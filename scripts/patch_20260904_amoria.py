#!/usr/bin/env python3
"""2026-09-04 메이플랜드 패치(아모리안 챌린지) 레퍼런스 반영.

공식 패치노트: https://maple.land/board/notices/u59poew390cw27yfl21j5fdf
- 아모스의 훈련장·아모리안 챌린지 스테이지 맵을 mapleland_reference.json 에 추가 (+ kms 한글명)
  · GMS v92 원본 맵 존재 확인 (Amos' Training Ground 670010000 등)
  · "아모리아 평야 1·2 / 아모리아 숲 1·2"는 GMS 대응이 불명(후보: 670000100/200 Purplewood Forest 1·2 뿐)
    → 9/7 이후 인게임 실측으로 확정 예정, 이번에는 미등록
  · 챌린지 스테이지 몹(9400530~9400537 GL/PQ·가이스트 발록)은 메랜 인게임 명칭 실측 후 등록 예정
- 리버스/타임리스 에아스 핸드 공격속도 변경: 느림(8) → 빠름(4)
  · 패치노트는 툴팁 라벨(느림→빠름)만 명시 — 세부 수치(4/5)는 실측 미확정이라 빠름 대표값 4 사용
- 공지에 명시된 아모리아 신규 퀘스트 5종을 공식 확인 데이터로 등록
  · 퀘스트별 요구 레벨·선행 조건·보상은 공지에 없어 미확정으로 유지

사용:
  python3 scripts/patch_20260904_amoria.py            # dry-run
  python3 scripts/patch_20260904_amoria.py --apply
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"

# (map_id, 메랜 한글명) — 한글명은 9/4 패치노트 표기, ID는 GMS v92 maps 테이블 확인값
NEW_MAPS = [
    (670010000, "아모스의 훈련장"),
    (670010100, "아모리안 챌린지 : 입구"),
    (670010200, "스테이지 1 - 마법의 거울"),
    (670010300, "스테이지 2 - 하나된 마음"),
    (670010301, "스테이지 2 - 하나된 마음"),
    (670010302, "스테이지 2 - 하나된 마음"),
    (670010400, "스테이지 3 - 변덕스런 마음"),
    (670010500, "스테이지 4 - 마지막 저항"),
    (670010600, "스테이지 5 - 설레는 마음"),
    (670010700, "스테이지 6 - 아픈 사랑"),
    (670010750, "스테이지 7 - 아모스의 금고 (커플)"),
    (670010800, "스테이지 7 - 아모스의 금고"),
]

# 아이템 옵션 변경 (id, 컬럼, 이전값, 새값)
ITEM_UPDATES = [
    (1382059, "attack_speed", "8", "4"),  # 리버스 에아스 핸드: 느림 → 빠름
    (1382057, "attack_speed", "8", "4"),  # 타임리스 에아스 핸드: 느림 → 빠름
]

# 공식 9/4 패치노트에 공개된 이름만 확정. 세부 조건·보상은 인게임 실측 대기.
NEW_QUESTS = [
    ("정원사 제이콥", "일반"),
    ("제이콥의 특별한 선물 준비", "일반"),
    ("결혼식을 도와주세요!", "일반"),
    ("반지 수리하기", "일반"),
    ("아모리안 챌린지 알아보기", "파티"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    maps_node = ref["entities"]["maps"]["records"]
    map_ids = {int(r["id"]) for r in maps_node}

    conn = sqlite3.connect(DB_PATH)

    added = [(i, n) for i, n in NEW_MAPS if i not in map_ids]
    for i, n in added:
        maps_node.append({"id": i, "name_kr": n})
        print(f"맵 추가: {i} {n}")

    for i, n in NEW_MAPS:
        exists = conn.execute(
            "SELECT 1 FROM entity_names_en WHERE entity_type='map' AND entity_id=? AND source='kms'", (i,)
        ).fetchone()
        if not exists:
            print(f"한글명 추가: map {i} → {n}")
            if args.apply:
                conn.execute(
                    "INSERT OR IGNORE INTO entity_names_en (entity_type, entity_id, name_en, source) VALUES ('map', ?, ?, 'kms')",
                    (i, n),
                )

    for item_id, col, old, new in ITEM_UPDATES:
        row = conn.execute(f"SELECT name, {col} FROM items WHERE id=?", (item_id,)).fetchone()
        if not row:
            print(f"경고: 아이템 {item_id} 없음")
            continue
        print(f"아이템 {item_id} {row[0]}: {col} {row[1]} → {new}")
        if args.apply:
            conn.execute(f"UPDATE items SET {col}=? WHERE id=?", (new, item_id))

    for name, quest_type in NEW_QUESTS:
        exists = conn.execute("SELECT 1 FROM quests WHERE name=?", (name,)).fetchone()
        if exists:
            print(f"퀘스트 유지: {name}")
            continue
        print(f"퀘스트 추가: {name}")
        if args.apply:
            conn.execute(
                """
                INSERT INTO quests (
                    name, level_req, area, start_location, quest_conditions,
                    exp_reward, meso_reward, note, tip, difficulty,
                    quest_type, is_mapleland, category
                ) VALUES (?, 0, '아모리아', '웨딩빌리지(아모리아)', ?, 0, 0, ?, ?, '미확인', ?, 1, '아모리아')
                """,
                (
                    name,
                    "9/4 공식 공지에서 추가 확인. 상세 시작 조건은 인게임 실측 필요.",
                    "메이플랜드 2026-09-04 공식 패치노트 수록 퀘스트.",
                    "요구 레벨·선행 퀘스트·보상은 공식 공지에 없어 확인 후 갱신 예정.",
                    quest_type,
                ),
            )

    if args.apply:
        REF_PATH.write_text(json.dumps(ref, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        from crawler.db import rebuild_search_index

        rebuild_search_index(conn)
        conn.commit()
        print("적용 완료")
    else:
        print("(dry-run — --apply 로 적용)")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
