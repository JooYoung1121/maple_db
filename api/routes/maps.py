"""Map routes"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import json

from crawler.db import get_connection

router = APIRouter()


@router.get("/maps/filters")
def map_filters():
    try:
        conn = get_connection()
    except Exception:
        return {"areas": [], "street_names": []}
    try:
        areas = conn.execute(
            "SELECT DISTINCT area FROM maps WHERE area IS NOT NULL AND area != '' ORDER BY area"
        ).fetchall()
        streets = conn.execute(
            "SELECT DISTINCT street_name FROM maps WHERE street_name IS NOT NULL AND street_name != '' ORDER BY street_name"
        ).fetchall()
        town_count = conn.execute("SELECT COUNT(*) FROM maps WHERE is_town=1").fetchone()[0]
        return {
            "areas": [r["area"] for r in areas],
            "street_names": [r["street_name"] for r in streets],
            "town_count": town_count,
        }
    finally:
        conn.close()


@router.get("/maps")
def list_maps(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    area: Optional[str] = Query(default=None),
    street_name: Optional[str] = Query(default=None),
    is_town: Optional[bool] = Query(default=None),
    q: Optional[str] = Query(default=None),
):
    offset = (page - 1) * per_page
    conditions = []
    params: list = []

    if area:
        conditions.append("area LIKE ?")
        params.append(f"%{area}%")
    if street_name:
        conditions.append("street_name LIKE ?")
        params.append(f"%{street_name}%")
    if is_town is not None:
        conditions.append("is_town = ?")
        params.append(1 if is_town else 0)
    if q:
        conditions.append("name LIKE ?")
        params.append(f"%{q}%")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    try:
        conn = get_connection()
    except Exception:
        return {"maps": [], "total": 0, "page": page, "per_page": per_page}

    try:
        total = conn.execute(f"SELECT COUNT(*) FROM maps {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM maps {where} ORDER BY id LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        results = []
        for row in rows:
            m = dict(row)
            kr = conn.execute(
                "SELECT name_en FROM entity_names_en WHERE entity_type='map' AND entity_id=? AND source='kms'",
                (m["id"],),
            ).fetchone()
            m["name_kr"] = kr["name_en"] if kr else None
            results.append(m)
    except Exception:
        results = []
        total = 0
    finally:
        conn.close()

    return {"maps": results, "total": total, "page": page, "per_page": per_page}


@router.get("/maps/{map_id}")
def get_map(map_id: int):
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        row = conn.execute("SELECT * FROM maps WHERE id = ?", (map_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Map not found")

        map_data = dict(row)

        # 영문명
        en_rows = conn.execute(
            "SELECT name_en, source FROM entity_names_en WHERE entity_type = 'map' AND entity_id = ?",
            (map_id,),
        ).fetchall()
        map_data["names_en"] = [dict(r) for r in en_rows]

        # Parse portals
        portals_raw = map_data.get("portals_json")
        if portals_raw:
            try:
                map_data["portals"] = json.loads(portals_raw)
            except Exception:
                map_data["portals"] = []
        else:
            map_data["portals"] = []

        # Monsters that spawn on this map
        mob_rows = conn.execute(
            """
            SELECT m.id, m.name, m.level, m.hp, m.is_boss, m.icon_url
            FROM mob_spawns ms
            JOIN mobs m ON m.id = ms.mob_id
            WHERE ms.map_id = ?
            ORDER BY m.level
            """,
            (map_id,),
        ).fetchall()
        monsters = [dict(r) for r in mob_rows]

        # NPCs on this map
        npc_rows = conn.execute(
            "SELECT id, name, description, icon_url FROM npcs WHERE map_id = ? ORDER BY name",
            (map_id,),
        ).fetchall()
        npcs = [dict(r) for r in npc_rows]
    finally:
        conn.close()

    return {"map": map_data, "monsters": monsters, "npcs": npcs}
