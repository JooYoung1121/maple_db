"""이세계 도감 API — 메이플랜드 레퍼런스에 '없는' 몹·아이템을 재미로 구경하는 페이지.

사이트 본편(목록/검색/퀴즈/오늘의몬스터)은 전부 레퍼런스 ID 필터를 통과한 것만 노출하고,
여기는 정확히 그 여집합(KMS 한글명은 있으나 메이플랜드에 없는 것)만 보여준다.
퀴즈·게임 풀과는 구조적으로 격리된다(그쪽은 레퍼런스 필터 기반).
"""
from fastapi import APIRouter, Query

from api.routes.mapleland_reference import mapleland_ids
from crawler.db import get_connection

router = APIRouter()


def _not_in_sql(column: str, kind: str) -> str:
    ids = mapleland_ids(kind)
    if not ids:
        return "1=0"  # 레퍼런스가 없으면 여집합 개념이 성립하지 않음 — 아무것도 노출 안 함
    return f"{column} NOT IN ({','.join(str(i) for i in ids)})"


@router.get("/museum")
def museum_list(
    type: str = Query(default="mob", pattern="^(mob|item)$"),
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=40, ge=1, le=100),
):
    conn = get_connection()
    try:
        like = f"%{q.strip()}%" if q.strip() else None
        if type == "mob":
            where = [
                "en.name_en IS NOT NULL",
                "m.id < 9000000",
                "COALESCE(m.is_hidden, 0) = 0",
                # 전투 내부용 더미(소환 트리거·투명몹)는 도감 대상 아님
                "en.name_en NOT LIKE '%소환%'",
                "en.name_en NOT LIKE '%투명%'",
                _not_in_sql("m.id", "mobs"),
            ]
            params: list = []
            if like:
                where.append("(en.name_en LIKE ? OR m.name LIKE ?)")
                params += [like, like]
            base = f"""
                FROM mobs m
                JOIN entity_names_en en ON en.entity_type='mob' AND en.entity_id=m.id AND en.source='kms'
                WHERE {' AND '.join(where)}
            """
            total = conn.execute(f"SELECT COUNT(*) {base}", params).fetchone()[0]
            rows = conn.execute(
                f"""SELECT m.id, en.name_en AS name_kr, m.name, m.level, m.hp, m.exp, m.is_boss
                    {base} ORDER BY m.level, m.id LIMIT ? OFFSET ?""",
                params + [per_page, (page - 1) * per_page],
            ).fetchall()
        else:
            where = [
                "en.name_en IS NOT NULL",
                "COALESCE(i.is_hidden, 0) = 0",
                _not_in_sql("i.id", "items"),
            ]
            params = []
            if like:
                where.append("(en.name_en LIKE ? OR i.name LIKE ?)")
                params += [like, like]
            base = f"""
                FROM items i
                JOIN entity_names_en en ON en.entity_type='item' AND en.entity_id=i.id AND en.source='kms'
                WHERE {' AND '.join(where)}
            """
            total = conn.execute(f"SELECT COUNT(*) {base}", params).fetchone()[0]
            rows = conn.execute(
                f"""SELECT i.id, en.name_en AS name_kr, i.name, i.category, i.subcategory, i.level_req
                    {base} ORDER BY i.subcategory, i.id LIMIT ? OFFSET ?""",
                params + [per_page, (page - 1) * per_page],
            ).fetchall()
        return {
            "entries": [dict(r) for r in rows],
            "total": total,
            "page": page,
            "per_page": per_page,
        }
    finally:
        conn.close()
