"""아이템 수치 다중 출처 정규화·병합 (v4.17.0).

배경: 메이플랜드 현행 수치를 mapledb.kr 한 곳에서 긁어 왔는데 그 사이트는 2024년 이후 갱신이 멈췄다.
대신 운영 중인 공개 DB 들을 직접 가져와 출처별로 보관하고(item_source_stats), 상세 API 가 여기서 병합한다.

  override  data/mapleland_overrides.json — 운영자가 인게임에서 확인한 값 (최우선)
  matip     메팁 「옛날 메이플 데이터베이스」 JSON API (matip.kr/com/db/api.php) — 메랜 전용 보정(카오스 자쿰 투구 HP/MP%) 포함
  maplelog  로그지지 아이템 DB (maplelog.gg js/item_db*.js) — 수기 관리 custom 파일에 메랜 실측값 포함
  mapledb   mapledb.kr 2024 스냅샷(item_mapleland_stats) — 재수집하지 않는 고정 스냅샷. 값은 GMS v64 와 일치

병합 규칙(resolve): 옵션 키마다 "그 키를 다루는 출처 중 PRIORITY 가 앞선 것"의 값을 쓴다. 어떤 출처도 그 아이템을
모르면 원작(items.stats, GMS v92)으로 돌아간다. 출처끼리 값이 다르면 conflicts 에 전부 담아 툴팁 아래에 출처별로 보여준다
— 어느 쪽이 맞는지는 인게임 확인 후 override 로 확정하는 운영 흐름.
"""
from __future__ import annotations

import json
from typing import Any

JOB_BITS: tuple[tuple[str, int], ...] = (("전사", 1), ("마법사", 2), ("궁수", 4), ("도적", 8), ("해적", 16))
JOB_NAMES = tuple(n for n, _ in JOB_BITS)
STAT_KEYS: tuple[str, ...] = (
    "incSTR", "incDEX", "incINT", "incLUK", "incMHP", "incMMP", "incMHPr", "incMMPr",
    "incPAD", "incMAD", "incPDD", "incMDD", "incACC", "incEVA", "incSpeed", "incJump",
)
REQ_KEYS: tuple[str, ...] = ("STR", "DEX", "INT", "LUK", "POP")
MAPLEDB_LABEL_TO_KEY: dict[str, str] = {
    "물리방어력": "incPDD", "마법방어력": "incMDD", "물리공격력": "incPAD", "마법공격력": "incMAD",
    "STR": "incSTR", "DEX": "incDEX", "INT": "incINT", "LUK": "incLUK",
    "최대체력": "incMHP", "최대마나": "incMMP", "명중률": "incACC", "회피율": "incEVA",
    "이동속도": "incSpeed", "점프력": "incJump",
}
MAPLEDB_KEYS = frozenset(MAPLEDB_LABEL_TO_KEY.values())

SOURCES: dict[str, dict[str, Any]] = {
    "override": {"label": "운영자 인게임 확인", "short": "인게임 확인", "url": None, "covers": None},
    "matip": {"label": "메팁 옛날 메이플 DB", "short": "메팁", "url": "https://matip.kr/com/db?item={id}", "covers": None},
    "maplelog": {"label": "로그지지 아이템 DB", "short": "로그지지", "url": "https://maplelog.gg/#item/{id}", "covers": None},
    "mapledb": {"label": "mapledb.kr 2024 스냅샷", "short": "mapledb", "url": "https://mapledb.kr/search.php?q={id}&t=item", "covers": MAPLEDB_KEYS},
}
PRIORITY: tuple[str, ...] = ("override", "matip", "maplelog", "mapledb")
ORIGINAL = "gms92"
# 메팁 subcategory 는 무기 전체가 "무기", 장신구 전체가 "장신구"라 인게임 '장비분류'로 쓰기엔 거칠다
_COARSE_SUBCATEGORY = {"무기", "장신구", "캐시 아이템"}


def _int(v: Any) -> int | None:
    try:
        if v is None or v == "":
            return None
        return int(float(v))
    except (TypeError, ValueError):
        return None


def jobs_from_bits(req_job: Any) -> list[str] | None:
    """reqJob 비트마스크(1 전사 · 2 마법사 · 4 궁수 · 8 도적 · 16 해적) → 착용 직업 목록. 0/None/전부 → None(공용)."""
    bits = _int(req_job)
    if not bits or bits < 0:
        return None
    jobs = [name for name, bit in JOB_BITS if bits & bit]
    return jobs if 0 < len(jobs) < len(JOB_BITS) else None


