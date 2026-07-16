"""MapleLand reference helpers for public data filters."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
COMBINED_PATH = DATA_DIR / "mapleland_reference.json"

ENTITY_TO_KIND = {
    "item": "items",
    "mob": "mobs",
    "map": "maps",
    "npc": "npcs",
    "quest": "quests",
}


@lru_cache(maxsize=1)
def _reference() -> dict:
    try:
        return json.loads(COMBINED_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"entities": {}}


@lru_cache(maxsize=None)
def mapleland_ids(kind: str) -> tuple[int, ...]:
    records = _reference().get("entities", {}).get(kind, {}).get("records", [])
    ids = []
    for row in records:
        try:
            ids.append(int(row["id"]))
        except Exception:
            continue
    return tuple(sorted(set(ids)))


@lru_cache(maxsize=None)
def mapleland_names(kind: str) -> tuple[str, ...]:
    records = _reference().get("entities", {}).get(kind, {}).get("records", [])
    names = []
    for row in records:
        name = str(row.get("name_kr") or "").strip()
        if name:
            names.append(name)
    return tuple(sorted(set(names)))


@lru_cache(maxsize=None)
def mapleland_name_kr_map(kind: str) -> dict[int, str]:
    records = _reference().get("entities", {}).get(kind, {}).get("records", [])
    out: dict[int, str] = {}
    for row in records:
        try:
            name = str(row.get("name_kr") or "").strip()
            if name:
                out[int(row["id"])] = name
        except Exception:
            continue
    return out


def id_filter_sql(column: str, kind: str) -> str | None:
    ids = mapleland_ids(kind)
    if not ids:
        return None
    return f"{column} IN ({','.join(str(item_id) for item_id in ids)})"


def require_mapleland_id(item_id: int, kind: str) -> bool:
    ids = mapleland_ids(kind)
    return not ids or int(item_id) in ids


def search_entity_filter_sql(entity_column: str, id_column: str) -> str | None:
    clauses = []
    for entity_type, kind in ENTITY_TO_KIND.items():
        if entity_type == "quest":
            continue
        entity_filter = id_filter_sql(id_column, kind)
        if entity_filter:
            clauses.append(f"({entity_column} = '{entity_type}' AND {entity_filter})")
        else:
            clauses.append(f"{entity_column} = '{entity_type}'")
    clauses.append(f"{entity_column} NOT IN ('item','mob','map','npc')")
    return "(" + " OR ".join(clauses) + ")"
