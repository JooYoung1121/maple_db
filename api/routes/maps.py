"""Map routes"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import json

from crawler.db import get_connection
from api.routes.mapleland_reference import (
    id_filter_sql,
    require_mapleland_id,
    mapleland_ids,
    mapleland_name_kr_map,
)

router = APIRouter()


@router.get("/maps/filters")
def map_filters():
    try:
        conn = get_connection()
    except Exception:
        return {"areas": [], "street_names": []}
    try:
        mapleland_filter = id_filter_sql("id", "maps")
        base_conditions = []
        if mapleland_filter:
            base_conditions.append(mapleland_filter)
        base_where = f"WHERE {' AND '.join(base_conditions)}" if base_conditions else ""
        prefix = f"{base_where} AND" if base_where else "WHERE"
        areas = conn.execute(
            f"SELECT DISTINCT area FROM maps {prefix} area IS NOT NULL AND area != '' ORDER BY area"
        ).fetchall()
        streets = conn.execute(
            f"SELECT DISTINCT street_name FROM maps {prefix} street_name IS NOT NULL AND street_name != '' ORDER BY street_name"
        ).fetchall()
        town_conditions = ["is_town=1"]
        if mapleland_filter:
            town_conditions.insert(0, mapleland_filter)
        town_count = conn.execute(f"SELECT COUNT(*) FROM maps WHERE {' AND '.join(town_conditions)}").fetchone()[0]
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
    mapleland_only: bool = Query(default=True),
):
    offset = (page - 1) * per_page
    conditions = []
    params: list = []

    if mapleland_only:
        mapleland_filter = id_filter_sql("id", "maps")
        if mapleland_filter:
            conditions.append(mapleland_filter)

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
        conditions.append(
            "(name LIKE ? OR id IN (SELECT entity_id FROM entity_names_en WHERE entity_type='map' AND name_en LIKE ?))"
        )
        params.append(f"%{q}%")
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
            m["name_kr"] = (kr["name_en"] if kr else None) or mapleland_name_kr_map("maps").get(m["id"])
            results.append(m)
    except Exception:
        results = []
        total = 0
    finally:
        conn.close()

    return {"maps": results, "total": total, "page": page, "per_page": per_page}


@router.get("/maps/{map_id}")
def get_map(map_id: int):
    if not require_mapleland_id(map_id, "maps"):
        raise HTTPException(status_code=404, detail="Map not found")

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
        map_data["name_kr"] = next(
            (r["name_en"] for r in map_data["names_en"] if r.get("source") == "kms"),
            None,
        ) or mapleland_name_kr_map("maps").get(map_id)
        # 레퍼런스 한글명의 "지역: 맵이름" 접두어에서 한글 지역명 추출
        ref_full = mapleland_name_kr_map("maps").get(map_id) or ""
        map_data["region_kr"] = ref_full.split(":", 1)[0].strip() if ":" in ref_full else None

        # Parse portals
        portals_raw = map_data.get("portals_json")
        if portals_raw:
            try:
                portals = json.loads(portals_raw)
                map_data["portals"] = [p for p in portals if isinstance(p, dict)] if isinstance(portals, list) else []
            except Exception:
                map_data["portals"] = []
        else:
            map_data["portals"] = []

        # Monsters that spawn on this map
        mob_filter = id_filter_sql("m.id", "mobs")
        mob_conditions = ["ms.map_id = ?"]
        if mob_filter:
            mob_conditions.append(mob_filter)
        mob_rows = conn.execute(
            """
            SELECT m.id as mob_id, m.name as mob_name, m.level, m.hp, m.is_boss, m.icon_url,
                   ms.spawn_count as spawn_count,
                   (SELECT name_en FROM entity_names_en
                    WHERE entity_type='mob' AND entity_id=m.id AND source='kms') as mob_name_kr
            FROM mob_spawns ms
            JOIN mobs m ON m.id = ms.mob_id
            WHERE """ + " AND ".join(mob_conditions) + """
            ORDER BY ms.spawn_count DESC, m.level
            """,
            (map_id,),
        ).fetchall()
        monsters = [dict(r) for r in mob_rows]

        # NPCs on this map
        npc_filter = id_filter_sql("id", "npcs")
        npc_conditions = ["map_id = ?"]
        if npc_filter:
            npc_conditions.append(npc_filter)
        npc_rows = conn.execute(
            f"""SELECT id, name, description, icon_url,
                       (SELECT name_en FROM entity_names_en
                        WHERE entity_type='npc' AND entity_id=npcs.id AND source='kms') as name_kr
                FROM npcs
                WHERE {' AND '.join(npc_conditions)}
                ORDER BY COALESCE(name_kr, name)""",
            (map_id,),
        ).fetchall()
        npcs = [dict(r) for r in npc_rows]

        # ── 맵 상세(map_details): 스폰 위치·발판·로프·미니맵 ──
        detail = None
        detail_row = None
        try:
            detail_row = conn.execute(
                "SELECT * FROM map_details WHERE map_id = ?", (map_id,)
            ).fetchone()
        except Exception:
            detail_row = None  # 테이블 미존재(시드 전) 허용

        spawn_counts: dict[int, int] = {}
        if detail_row is not None:
            d = dict(detail_row)
            spawns = json.loads(d.get("spawns_json") or "[]")
            for s in spawns:
                if isinstance(s, list) and len(s) >= 3:
                    spawn_counts[int(s[0])] = spawn_counts.get(int(s[0]), 0) + 1
            detail = {
                "spawns": spawns,  # [[mob_id, x, y], ...]
                "npcs": json.loads(d.get("npcs_json") or "[]"),
                "footholds": json.loads(d.get("footholds_json") or "[]"),
                "ropes": json.loads(d.get("ropes_json") or "[]"),
                "minimap": json.loads(d["minimap_json"]) if d.get("minimap_json") else None,
                "vr": json.loads(d["vr_json"]) if d.get("vr_json") else None,
                "bgm": d.get("bgm"),
                "is_swim": bool(d.get("is_swim")),
            }

        # 정확한 젠 수 병합 + mob_spawns에 없는 몹 보충
        known_mob_ids = {m["mob_id"] for m in monsters}
        for m in monsters:
            m["spawn_points"] = spawn_counts.get(m["mob_id"])
        missing_ids = [mid for mid in spawn_counts if mid not in known_mob_ids]
        if missing_ids:
            ref_mob_ids = set(mapleland_ids("mobs"))
            placeholders = ",".join("?" for _ in missing_ids)
            extra_rows = conn.execute(
                f"""SELECT m.id as mob_id, m.name as mob_name, m.level, m.hp, m.is_boss, m.icon_url,
                           (SELECT name_en FROM entity_names_en
                            WHERE entity_type='mob' AND entity_id=m.id AND source='kms') as mob_name_kr
                    FROM mobs m WHERE m.id IN ({placeholders})""",
                missing_ids,
            ).fetchall()
            for r in extra_rows:
                m = dict(r)
                m["spawn_count"] = None
                m["spawn_points"] = spawn_counts.get(m["mob_id"])
                m["in_reference"] = (not ref_mob_ids) or m["mob_id"] in ref_mob_ids
                monsters.append(m)
        monsters.sort(key=lambda m: (-(m.get("spawn_points") or m.get("spawn_count") or 0), m.get("level") or 0))

        # ── 이 맵에서 얻는 드랍템 (출현 몹들의 드랍 합집합) ──
        drops = []
        all_mob_ids = sorted({m["mob_id"] for m in monsters})
        if all_mob_ids:
            item_filter = id_filter_sql("i.id", "items")
            item_cond = f" AND {item_filter}" if item_filter else ""
            mob_ph = ",".join("?" for _ in all_mob_ids)
            drop_rows = conn.execute(
                f"""SELECT i.id as item_id, i.name as item_name, i.category, i.icon_url,
                           (SELECT name_en FROM entity_names_en
                            WHERE entity_type='item' AND entity_id=i.id AND source='kms') as item_name_kr,
                           md.mob_id, md.drop_rate
                    FROM mob_drops md
                    JOIN items i ON i.id = md.item_id
                    WHERE md.mob_id IN ({mob_ph}){item_cond}
                    ORDER BY i.category, i.name""",
                all_mob_ids,
            ).fetchall()
            by_item: dict[int, dict] = {}
            for r in drop_rows:
                it = by_item.get(r["item_id"])
                if it is None:
                    it = by_item[r["item_id"]] = {
                        "item_id": r["item_id"], "item_name": r["item_name"],
                        "category": r["category"], "icon_url": r["icon_url"],
                        "item_name_kr": r["item_name_kr"],
                        "mob_ids": [], "sources": [], "max_rate": None,
                    }
                it["mob_ids"].append(r["mob_id"])
                it["sources"].append({"mob_id": r["mob_id"], "rate": r["drop_rate"]})
                if r["drop_rate"] is not None and (it["max_rate"] is None or r["drop_rate"] > it["max_rate"]):
                    it["max_rate"] = r["drop_rate"]
            drops = list(by_item.values())

        # 포탈 연결맵 한글명
        kr_map_names = mapleland_name_kr_map("maps")
        for p in map_data.get("portals") or []:
            to_map = p.get("toMap")
            if isinstance(to_map, int) and to_map in kr_map_names:
                p["to_name_kr"] = kr_map_names[to_map]
    finally:
        conn.close()

    return {"map": map_data, "monsters": monsters, "npcs": npcs, "detail": detail, "drops": drops}