def jobs_from_text(text: Any) -> list[str] | None:
    """"전사,도적" · "전사/도적" · "공용" · "not" · "" → 목록 또는 None(공용/해당 없음)."""
    if not text or not isinstance(text, str):
        return None
    norm = text.replace("법사", "마법사").replace("마마법사", "마법사")
    if "공용" in norm or norm.strip().lower() in {"not", "all", "beginner"}:
        return None
    jobs = [j for j in (p.strip() for p in norm.replace("/", ",").replace("·", ",").split(",")) if j in JOB_NAMES]
    return jobs if 0 < len(jobs) < len(JOB_BITS) else None


def bits_from_jobs(jobs: list[str] | None) -> int | None:
    if not jobs:
        return None
    return sum(bit for name, bit in JOB_BITS if name in jobs)


def _record(**kw: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "name_kr": None, "level": None, "jobs": None, "req_job": None, "gender": None,
        "category": None, "subcategory": None, "req": {}, "stats": {}, "ranges": {},
        "price": None, "attack_speed": None, "tuc": None, "description": None, "note": None, "source_url": None,
    }
    base.update({k: v for k, v in kw.items() if v is not None or k in ("stats", "req")})
    return base


def _stats_from_inc(d: dict[str, Any]) -> dict[str, int]:
    out: dict[str, int] = {}
    for k in STAT_KEYS:
        v = _int(d.get(k))
        if v:
            out[k] = v
    return out


def _req_from_inc(d: dict[str, Any]) -> dict[str, int]:
    return {k: (_int(d.get(f"req{k}")) or 0) for k in REQ_KEYS}


# ── 출처별 정규화 ────────────────────────────────────────────────────────────

def normalize_matip(item: dict[str, Any]) -> dict[str, Any] | None:
    """matip api.php?action=item_list|item_detail 의 item 객체 → 공통 레코드."""
    info = item.get("equipment_info") or {}
    iid = _int(item.get("id"))
    if iid is None:
        return None
    is_equip = item.get("category") == "equip"
    if is_equip and not _stats_from_inc(info) and _int(info.get("tuc")) is None:
        return None  # 캐시 장비 등 수치가 없는 행 → 출처로 치지 않는다
    sub = item.get("subcategory_name") or None
    rec = _record(
        name_kr=item.get("name") or None,
        level=_int(info.get("reqLevel")) if is_equip else None,
        jobs=jobs_from_bits(info.get("reqJob")) if is_equip else None,
        req_job=_int(info.get("reqJob")) if is_equip else None,
        category=item.get("category_name") or None,
        subcategory=None if (sub in _COARSE_SUBCATEGORY) else sub,
        req=_req_from_inc(info) if is_equip else {},
        stats=_stats_from_inc(info),
        price=_int(info.get("price")),
        attack_speed=(str(_int(info.get("attackSpeed"))) if _int(info.get("attackSpeed")) else None),
        tuc=_int(info.get("tuc")),
        description=(item.get("desc") or None),
        source_url=SOURCES["matip"]["url"].format(id=iid),
    )
    rec["id"] = iid
    return rec


def normalize_maplelog(row: dict[str, Any]) -> dict[str, Any] | None:
    """maplelog item_db*.js 한 행 {"id","kr","en","lv","stats","comment"} → 공통 레코드."""
    iid = _int(row.get("id"))
    if iid is None:
        return None
    st = row.get("stats") or {}
    is_equip = 1000000 <= iid < 2000000
    if is_equip and not any(k.startswith(("inc", "req")) and k != "reqJob" or k == "tuc" for k in st):
        return None  # 로그지지 행에 이름만 있고 수치가 없음 ([1402000,"양손검","Two-handed Sword",20] 또는 {reqJob:0}) → 출처로 치지 않는다
    speed = _int(st.get("attackSpeed"))
    rec = _record(
        name_kr=row.get("kr") or None,
        level=_int(st.get("reqLevel")) if st.get("reqLevel") is not None else _int(row.get("lv")),
        jobs=jobs_from_bits(st.get("reqJob")) if is_equip and st.get("reqJob") is not None else None,
        req_job=_int(st.get("reqJob")) if is_equip else None,
        req=_req_from_inc(st) if is_equip else {},
        stats=_stats_from_inc(st),
        price=_int(st.get("price")),
        attack_speed=str(speed) if speed else None,
        tuc=_int(st.get("tuc")),
        note=(row.get("comment") or None),
        source_url=SOURCES["maplelog"]["url"].format(id=iid),
    )
    rec["id"] = iid
    return rec


