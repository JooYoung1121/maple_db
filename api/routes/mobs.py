"""Mob routes"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from crawler.db import get_connection

router = APIRouter()


@router.get("/mobs/filters")
def mob_filters():
    try:
        conn = get_connection()
    except Exception:
        return {"level_ranges": [], "boss_count": 0}
    try:
        boss_count = conn.execute("SELECT COUNT(*) FROM mobs WHERE is_boss=1").fetchone()[0]
        max_level = conn.execute("SELECT MAX(level) FROM mobs").fetchone()[0] or 200
        ranges = []
        step = 10
        for start in range(0, max_level + 1, step):
            end = start + step - 1
            cnt = conn.execute(
                "SELECT COUNT(*) FROM mobs WHERE level >= ? AND level <= ?", (start, end)
            ).fetchone()[0]
            if cnt > 0:
                ranges.append({"min": start, "max": end, "count": cnt})
        return {"level_ranges": ranges, "boss_count": boss_count}
    finally:
        conn.close()


@router.get("/mobs")
def list_mobs(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    level_min: Optional[int] = Query(default=None, ge=0),
    level_max: Optional[int] = Query(default=None, ge=0),
    is_boss: Optional[bool] = Query(default=None),
    q: Optional[str] = Query(default=None),
):
    offset = (page - 1) * per_page
    conditions = []
    params: list = []

    if level_min is not None:
        conditions.append("level >= ?")
        params.append(level_min)
    if level_max is not None:
        conditions.append("level <= ?")
        params.append(level_max)
    if is_boss is not None:
        conditions.append("is_boss = ?")
        params.append(1 if is_boss else 0)
    if q:
        conditions.append("name LIKE ?")
        params.append(f"%{q}%")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    try:
        conn = get_connection()
    except Exception:
        return {"mobs": [], "total": 0, "page": page, "per_page": per_page}

    try:
        total = conn.execute(f"SELECT COUNT(*) FROM mobs {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM mobs {where} ORDER BY level LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        results = []
        for row in rows:
            mob = dict(row)
            kr = conn.execute(
                "SELECT name_en FROM entity_names_en WHERE entity_type='mob' AND entity_id=? AND source='kms'",
                (mob["id"],),
            ).fetchone()
            mob["name_kr"] = kr["name_en"] if kr else None
            results.append(mob)
    except Exception:
        results = []
        total = 0
    finally:
        conn.close()

    return {"mobs": results, "total": total, "page": page, "per_page": per_page}


@router.get("/bosses")
def list_bosses(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    level_min: Optional[int] = Query(default=None, ge=0),
    level_max: Optional[int] = Query(default=None, ge=0),
    q: Optional[str] = Query(default=None),
):
    offset = (page - 1) * per_page
    conditions = ["is_boss = 1"]
    params: list = []

    if level_min is not None:
        conditions.append("level >= ?")
        params.append(level_min)
    if level_max is not None:
        conditions.append("level <= ?")
        params.append(level_max)
    if q:
        conditions.append("name LIKE ?")
        params.append(f"%{q}%")

    where = "WHERE " + " AND ".join(conditions)

    try:
        conn = get_connection()
    except Exception:
        return {"bosses": [], "total": 0, "page": page, "per_page": per_page}

    try:
        total = conn.execute(f"SELECT COUNT(*) FROM mobs {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM mobs {where} ORDER BY level LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        results = []
        for row in rows:
            boss = dict(row)
            kr = conn.execute(
                "SELECT name_en FROM entity_names_en WHERE entity_type='mob' AND entity_id=? AND source='kms'",
                (boss["id"],),
            ).fetchone()
            boss["name_kr"] = kr["name_en"] if kr else None
            drop_count = conn.execute(
                "SELECT COUNT(*) FROM mob_drops WHERE mob_id = ?", (boss["id"],)
            ).fetchone()[0]
            boss["drop_count"] = drop_count
            spawn = conn.execute(
                "SELECT m.name FROM mob_spawns ms JOIN maps m ON m.id=ms.map_id WHERE ms.mob_id=? LIMIT 1",
                (boss["id"],),
            ).fetchone()
            boss["spawn_map"] = spawn["name"] if spawn else None
            results.append(boss)
    except Exception:
        results = []
        total = 0
    finally:
        conn.close()

    return {"bosses": results, "total": total, "page": page, "per_page": per_page}


@router.get("/mobs/{mob_id}")
def get_mob(mob_id: int):
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        row = conn.execute("SELECT * FROM mobs WHERE id = ?", (mob_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Mob not found")

        mob = dict(row)

        # 영문명
        en_rows = conn.execute(
            "SELECT name_en, source FROM entity_names_en WHERE entity_type = 'mob' AND entity_id = ?",
            (mob_id,),
        ).fetchall()
        mob["names_en"] = [dict(r) for r in en_rows]

        # Items dropped by this mob
        drop_rows = conn.execute(
            """
            SELECT i.id, i.name, i.category, md.drop_rate
            FROM mob_drops md
            JOIN items i ON i.id = md.item_id
            WHERE md.mob_id = ?
            ORDER BY i.name
            """,
            (mob_id,),
        ).fetchall()
        drops = [dict(r) for r in drop_rows]

        # Maps where this mob spawns
        spawn_rows = conn.execute(
            """
            SELECT m.id, m.name, m.street_name, m.area
            FROM mob_spawns ms
            JOIN maps m ON m.id = ms.map_id
            WHERE ms.mob_id = ?
            ORDER BY m.name
            """,
            (mob_id,),
        ).fetchall()
        spawn_maps = [dict(r) for r in spawn_rows]
    finally:
        conn.close()

    return {"mob": mob, "drops": drops, "spawn_maps": spawn_maps}
