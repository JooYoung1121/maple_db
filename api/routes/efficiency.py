"""체경비(몹 체력 ÷ 경험치) 사냥터 추천 API.

- 몹 랭킹: 레벨 구간 내 몹을 체경비 오름차순(낮을수록 꿀)으로 정렬
- 맵 추천: map_details.spawns_json(GMS 스폰 배치)으로 맵별 몹 마릿수·분포를 집계해
  젠 가중 체경비(Σ count×hp ÷ Σ count×exp)와 한 젠 경험치 총량으로 순위를 매긴다
- 유저 대면 규칙: 메랜 레퍼런스 화이트리스트 + is_hidden/보스 제외.
  900만번대 일괄 제외는 하지 않는다 — 닌자성·지하 감옥 등 노출 몹의 45%가 9M 대역이며,
  게이트는 레퍼런스 화이트리스트다 (2026-09-29 감사).
- 파퀘/전직시험 인스턴스는 제외한다 (2026-09-30 피드백): ① 108 대역 직업 훈련장 맵,
  ② 9억대 맵 중 서식 몹이 전부 9M 변종인 맵(독의 숲 등 파퀘 71곳 — 돼지농장처럼
  정상 몹이 사는 9억대 입장권 사냥터는 유지), ③ 9M 몹은 정상 맵 서식지가 확인될
  때만 랭킹에 포함(선물상자 등 이벤트 변종 정리).
- 캐릭터 계산(N방컷·명중률)용으로 몹 전투 스탯(wdef/mdef/avoid)을 함께 반환한다.
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

# 전직 시험/직업 훈련장 대역 (궁수의개미굴·전사의바위산 등 26맵)
TRAINING_MAP_RANGE = (108_000_000, 109_000_000)
# 파퀘·이벤트 인스턴스 대역 — 서식 몹이 전부 9M 변종일 때만 제외
INSTANCE_MAP_MIN = 900_000_000


def _is_instance_map(map_id: int, resident_ids: set[int]) -> bool:
    if TRAINING_MAP_RANGE[0] <= map_id < TRAINING_MAP_RANGE[1]:
        return True
    return (
        map_id >= INSTANCE_MAP_MIN
        and bool(resident_ids)
        and all(mid >= 9_000_000 for mid in resident_ids)
    )


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
            "SELECT id, level, hp, exp, is_boss, defense, magic_defense, evasion, is_undead "
            "FROM mobs WHERE COALESCE(is_hidden,0)=0"
        ):
            mid = r["id"]
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
                "wdef": r["defense"] or 0,
                "mdef": r["magic_defense"] or 0,
                "avoid": r["evasion"] or 0,
                "undead": 1 if r["is_undead"] else 0,
            }

        towns = {r["id"] for r in conn.execute("SELECT id FROM maps WHERE is_town=1")}

        # 1차 스캔: 맵별 스폰 파싱 + 서식 몹 구성(파퀘 인스턴스 판정용) 수집
        parsed: list[tuple[int, list]] = []
        map_mob_ids: dict[int, set[int]] = {}
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
            parsed.append((map_id, spawns))
            ids = map_mob_ids.setdefault(map_id, set())
            for s in spawns:
                if isinstance(s, list) and len(s) >= 3 and (
                    not mob_whitelist or s[0] in mob_whitelist
                ):
                    ids.add(s[0])

        spawn_rows = [
            dict(r)
            for r in conn.execute("SELECT mob_id, map_id, spawn_count FROM mob_spawns")
        ]
        for r in spawn_rows:
            if r["mob_id"] in mobs and (not map_whitelist or r["map_id"] in map_whitelist):
                map_mob_ids.setdefault(r["map_id"], set()).add(r["mob_id"])

        excluded_maps = {
            map_id for map_id, ids in map_mob_ids.items() if _is_instance_map(map_id, ids)
        }

        # 2차: 맵 집계 (파퀘/훈련장 제외)
        maps: list[dict] = []
        geo: dict[int, tuple[int, int]] = {}  # map_id → (층수, 폭) — 미상 행 지형 폴백용
        mob_presence: dict[int, dict[str, int]] = {}  # mob_id → {map_count, total_spawns}
        for map_id, spawns in parsed:
            if map_id in excluded_maps:
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
            floors = len(ys)
            width = (max(xs) - min(xs)) if len(xs) > 1 else 0
            maps.append({
                "map_id": map_id,
                "counts": counts,
                "floors": floors,
                "width": width,
            })
            geo[map_id] = (floors, width)
            for mid, cnt in counts.items():
                p = mob_presence.setdefault(mid, {"map_count": 0, "total_spawns": 0})
                p["map_count"] += 1
                p["total_spawns"] += cnt

        street = {
            r["id"]: r["street_name"]
            for r in conn.execute("SELECT id, street_name FROM maps WHERE street_name IS NOT NULL")
        }
        mob_rate = {
            r["id"]: round(r["mob_rate"], 1)
            for r in conn.execute("SELECT id, mob_rate FROM maps WHERE mob_rate IS NOT NULL AND mob_rate > 0")
        }

        # 스폰 포인트가 아닌 구조물(망둥이집 등)에서 젠되는 몹은 map_details에 안 잡힌다 —
        # mob_spawns(맵↔몹 매핑, spawn_count 82% 보유)를 폴백으로 들고 있다가
        # 마릿수 추정치와 함께 노출한다. (파퀘/훈련장 맵은 여기서도 제외)
        fallback_spawns: dict[int, dict[int, int | None]] = {}
        for r in spawn_rows:
            if r["map_id"] in towns or r["map_id"] in excluded_maps:
                continue
            if r["mob_id"] in mobs and (not map_whitelist or r["map_id"] in map_whitelist):
                fallback_spawns.setdefault(r["mob_id"], {})[r["map_id"]] = r["spawn_count"]
    finally:
        conn.close()

    return {
        "mobs": mobs, "maps": maps, "presence": mob_presence,
        "street": street, "fallback": fallback_spawns, "geo": geo,
        "mob_rate": mob_rate,
    }


@router.get("/efficiency")
def efficiency(
    min_level: int = Query(default=1, ge=1, le=200),
    max_level: int = Query(default=200, ge=1, le=200),
    mob_limit: int = Query(default=60, ge=1, le=200),
    map_limit: int = Query(default=40, ge=1, le=100),
    sort: str = Query(default="ratio", pattern="^(ratio|exp)$"),
    min_count: int = Query(default=1, ge=1, le=30),
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
        fb = snap["fallback"].get(mid, {})
        # 9M 변종 몹은 정상 맵 서식지가 확인될 때만 랭킹 포함
        # (파퀘·이벤트 전용 몹 정리 — 선물상자·초강화형 등)
        if mid >= 9_000_000 and p is None and not fb:
            continue
        estimated = False
        if p is None:
            # 스폰 포인트 데이터가 없는 몹 — mob_spawns 매핑에서 맵 수·젠 수 추정치 제공
            known = [c for c in fb.values() if c]
            p = {
                "map_count": len(fb),
                "total_spawns": sum(known) if known else None,
            }
            estimated = True
        mob_rows.append({
            **m,
            "name_kr": mob_kr.get(mid),
            "map_count": p["map_count"],
            "total_spawns": p["total_spawns"],
            "spawns_estimated": estimated,
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
        if total_count < min_count:
            continue
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
            "mob_rate": snap["mob_rate"].get(entry["map_id"]),
            "floors": entry["floors"],
            "width": entry["width"],
            "estimated": False,
        })

    # 스폰 포인트 미집계 몹(망둥이 등)의 서식 맵을 mob_spawns 젠 수 추정치로 보충
    covered = {m["map_id"] for m in map_rows}
    synth: dict[int, dict[int, int | None]] = {}
    for mid in in_range:
        if mid in snap["presence"]:
            continue
        for map_id, cnt in snap["fallback"].get(mid, {}).items():
            if map_id not in covered:
                synth.setdefault(map_id, {})[mid] = cnt
    for map_id, mob_counts in synth.items():
        mids = sorted(mob_counts, key=lambda x: in_range[x]["ratio"])
        known = {mid: cnt for mid, cnt in mob_counts.items() if cnt}
        all_known = len(known) == len(mob_counts)
        if all_known:
            total_hp = sum(in_range[mid]["hp"] * cnt for mid, cnt in known.items())
            total_exp = sum(in_range[mid]["exp"] * cnt for mid, cnt in known.items())
            weighted = round(total_hp / total_exp, 1) if total_exp else None
        else:
            ratios = [in_range[mid]["ratio"] for mid in mids]
            total_exp = None
            weighted = round(sum(ratios) / len(ratios), 1)
        total_count = sum(known.values()) if known else None
        if total_count is not None and min_count > 1 and total_count < min_count:
            continue
        g = snap["geo"].get(map_id)
        map_rows.append({
            "map_id": map_id,
            "name_kr": map_kr.get(map_id),
            "street_name": snap["street"].get(map_id),
            "mobs": [
                {**in_range[mid], "name_kr": mob_kr.get(mid), "count": mob_counts[mid]}
                for mid in mids
            ],
            "total_count": total_count,
            "out_of_range_count": 0,
            "weighted_ratio": weighted,
            "exp_per_gen": total_exp if all_known else None,
            "mob_rate": snap["mob_rate"].get(map_id),
            "floors": g[0] if g else None,
            "width": g[1] if g else None,
            "estimated": True,
        })

    # 동일 이름·동일 몹 구성의 변형 맵(전직시험 3구역, 차원의세계 5구역 등)은 한 장으로 합친다
    deduped: dict[tuple, dict] = {}
    for row in map_rows:
        sig = (
            row["name_kr"] or f"#{row['map_id']}",
            row["street_name"],
            tuple(sorted((m["id"], m.get("count")) for m in row["mobs"])),
        )
        if sig in deduped:
            deduped[sig]["variant_count"] += 1
        else:
            row["variant_count"] = 1
            deduped[sig] = row
    map_rows = list(deduped.values())

    if sort == "exp":
        # 한 젠 경험치 총량 내림차순 — 젠 배율(mob_rate) 보정, 마릿수 미상 행은 뒤로
        map_rows.sort(key=lambda x: (
            x["exp_per_gen"] is None,
            -((x["exp_per_gen"] or 0) * (x["mob_rate"] or 1.0)),
        ))
    else:
        # 체경비 동률이면 마릿수 많은 맵 우선 (1~2마리 맵이 상위 도배되는 것 방지)
        map_rows.sort(key=lambda x: (
            x["weighted_ratio"] is None, x["weighted_ratio"], -(x["total_count"] or 0),
        ))

    return {
        "min_level": min_level,
        "max_level": max_level,
        "mobs": mob_rows[:mob_limit],
        "maps": map_rows[:map_limit],
        "total_maps": len(map_rows),
        "total_mobs": len(mob_rows),
    }
