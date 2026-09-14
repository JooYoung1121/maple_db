"""Item routes"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from crawler.db import get_connection
from crawler.catalog_data import equipment_notes
from api.routes.mapleland_reference import id_filter_sql, require_mapleland_id

router = APIRouter()

EQUIPMENT_CATEGORIES = ("Armor", "Accessory", "One-Handed Weapon", "Two-Handed Weapon", "Weapon")
COMMON_JOB_SQL = "COALESCE(job_req, '') IN ('', '공용', 'All', 'Beginner')"
JOB_NAMES = {"Warrior": "전사", "Magician": "마법사", "Bowman": "궁수", "Thief": "도적", "Pirate": "해적"}



@router.get("/items/filters")
def item_filters():
    try:
        conn = get_connection()
    except Exception:
        return {"categories": [], "subcategories": [], "jobs": []}
    try:
        mapleland_filter = id_filter_sql("id", "items")
        where = "WHERE COALESCE(is_hidden, 0) = 0"
        if mapleland_filter:
            where += f" AND {mapleland_filter}"
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
            "subcategories_by_category": {
                r["category"]: [s["subcategory"] for s in conn.execute(
                    f"SELECT DISTINCT subcategory FROM items {prefix} category = ? AND subcategory IS NOT NULL AND subcategory != '' ORDER BY subcategory",
                    (r["category"],),
                )] for r in cats
            },
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
        conditions = ["category IS NOT NULL", "category != ''", "COALESCE(is_hidden, 0) = 0"]
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
    equipment_only: bool = Query(default=False),
    include_common: bool = Query(default=True),
):
    offset = (page - 1) * per_page
    conditions = ["COALESCE(is_hidden, 0) = 0"]
    params: list = []

    if mapleland_only:
        mapleland_filter = id_filter_sql("id", "items")
        if mapleland_filter:
            conditions.append(mapleland_filter)

    if level_min is not None and level_max is not None and level_min > level_max:
        raise HTTPException(status_code=422, detail="최소 레벨은 최대 레벨보다 클 수 없습니다")
    if equipment_only:
        conditions.append("category IN (" + ",".join("?" for _ in EQUIPMENT_CATEGORIES) + ")")
        params.extend(EQUIPMENT_CATEGORIES)

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
        if job in ("공용", "common"):
            conditions.append(COMMON_JOB_SQL)
        else:
            job_name = JOB_NAMES.get(job, job)
            job_condition = "('/' || COALESCE(job_req, '') || '/') LIKE ?"
            conditions.append(f"({job_condition} OR {COMMON_JOB_SQL})" if include_common else job_condition)
            params.append(f"%/{job_name}/%")
    if q:
        # 공백 차이를 무시하고 토큰별 AND 매칭 ("자쿰 투구" → "자쿰의 투구")
        for token in q.split() or [q]:
            needle = f"%{token.replace(' ', '')}%"
            conditions.append(
                "(REPLACE(name, ' ', '') LIKE ?"
                " OR id IN (SELECT entity_id FROM entity_names_en"
                " WHERE entity_type='item' AND REPLACE(name_en, ' ', '') LIKE ?))"
            )
            params.append(needle)
            params.append(needle)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        total = conn.execute(f"SELECT COUNT(*) FROM items {where}", params).fetchone()[0]
        valid_sorts = {
            "level_asc": "level_req ASC, id ASC",
            "level_desc": "level_req DESC, id ASC",
            "name_asc": "COALESCE((SELECT name_en FROM entity_names_en WHERE entity_type='item' AND entity_id=items.id ORDER BY CASE source WHEN 'mapleland-current' THEN 0 WHEN 'kms' THEN 1 ELSE 2 END LIMIT 1), name) ASC, id ASC",
            "name_desc": "name DESC",
        }
        order = valid_sorts.get(sort or "", "id")
        rows = conn.execute(
            f"SELECT * FROM items {where} ORDER BY {order} LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        # Fetch drop sources once for the current page, respecting the live mob scope.
        drops_by_item = {}
        if rows:
            mob_scope = id_filter_sql("m.id", "mobs")
            scope = f" AND {mob_scope}" if mob_scope else ""
            ids = [row["id"] for row in rows]
            drop_rows = conn.execute(
                f"""SELECT md.item_id, m.id AS mob_id, m.name AS mob_name, m.level,
                    (SELECT name_en FROM entity_names_en WHERE entity_type='mob' AND entity_id=m.id
                     ORDER BY CASE source WHEN 'mapleland-current' THEN 0 WHEN 'kms' THEN 1 ELSE 2 END LIMIT 1) AS mob_name_kr
                    FROM mob_drops md JOIN mobs m ON m.id=md.mob_id
                    WHERE md.item_id IN ({','.join('?' for _ in ids)}) AND COALESCE(m.is_hidden,0)=0{scope}
                    ORDER BY m.level, m.id""", ids,
            ).fetchall()
            for drop in drop_rows:
                drops_by_item.setdefault(drop["item_id"], []).append(dict(drop))
        results = []
        for row in rows:
            item = dict(row)
            kr = conn.execute(
                """SELECT name_en FROM entity_names_en
                   WHERE entity_type='item' AND entity_id=?
                   ORDER BY CASE source WHEN 'mapleland-current' THEN 0 WHEN 'kms' THEN 1 ELSE 2 END
                   LIMIT 1""",
                (item["id"],),
            ).fetchone()
            item["name_kr"] = kr["name_en"] if kr else None
            drops = drops_by_item.get(item["id"], [])
            item["drop_count"] = len(drops)
            item["drop_sources"] = drops[:3]
            item["catalog_notes"] = equipment_notes().get(str(item["id"]))
            results.append(item)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Search unavailable") from exc
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
        item["catalog_notes"] = equipment_notes().get(str(item_id))

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
