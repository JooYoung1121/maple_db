"""체경비(몹 체력 ÷ 경험치) 사냥터 추천 API.

- 몹 랭킹: 레벨 구간 내 몹을 체경비 오름차순(낮을수록 꿀)으로 정렬
- 맵 추천: map_details.spawns_json(GMS 스폰 배치)으로 맵별 몹 마릿수·분포를 집계해
  젠 가중 체경비(Σ count×hp ÷ Σ count×exp)와 한 젠 경험치 총량으로 순위를 매긴다
- 유저 대면 규칙: 메랜 레퍼런스 화이트리스트 + is_hidden/보스/900만번대 특수몹 제외
"""
from __future__ import annotations

import json
from functools import lru_cache

from fastapi import APIRouter, Query

from api.routes.mapleland_reference import mapleland_ids, mapleland_name_kr_map
from crawler.db import get_connection

router = APIRouter()

# 스폰 y좌표를 40px 단위로 묶어 층수를 추정한다 (발판 높이 대략치)
FLOOR_BUCKET = 40


@lru_cache(maxsize=1)
def _snapshot() -> dict:
    """DB에서 몹 스탯·맵 스폰을 한 번 읽어 집계 스냅샷을 만든다.

    레퍼런스 DB는 배포 시에만 바뀌므로 프로세스 수명 동안 캐시해도 안전하다.
    """
    mob_whitelist = set(mapleland_ids("mobs"))
    map_whitelist = set(mapleland_ids("maps"))

    conn = get_connection()
    try:
        mobs: dict[int, dict] = {}
        for r in conn.execute(
            "SELECT id, level, hp, exp, is_boss FROM mobs WHERE COALESCE(is_hidden,0)=0"
        ):
            mid = r["id"]
            if mid >= 9_000_000:  # 퀘스트/이벤트 변종몹
                continue
            if mob_whitelist and mid not in mob_whitelist:
                continue
            if r["is_boss"]:
                continue
            if not r["hp"] or not r["exp"] or r["exp"] <= 0 or r["hp"] <= 0:
                continue
            mobs[mid] = {
                "id": mid,
                "level": r["level"] or 0,
                "hp": r["hp"],
                "exp": r["exp"],
                "ratio": round(r["hp"] / r["exp"], 1),
            }

        maps: list[dict] = []
        mob_presence: dict[int, dict[str, int]] = {}  # mob_id → {map_count, total_spawns}
        for r in conn.execute(
            "SELECT map_id, spawns_json FROM map_details WHERE spawns_json IS NOT NULL AND spawns_json != '[]'"
        ):
            map_id = r["map_id"]
            if map_whitelist and map_id not in map_whitelist:
                continue
            try:
                spawns = json.loads(r["spawns_json"])
            except Exception:
                continue
            counts: dict[int, int] = {}
            xs: list[int] = []
            ys: set[int] = set()
            for s in spawns:
                if not isinstance(s, list) or len(s) < 3 or s[0] not in mobs:
                    continue
                counts[s[0]] = counts.get(s[0], 0) + 1
                xs.append(int(s[1]))
                ys.add(int(s[2]) // FLOOR_BUCKET)
            if not counts:
                continue
            maps.append({
                "map_id": map_id,
                "counts": counts,
                "floors": len(ys),
                "width": (max(xs) - min(xs)) if len(xs) > 1 else 0,
            })
            for mid, cnt in counts.items():
                p = mob_presence.setdefault(mid, {"map_count": 0, "total_spawns": 0})
                p["map_count"] += 1
                p["total_spawns"] += cnt

        street = {
            r["id"]: r["street_name"]
            for r in conn.execute("SELECT id, street_name FROM maps WHERE street_name IS NOT NULL")
        }
        towns = {r["id"] for r in conn.execute("SELECT id FROM maps WHERE is_town=1")}

        # 스폰 포인트가 아닌 구조물(망둥이집 등)에서 젠되는 몹은 map_details에 안 잡힌다 —
        # mob_spawns(맵↔몹 매핑)를 폴백으로 들고 있다가 마릿수 미상으로 노출한다.
        fallback_spawns: dict[int, set[int]] = {}
        for r in conn.execute("SELECT DISTINCT mob_id, map_id FROM mob_spawns"):
            if r["map_id"] in towns:
                continue
            if r["mob_id"] in mobs and (not map_whitelist or r["map_id"] in map_whitelist):
                fallback_spawns.setdefault(r["mob_id"], set()).add(r["map_id"])
    finally:
        conn.close()

    return {
        "mobs": mobs, "maps": maps, "presence": mob_presence,
        "street": street, "fallback": fallback_spawns,
    }


@router.get("/efficiency")
def efficiency(
    min_level: int = Query(default=1, ge=1, le=200),
    max_level: int = Query(default=200, ge=1, le=200),
    mob_limit: int = Query(default=60, ge=1, le=200),
    map_limit: int = Query(default=40, ge=1, le=100),
    sort: str = Query(default="ratio", pattern="^(ratio|exp)$"),
):
    if min_level > max_level:
        min_level, max_level = max_level, min_level

    snap = _snapshot()
    mob_kr = mapleland_name_kr_map("mobs")
    map_kr = mapleland_name_kr_map("maps")

    in_range = {
        mid: m for mid, m in snap["mobs"].items() if min_level <= m["level"] <= max_level
    }

    mob_rows = []
    for mid, m in in_range.items():
        p = snap["presence"].get(mid)
        if p is None:
            # 스폰 포인트 데이터가 없는 몹 — mob_spawns 매핑으로 서식 맵 수만 제공
            fb = snap["fallback"].get(mid, set())
            p = {"map_count": len(fb), "total_spawns": None}
        mob_rows.append({
            **m,
            "name_kr": mob_kr.get(mid),
            "map_count": p["map_count"],
            "total_spawns": p["total_spawns"],
        })
    mob_rows.sort(key=lambda x: x["ratio"])

    map_rows = []
    for entry in snap["maps"]:
        picked = [
            (mid, cnt) for mid, cnt in entry["counts"].items() if mid in in_range
        ]
        if not picked:
            continue
        total_hp = sum(in_range[mid]["hp"] * cnt for mid, cnt in picked)
        total_exp = sum(in_range[mid]["exp"] * cnt for mid, cnt in picked)
        total_count = sum(cnt for _, cnt in picked)
        out_of_range = sum(cnt for mid, cnt in entry["counts"].items() if mid not in in_range)
        map_rows.append({
            "map_id": entry["map_id"],
            "name_kr": map_kr.get(entry["map_id"]),
            "street_name": snap["street"].get(entry["map_id"]),
            "mobs": [
                {
                    **in_range[mid],
                    "name_kr": mob_kr.get(mid),
                    "count": cnt,
                }
                for mid, cnt in sorted(picked, key=lambda x: -x[1])
            ],
            "total_count": total_count,
            "out_of_range_count": out_of_range,
            "weighted_ratio": round(total_hp / total_exp, 1) if total_exp else None,
            "exp_per_gen": total_exp,
            "floors": entry["floors"],
            "width": entry["width"],
            "estimated": False,
        })

    # 스폰 포인트 미집계 몹(망둥이 등)의 서식 맵을 마릿수 미상 행으로 보충
    covered = {m["map_id"] for m in map_rows}
    synth: dict[int, list[int]] = {}
    for mid in in_range:
        if mid in snap["presence"]:
            continue
        for map_id in snap["fallback"].get(mid, set()):
            if map_id not in covered:
                synth.setdefault(map_id, []).append(mid)
    for map_id, mids in synth.items():
        ratios = [in_range[mid]["ratio"] for mid in mids]
        map_rows.append({
            "map_id": map_id,
            "name_kr": map_kr.get(map_id),
            "street_name": snap["street"].get(map_id),
            "mobs": [
                {**in_range[mid], "name_kr": mob_kr.get(mid), "count": None}
                for mid in sorted(mids, key=lambda x: in_range[x]["ratio"])
            ],
            "total_count": None,
            "out_of_range_count": 0,
            "weighted_ratio": round(sum(ratios) / len(ratios), 1),
            "exp_per_gen": None,
            "floors": None,
            "width": None,
            "estimated": True,
        })
    if sort == "exp":
        # 한 젠 경험치 총량 내림차순 — 마릿수 미상(estimated) 행은 뒤로
        map_rows.sort(key=lambda x: (x["exp_per_gen"] is None, -(x["exp_per_gen"] or 0)))
    else:
        map_rows.sort(key=lambda x: (x["weighted_ratio"] is None, x["weighted_ratio"]))

    return {
        "min_level": min_level,
        "max_level": max_level,
        "mobs": mob_rows[:mob_limit],
        "maps": map_rows[:map_limit],
        "total_maps": len(map_rows),
    }
