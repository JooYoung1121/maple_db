"""Mob routes"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from crawler.db import get_connection
from api.routes.mapleland_reference import id_filter_sql, mapleland_ids, require_mapleland_id

router = APIRouter()


def mapleland_mob_ids() -> set[int]:
    return set(mapleland_ids("mobs"))


@router.get("/mobs/filters")
def mob_filters():
    try:
        conn = get_connection()
    except Exception:
        return {"level_ranges": [], "boss_count": 0}
    try:
        mapleland_filter = id_filter_sql("id", "mobs")
        base_conditions = ["COALESCE(is_hidden,0)=0"]
        if mapleland_filter:
            base_conditions.append(mapleland_filter)
        base_where = " AND ".join(base_conditions)
        boss_count = conn.execute(f"SELECT COUNT(*) FROM mobs WHERE is_boss=1 AND {base_where}").fetchone()[0]
        max_level = conn.execute(f"SELECT MAX(level) FROM mobs WHERE {base_where}").fetchone()[0] or 200
        ranges = []
        step = 10
        for start in range(0, max_level + 1, step):
            end = start + step - 1
            cnt = conn.execute(
                f"SELECT COUNT(*) FROM mobs WHERE level >= ? AND level <= ? AND {base_where}",
                (start, end),
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
    sort: Optional[str] = Query(default=None),
    mapleland_only: bool = Query(default=True),
):
    offset = (page - 1) * per_page
    conditions = []
    params: list = []

    # 숨김 처리된 몬스터 제외 (중복/빈 데이터/이벤트 복제)
    conditions.append("COALESCE(is_hidden, 0) = 0")

    if mapleland_only:
        mapleland_filter = id_filter_sql("id", "mobs")
        if mapleland_filter:
            conditions.append(mapleland_filter)

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
        conditions.append(
            "(name LIKE ? OR id IN (SELECT entity_id FROM entity_names_en WHERE entity_type='mob' AND name_en LIKE ?))"
        )
        params.append(f"%{q}%")
        params.append(f"%{q}%")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    try:
        conn = get_connection()
    except Exception:
        return {"mobs": [], "total": 0, "page": page, "per_page": per_page}

    try:
        valid_sorts = {
            "level_asc": "level ASC",
            "level_desc": "level DESC",
            "hp_desc": "hp DESC",
            "exp_desc": "exp DESC",
            "name_asc": "COALESCE((SELECT name_en FROM entity_names_en WHERE entity_type='mob' AND entity_id=mobs.id AND source='kms'), name) ASC",
        }
        order = valid_sorts.get(sort or "", "level ASC")
        total = conn.execute(f"SELECT COUNT(*) FROM mobs {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM mobs {where} ORDER BY {order} LIMIT ? OFFSET ?",
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


@router.get("/mobs/nhit-presets")
def nhit_mob_presets(
    q: Optional[str] = Query(default=None),
    include_boss: bool = Query(default=True),
    mapleland_only: bool = Query(default=True),
    require_korean_name: bool = Query(default=True),
    level_min: Optional[int] = Query(default=None, ge=0),
    level_max: Optional[int] = Query(default=None, ge=0),
    limit: int = Query(default=2500, ge=1, le=5000),
):
    conditions = [
        "COALESCE(is_hidden, 0) = 0",
        "level > 0",
        "hp > 1",
        "(COALESCE(exp, 0) > 0 OR COALESCE(is_boss, 0) = 1)",
    ]
    params: list = []

    ids = sorted(mapleland_mob_ids()) if mapleland_only else []
    if ids:
        conditions.append(f"id IN ({','.join('?' for _ in ids)})")
        params.extend(ids)
    if not include_boss:
        conditions.append("COALESCE(is_boss, 0) = 0")
    if require_korean_name:
        conditions.append(
            "EXISTS (SELECT 1 FROM entity_names_en WHERE entity_type='mob' AND entity_id=mobs.id AND source='kms')"
        )
    if level_min is not None:
        conditions.append("level >= ?")
        params.append(level_min)
    if level_max is not None:
        conditions.append("level <= ?")
        params.append(level_max)
    if q:
        conditions.append(
            "(name LIKE ? OR id IN (SELECT entity_id FROM entity_names_en WHERE entity_type='mob' AND name_en LIKE ?))"
        )
        params.append(f"%{q}%")
        params.append(f"%{q}%")

    where = "WHERE " + " AND ".join(conditions)

    try:
        conn = get_connection()
    except Exception:
        return {"mobs": [], "total": 0}

    try:
        total = conn.execute(f"SELECT COUNT(*) FROM mobs {where}", params).fetchone()[0]
        rows = conn.execute(
            f"""
            SELECT
                id,
                name,
                level,
                hp,
                COALESCE(defense, 0) as wdef,
                COALESCE(magic_defense, 0) as mdef,
                COALESCE(exp, 0) as exp,
                COALESCE(is_boss, 0) as is_boss,
                COALESCE(is_undead, 0) as is_undead,
                COALESCE(speed, 0) as speed,
                (SELECT name_en FROM entity_names_en
                 WHERE entity_type='mob' AND entity_id=mobs.id AND source='kms') as name_kr
            FROM mobs
            {where}
            ORDER BY level ASC, hp ASC, id ASC, COALESCE(name_kr, name) ASC
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()
        results = [dict(row) for row in rows]
    except Exception:
        results = []
        total = 0
    finally:
        conn.close()

    return {"mobs": results, "total": total}