def normalize_mapledb(row: dict[str, Any]) -> dict[str, Any] | None:
    """item_mapleland_stats 행(dict) → 공통 레코드. 한글 라벨 옵션을 inc 키로 바꾸고 범위는 ranges 에 둔다."""
    iid = _int(row.get("item_id"))
    if iid is None:
        return None
    try:
        raw = json.loads(row.get("stats_json") or "{}")
    except (TypeError, ValueError):
        raw = {}
    try:
        req = json.loads(row.get("req_json") or "{}")
    except (TypeError, ValueError):
        req = {}
    stats: dict[str, int] = {}
    ranges: dict[str, dict[str, int | None]] = {}
    for label, v in raw.items():
        key = MAPLEDB_LABEL_TO_KEY.get(label)
        if not key or not isinstance(v, dict):
            continue
        base = _int(v.get("base"))
        if base:
            stats[key] = base
            if v.get("min") is not None and v.get("max") is not None and v.get("min") != v.get("max"):
                ranges[key] = {"min": _int(v.get("min")), "max": _int(v.get("max"))}
    jobs_text = row.get("jobs")
    jobs = jobs_from_text(jobs_text)
    rec = _record(
        name_kr=row.get("name_kr"),
        level=_int(row.get("level")) if jobs_text != "not" else None,
        jobs=jobs,
        req_job=bits_from_jobs(jobs),
        gender=row.get("gender"),
        category=row.get("category"),
        subcategory=row.get("subcategory"),
        req={k: (_int(req.get(k)) or 0) for k in REQ_KEYS} if jobs_text != "not" else {},
        stats=stats,
        ranges=ranges,
        price=_int(row.get("price")),
        attack_speed=(str(row.get("attack_speed")).strip() or None) if row.get("attack_speed") else None,
        description=row.get("description"),
        source_url=row.get("source_url") or SOURCES["mapledb"]["url"].format(id=iid),
    )
    rec["id"] = iid
    return rec


def normalize_override(item_id: int, entry: dict[str, Any]) -> dict[str, Any] | None:
    """data/mapleland_overrides.json items[id] → 레코드. stats 가 있을 때만 수치 출처가 된다(없으면 메모만)."""
    if not isinstance(entry, dict):
        return None
    stats_raw = entry.get("stats")
    if not isinstance(stats_raw, dict):
        return None
    jobs = jobs_from_text(entry.get("job_req"))
    rec = _record(
        level=_int(entry.get("level_req")),
        jobs=jobs,
        req_job=bits_from_jobs(jobs),
        req=_req_from_inc(stats_raw) if any(f"req{k}" in stats_raw for k in REQ_KEYS) else {},
        stats=_stats_from_inc(stats_raw),
        price=_int(entry.get("price")),
        attack_speed=(str(entry.get("attack_speed")) if entry.get("attack_speed") else None),
        tuc=_int(entry.get("upgrade_slots")),
        description=entry.get("description"),
        note=entry.get("source_note"),
    )
    rec["id"] = item_id
    return rec


# ── 병합 ────────────────────────────────────────────────────────────────────

def _covers(source: str, key: str) -> bool:
    covers = SOURCES.get(source, {}).get("covers")
    return covers is None or key in covers


def _has_stat_data(rec: dict[str, Any]) -> bool:
    if rec.get("stats"):
        return True
    iid = _int(rec.get("id"))
    is_equip = iid is not None and 1000000 <= iid < 2000000
    return is_equip and (rec.get("tuc") is not None or bool(rec.get("req")))


def _first(records: dict[str, dict[str, Any]], field: str, order: tuple[str, ...] = PRIORITY) -> Any:
    for src in order:
        rec = records.get(src)
        if rec is None:
            continue
        v = rec.get(field)
        if v not in (None, "", {}, []):
            return v
    return None


