#!/usr/bin/env python3
"""2026-09-07 배틀메이지 출시 후 커뮤니티 실측 반영 (9/7~9/8 디시 메이플랜드 갤러리).

근거 (전부 몬스터북/인벤토리 스크린샷 판독으로 검증, 글번호는 디시 메랜갤):
- 마스터리북 드롭 확정:
  · 어드밴스드 다크오라 20 ← 파풀라투스 70%·스킬Lv5+ (no=3942941), 라이카 (9/4 몬스터북, no=3933442)
  · 어드밴스드 옐로우오라 30 ← 망각의 수호대장 50%·스킬Lv15+ (9/4 몬스터북, no=3933442)
  · 다크 제네시스 30 ← 망각의 수호병 50%·스킬Lv15+ (no=3942941)
  · 쉘터 20 ← 망각의 사제 (no=3943054)
  · 싸이클론 30 ← 후회의 수호대장 50%·스킬Lv15+ (no=3942951)
  ※ 미확정 제보(뉴트 주니어→싸이클론 20, 망각의 수호대→어드 옐로우오라 20)는 넣지 않음.
  ※ 빅뱅 후 KMS 드롭표(광석 이터→피니쉬 블로우 등)는 메랜 미적용 확정 — 광석 이터
    몬스터북 전리품 실측에 배메 마북 없음 (no=3944293 댓글, 3942833).
- 마북 아이템 ID: GMS v95 원본 (maplestory.io/api/GMS/95 item 검색) — 2290226~2290236.
  쉘터의 GMS 원명은 Party Shield.
- 몹 실측 (no=3943694, 버닝 월드 EXP×2/3=본섭 환산 / no=3942833 몬스터북):
  · EXP 9종 본섭 환산값 반영 (기존 GMS v95 참고값 대비 약 2.3배)
  · 광석 이터 HP 57000·MP 250 (몬스터북 표기 — 확정)
  · 라키 HP 약 15000 (글쓴이 실측 근사값)

사용:
  python3 scripts/patch_20260908_community.py            # dry-run
  python3 scripts/patch_20260908_community.py --apply
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

# (item_id, GMS 원명, 한글명) — 한글명은 인게임 툴팁 판독 표기
NEW_BOOKS = [
    (2290226, "[Mastery Book]Advanced Dark Aura 20", "어드밴스드 다크오라 20"),
    (2290227, "[Mastery Book]Advanced Dark Aura 30", "어드밴스드 다크오라 30"),
    (2290228, "[Mastery Book]Advanced Yellow Aura 20", "어드밴스드 옐로우오라 20"),
    (2290229, "[Mastery Book]Advanced Yellow Aura 30", "어드밴스드 옐로우오라 30"),
    (2290230, "[Mastery Book]Finishing Blow 20", "피니쉬 블로우 20"),
    (2290231, "[Mastery Book]Finishing Blow 30", "피니쉬 블로우 30"),
    (2290232, "[Mastery Book]Twister Spin 20", "싸이클론 20"),
    (2290233, "[Mastery Book]Twister Spin 30", "싸이클론 30"),
    (2290234, "[Mastery Book]Dark Genesis 20", "다크 제네시스 20"),
    (2290235, "[Mastery Book]Dark Genesis 30", "다크 제네시스 30"),
    (2290236, "[Mastery Book]Party Shield 20", "쉘터 20"),
]

# (mob_id, item_id, drop_rate|None) — 몬스터북 스크린샷 검증분만
NEW_DROPS = [
    (8500002, 2290226, None),  # 파풀라투스 → 어드 다크오라 20
    (8220006, 2290226, None),  # 라이카 → 어드 다크오라 20
    (8200012, 2290229, None),  # 망각의 수호대장 → 어드 옐로우오라 30
    (8200011, 2290235, None),  # 망각의 수호병 → 다크 제네시스 30
    (8200009, 2290236, None),  # 망각의 사제 → 쉘터 20
    (8200008, 2290233, None),  # 후회의 수호대장 → 싸이클론 30
]

# 9/6 퀘스트창 스크린샷 판독 (no=3940014) — 9/4 공지 목록에 없던 신규 아모리아 퀘스트
NEW_QUESTS = [
    {
        "name": "아모리아의 벚꽃 정원",
        "level_req": 35,
        "area": "아모리아",
        "start_location": "웨딩빌리지(아모리아) — 정원사 제이콥",
        "quest_conditions": '["벚나무 묘목 25개 (사쿠라 셀리온)", "비단 깃털 10개 (주니어 라이오너)", "동물의 가죽 10개"]',
        "note": "정원 확장을 고민하는 제이콥의 수집 퀘스트. 보상은 고급 포션(퀘스트창 대사 기준).",
        "tip": "벚나무 묘목은 사쿠라 셀리온 드롭 — 아모리아 인근 맵에서 파밍했다는 실측(디시 3940014). 사쿠라 셀리온 출현 맵의 메랜 명칭은 실측 대기.",
        "quest_type": "일반",
    },
]

# (mob_id, 한글명, {컬럼: 실측값})
MOB_MEASURED = [
    (7150000, "라키", {"hp": 15000, "exp": 452}),
    (7150001, "빅 스파이더", {"exp": 472}),
    (7150002, "카트베어", {"exp": 488}),
    (7150004, "경비로봇L", {"exp": 630}),
    (8105001, "방어 시스템", {"exp": 1500}),
    (8105002, "강화된 방어 시스템", {"exp": 1780}),
    (8105003, "AF형 안드로이드", {"exp": 2100}),
    (8105004, "고장난 DF형 안드로이드", {"exp": 2300}),
    (8105005, "광석 이터", {"hp": 57000, "mp": 250, "exp": 3050}),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    ref_items = ref["entities"]["items"]["records"]
    ref_ids = {int(r["id"]) for r in ref_items}

    for item_id, name_en, kr in NEW_BOOKS:
        exists = conn.execute("SELECT 1 FROM items WHERE id=?", (item_id,)).fetchone()
        if exists:
            print(f"아이템 유지: {item_id} {kr}")
        else:
            print(f"아이템 추가: {item_id} {name_en} ({kr})")
            if args.apply:
                conn.execute(
                    """INSERT INTO items (id, name, category, subcategory, level_req,
                       description, icon_url, overall_category)
                       VALUES (?, ?, 'Character Modification', 'Mastery Book', 0, ?, ?, 'Use')""",
                    (
                        item_id,
                        name_en,
                        f"[마스터리북] {kr} — 2026-09-07 배틀메이지 패치로 추가.",
                        f"https://maplestory.io/api/gms/95/item/{item_id}/icon",
                    ),
                )
        if args.apply:
            conn.execute(
                "INSERT OR IGNORE INTO entity_names_en (entity_type, entity_id, name_en, source) "
                "VALUES ('item', ?, ?, 'kms')",
                (item_id, f"[마스터리북]{kr}"),
            )
        if item_id not in ref_ids:
            print(f"레퍼런스 추가: {item_id} [마스터리북] {kr}")
            ref_items.append({"id": item_id, "name_kr": f"[마스터리북] {kr}", "level": 0, "jobs": "not"})

    for mob_id, item_id, rate in NEW_DROPS:
        kr = next(k for i, _, k in NEW_BOOKS if i == item_id)
        exists = conn.execute(
            "SELECT 1 FROM mob_drops WHERE mob_id=? AND item_id=?", (mob_id, item_id)
        ).fetchone()
        if exists:
            print(f"드롭 유지: {mob_id} → {kr}")
            continue
        print(f"드롭 추가: {mob_id} → [마스터리북]{kr}")
        if args.apply:
            conn.execute(
                "INSERT INTO mob_drops (mob_id, item_id, item_name, drop_rate) VALUES (?,?,?,?)",
                (mob_id, item_id, f"[마스터리북]{kr}", rate),
            )

    for q in NEW_QUESTS:
        exists = conn.execute("SELECT 1 FROM quests WHERE name=?", (q["name"],)).fetchone()
        if exists:
            print(f"퀘스트 유지: {q['name']}")
        else:
            print(f"퀘스트 추가: {q['name']} (Lv.{q['level_req']}+)")
            if args.apply:
                conn.execute(
                    """INSERT INTO quests (
                        name, level_req, area, start_location, quest_conditions,
                        exp_reward, meso_reward, note, tip, difficulty,
                        quest_type, is_mapleland, category
                    ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, '미확인', ?, 1, '아모리아')""",
                    (
                        q["name"], q["level_req"], q["area"], q["start_location"],
                        q["quest_conditions"], q["note"], q["tip"], q["quest_type"],
                    ),
                )

    for mob_id, kr, vals in MOB_MEASURED:
        row = conn.execute(
            f"SELECT {', '.join(vals.keys())} FROM mobs WHERE id=?", (mob_id,)
        ).fetchone()
        if not row:
            print(f"경고: 몹 {mob_id}({kr}) 없음")
            continue
        changes = {c: v for (c, v), old in zip(vals.items(), row) if old != v}
        if not changes:
            print(f"몹 유지: {kr}")
            continue
        print(f"몹 실측: {kr} {dict(zip(vals.keys(), row))} → {vals}")
        if args.apply:
            sets = ", ".join(f"{c}=?" for c in changes)
            conn.execute(f"UPDATE mobs SET {sets} WHERE id=?", (*changes.values(), mob_id))

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
