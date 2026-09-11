#!/usr/bin/env python3
"""에델슈타인 몹 출현맵(mob_spawns) 재생성 — 추정 매핑을 GMS 스폰 데이터로 교체.

배경: 9/7 패치 스크립트(patch_20260907_edelstein.py)의 MANUAL_SPAWNS는 공지의 레벨
순서로 지역을 추정 매핑했는데, 이후 수집한 GMS v95 맵 상세(map_details.spawns_json)와
대조하니 갱도·산책로 라인이 한 칸씩 밀려 있었다 (예: 갱도1은 빅 스파이더가 아니라 라키,
위험한 너구리 소굴은 라쿤이 아니라 라칸 — 커뮤니티 실측 no=3949303과 GMS 데이터 일치).

수정: 에델 맵 48종의 mob_spawns를 전부 지우고 map_details 스폰 좌표에서 재생성한다.
- spawn_count = 스폰 포인트 수 (실제 젠 마릿수 근사)
- GMS에 스폰이 없는 맵(마을·통로·트레이닝 룸 포스)은 등록하지 않음 — 추정으로 채우지 않는다
- 광석 이터는 GMS 배치에도 없어(메랜 커스텀) 계속 미등록 — 실측 확보 시 별도 반영

사용:
  python3 scripts/patch_20260911_edelstein_spawns.py            # dry-run
  python3 scripts/patch_20260911_edelstein_spawns.py --apply
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
DB_PATH = ROOT / "data" / "maple.db"

EDEL_MAP_IDS = [
    104020130, 200000170, 200090600, 310000010, 310020200, 310020100, 310020000,
    310000000, 310000004, 310000001, 310000003, 310010000, 310010010, 310010100,
    310010200, 310010300, 310010400, 310010500, 310030000, 310030100, 310030110,
    310030200, 310030300, 310030310, 310040000, 310040100, 310040110, 310040400,
    310040300, 310040200, 310050000, 310050100, 310050200, 310050300, 310050400,
    310050500, 310050510, 310050520, 310050600, 310050700, 310050800, 310060000,
    310060100, 310060110, 310060120, 310060200, 310060210, 310060220,
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    map_kr = {
        r["entity_id"]: r["name_en"]
        for r in conn.execute(
            "SELECT entity_id, name_en FROM entity_names_en WHERE entity_type='map' AND source='kms'"
        )
    }
    mob_kr = {
        r["entity_id"]: r["name_en"]
        for r in conn.execute(
            "SELECT entity_id, name_en FROM entity_names_en WHERE entity_type='mob' AND source='kms'"
        )
    }

    ph = ",".join("?" for _ in EDEL_MAP_IDS)
    old = conn.execute(
        f"SELECT COUNT(*) FROM mob_spawns WHERE map_id IN ({ph})", EDEL_MAP_IDS
    ).fetchone()[0]
    print(f"기존 에델 mob_spawns {old}행 제거 예정")

    new_rows = []
    for map_id in EDEL_MAP_IDS:
        row = conn.execute(
            "SELECT spawns_json FROM map_details WHERE map_id=?", (map_id,)
        ).fetchone()
        if not row or not row["spawns_json"]:
            continue
        counts = Counter(s[0] for s in json.loads(row["spawns_json"]))
        for mob_id, cnt in counts.items():
            if not conn.execute("SELECT 1 FROM mobs WHERE id=?", (mob_id,)).fetchone():
                print(f"경고: 몹 {mob_id} 미등록 — 건너뜀 (map {map_id})")
                continue
            new_rows.append((mob_id, map_id, map_kr.get(map_id), cnt))
            print(f"  {map_kr.get(map_id, map_id):<20} ← {mob_kr.get(mob_id, mob_id)} ×{cnt}")

    print(f"신규 {len(new_rows)}행 생성")
    if args.apply:
        conn.execute(f"DELETE FROM mob_spawns WHERE map_id IN ({ph})", EDEL_MAP_IDS)
        conn.executemany(
            "INSERT INTO mob_spawns (mob_id, map_id, map_name, spawn_count) VALUES (?,?,?,?)",
            new_rows,
        )
        conn.commit()
        print("적용 완료")
    else:
        print("(dry-run — --apply 로 적용)")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
