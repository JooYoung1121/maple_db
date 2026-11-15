#!/usr/bin/env python3
"""2026-11-13 메이플랜드 패치(몬스터 카니발 2) 반영.

출처:
- 메랜 11/13 패치노트: https://maple.land/board/notices/urv9m8wt7951r3lpecndd855
  · 몬스터 카니발 2 (Lv.51~70, 커닝시티·오르비스·루디브리엄 슈피겔만, 필드별 1일 6회)
  · 공지 맵 목록: 슈피겔만의 사무실 / 카니발 필드<대기실>·<전장>·<부활의 장>·<패자의 오기>·<승리의 외침> / 나가는 곳
  · 공지 이미지(NPC 대화): 필드1·2 2~4명, 필드3 3~6명 /
    교환: 슈피겔만의 목걸이 50 코인, 슈피겔만의 구슬 40 코인, 슈피겔만의 혼돈 목걸이 150 반짝이는 메이플 코인
  · 공지 이미지(툴팁): 슈피겔만의 혼돈 목걸이 REQ 51, 올스탯 +1, 공 +1, 마 +1, 물방/마방 +27, 업그레이드 가능 횟수 1
    (원작 GMS v83 1122058 은 업횟 3 → 메랜 변경값)
- 맵 ID: maps 테이블의 GMS/92 크롤(980030000~980033400, street 'The 2nd Monster Carnival')

동작 (patch_20261008_malaysia_chaos_scroll 패턴):
- 맵 17개: entity_names_en 한글명 + mapleland_reference.json(노출 화이트리스트) 등록
- 아이템: 반짝이는 메이플 코인(4001254) reference 등록,
  슈피겔만의 혼돈 목걸이(1122058)는 items.upgrade_slots=1 (오버라이드 파일에도 기록) — 노출은 equipment_notes publish 로
- 카니발 소환 몬스터(9300315~9300324)는 등록 보류: 공지가 '원작과 달리 정상 경험치'로 바꿨다고만 하고 수치가 없어
  원작 EXP(1~10)가 그대로 보이면 오해 소지가 크다.

사용:
  python3 scripts/patch_20261113_monster_carnival2.py          # dry-run
  python3 scripts/patch_20261113_monster_carnival2.py --apply  # 로컬 DB + reference 반영
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"

P = "몬스터 카니발 2: "
NEW_MAPS = [
    (980030000, P + "슈피겔만의 사무실"),
    (980030010, P + "나가는 곳"),
]
for n in (1, 2, 3):
    base = 980030000 + n * 1000
    NEW_MAPS += [
        (base, f"{P}카니발 필드{n} <대기실>"),
        (base + 100, f"{P}카니발 필드{n} <전장>"),
        (base + 200, f"{P}카니발 필드{n} <부활의 장>"),
        (base + 300, f"{P}카니발 필드{n} <승리의 외침>"),
        (base + 400, f"{P}카니발 필드{n} <패자의 오기>"),
    ]

NEW_ITEMS = [(4001254, "반짝이는 메이플 코인", 0)]
CHAOS_NECKLACE = 1122058
CHAOS_NECKLACE_SLOTS = 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    maps_node = ref["entities"]["maps"]["records"]
    items_node = ref["entities"]["items"]["records"]
    ref_map_ids = {int(r["id"]) for r in maps_node}
    ref_item_ids = {int(r["id"]) for r in items_node}

    conn = sqlite3.connect(DB_PATH)
    for i, kr in NEW_MAPS:
        row = conn.execute("SELECT name FROM maps WHERE id=?", (i,)).fetchone()
        if not row:
            print(f"경고: maps 에 {i}({kr}) 없음")
            continue
        print(f"map: {i} {row[0]} → {kr}")
        if args.apply:
            conn.execute(
                "INSERT OR IGNORE INTO entity_names_en (entity_type, entity_id, name_en, source) VALUES ('map', ?, ?, 'kms')",
                (i, kr),
            )
        if i not in ref_map_ids:
            maps_node.append({"id": i, "name_kr": kr})
            ref_map_ids.add(i)

    for i, kr, lv in NEW_ITEMS:
        row = conn.execute("SELECT name FROM items WHERE id=?", (i,)).fetchone()
        print(f"item: {i} {row[0] if row else '(없음)'} → {kr}")
        if row and i not in ref_item_ids:
            items_node.append({"id": i, "name_kr": kr, "level": lv, "jobs": "not"})
            ref_item_ids.add(i)

    cur = conn.execute("SELECT upgrade_slots FROM items WHERE id=?", (CHAOS_NECKLACE,)).fetchone()
    print(f"item: {CHAOS_NECKLACE} upgrade_slots {cur[0] if cur else None} → {CHAOS_NECKLACE_SLOTS}")
    if args.apply:
        conn.execute("UPDATE items SET upgrade_slots=? WHERE id=?", (CHAOS_NECKLACE_SLOTS, CHAOS_NECKLACE))
        conn.commit()
        REF_PATH.write_text(json.dumps(ref, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("적용 완료")
    else:
        print("(dry-run — --apply 로 적용)")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
