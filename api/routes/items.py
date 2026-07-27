"""Item routes"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from crawler.db import get_connection
from api.routes.mapleland_reference import id_filter_sql, require_mapleland_id

router = APIRouter()


@router.get("/items/filters")
def item_filters():
    try:
        conn = get_connection()
    except Exception:
        return {"categories": [], "subcategories": [], "jobs": []}
    try:
        mapleland_filter = id_filter_sql("id", "items")
        where = f"WHERE {mapleland_filter}" if mapleland_filter else ""
        prefix = f"{where} AND" if where else "WHERE"
        cats = conn.execute(
            f"SELECT DISTINCT category FROM items {prefix} category IS NOT NULL AND category != '' ORDER BY category"
        ).fetchall()
        subcats = conn.execute(
            f"SELECT DISTINCT subcategory FROM items {prefix} subcategory IS NOT NULL AND subcategory != '' ORDER BY subcategory"
        ).fetchall()
        jobs = conn.execute(
            f"SELECT DISTINCT job_req FROM items {prefix} job_req IS NOT NULL AND job_req != '' ORDER BY job_req"
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
        mapleland_filter = id_filter_sql("id", "items")
        conditions = ["category IS NOT NULL", "category != ''"]
        if mapleland_filter:
            conditions.insert(0, mapleland_filter)
        rows = conn.execute(
            f"SELECT category, COUNT(*) as count FROM items WHERE {' AND '.join(conditions)} GROUP BY category ORDER BY count DESC"
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
    mapleland_only: bool = Query(default=True),
):
    offset = (page - 1) * per_page
    conditions = ["COALESCE(is_hidden, 0) = 0"]
    params: list = []

    if mapleland_only:
        mapleland_filter = id_filter_sql("id", "items")
        if mapleland_filter:
            conditions.append(mapleland_filter)

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
    if not require_mapleland_id(item_id, "items"):
        raise HTTPException(status_code=404, detail="Item not found")

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
        mob_filter = id_filter_sql("m.id", "mobs")
        drop_conditions = ["md.item_id = ?"]
        if mob_filter:
            drop_conditions.append(mob_filter)
        drop_rows = conn.execute(
            f"""
            SELECT m.id as mob_id, m.name as mob_name, m.level, m.is_boss, md.drop_rate,
                   (SELECT name_en FROM entity_names_en
                    WHERE entity_type='mob' AND entity_id=m.id AND source='kms') as mob_name_kr
            FROM mob_drops md
            JOIN mobs m ON m.id = md.mob_id
            WHERE {' AND '.join(drop_conditions)}
            ORDER BY m.level
            """,
            (item_id,),
        ).fetchall()
        dropped_by = [dict(r) for r in drop_rows]
        mob_ids = [mob["mob_id"] for mob in dropped_by]
        spawn_map: dict[int, list[dict]] = {mob_id: [] for mob_id in mob_ids}
        if mob_ids:
            placeholders = ",".join("?" for _ in mob_ids)
            map_filter = id_filter_sql("mp.id", "maps")
            map_condition = f"AND {map_filter}" if map_filter else ""
            spawn_rows = conn.execute(
                f"""
                SELECT
                    ms.mob_id,
                    mp.id AS map_id,
                    mp.name AS map_name,
                    ms.map_name AS spawn_name,
                    (SELECT name_en FROM entity_names_en
                     WHERE entity_type='map' AND entity_id=mp.id AND source='kms') AS map_name_kr
                FROM mob_spawns ms
                JOIN maps mp ON mp.id = ms.map_id
                WHERE ms.mob_id IN ({placeholders})
                  {map_condition}
                ORDER BY ms.mob_id, mp.id
                """,
                mob_ids,
            ).fetchall()
            for spawn in spawn_rows:
                spawn_map.setdefault(spawn["mob_id"], []).append(dict(spawn))
        for mob in dropped_by:
            mob["spawn_maps"] = spawn_map.get(mob["mob_id"], [])
    finally:
        conn.close()

    return {"item": item, "dropped_by": dropped_by}
