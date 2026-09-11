#!/usr/bin/env python3
"""2026-09-11 패치노트 반영 — 배틀메이지 오라 자동 전이 중단 · 쉘터 오류 수정 · 비단 깃털.

공식 패치노트: https://maple.land/board/notices/uc6cu3mlb78f1zyavaceeq64
- "배틀메이지의 오라류 스킬에 자동 전이 중단 로직이 추가됩니다."
  커뮤니티 실측(디시 3954205·3954360, 9/11): 시전자가 일정 시간 조작·전투 없이 방치되면
  파티원으로의 오라 전이가 자동 중단 — 저레벨 배메 부캐를 세워두고 다크 오라(파티 데미지
  +10~20%)만 받는 '오라캐' 운용 차단 목적. 재적용 조건 세부 규칙은 실측 진행 중.
- "배틀메이지의 쉘터 스킬이 1레벨일 때 재사용 대기시간에 발생하던 오류가 수정됩니다."
- "비단 깃털이 관련 퀘스트가 진행중이 아닐 때는 드롭되지 않도록 수정됩니다."
  → '아모리아의 벚꽃 정원' 퀘스트 팁 갱신 (비단 깃털 = 주니어 라이오너 드롭 퀘템)

사용:
  python3 scripts/patch_20260911_aura.py            # dry-run
  python3 scripts/patch_20260911_aura.py --apply
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
DB_PATH = ROOT / "data" / "maple.db"

MARKER = "[메이플랜드 9/11 조정]"

AURA_NOTE = (
    "오라류에 자동 전이 중단 로직 추가 — 시전자가 일정 시간 조작·전투 없이 방치되면 "
    "파티원 전이가 중단된다 (방치형 '오라캐' 차단, 세부 규칙 실측 중)."
)

SKILL_NOTES = [
    ("배틀메이지", "다크 오라", AURA_NOTE),
    ("배틀메이지", "블루 오라", AURA_NOTE),
    ("배틀메이지", "옐로우 오라", AURA_NOTE),
    ("배틀메이지", "어드밴스드 다크 오라", AURA_NOTE),
    ("배틀메이지", "어드밴스드 블루 오라", AURA_NOTE),
    ("배틀메이지", "어드밴스드 옐로우 오라", AURA_NOTE),
    ("배틀메이지", "쉘터", "1레벨일 때 재사용 대기시간 오류 수정."),
]

QUEST_TIP = (
    "벚나무 묘목은 사쿠라 셀리온, 비단 깃털은 주니어 라이오너 드롭 — 아모리아 인근 맵 실측(디시 3940014). "
    "9/11 패치부터 비단 깃털은 퀘스트 진행 중일 때만 드롭된다."
)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)

    for job, skill, note in SKILL_NOTES:
        row = conn.execute(
            "SELECT id, description FROM skills WHERE job_class=? AND skill_name=?", (job, skill)
        ).fetchone()
        if not row:
            print(f"경고: 스킬 {job}/{skill} 없음")
            continue
        desc = row[1] or ""
        if MARKER in desc:
            print(f"스킬 유지: {skill} (이미 반영)")
            continue
        print(f"스킬 갱신: {skill} — {note[:40]}...")
        if args.apply:
            conn.execute(
                "UPDATE skills SET description=? WHERE id=?",
                (f"{desc.rstrip()} {MARKER} {note}", row[0]),
            )

    row = conn.execute("SELECT id, tip FROM quests WHERE name='아모리아의 벚꽃 정원'").fetchone()
    if row:
        if "9/11 패치부터" in (row[1] or ""):
            print("퀘스트 유지: 아모리아의 벚꽃 정원 (이미 반영)")
        else:
            print("퀘스트 팁 갱신: 아모리아의 벚꽃 정원")
            if args.apply:
                conn.execute("UPDATE quests SET tip=? WHERE id=?", (QUEST_TIP, row[0]))
    else:
        print("경고: 벚꽃 정원 퀘스트 없음")

    if args.apply:
        conn.commit()
        print("적용 완료")
    else:
        print("(dry-run — --apply 로 적용)")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