@router.get("/bosses")
def list_bosses(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    level_min: Optional[int] = Query(default=None, ge=0),
    level_max: Optional[int] = Query(default=None, ge=0),
    q: Optional[str] = Query(default=None),
):
    offset = (page - 1) * per_page
    conditions = ["is_boss = 1", "COALESCE(is_hidden,0) = 0"]
    params: list = []
    # NOTE: 보스 엔드포인트는 메이플랜드 ID 화이트리스트(id_filter_sql)를 적용하지 않는다.
    # 화이트리스트(data/mapleland_reference.json)에 보스 ID가 대부분 누락돼 있어
    # 필터를 걸면 is_boss=1 30종 중 좀비머쉬맘/자쿰 2종만 통과하는 문제가 있었다.
    if level_min is not None:
        conditions.append("level >= ?")
        params.append(level_min)
    if level_max is not None:
        conditions.append("level <= ?")
        params.append(level_max)
    if q:
        conditions.append(
            "(name LIKE ? OR id IN (SELECT entity_id FROM entity_names_en WHERE entity_type='mob' AND name_en LIKE ?))"
        )
        params.append(f"%{q}%")
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
            item_filter = id_filter_sql("item_id", "items")
            drop_count_conditions = ["mob_id = ?"]
            if item_filter:
                drop_count_conditions.append(item_filter)
            drop_count = conn.execute(
                f"SELECT COUNT(*) FROM mob_drops WHERE {' AND '.join(drop_count_conditions)}",
                (boss["id"],),
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

        # 화이트리스트 밖 몹이라도 보스는 상세 진입을 허용한다.
        # (보스 탭은 is_boss=1 전체를 노출하므로 상세도 404 없이 열려야 함)
        if not require_mapleland_id(mob_id, "mobs") and not row["is_boss"]:
            raise HTTPException(status_code=404, detail="Mob not found")

        mob = dict(row)

        # 영문명
        en_rows = conn.execute(
            "SELECT name_en, source FROM entity_names_en WHERE entity_type = 'mob' AND entity_id = ?",
            (mob_id,),
        ).fetchall()
        mob["names_en"] = [dict(r) for r in en_rows]

        # Items dropped by this mob (한국어 이름 포함)
        item_filter = id_filter_sql("i.id", "items")
        drop_conditions = ["md.mob_id = ?"]
        if item_filter:
            drop_conditions.append(item_filter)
        drop_rows = conn.execute(
            f"""
            SELECT i.id, i.name, i.category, md.drop_rate,
                   (SELECT name_en FROM entity_names_en
                    WHERE entity_type='item' AND entity_id=i.id AND source='kms') as name_kr
            FROM mob_drops md
            JOIN items i ON i.id = md.item_id
            WHERE {' AND '.join(drop_conditions)}
            ORDER BY COALESCE(
                (SELECT name_en FROM entity_names_en WHERE entity_type='item' AND entity_id=i.id AND source='kms'),
                i.name
            )
            """,
            (mob_id,),
        ).fetchall()
        drops = [dict(r) for r in drop_rows]

        # Maps where this mob spawns
        map_filter = id_filter_sql("m.id", "maps")
        spawn_conditions = ["ms.mob_id = ?"]
        if map_filter:
            spawn_conditions.append(map_filter)
        spawn_rows = conn.execute(
            f"""
            SELECT m.id, m.name, m.street_name, m.area,
                   (SELECT name_en FROM entity_names_en
                    WHERE entity_type='map' AND entity_id=m.id AND source='kms') as name_kr
            FROM mob_spawns ms
            JOIN maps m ON m.id = ms.map_id
            WHERE {' AND '.join(spawn_conditions)}
            ORDER BY m.name
            """,
            (mob_id,),
        ).fetchall()
        spawn_maps = [dict(r) for r in spawn_rows]
    finally:
        conn.close()

    return {"mob": mob, "drops": drops, "spawn_maps": spawn_maps}
