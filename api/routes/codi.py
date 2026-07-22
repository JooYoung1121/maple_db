"""코디 시뮬레이터 — 파트(헤어/성형/장비) 검색

헤어·성형은 게임 데이터 전체(코디 미리보기 용도라 메랜 레퍼런스 필터 미적용),
장비는 메랜 레퍼런스 필터 적용(실제 획득 가능한 것만).
"""
from fastapi import APIRouter, Query, HTTPException

from crawler.db import get_connection
from api.routes.mapleland_reference import id_filter_sql

router = APIRouter()

# type → (category, subcategory 목록, 레퍼런스 필터 적용 여부)
PART_TYPES: dict[str, tuple[str, tuple[str, ...], bool]] = {
    "hair": ("Character", ("Hair",), False),
    "face": ("Character", ("Face",), False),
    "hat": ("Armor", ("Hat",), True),
    "overall": ("Armor", ("Overall",), True),
    "top": ("Armor", ("Top",), True),
    "bottom": ("Armor", ("Bottom",), True),
    "shoes": ("Armor", ("Shoes",), True),
    "glove": ("Armor", ("Glove",), True),
    "cape": ("Armor", ("Cape",), True),
    "shield": ("Armor", ("Shield",), True),
    "weapon": ("WEAPON", (), True),  # 특수 처리: 한손+두손 무기
}


@router.get("/codi/parts")
def codi_parts(
    type: str = Query(...),
    q: str | None = Query(default=None, max_length=50),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=60, ge=1, le=120),
):
    if type not in PART_TYPES:
        raise HTTPException(status_code=400, detail=f"type은 {', '.join(PART_TYPES)} 중 하나")
    category, subs, use_ref = PART_TYPES[type]

    conditions = ["i.icon_url IS NOT NULL"]
    params: list = []
    if category == "WEAPON":
        conditions.append("i.category IN ('One-Handed Weapon', 'Two-Handed Weapon')")
    else:
        conditions.append("i.category = ?")
        params.append(category)
        if subs:
            ph = ",".join("?" for _ in subs)
            conditions.append(f"i.subcategory IN ({ph})")
            params.extend(subs)
    if use_ref:
        flt = id_filter_sql("i.id", "items")
        if flt:
            conditions.append(flt)
    if q and q.strip():
        conditions.append(
            "(i.name LIKE ? OR i.id IN (SELECT entity_id FROM entity_names_en"
            " WHERE entity_type='item' AND name_en LIKE ?))"
        )
        like = f"%{q.strip()}%"
        params.extend([like, like])

    where = "WHERE " + " AND ".join(conditions)
    offset = (page - 1) * per_page

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        total = conn.execute(f"SELECT COUNT(*) FROM items i {where}", params).fetchone()[0]
        rows = conn.execute(
            f"""SELECT i.id, i.name, i.icon_url, i.level_req,
                       (SELECT name_en FROM entity_names_en
                        WHERE entity_type='item' AND entity_id=i.id AND source='kms') AS name_kr
                FROM items i {where}
                ORDER BY COALESCE(
                    (SELECT name_en FROM entity_names_en
                     WHERE entity_type='item' AND entity_id=i.id AND source='kms'), i.name), i.id
                LIMIT ? OFFSET ?""",
            params + [per_page, offset],
        ).fetchall()
        parts = [
            {
                "id": r["id"],
                "name": (r["name_kr"] or r["name"] or "").strip(),
                "icon": r["icon_url"],
                "level": r["level_req"] or 0,
            }
            for r in rows
        ]
    finally:
        conn.close()
    return {"parts": parts, "total": total, "page": page, "per_page": per_page}
