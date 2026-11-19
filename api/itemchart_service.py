"""Read one public Itemchart search result; never poll or execute page scripts.

The upstream Next.js HTML/option format was inspected on 2026-11-19.
This is a page adapter, not a supported public API. Fail closed on format changes.
"""
import json
import re
from html.parser import HTMLParser


class ItemchartFormatError(ValueError):
    pass


class _FlightParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.in_script = False
        self.current = []
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            self.in_script = True
            self.current = []

    def handle_data(self, data):
        if self.in_script:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag != "script" or not self.in_script:
            return
        self.in_script = False
        script = "".join(self.current).strip()
        prefix = "self.__next_f.push("
        if not script.startswith(prefix):
            return
        try:
            value = json.loads(script[len(prefix):].rstrip(";").removesuffix(")"))
        except ValueError:
            return
        if isinstance(value, list) and len(value) == 2 and value[0] == 1 and isinstance(value[1], str):
            self.parts.append(value[1])


def _objects(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from _objects(child)


def extract_rows(html: str, kind: str) -> tuple[list[dict], int | None]:
    parser = _FlightParser()
    parser.feed(html)
    # A JSON record may be split across several push calls. Join before decoding.
    for line in "".join(parser.parts).splitlines():
        _, sep, payload = line.partition(":")
        if not sep:
            continue
        try:
            value = json.loads(payload)
        except ValueError:
            continue
        for obj in _objects(value):
            key = "rows" if kind == "active" else "initialRows"
            matches = obj.get("kind") == "active" if kind == "active" else "initialNow" in obj and "query" in obj
            if not matches or key not in obj:
                continue
            rows = obj[key]
            if not isinstance(rows, list) or len(rows) > 100 or not all(isinstance(row, dict) for row in rows):
                raise ItemchartFormatError("Unexpected search rows")
            return rows, obj.get("now" if kind == "active" else "initialNow")
    raise ItemchartFormatError("Search result missing from page")


# Raw equipment slots and gem effects, validated against the public display decoder.
STAT_KEYS = (
    "strength", "dexterity", "intelligence", "luck", "hp", "mp", "attack",
    "magicAttack", "physicalDefense", "magicDefense", "accuracy", "avoidability",
    "speed", "craft", "jump",
)
_GEM_KEYS = (
    "attack", "magicAttack", "accuracy", "avoidability", "speed", "jump", "hp", "mp",
    "strength", "intelligence", "luck", "dexterity", "requiredLevelAdjustment",
)
_GEM_AMOUNTS = {
    6000: (1, 1, 1, 1, 1, 1, 10, 10, 1, 1, 1, 1, -1),
    16000: (2, 2, 3, 3, 3, 2, 20, 20, 3, 3, 3, 3, -2),
    26000: (3, 3, 5, 5, 5, 3, 30, 30, 5, 5, 5, 5, -3),
}
GEMS = {base + index: (key, amounts[index]) for base, amounts in _GEM_AMOUNTS.items()
        for index, key in enumerate(_GEM_KEYS)}


def _integer(value):
    return type(value) is int and abs(value) <= 2**53 - 1


def decode_options(options, equipment: bool | None) -> dict:
    result = {"stats": {}, "upgradeCount": None, "remainingUpgrades": None,
              "gemApplied": None, "gems": [], "complete": False, "status": "unknown",
              "requiredLevelAdjustment": None}
    if equipment is False:
        return {**result, "status": "not_equipment", "complete": True}
    if not isinstance(options, dict):
        return result
    raw = options.get("raw")
    raw_valid = isinstance(raw, list) and len(raw) == 30 and all(_integer(v) for v in raw)
    raw_codes = [v for v in raw[27:] if v] if raw_valid else None
    additional = options.get("rawAdditional")
    extra = additional[1] if isinstance(additional, list) and len(additional) > 1 else None
    extra_valid = isinstance(extra, list) and all(_integer(v) for v in extra)
    extra_codes = [v for v in extra if v] if extra_valid else None
    mismatch = (extra is not None and extra != 0 and not extra_valid)
    if extra_codes is not None and raw_codes is not None:
        mismatch = mismatch or sorted(extra_codes) != sorted(raw_codes)
    normalized = options.get("normalized")
    normalized = normalized if isinstance(normalized, dict) else None
    codes = extra_codes if extra_codes is not None else raw_codes
    if normalized is not None:
        declared = normalized.get("gemCodes")
        if isinstance(declared, list) and all(_integer(v) for v in declared):
            declared = [v for v in declared if v]
            mismatch = mismatch or codes is not None and sorted(declared) != sorted(codes)
            codes = declared
    codes_known = codes is not None
    codes = codes or []
    known_effects = all(code in GEMS for code in codes)
    result["gemApplied"] = True if codes else (False if codes_known and not mismatch else None)
    if normalized is not None and type(normalized.get("gemApplied")) is bool:
        if codes and not normalized["gemApplied"]:
            mismatch = True
        result["gemApplied"] = normalized["gemApplied"] if not codes else True
        if normalized["gemApplied"] and not codes:
            mismatch = True
    result["gems"] = [{"code": code, "stat": GEMS[code][0] if code in GEMS else None,
                       "amount": GEMS[code][1] if code in GEMS else None} for code in codes]
    complete = codes_known and not mismatch and known_effects
    if normalized is not None:
        if normalized.get("verification") == "unmapped":
            return result
        result["status"] = "checked" if normalized.get("verification") == "checked" else "inferred"
        for key in ("upgradeCount", "remainingUpgrades", "requiredLevelAdjustment"):
            result[key] = normalized.get(key) if _integer(normalized.get(key)) else None
        # Normalized values already include gems. Never add gem effects twice.
        if complete:
            result["stats"] = {k: normalized[k] for k in STAT_KEYS if _integer(normalized.get(k))}
    elif raw_valid and equipment is True and raw[0] >= 0 and raw[1] >= 0:
        result.update(status="inferred", upgradeCount=raw[1], remainingUpgrades=raw[0], requiredLevelAdjustment=0)
        if complete:
            result["stats"] = dict(zip(STAT_KEYS, raw[2:17]))
            for code in codes:
                key, amount = GEMS[code]
                if key == "requiredLevelAdjustment":
                    result[key] += amount
                else:
                    result["stats"][key] += amount
    else:
        return result
    result["complete"] = complete
    return result


def _decimal(value):
    text = str(value)
    if not re.fullmatch(r"\d{1,19}", text):
        raise ItemchartFormatError("Invalid price or quantity")
    return text


def normalize_row(row: dict, kind: str) -> dict:
    item = row.get("item")
    if not isinstance(item, dict) or not isinstance(item.get("name"), str) or not _integer(row.get("itemId")):
        raise ItemchartFormatError("Missing item identity")
    category = item.get("itemCategory")
    equipment = (category.get("top") in ("무기", "방어구")
                 if item.get("categoryVerified") is True and isinstance(category, dict) else None)
    return {"id": str(row.get("id", "")), "itemId": row["itemId"], "name": item["name"],
            "unitPrice": _decimal(row.get("unitPrice")), "quantity": _decimal(row.get("quantity")),
            "soldAt": row.get("soldAt") if kind == "sold" else None,
            "expiresAt": row.get("expiresAt") if kind == "active" else None,
            "options": decode_options(row.get("displayOptions" if kind == "active" else "options"), equipment)}
