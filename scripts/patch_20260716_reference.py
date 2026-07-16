#!/usr/bin/env python3
"""2026-07-16 메이플랜드 패치(마왕 발록·카오스 자쿰) 레퍼런스 반영.

- 신규 맵 8개를 mapleland_reference.json 에 추가 (+ entity_names_en kms 한글명)
- 카오스 자쿰 몸통 2·3(8800101, 8800102) 몹 추가 (본체·팔은 기수록)
- 8830000 '발록' → '마왕 발록' 개명 (ML 공식 명칭)
- 280030000 오표기 수정: '카오스자쿰의제단' → '자쿰의 제단' (GMS: Zakum's Altar)
- 보스 스폰 연결: 카오스 자쿰 일가 → 카오스자쿰의 제단, 마왕 발록 → 발록의 무덤

사용:
  python3 scripts/patch_20260716_reference.py            # dry-run
  python3 scripts/patch_20260716_reference.py --apply
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"

# 2026-07-16 패치노트 명시 신규 지역 (한글명은 패치노트, ID는 GMS v92 maps 테이블 대응)
NEW_MAPS = [
    (105100000, "던전: 지하로 내려가는 길"),
    (105100100, "던전: 신전의 밑바닥"),
    (105100101, "히든스트리트: 트리스탄의 안식처"),
    (105100300, "던전: 발록의 무덤"),
    (105100301, "던전: 발록이 사라진 자리"),
    (211042301, "폐광: 카오스자쿰으로통하는문"),
    (211042401, "폐광: 카오스자쿰의 제단 입구"),
    (280030001, "마지막임무: 카오스자쿰의 제단"),
]

NEW_MOBS = [
    (8800101, "카오스 자쿰"),
    (8800102, "카오스 자쿰"),
]

RENAME_MOBS = {8830000: "마왕 발록"}
RENAME_MAPS = {280030000: "마지막임무: 자쿰의 제단"}

# 보스 스폰 연결 (몹 id 목록, 맵 id, 맵 이름[접두어 제외])
SPAWN_LINKS = [
    (list(range(8800100, 8800111)), 280030001, "카오스자쿰의 제단"),
    ([8830000], 105100300, "발록의 무덤"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    maps_node = ref["entities"]["maps"]["records"]
    mobs_node = ref["entities"]["mobs"]["records"]
    map_ids = {int(r["id"]) for r in maps_node}
    mob_ids = {int(r["id"]) for r in mobs_node}

    conn = sqlite3.connect(DB_PATH)

    # 1. 맵 추가
    added_maps = [(i, n) for i, n in NEW_MAPS if i not in map_ids]
    for i, n in added_maps:
        maps_node.append({"id": i, "name_kr": n})
        print(f"맵 추가: {i} {n}")

    # 2. 몹 추가 (level/hp는 mobs 테이블에서)
    for i, n in NEW_MOBS:
        if i in mob_ids:
            continue
        row = conn.execute("SELECT level, hp FROM mobs WHERE id=?", (i,)).fetchone()
        mobs_node.append({"id": i, "name_kr": n, "level": row[0] if row else 0, "hp": row[1] if row else 0})
        print(f"몹 추가: {i} {n}")

    # 3. 개명
    for r in mobs_node:
        if int(r["id"]) in RENAME_MOBS and r.get("name_kr") != RENAME_MOBS[int(r["id"])]:
            print(f"몹 개명: {r['id']} {r.get('name_kr')} → {RENAME_MOBS[int(r['id'])]}")
            r["name_kr"] = RENAME_MOBS[int(r["id"])]
    for r in maps_node:
        if int(r["id"]) in RENAME_MAPS and r.get("name_kr") != RENAME_MAPS[int(r["id"])]:
            print(f"맵 개명: {r['id']} {r.get('name_kr')} → {RENAME_MAPS[int(r['id'])]}")
            r["name_kr"] = RENAME_MAPS[int(r["id"])]

    # 4. entity_names_en kms 한글명 (맵 — 접두어 제외, 검색용)
    name_rows = []
    for i, n in NEW_MAPS:
        bare = n.split(":", 1)[1].strip()
        name_rows.append(("map", i, bare, "kms"))
    # 몹 한글명 갱신 (마왕 발록)
    kms_updates = [(RENAME_MOBS[8830000], "mob", 8830000)]

    # 5. 스폰 연결
    spawn_rows = []
    for mob_list, map_id, map_name in SPAWN_LINKS:
        for m in mob_list:
            spawn_rows.append((m, map_id, map_name, None))

    print(f"\nentity_names_en 추가 {len(name_rows)}건 · 몹명 갱신 {len(kms_updates)}건 · 스폰 연결 {len(spawn_rows)}건")

    if not args.apply:
        print("(dry-run — --apply 로 적용)")
        return 0

    REF_PATH.write_text(json.dumps(ref, ensure_ascii=False, indent=2), encoding="utf-8")
    conn.executemany(
        "INSERT OR IGNORE INTO entity_names_en (entity_type, entity_id, name_en, source) VALUES (?,?,?,?)",
        [(t, i, n, s) for (t, i, n, s) in name_rows],
    )
    conn.executemany("UPDATE entity_names_en SET name_en=? WHERE entity_type=? AND entity_id=? AND source='kms'", kms_updates)
    conn.executemany(
        "INSERT OR IGNORE INTO mob_spawns (mob_id, map_id, map_name, spawn_count) VALUES (?,?,?,?)",
        spawn_rows,
    )
    conn.commit()
    print("적용 완료")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
