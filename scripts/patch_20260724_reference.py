#!/usr/bin/env python3
"""2026-07-24 메이플랜드 패치(독안개의 숲·위험에 빠진 켄타 PQ) 레퍼런스 반영.

- 독안개의 숲 PQ 맵 10개를 mapleland_reference.json 에 추가 (+ entity_names_en kms 한글명)
  · 한글명은 패치노트 명시, ID는 GMS v92 maps 테이블(930000000대 + 300030100) 대응
- 보상 아이템 3종 추가: 알테어 이어링(1032060) · 빛나는 알테어 이어링(1032061) · 알테어 조각(4001198)
  · GMS v92 items 테이블에 존재, 한글명은 entity_names_en kms 기수록
- 켄타 PQ 맵(위험한 바다1 등)과 얼음결정 페이스페인팅은 GMS v92 덤프에 없어 미등록
  (켄타 PQ 원작은 빅뱅 후 2011년 콘텐츠 — ML이 MSW에서 자체 재현)

사용:
  python3 scripts/patch_20260724_reference.py            # dry-run
  python3 scripts/patch_20260724_reference.py --apply
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"

# 2026-07-24 패치노트 명시 신규 지역 (독안개의 숲 PQ)
NEW_MAPS = [
    (300030100, "깊은 요정의 숲"),
    (930000000, "들어가기 전"),
    (930000010, "숲 입구"),
    (930000100, "숲 초입"),
    (930000200, "변질된 숲"),
    (930000400, "중독된 숲"),
    (930000500, "숲 공터"),
    (930000600, "독의 숲"),
    (930000700, "엘린의 숲"),
    (930000800, "숲 외곽 출구"),
]

# 보상 아이템 (id, 한글명, 착용 레벨, 직업)
NEW_ITEMS = [
    (1032060, "알테어 이어링", 0, "공용"),
    (1032061, "빛나는 알테어 이어링", 0, "공용"),
    (4001198, "알테어 조각", 0, "공용"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    maps_node = ref["entities"]["maps"]["records"]
    items_node = ref["entities"]["items"]["records"]
    map_ids = {int(r["id"]) for r in maps_node}
    item_ids = {int(r["id"]) for r in items_node}

    conn = sqlite3.connect(DB_PATH)

    added_maps = [(i, n) for i, n in NEW_MAPS if i not in map_ids]
    for i, n in added_maps:
        maps_node.append({"id": i, "name_kr": n})
        print(f"맵 추가: {i} {n}")

    added_items = [(i, n, lv, jobs) for i, n, lv, jobs in NEW_ITEMS if i not in item_ids]
    for i, n, lv, jobs in added_items:
        items_node.append({"id": i, "name_kr": n, "level": lv, "jobs": jobs})
        print(f"아이템 추가: {i} {n}")

    name_rows = [("map", i, n, "kms") for i, n in NEW_MAPS]
    name_rows += [("item", i, n, "kms") for i, n, _, _ in NEW_ITEMS]
    print(f"\nentity_names_en 추가(IGNORE) {len(name_rows)}건")

    if not args.apply:
        print("(dry-run — --apply 로 적용)")
        return 0

    REF_PATH.write_text(json.dumps(ref, ensure_ascii=False, indent=2), encoding="utf-8")
    conn.executemany(
        "INSERT OR IGNORE INTO entity_names_en (entity_type, entity_id, name_en, source) VALUES (?,?,?,?)",
        name_rows,
    )
    conn.commit()
    print("적용 완료")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
