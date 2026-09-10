#!/usr/bin/env python3
"""에델슈타인 몹 드랍테이블 1차 반영 (2026-09-07~09-10 커뮤니티 실측).

출처는 디시 메이플랜드 갤러리 글번호. 증거 등급:
- [툴팁] 인게임 아이템 툴팁 스크린샷 판독 (확정)
- [몬북+본문] 몬스터북 전리품 스샷 + 본문 텍스트 목록 (확정)
- [본문] 정보글 본문 텍스트 목록
- [그리드] 몬스터북 그리드 아이콘 판독 — 원석처럼 색으로 확실한 것만
- [댓글] 단일 댓글 제보 (최저 등급 — 표기하되 추후 재검증 대상)

몹별 근거:
- 경비로봇L(7150004): 펫장비 점프력 60% [툴팁] no=3945093
- 라칸(8105000): 펫장비 점프력 60% [댓글] no=3945093 댓글 "큰 너구리도 떨구더라"
- 강화된 방어 시스템(8105002): 하의 방어력 60%·두손검 공격력 10%·아대 공격력 60% [본문]
  no=3943095, 그레이트 로헨 [댓글] 같은 글 (그리드에 골드 대검 아이콘 존재로 부합).
  "펫장비 100%"는 이동속도/점프력 구분 불가라 보류.
- AF형 안드로이드(8105003): 두손둔기 공격력 60%·폴암 공격력 10% [본문 교차]
  no=3944662·3944442, 가넷·다이아몬드·흑수정 원석 [그리드] no=3944442 (색상 명확)
- 고장난 DF형 안드로이드(8105004): no=3943773(몬북+본문)·3947666(몬북+본문) 교차 —
  주문서 5종(스태프 마력 60%·아대 공격력 60%·건 공격력 60%·폴암 공격력 60%·펫장비 이동속도 10%[툴팁 no=3942856]),
  장비 11종(블루 코르뱅·라 투핸더·타바르·다크 바즈라·블루 바르슈즈·다크 아데스슈즈·
  화이트 네쉐르·바키트·블러드 대거·레드 마르티어·킹 센트), 원석 3종
- 광석 이터(8105005): no=3942833(몬북+본문) — [마스터리북]암살 30·어드밴스드 호밍 20
  (몬카 전리품 실측 no=3944293 댓글로 재확인), 방패 방어력 60%·한손둔기 공격력 60%·
  완드 마력 60%, 파워 엘릭서(교환 불가 변형) [툴팁] no=3947343

나머지 17종(새싹 화분~카트베어·라쿤·방어 시스템)은 9/10 기준 커뮤니티 제보 없음 — 미기입.

사용:
  python3 scripts/patch_20260910_edelstein_drops.py            # dry-run
  python3 scripts/patch_20260910_edelstein_drops.py --apply
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

# (mob_id, item_id, 표기명) — item_id는 메랜 레퍼런스 화이트리스트 내 ID로 확인 완료
NEW_DROPS: list[tuple[int, int, str]] = [
    # 경비로봇L
    (7150004, 2048004, "펫장비 점프력 주문서 60%"),
    # 라칸
    (8105000, 2048004, "펫장비 점프력 주문서 60%"),
    # 강화된 방어 시스템
    (8105002, 2040601, "하의 방어력 주문서 60%"),
    (8105002, 2044002, "두손검 공격력 주문서 10%"),
    (8105002, 2044701, "아대 공격력 주문서 60%"),
    (8105002, 1402015, "그레이트 로헨"),
    # AF형 안드로이드
    (8105003, 2044201, "두손둔기 공격력 주문서 60%"),
    (8105003, 2044402, "폴암 공격력 주문서 10%"),
    (8105003, 4020000, "가넷의 원석"),
    (8105003, 4020007, "다이아몬드의 원석"),
    (8105003, 4020008, "흑수정의 원석"),
    # 고장난 DF형 안드로이드 — 주문서
    (8105004, 2043801, "스태프 마력 주문서 60%"),
    (8105004, 2044701, "아대 공격력 주문서 60%"),
    (8105004, 2044901, "건 공격력 주문서 60%"),
    (8105004, 2044401, "폴암 공격력 주문서 60%"),
    (8105004, 2048002, "펫장비 이동속도 주문서 10%"),
    # 고장난 DF형 안드로이드 — 장비
    (8105004, 1082140, "블루 코르뱅"),
    (8105004, 1402016, "라 투핸더"),
    (8105004, 1412021, "타바르"),
    (8105004, 1051104, "다크 바즈라"),
    (8105004, 1072224, "블루 바르슈즈"),
    (8105004, 1072205, "다크 아데스슈즈"),
    (8105004, 1462015, "화이트 네쉐르"),
    (8105004, 1332027, "바키트"),
    (8105004, 1332052, "블러드 대거"),
    (8105004, 1082210, "레드 마르티어"),
    (8105004, 1482012, "킹 센트"),
    # 고장난 DF형 안드로이드 — 원석
    (8105004, 4020000, "가넷의 원석"),
    (8105004, 4020007, "다이아몬드의 원석"),
    (8105004, 4020008, "흑수정의 원석"),
    # 광석 이터
    (8105005, 2290093, "[마스터리북]암살 30"),
    (8105005, 2290124, "[마스터리북]어드밴스드 호밍 20"),
    (8105005, 2040901, "방패 방어력 주문서 60%"),
    (8105005, 2043201, "한손둔기 공격력 주문서 60%"),
    (8105005, 2043701, "완드 마력 주문서 60%"),
    (8105005, 2000005, "파워 엘릭서"),
]

# 드랍 실측으로 존재가 확인됐지만 레퍼런스 화이트리스트에 없던 아이템
NEW_REF_ITEMS = [
    (1082210, "레드 마르티어", 0),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    ref_items = ref["entities"]["items"]["records"]
    ref_ids = {int(r["id"]) for r in ref_items}

    for item_id, kr, level in NEW_REF_ITEMS:
        if item_id in ref_ids:
            print(f"레퍼런스 유지: {item_id} {kr}")
            continue
        print(f"레퍼런스 추가: {item_id} {kr}")
        ref_items.append({"id": item_id, "name_kr": kr, "level": level, "jobs": "공용"})

    for mob_id, item_id, kr in NEW_DROPS:
        if not conn.execute("SELECT 1 FROM items WHERE id=?", (item_id,)).fetchone():
            print(f"경고: 아이템 {item_id}({kr}) 없음 — 건너뜀")
            continue
        exists = conn.execute(
            "SELECT 1 FROM mob_drops WHERE mob_id=? AND item_id=?", (mob_id, item_id)
        ).fetchone()
        if exists:
            print(f"드롭 유지: {mob_id} → {kr}")
            continue
        print(f"드롭 추가: {mob_id} → {kr}")
        if args.apply:
            conn.execute(
                "INSERT INTO mob_drops (mob_id, item_id, item_name, drop_rate) VALUES (?,?,?,NULL)",
                (mob_id, item_id, kr),
            )

    if args.apply:
        REF_PATH.write_text(json.dumps(ref, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        conn.commit()
        print("적용 완료")
    else:
        print("(dry-run — --apply 로 적용)")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
