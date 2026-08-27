"""DB를 활용한 짧은 놀이터 게임 라운드 API."""
from __future__ import annotations

import json
import random

from fastapi import APIRouter, HTTPException

from api.routes.daily_mob import load_pool
from api.routes.mapleland_reference import id_filter_sql, mapleland_name_kr_map
from crawler.db import get_connection

router = APIRouter()


@router.get("/playground/highlow/round")
def highlow_round():
    conn = get_connection()
    try:
        pool = [p for p in load_pool(conn) if p["hp"] > 0 and p["exp"] > 0]
    finally:
        conn.close()
    if len(pool) < 2:
        raise HTTPException(status_code=503, detail="출제 가능한 몬스터가 없습니다")
    metric = random.choice(("level", "hp", "exp"))
    for _ in range(30):
        left, right = random.sample(pool, 2)
        if left[metric] != right[metric]:
            break
    return {
        "metric": metric,
        "left": {**{k: left[k] for k in ("id", "name", "level", "hp", "exp")},
                 "icon_url": f"https://maplestory.io/api/gms/92/mob/{left['id']}/icon"},
        "right": {**{k: right[k] for k in ("id", "name", "level", "hp", "exp")},
                  "icon_url": f"https://maplestory.io/api/gms/92/mob/{right['id']}/icon"},
        "answer_id": left["id"] if left[metric] > right[metric] else right["id"],
    }


def _map_rows(conn) -> list[dict]:
    flt = id_filter_sql("m.id", "maps")
    rows = conn.execute(
        f"""SELECT m.id, m.name, m.street_name, m.area, d.minimap_json
            FROM maps m JOIN map_details d ON d.map_id=m.id
            WHERE d.minimap_json IS NOT NULL AND d.minimap_json != ''
              {f'AND {flt}' if flt else ''}
            ORDER BY m.id"""
    ).fetchall()
    names = mapleland_name_kr_map("maps")
    result = []
    for row in rows:
        full_name = names.get(row["id"])
        if not full_name:
            kr = conn.execute(
                "SELECT name_en FROM entity_names_en WHERE entity_type='map' AND entity_id=? AND source='kms'",
                (row["id"],),
            ).fetchone()
            full_name = kr["name_en"] if kr else None
        if not full_name:
            continue
        display = str(full_name).split(":")[-1].strip()
        if not display or display == "스트링 없음":
            continue
        try:
            mini = json.loads(row["minimap_json"])
        except (TypeError, ValueError):
            continue
        canvas = mini.get("canvas") if isinstance(mini, dict) else None
        if not canvas:
            continue
        result.append({
            "id": row["id"], "name": display, "full_name": full_name,
            "street_name": row["street_name"] or "", "area": row["area"] or "",
            "canvas": canvas,
        })
    return result


@router.get("/playground/map-guess/round")
def map_guess_round():
    conn = get_connection()
    try:
        pool = _map_rows(conn)
        if len(pool) < 4:
            raise HTTPException(status_code=503, detail="출제 가능한 미니맵이 없습니다")
        answer = random.choice(pool)
        decoys = random.sample([m for m in pool if m["id"] != answer["id"]], 3)
        choices = [{"id": m["id"], "name": m["name"]} for m in [answer, *decoys]]
        random.shuffle(choices)
        mobs = conn.execute(
            """SELECT COALESCE((SELECT name_en FROM entity_names_en
                                 WHERE entity_type='mob' AND entity_id=mo.id AND source='kms'), mo.name) AS name
                 FROM mob_spawns ms JOIN mobs mo ON mo.id=ms.mob_id
                WHERE ms.map_id=? ORDER BY COALESCE(ms.spawn_count,0) DESC LIMIT 4""",
            (answer["id"],),
        ).fetchall()
        region = str(answer["full_name"]).split(":", 1)[0] if ":" in str(answer["full_name"]) else answer["street_name"]
        return {
            "map_id": answer["id"],
            "minimap": f"data:image/png;base64,{answer['canvas']}",
            "choices": choices,
            "answer_id": answer["id"],
            "answer_name": answer["name"],
            "hints": [
                f"지역: {region or '알 수 없음'}",
                "출현 몬스터: " + (", ".join(r["name"] for r in mobs) if mobs else "정보 없음"),
            ],
        }
    finally:
        conn.close()


