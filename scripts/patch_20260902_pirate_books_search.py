#!/usr/bin/env python3
"""2026-09-02 검색 점검 후속 — 해적 마스터리북·스킬북 레퍼런스 등록 + 드랍률 정리.

배경: 검색·아이템 목록·상세·몹 드랍 노출이 전부 mapleland_reference.json 화이트리스트
기준인데, 레퍼런스가 2.0(해적 4차) 이전 데이터라 mob_drops 에 존재하는 해적 마스터리북
23종과 [스킬북] 7종이 어디에서도 노출되지 않았다 (예: "드래곤 스트라이크" 검색 0건).

- 마스터리북 23종 + 스킬북 7종을 mapleland_reference.json items 에 추가
  · 대상 선별: 북 이름의 스킬이 skills 테이블(사이트 지원 직업군)에 존재하는 것만.
    아란 계열 7종(오버 스윙·하이 마스터리·프리즈 스탠딩·파이널 블로우·하이 디펜스)은
    메랜 미지원 직업이라 제외.
  · name_kr 은 entity_names_en(kms) 한글명 그대로 사용
- 추가 대상 중 is_hidden=1 이던 11종 노출 전환 (20/30권 hidden 비일관 정리)
- mob_drops 드랍률 정리: 크롤 아티팩트로 확인된 값을 NULL(확률 미상)로
  · drop_rate=0.3488 13건 — 자쿰·혼테일·피아누스 해적 북에 동일값 복제
  · drop_rate=0.0 191건 — "0.00%" 로 표시되던 보스 주문서·큐브류

사용:
  python3 scripts/patch_20260902_pirate_books_search.py            # dry-run
  python3 scripts/patch_20260902_pirate_books_search.py --apply
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"

# skills 테이블 매칭으로 선별한 추가 대상 (id, 스킬 직업군)
NEW_BOOK_IDS = [
    # [스킬북] — 4차 스킬 오픈용, 기존 레퍼런스에 스킬북 항목 자체가 없었음
    (2280004, "마법사"),   # 인피니티
    (2280005, "궁수"),     # 드래곤 펄스
    (2280006, "전사"),     # 쇼다운
    (2280007, "전사"),     # 어드밴스드 콤보 (skills: 어드밴스드 콤보 어택)
    (2280008, "전사"),     # 어드밴스드 차지
    (2280009, "마법사"),   # 엔젤레이
    (2280010, "전사"),     # 트리플스로우
    # [마스터리북] 해적 4차
    (2290097, "해적"), (2290098, "해적"),  # 드래곤 스트라이크 20/30
    (2290099, "해적"), (2290100, "해적"),  # 에너지 오브 20/30
    (2290101, "해적"),                      # 슈퍼 트랜스폼 20
    (2290102, "해적"), (2290103, "해적"),  # 데몰리션 20/30
    (2290104, "해적"),                      # 스내치 20
    (2290106, "해적"), (2290107, "해적"),  # 피스트 20/30
    (2290108, "해적"),                      # 윈드 부스터 20
    (2290110, "해적"),                      # 타임 리프 20
    (2290112, "해적"),                      # 속성강화 20
    (2290114, "해적"),                      # 서포트 옥토퍼스 20
    (2290115, "해적"),                      # 에어 스트라이크 20
    (2290117, "해적"), (2290118, "해적"),  # 래피드 파이어 20/30
    (2290119, "해적"), (2290120, "해적"),  # 배틀쉽 캐논 20/30
    (2290121, "해적"), (2290122, "해적"),  # 배틀쉽 토르페도 20/30
    (2290123, "해적"),                      # 마인드 컨트롤 20
    (2290124, "해적"),                      # 어드밴스드 호밍 20
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    items_node = ref["entities"]["items"]["records"]
    item_ids = {int(r["id"]) for r in items_node}

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    added = []
    for item_id, _job in NEW_BOOK_IDS:
        if item_id in item_ids:
            print(f"이미 존재: {item_id}")
            continue
        row = conn.execute(
            "SELECT name_en FROM entity_names_en WHERE entity_type='item' AND entity_id=? AND source='kms'",
            (item_id,),
        ).fetchone()
        if row is None:
            print(f"kms 한글명 없음, 건너뜀: {item_id}")
            continue
        # 기존 마스터리북 레코드들과 동일한 필드 구성 (level 0, jobs "not")
        added.append({"id": item_id, "name_kr": row["name_en"], "level": 0, "jobs": "not"})
        print(f"아이템 추가: {item_id} {row['name_en']}")

    unhide_ids = [
        r["id"]
        for r in conn.execute(
            f"SELECT id FROM items WHERE id IN ({','.join(str(i) for i, _ in NEW_BOOK_IDS)})"
            " AND COALESCE(is_hidden, 0) = 1"
        )
    ]
    print(f"\nis_hidden 해제 대상 {len(unhide_ids)}건: {unhide_ids}")

    n_3488 = conn.execute("SELECT COUNT(*) FROM mob_drops WHERE drop_rate = 0.3488").fetchone()[0]
    n_zero = conn.execute("SELECT COUNT(*) FROM mob_drops WHERE drop_rate = 0.0").fetchone()[0]
    print(f"drop_rate NULL 전환: 0.3488 동일값 {n_3488}건, 0.0 {n_zero}건")

    if not args.apply:
        print("(dry-run — --apply 로 적용)")
        return 0

    items_node.extend(added)
    REF_PATH.write_text(json.dumps(ref, ensure_ascii=False, indent=2), encoding="utf-8")
    if unhide_ids:
        conn.execute(
            f"UPDATE items SET is_hidden = 0 WHERE id IN ({','.join(str(i) for i in unhide_ids)})"
        )
    conn.execute("UPDATE mob_drops SET drop_rate = NULL WHERE drop_rate = 0.3488")
    conn.execute("UPDATE mob_drops SET drop_rate = NULL WHERE drop_rate = 0.0")
    conn.commit()
    print("적용 완료")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
