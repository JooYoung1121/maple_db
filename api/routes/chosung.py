"""초성퀴즈 검색기 — 초성으로 메랜 DB 한글명(몹·아이템·맵·NPC) 검색.

풀은 사이트에 등재된 레퍼런스 이름(entity_names_en, source='kms')만 사용 —
외부 족보 데이터 없이 검증된 이름만 제공한다.
"""
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from crawler.db import get_connection
from api.routes.mapleland_reference import id_filter_sql

router = APIRouter()

CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ",
       "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]

ENTITY_TYPES = ["mob", "item", "map", "npc"]
TYPE_LABELS = {"mob": "몬스터", "item": "아이템", "map": "맵", "npc": "NPC"}

_cache: dict[str, object] = {"at": 0.0, "pool": None}
CACHE_TTL = 3600.0


def to_chosung(text: str) -> str:
    """한글 음절 → 초성열. 공백 제거, 비한글 문자는 그대로 유지."""
    out = []
    for ch in text:
        if ch == " ":
            continue
        code = ord(ch)
        if 0xAC00 <= code <= 0xD7A3:
            out.append(CHO[(code - 0xAC00) // 588])
        else:
            out.append(ch)
    return "".join(out)


def _load_pool() -> list[dict]:
    now = time.time()
    if _cache["pool"] is not None and now - float(_cache["at"]) < CACHE_TTL:
        return _cache["pool"]  # type: ignore[return-value]
    conn = get_connection()
    pool: list[dict] = []
    try:
        for etype in ENTITY_TYPES:
            table = {"mob": "mobs", "item": "items", "map": "maps", "npc": "npcs"}[etype]
            gate = id_filter_sql("entity_id", table)
            where = f"AND {gate}" if gate else ""
            rows = conn.execute(
                f"""SELECT DISTINCT entity_id, name_en FROM entity_names_en
                    WHERE entity_type = ? AND source = 'kms' AND name_en != '' {where}""",
                (etype,),
            ).fetchall()
            for r in rows:
                name = r["name_en"].strip()
                if not name or name == "없음":
                    continue
                pool.append({
                    "type": etype,
                    "id": r["entity_id"],
                    "name": name,
                    "chosung": to_chosung(name),
                    "len": len(name.replace(" ", "")),
                })
    finally:
        conn.close()
    _cache["pool"] = pool
    _cache["at"] = now
    return pool


@router.get("/chosung")
def search_chosung(
    q: str = Query(..., min_length=1, max_length=20, description="초성 (예: ㅍㄹㄷ)"),
    type: Optional[str] = Query(default=None, description="mob|item|map|npc"),
    mode: str = Query(default="exact", description="exact(글자수 일치) | prefix(앞부분 일치)"),
):
    query = q.replace(" ", "")
    if not query:
        raise HTTPException(status_code=400, detail="초성을 입력하세요")
    if type and type not in ENTITY_TYPES:
        raise HTTPException(status_code=400, detail="type은 mob|item|map|npc")
    pool = _load_pool()
    results = []
    for entry in pool:
        if type and entry["type"] != type:
            continue
        if mode == "prefix":
            if entry["chosung"].startswith(query):
                results.append(entry)
        else:
            if entry["chosung"] == query:
                results.append(entry)
    results.sort(key=lambda e: (e["len"], e["name"]))
    return {
        "q": query,
        "mode": mode,
        "total": len(results),
        "results": [
            {"type": e["type"], "type_label": TYPE_LABELS[e["type"]], "id": e["id"], "name": e["name"]}
            for e in results[:200]
        ],
    }
