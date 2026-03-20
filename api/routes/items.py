"""Item routes"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from crawler.db import get_connection

router = APIRouter()


@router.get("/items/filters")
def item_filters():
    try:
        conn = get_connection()
    except Exception:
        return {"categories": [], "subcategories": [], "jobs": []}
    try:
        cats = conn.execute(
            "SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND category != '' ORDER BY category"
        ).fetchall()
        subcats = conn.execute(
            "SELECT DISTINCT subcategory FROM items WHERE subcategory IS NOT NULL AND subcategory != '' ORDER BY subcategory"
        ).fetchall()
        jobs = conn.execute(
            "SELECT DISTINCT job_req FROM items WHERE job_req IS NOT NULL AND job_req != '' ORDER BY job_req"
        ).fetchall()
        return {
            "categories": [r["category"] for r in cats],
            "subcategories": [r["subcategory"] for r in subcats],
            "jobs": [r["job_req"] for r in jobs],
        }
    finally:
        conn.close()


@router.get("/items/categories")
def list_item_categories():
    """아이템 카테고리 목록 반환."""
    try:
        conn = get_connection()
    except Exception:
        return {"categories": []}
    try:
        rows = conn.execute(
            "SELECT category, COUNT(*) as count FROM items WHERE category IS NOT NULL AND category != '' GROUP BY category ORDER BY count DESC"
        ).fetchall()
        return {"categories": [{"name": r["category"], "count": r["count"]} for r in rows]}
    finally:
        conn.close()


@router.get("/items")
def list_items(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    category: Optional[str] = Query(default=None),
    subcategory: Optional[str] = Query(default=None),
    level_min: Optional[int] = Query(default=None, ge=0),
    level_max: Optional[int] = Query(default=None, ge=0),
    job: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    sort: Optional[str] = Query(default=None),
):
    offset = (page - 1) * per_page
    conditions = []
    params: list = []

    if category:
        if "," in category:
            cats = [c.strip() for c in category.split(",") if c.strip()]
            placeholders = ",".join("?" * len(cats))
            conditions.append(f"category IN ({placeholders})")
            params.extend(cats)
        else:
            conditions.append("category = ?")
            params.append(category)
    if subcategory:
        conditions.append("subcategory = ?")
        params.append(subcategory)
    if level_min is not None:
        conditions.append("level_req >= ?")
        params.append(level_min)
    if level_max is not None:
        conditions.append("level_req <= ?")
        params.append(level_max)
    if job:
        conditions.append("job_req LIKE ?")
        params.append(f"%{job}%")
    if q:
        conditions.append(
            "(name LIKE ? OR id IN (SELECT entity_id FROM entity_names_en WHERE entity_type='item' AND name_en LIKE ?))"
        )
        params.append(f"%{q}%")
        params.append(f"%{q}%")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    try:
        conn = get_connection()
    except Exception:
        return {"items": [], "total": 0, "page": page, "per_page": per_page}

    try:
        total = conn.execute(f"SELECT COUNT(*) FROM items {where}", params).fetchone()[0]
        valid_sorts = {
            "level_asc": "level_req ASC",
            "level_desc": "level_req DESC",
            "name_asc": "name ASC",
            "name_desc": "name DESC",
        }
        order = valid_sorts.get(sort or "", "id")
        rows = conn.execute(
            f"SELECT * FROM items {where} ORDER BY {order} LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        results = []
        for row in rows:
            item = dict(row)
            kr = conn.execute(
                "SELECT name_en FROM entity_names_en WHERE entity_type='item' AND entity_id=? AND source='kms'",
                (item["id"],),
            ).fetchone()
            item["name_kr"] = kr["name_en"] if kr else None
            results.append(item)
    except Exception:
        results = []
        total = 0
    finally:
        conn.close()

    return {"items": results, "total": total, "page": page, "per_page": per_page}


@router.get("/items/{item_id}")
def get_item(item_id: int):
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Item not found")

        item = dict(row)

        # 영문명
        en_rows = conn.execute(
            "SELECT name_en, source FROM entity_names_en WHERE entity_type = 'item' AND entity_id = ?",
            (item_id,),
        ).fetchall()
        item["names_en"] = [dict(r) for r in en_rows]

        # Mobs that drop this item
        drop_rows = conn.execute(
            """
            SELECT m.id as mob_id, m.name as mob_name, m.level, m.is_boss, md.drop_rate
            FROM mob_drops md
            JOIN mobs m ON m.id = md.mob_id
            WHERE md.item_id = ?
            ORDER BY m.level
            """,
            (item_id,),
        ).fetchall()
        dropped_by = [dict(r) for r in drop_rows]
    finally:
        conn.close()

    return {"item": item, "dropped_by": dropped_by}
