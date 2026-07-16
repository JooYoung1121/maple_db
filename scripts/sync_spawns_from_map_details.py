#!/usr/bin/env python3
"""mob_spawns를 map_details(GMS v92 원작 스폰)와 정합화 — 비파괴적.

배경: 메이플랜드 2.0(2026-06-30 오픈)은 몬스터 배치가 원작 형태로 돌아갔다
(2026-07-16 패치노트 개발자 코멘트). mob_spawns는 1.0 시절 수집분이라
원작 배치에서 새로 나오는 몹(예: 빛을잃은동굴2의 레드 드레이크)이 빠져 있다.

동작 (비파괴):
  1. GMS 스폰에 있는데 mob_spawns에 없는 (몹, 맵) 쌍 추가 — 젠 수는 스폰 포인트 수
  2. 기존 행의 spawn_count 가 NULL 이면 GMS 포인트 수로 채움
  3. 기존 행 삭제/기존 젠 수 덮어쓰기 없음 (ML이 1.0 배치로 복원한 맵이 있어 삭제는 위험)

사용:
  python3 scripts/sync_spawns_from_map_details.py            # dry-run
  python3 scripts/sync_spawns_from_map_details.py --apply
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    ref_mob_ids = {int(r["id"]) for r in ref["entities"]["mobs"]["records"]}
    kr_map_names = {}
    for r in ref["entities"]["maps"]["records"]:
        name = str(r.get("name_kr") or "")
        # "지역: 맵이름" 접두어 제거 — mob_spawns.map_name 관례에 맞춤
        kr_map_names[int(r["id"])] = name.split(":", 1)[1].strip() if ":" in name else name

    conn = sqlite3.connect(DB_PATH)
    added, filled = [], 0
    for map_id, sj in conn.execute("SELECT map_id, spawns_json FROM map_details WHERE spawns_json != '[]'"):
        gms = Counter(s[0] for s in json.loads(sj))
        existing = {r[0] for r in conn.execute("SELECT mob_id FROM mob_spawns WHERE map_id=?", (map_id,))}
        for mob_id, cnt in gms.items():
            if mob_id >= 9000000:
                continue  # 퀘스트/이벤트 변종몹 — 유저 대면 데이터에서 제외 규칙
            if mob_id in ref_mob_ids and mob_id not in existing:
                added.append((mob_id, map_id, kr_map_names.get(map_id), cnt))
            elif mob_id in existing:
                cur = conn.execute(
                    "SELECT spawn_count FROM mob_spawns WHERE mob_id=? AND map_id=?", (mob_id, map_id)
                ).fetchone()
                if cur and cur[0] is None:
                    filled += 1
                    if args.apply:
                        conn.execute(
                            "UPDATE mob_spawns SET spawn_count=? WHERE mob_id=? AND map_id=?",
                            (cnt, mob_id, map_id),
                        )

    print(f"추가할 (몹, 맵) 쌍: {len(added)}")
    print(f"NULL 젠 수 채움: {filled}")
    for mob_id, map_id, map_name, cnt in added[:10]:
        print(f"  + {map_name}({map_id}) ← 몹 {mob_id} ×{cnt}")
    if len(added) > 10:
        print(f"  ... 외 {len(added) - 10}")

    if args.apply:
        conn.executemany(
            "INSERT OR IGNORE INTO mob_spawns (mob_id, map_id, map_name, spawn_count) VALUES (?,?,?,?)",
            added,
        )
        conn.commit()
        print("적용 완료")
    else:
        print("(dry-run — --apply 로 적용)")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