def resolve(records: dict[str, dict[str, Any]], original_stats: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """출처별 레코드 → 툴팁용 병합 결과. 레코드가 하나도 없으면 None."""
    records = {s: r for s, r in records.items() if r and s in SOURCES}
    if not records:
        return None
    original = {k: v for k, v in (original_stats or {}).items() if k in STAT_KEYS and _int(v)}
    present = [s for s in PRIORITY if s in records]
    # 옵션 비교에 참여하는 출처: 옵션을 하나라도 줬거나, 장비인데 업횟·요구 스탯을 준 출처(= 옵션이 정말 없다는 뜻).
    # 소비 아이템(주문서)처럼 출처가 옵션 정보를 아예 다루지 않으면 이름·가격·설명에만 쓰고 "없음" 으로 세지 않는다.
    stat_sources = [s for s in present if _has_stat_data(records[s])]

    stats: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    for key in STAT_KEYS:
        cands = [(s, records[s]["stats"].get(key, 0) or 0) for s in stat_sources if _covers(s, key)]
        if not cands:
            v = _int(original.get(key)) or 0
            if v:
                stats.append({"key": key, "value": v, "source": ORIGINAL, "min": None, "max": None, "conflict": False})
            continue
        src, value = cands[0]
        distinct = {v for _, v in cands}
        conflict = len(distinct) > 1
        if conflict:
            conflicts.append({"key": key, "values": {s: v for s, v in cands}})
        if value:
            rng = None
            for s in present:
                r = records[s].get("ranges", {}).get(key)
                if r and records[s]["stats"].get(key) == value:
                    rng = r
                    break
            stats.append({"key": key, "value": value, "source": src,
                          "min": rng["min"] if rng else None, "max": rng["max"] if rng else None, "conflict": conflict})

    resolved_map = {s["key"]: s["value"] for s in stats}
    diff = []
    for key in STAT_KEYS:
        a = resolved_map.get(key, 0)
        b = _int(original.get(key)) or 0
        if a != b:
            diff.append({"key": key, "mapleland": a, "original": b})

    req = _first(records, "req") or {}
    level = _first(records, "level")
    jobs_src = next((s for s in present if records[s].get("req_job") is not None or records[s].get("jobs")), None)
    jobs = records[jobs_src]["jobs"] if jobs_src else None
    jobs_known = jobs_src is not None
    job_conflict = None
    job_vals = {s: records[s].get("jobs") for s in present if records[s].get("req_job") is not None}
    if len({json.dumps(v, ensure_ascii=False) for v in job_vals.values()}) > 1:
        job_conflict = job_vals
    level_vals = {s: records[s].get("level") for s in present if records[s].get("level") is not None}
    level_conflict = level_vals if len(set(level_vals.values())) > 1 else None

    return {
        "primary": present[0],
        "sources_used": present,
        "name_kr": _first(records, "name_kr"),
        "level": level,
        "jobs": jobs,
        "jobs_known": jobs_known,
        "gender": _first(records, "gender"),
        "category": _first(records, "category"),
        "subcategory": _first(records, "subcategory", ("mapledb", "override", "matip", "maplelog")),
        "req": {k: (_int(req.get(k)) or 0) for k in REQ_KEYS} if req else {},
        "stats": stats,
        "price": _first(records, "price"),
        "attack_speed": _first(records, "attack_speed"),
        "tuc": _first(records, "tuc"),
        "description": _first(records, "description"),
        "conflicts": conflicts,
        "level_conflict": level_conflict,
        "job_conflict": job_conflict,
        "diff": diff,
        "notes": {s: records[s]["note"] for s in present if records[s].get("note")},
        "source_meta": {s: {"label": SOURCES[s]["label"], "short": SOURCES[s]["short"], "url": records[s].get("source_url")} for s in present},
    }


def load_source_records(conn, item_id: int) -> dict[str, dict[str, Any]]:
    """item_source_stats 에서 한 아이템의 출처별 레코드를 읽는다 (API 용)."""
    out: dict[str, dict[str, Any]] = {}
    try:
        rows = conn.execute("SELECT * FROM item_source_stats WHERE item_id = ?", (item_id,)).fetchall()
    except Exception:
        return out
    for row in rows:
        r = dict(row)
        try:
            stats = json.loads(r.get("stats_json") or "{}")
            req = json.loads(r.get("req_json") or "{}")
            ranges = json.loads(r.get("ranges_json") or "{}")
        except (TypeError, ValueError):
            continue
        out[r["source"]] = _record(
            name_kr=r.get("name_kr"), level=r.get("level"), jobs=jobs_from_text(r.get("jobs")), req_job=r.get("req_job"),
            gender=r.get("gender"), category=r.get("category"), subcategory=r.get("subcategory"),
            req=req, stats={k: int(v) for k, v in stats.items() if k in STAT_KEYS and _int(v)}, ranges=ranges,
            price=r.get("price"), attack_speed=r.get("attack_speed"), tuc=r.get("tuc"),
            description=r.get("description"), note=r.get("note"), source_url=r.get("source_url"),
        )
        out[r["source"]]["fetched_at"] = r.get("fetched_at")
        out[r["source"]]["id"] = r["item_id"]
    return out


def record_to_row(source: str, rec: dict[str, Any], fetched_at: str) -> tuple:
    """레코드 → item_source_stats INSERT 튜플 (컬럼 순서는 SOURCE_STATS_COLUMNS)."""
    return (
        rec["id"], source, rec.get("name_kr"), rec.get("level"),
        ",".join(rec["jobs"]) if rec.get("jobs") else ("공용" if rec.get("req_job") == 0 else None),
        rec.get("req_job"), rec.get("gender"), rec.get("category"), rec.get("subcategory"),
        json.dumps(rec.get("req") or {}, ensure_ascii=False), json.dumps(rec.get("stats") or {}, ensure_ascii=False),
        json.dumps(rec.get("ranges") or {}, ensure_ascii=False), rec.get("price"), rec.get("attack_speed"), rec.get("tuc"),
        rec.get("description"), rec.get("note"), rec.get("source_url"), fetched_at,
    )


SOURCE_STATS_COLUMNS = (
    "item_id", "source", "name_kr", "level", "jobs", "req_job", "gender", "category", "subcategory",
    "req_json", "stats_json", "ranges_json", "price", "attack_speed", "tuc", "description", "note", "source_url", "fetched_at",
)