@router.get("/playground/drop-chain/round")
def drop_chain_round():
    conn = get_connection()
    try:
        mob_filter = id_filter_sql("mo.id", "mobs")
        mob = conn.execute(
            f"""SELECT mo.id AS mob_id, men.name_en AS mob_name
                  FROM mobs mo
                  JOIN entity_names_en men ON men.entity_type='mob' AND men.entity_id=mo.id AND men.source='kms'
                 WHERE mo.id < 9000000 AND mo.level > 0
                   AND EXISTS (SELECT 1 FROM mob_drops md WHERE md.mob_id=mo.id)
                   AND EXISTS (SELECT 1 FROM mob_spawns ms WHERE ms.mob_id=mo.id)
                   {f'AND {mob_filter}' if mob_filter else ''}
                 ORDER BY RANDOM() LIMIT 1"""
        ).fetchone()
        if mob is None:
            raise HTTPException(status_code=503, detail="출제 가능한 드랍 연결이 없습니다")

        item = conn.execute(
            """SELECT i.id AS item_id, en.name_en AS item_name, i.category
                 FROM mob_drops md JOIN items i ON i.id=md.item_id
                 JOIN entity_names_en en ON en.entity_type='item' AND en.entity_id=i.id AND en.source='kms'
                WHERE md.mob_id=? ORDER BY RANDOM() LIMIT 1""",
            (mob["mob_id"],),
        ).fetchone()
        spawn_map = conn.execute(
            """SELECT mp.id AS map_id, en.name_en AS map_name
                 FROM mob_spawns ms JOIN maps mp ON mp.id=ms.map_id
                 JOIN entity_names_en en ON en.entity_type='map' AND en.entity_id=mp.id AND en.source='kms'
                WHERE ms.mob_id=? ORDER BY RANDOM() LIMIT 1""",
            (mob["mob_id"],),
        ).fetchone()
        if item is None or spawn_map is None:
            raise HTTPException(status_code=503, detail="드랍 연결 문제를 만들지 못했습니다")

        item_decoys = conn.execute(
            """SELECT i.id, en.name_en AS name FROM items i
                 JOIN entity_names_en en ON en.entity_type='item' AND en.entity_id=i.id AND en.source='kms'
                WHERE i.id != ? AND COALESCE(i.category,'')=COALESCE(?, '')
                ORDER BY RANDOM() LIMIT 3""",
            (item["item_id"], item["category"]),
        ).fetchall()
        if len(item_decoys) < 3:
            item_decoys = conn.execute(
                """SELECT i.id, en.name_en AS name FROM items i
                     JOIN entity_names_en en ON en.entity_type='item' AND en.entity_id=i.id AND en.source='kms'
                    WHERE i.id != ? ORDER BY RANDOM() LIMIT 3""",
                (item["item_id"],),
            ).fetchall()
        map_decoys = conn.execute(
            """SELECT mp.id, en.name_en AS name FROM maps mp
                 JOIN entity_names_en en ON en.entity_type='map' AND en.entity_id=mp.id AND en.source='kms'
                WHERE mp.id != ? ORDER BY RANDOM() LIMIT 3""",
            (spawn_map["map_id"],),
        ).fetchall()

        item_choices = [{"id": item["item_id"], "name": item["item_name"]}] + [dict(r) for r in item_decoys]
        map_choices = [{"id": spawn_map["map_id"], "name": str(spawn_map["map_name"]).split(":")[-1].strip()}] + [
            {"id": r["id"], "name": str(r["name"]).split(":")[-1].strip()} for r in map_decoys
        ]
        random.shuffle(item_choices)
        random.shuffle(map_choices)
        return {
            "mob": {
                "id": mob["mob_id"], "name": mob["mob_name"],
                "icon_url": f"https://maplestory.io/api/gms/92/mob/{mob['mob_id']}/icon",
            },
            "item_choices": item_choices,
            "map_choices": map_choices,
            "answer_item_id": item["item_id"],
            "answer_map_id": spawn_map["map_id"],
        }
    finally:
        conn.close()
