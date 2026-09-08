#!/usr/bin/env python3
"""2026-09-07 메이플랜드 패치노트(9/7 당일 수정본) 확정 데이터 반영.

공식 패치노트: https://maple.land/board/notices/nbudy1h3t2wjeqrx8i94yupm
9/7 당일 게시글 수정으로 추가된 내용:
- 에델슈타인 몬스터 목록에 공식 레벨이 병기됨 → GMS 참고값과 다른 7종 수정
- 배틀메이지 스킬 밸런스 대거 조정 (블로우류 자동 발동화, 마스터 기준 수치 변경)
- 모험가 해적 조정: 버커니어 에너지 차지 중첩, 캡틴 배틀쉽 이동속도 80→110

스킬 레벨별 수치(level_data)는 KMST 원본을 유지하고, 메이플랜드 조정치는
description 말미에 '[메이플랜드 9/7 조정]' 단락으로 병기한다 — 레벨별 조정값은
공지에 없어(마스터 기준만 공개) 임의로 만들어 넣지 않는다.

사용:
  python3 scripts/patch_20260908_balance.py            # dry-run
  python3 scripts/patch_20260908_balance.py --apply
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
DB_PATH = ROOT / "data" / "maple.db"

MARKER = "[메이플랜드 9/7 조정]"

# (mob_id, 한글명, 공지 레벨) — 9/7 패치노트 수정본의 공식 레벨 목록 기준.
# HP·EXP는 여전히 GMS v95 참고값이므로 건드리지 않는다 (실측 확보 시 별도 갱신).
MOB_LEVEL_FIXES = [
    (1150000, "순찰로봇", 15),
    (1150001, "이상한 이정표", 17),
    (1150002, "구렁이", 19),
    (3150000, "안전제일", 30),
    (7150004, "경비로봇L", 78),
    (8105000, "라칸", 83),
    (8105004, "고장난 DF형 안드로이드", 95),
]

# (job_class, skill_name, 조정 내용) — 9/7 패치노트 밸런스 항목 전문 요약.
SKILL_NOTES = [
    ("배틀메이지", "트리플 블로우", "연타 방식 폐지 — 1회 입력 시 기본공격력 20(마스터)으로 3회 자동 공격."),
    ("배틀메이지", "피니쉬 어택", "기본공격력 마스터 기준 30 → 70."),
    ("배틀메이지", "텔레포트", "이동거리 150 → 145."),
    ("배틀메이지", "쿼드 블로우", "4번째 추가 1타(기본공격력 240) 방식 폐지 — 1회 입력 시 기본공격력 28(마스터)으로 4회 자동 공격."),
    ("배틀메이지", "다크 체인", "기본공격력 마스터 기준 70 → 80."),
    ("배틀메이지", "블루 오라", "흡수량 Lv.1 49% → Lv.20 30% (레벨이 오를수록 받는 피해가 늘어나던 원작 오류 수정)."),
    ("배틀메이지", "블러드 드레인", "지속시간 마스터 기준 90초 → 120초."),
    ("배틀메이지", "스태프 부스터", "지속시간 마스터 기준 90초 → 200초."),
    ("배틀메이지", "데스 블로우", "5번째 추가 1타(기본공격력 480) 방식 폐지 — 1회 입력 시 기본공격력 42(마스터)으로 5회 자동 공격."),
    ("배틀메이지", "어드밴스드 블루 오라", "흡수량 Lv.1 29% → Lv.20 20% (원작 오류 수정)."),
    ("배틀메이지", "다크 라이트닝", "기본공격력 마스터 기준 250 → 300."),
    ("배틀메이지", "컨버젼", "지속시간 60초 고정 → 스킬 레벨 비례, 마스터 기준 최대 200초."),
    ("배틀메이지", "슈퍼 바디", "다크 오라 중 발동 시 추가 데미지 상승 마스터 기준 40% → 20%."),
    ("배틀메이지", "리바이브", "지속시간 90초 → 200초, 리퍼 기본공격력 상승, 리퍼 최대 소환 수 무제한 → 5마리."),
    ("배틀메이지", "피니쉬 블로우", "6번째 추가 1타(기본공격력 690) 방식 폐지 — 1회 입력 시 기본공격력 60(마스터)으로 6회 자동 공격."),
    ("배틀메이지", "어드밴스드 옐로우 오라", "공격속도 추가 증가 2단 → 1단."),
    ("배틀메이지", "싸이클론", "기본공격력 마스터 기준 770 → 850, 재사용 대기시간 1분 → 2분."),
    ("배틀메이지", "스탠스", "발동 확률 마스터 기준 90% → 95%."),
    ("배틀메이지", "쉘터", "재사용 대기시간 7분 → 10분."),
    ("해적", "에너지 차지", "에너지 차지 발동 시 공격력 보너스가 무조건 중첩되도록 변경."),
    ("해적", "배틀쉽", "배틀쉽 이동속도 80 → 110."),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)

    for mob_id, kr, level in MOB_LEVEL_FIXES:
        row = conn.execute("SELECT name, level FROM mobs WHERE id=?", (mob_id,)).fetchone()
        if not row:
            print(f"경고: 몹 {mob_id}({kr}) 없음")
            continue
        if row[1] == level:
            print(f"몹 유지: {kr} Lv.{level}")
            continue
        print(f"몹 레벨: {kr}({mob_id}) Lv.{row[1]} → Lv.{level}")
        if args.apply:
            conn.execute("UPDATE mobs SET level=? WHERE id=?", (level, mob_id))

    for job, skill, note in SKILL_NOTES:
        row = conn.execute(
            "SELECT id, description FROM skills WHERE job_class=? AND skill_name=?", (job, skill)
        ).fetchone()
        if not row:
            print(f"경고: 스킬 {job}/{skill} 없음")
            continue
        desc = row[1] or ""
        if MARKER in desc:
            print(f"스킬 유지: {job}/{skill} (이미 반영)")
            continue
        print(f"스킬 갱신: {job}/{skill} — {note}")
        if args.apply:
            new_desc = f"{desc.rstrip()} {MARKER} {note}"
            conn.execute("UPDATE skills SET description=? WHERE id=?", (new_desc, row[0]))

    if args.apply:
        conn.commit()
        print("적용 완료")
    else:
        print("(dry-run — --apply 로 적용)")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
