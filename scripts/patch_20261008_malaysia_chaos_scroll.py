#!/usr/bin/env python3
"""2026-10-08 메이플랜드 패치(말레이시아 · 혼돈의 주문서 · 바이퍼 상향) 반영.

출처:
- 메랜 10/8 패치노트: https://maple.land/board/notices/h0ifyesthgb4e79hecngkcgh
  (원문 보존: data/research/malaysia/notice_20261008_patchnote.txt)
  · 신규 지역 말레이시아 맵 14개(공지 한글명) + 몬스터 16종(공지 레벨)
  · 보스 타르가 & 스칼리온 — 스푸키 월드, 선행퀘 + Lv90 + '판타지 테마파크의 영혼', 7일 1회
  · 혼돈의 주문서 드랍 몬스터 33종 명시 (확률 미공개)
  · 바이퍼: 드래곤 스트라이크 810%→850%, 피스트 230%→250%, 데몰리션 400%→435% (마스터 기준)
  · 히어로: 인레이지가 몬스터 버프 해제 스킬에 해제되지 않도록 변경
- 몹/맵 ID·스폰: maplestory.io GMS/92 (빅뱅 전 MSEA 수입 데이터 — 공지 레벨과 전부 일치 확인)
  (스폰 스냅샷: data/research/malaysia/gms92_map_spawns.json)
- HP·EXP는 GMS/92 참고값 — 메랜 실측과 다를 수 있음 (레벨은 공지 확정)

동작 (에델슈타인 patch_20260907 패턴):
- 몹/맵은 이미 mobs/maps 테이블에 존재(GMS/92 크롤) → 한글명(entity_names_en)과
  mapleland_reference.json(사이트 노출 화이트리스트) 등록 + area 지정만 수행
- mob_spawns 연결 (GMS/92 맵 JSON의 스폰 포인트 수 = 젠 수)
- 혼돈의 주문서(2049100) 드랍 테이블 보강: 기존 maplekibun 참고 행은 보존하고
  공지에만 있는 몹(보스들 + 짜증내는 좀비버섯)을 list_source='official' 로 추가
- 공지의 '발록'은 마왕 발록(8830000, 발록의 무덤 원정대 보스)으로 해석
  (주니어/크림슨 발록이면 공지가 '주니어 네키'처럼 수식어를 붙였을 것)
- 공지의 '영주 두꺼비'는 레퍼런스 기존 몹 '두꺼비 영주'(9400408, 카에데 성)로 해석
- 대보스(9400300, The Boss·뉴리프시티)는 공지로 인게임 존재가 확정되어 레퍼런스 신규 등록
- 스킬: skills.description 에 '[메이플랜드 10/8 조정]' 병기(level_data 는 KMST 원본 유지
  — patch_20260908_balance 선례), sim_skills 는 마스터 레벨 수치만 공지값으로 교정
  (skillLevels.json/엔방컷 계산기가 마스터 수치를 직접 쓰므로 기능상 필요.
  실행 후 scripts/export_skill_levels.py 재실행 필수)

주의:
- '히비스커스 길목 3'은 공지에 있으나 원본(GMS/SEA) 데이터에 없는 메랜 커스텀 맵
  → ID를 알 수 없어 보류. 인게임 실측 확보 시 추가.
- is_boss 는 배포 시드 동기화(stat-sync)에서 제외되는 컬럼이라 라이브 프로덕션에는
  --live (GAME_ADMIN_PASSWORD 필요)로 별도 반영해야 한다.

사용:
  python3 scripts/patch_20261008_malaysia_chaos_scroll.py          # dry-run
  python3 scripts/patch_20261008_malaysia_chaos_scroll.py --apply  # 로컬 DB + reference 반영
  GAME_ADMIN_PASSWORD=... python3 scripts/patch_20261008_malaysia_chaos_scroll.py --live
                                                                   # 프로덕션 is_boss 플래그 반영
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"

NOTICE_URL = "https://maple.land/board/notices/h0ifyesthgb4e79hecngkcgh"
API_BASE = os.environ.get("MAPLEDB_API_BASE", "https://memorymapledb.up.railway.app")

CHAOS_SCROLL_ID = 2049100  # 혼돈의 주문서 60% — items/reference 에 이미 존재

# (id, 메랜 한글명, 공지 레벨, is_town) — 10/8 공지 맵 목록 순.
# '히비스커스 길목 3'은 원본 데이터에 없는 메랜 커스텀 맵이라 보류.
NEW_MAPS = [
    (550000000, "트렌드 존 메트로폴리스", 1),
    (550000100, "진흙 사면 변두리", 0),
    (550000200, "진흙 사면 1", 0),
    (550000300, "진흙 사면 2", 0),
    (550000400, "진흙 사면 3", 0),
    (551000000, "캄퐁 마을", 1),
    (551000100, "히비스커스 길목 1", 0),
    (551000200, "히비스커스 길목 2", 0),
    (551010000, "판타지 테마 파크 1", 0),
    (551020000, "판타지 테마 파크 2", 0),
    (551030000, "판타지 테마 파크 3", 0),
    (551030100, "스푸키 월드 입구", 0),
    (551030200, "스푸키 월드", 0),
]

# (id, 메랜 한글명, 공지 레벨) — mobs 테이블의 GMS/92 레벨과 공지 레벨 전부 일치 확인됨.
NEW_MOBS = [
    (9420527, "클로로트랩", 45),
    (9420528, "이모 슬라임", 47),
    (9420529, "다크 피션", 52),
    (9420530, "올리 올리", 56),
    (9420531, "겁쟁이 스칼리온", 59),
    (9420532, "라타툴라", 59),
    (9420533, "로데오", 61),
    (9420534, "챠머", 65),
    (9420535, "제스터 스칼리온", 68),
    (9420536, "프로스콜라", 72),
    (9420537, "야바 두", 75),
    (9420538, "부퍼 스칼리온", 82),
    (9420539, "바이크롤라", 87),
    (9420540, "갤러페라", 94),
]

# 보스 — 공지 레벨은 '???'. GMS/92 최종 페이즈(분노 형태, Lv140/HP 1억 5천) 기준으로 등록.
# 1·2페이즈(9420542/3, 9420547/8)는 노출 목록을 어지럽히지 않도록 레퍼런스 등록 보류.
NEW_BOSSES = [
    (9420544, "타르가", 140),
    (9420549, "스칼리온", 140),
]

# 대보스(The Boss, 뉴리프시티) — 혼줌 드랍 공지로 인게임 존재 확정. 레퍼런스 신규 등록.
THE_BOSS = (9400300, "대보스", 175)

BOSS_SPAWN_TIME = "7일 1회"  # 공지: 7일에 1회 도전 가능

# mob_id → [(map_id, 스폰 포인트 수)] — data/research/malaysia/gms92_map_spawns.json 기준
SPAWNS: dict[int, list[tuple[int, int]]] = {
    9420527: [(550000100, 15)],                    # 클로로트랩 — 진흙 사면 변두리
    9420528: [(550000100, 14)],                    # 이모 슬라임 — 진흙 사면 변두리
    9420529: [(550000200, 15)],                    # 다크 피션 — 진흙 사면 1
    9420530: [(550000200, 13)],                    # 올리 올리 — 진흙 사면 1
    9420533: [(550000300, 17), (551000100, 9)],    # 로데오 — 진흙 사면 2 · 히비스커스 길목 1
    9420534: [(550000400, 16), (551000100, 6)],    # 챠머 — 진흙 사면 3 · 히비스커스 길목 1
    9420531: [(551000200, 18)],                    # 겁쟁이 스칼리온 — 히비스커스 길목 2
    9420532: [(551000200, 19)],                    # 라타툴라 — 히비스커스 길목 2
    9420535: [(551010000, 13)],                    # 제스터 스칼리온 — 판타지 테마 파크 1
    9420536: [(551010000, 16)],                    # 프로스콜라 — 판타지 테마 파크 1
    9420537: [(551020000, 7)],                     # 야바 두 — 판타지 테마 파크 2
    9420538: [(551020000, 10)],                    # 부퍼 스칼리온 — 판타지 테마 파크 2
    9420539: [(551030000, 26)],                    # 바이크롤라 — 판타지 테마 파크 3
    9420540: [(551030100, 17)],                    # 갤러페라 — 스푸키 월드 입구
    # 보스 — 스푸키 월드 (소환식이라 맵 JSON에 스폰 없음 → 수동 연결, 젠 수 NULL)
    9420544: [(551030200, 0)],
    9420549: [(551030200, 0)],
}

# 혼돈의 주문서 드랍 — 공지 33종 중 기존 maplekibun 참고 행(24종)에 없는 몹만 추가.
# (mob_id, 공지 표기) — 확률 미공개라 drop_rate 는 NULL, list_source='official'.
CHAOS_NEW_DROPS = [
    (2230131, "짜증내는 좀비버섯"),
    (8830000, "발록"),          # 마왕 발록 — 발록의 무덤 원정대 보스
    (8510000, "피아누스"),      # 우측
    (8520000, "피아누스"),      # 좌측
    (8800100, "카오스 자쿰"),
    (9420544, "타르가"),
    (9420549, "스칼리온"),
    (9400300, "대보스"),
    (9400408, "영주 두꺼비"),   # 레퍼런스 표기는 '두꺼비 영주'
    (8820014, "핑크빈"),
]

SKILL_MARKER = "[메이플랜드 10/8 조정]"

# (job_class, skill_name, 공지 내용, sim_skill_id, sim 마스터 damage 신값)
SKILL_CHANGES = [
    ("해적", "드래곤 스트라이크", "데미지 마스터 기준 810% → 850%.", 5121001, "850"),
    ("해적", "피스트", "데미지 마스터 기준 230% → 250%.", 5121007, "250"),
    ("해적", "데몰리션", "기본 공격력 마스터 기준 400% → 435%.", 5121004, "435"),
    ("전사", "인레이지", "몬스터의 버프 해제 스킬에도 해제되지 않도록 변경.", None, None),
]


def apply_skills(conn: sqlite3.Connection, apply: bool) -> None:
    for job, name, note, sim_id, new_damage in SKILL_CHANGES:
        row = conn.execute(
            "SELECT description FROM skills WHERE job_class=? AND skill_name=?", (job, name)
        ).fetchone()
        if row is None:
            print(f"경고: skills 에 {job}/{name} 없음")
        elif SKILL_MARKER in (row[0] or ""):
            print(f"skills SKIP(이미 반영): {name}")
        else:
            print(f"skills 주석: {name} — {note}")
            if apply:
                desc = (row[0] or "").rstrip()
                conn.execute(
                    "UPDATE skills SET description=? WHERE job_class=? AND skill_name=?",
                    (f"{desc}\n{SKILL_MARKER} {note}", job, name),
                )
        if sim_id is None:
            continue
        sim = conn.execute(
            "SELECT level_properties FROM sim_skills WHERE id=?", (sim_id,)
        ).fetchone()
        if sim is None:
            print(f"경고: sim_skills {sim_id}({name}) 없음")
            continue
        props = json.loads(sim[0])
        old = props[-1].get("damage")
        if old == new_damage:
            print(f"sim SKIP(이미 반영): {name} 마스터 {new_damage}%")
            continue
        print(f"sim: {name} 마스터 damage {old}% → {new_damage}%")
        if apply:
            props[-1]["damage"] = new_damage
            conn.execute(
                "UPDATE sim_skills SET level_properties=?, source_url=? WHERE id=?",
                (json.dumps(props, ensure_ascii=False), NOTICE_URL, sim_id),
            )


def apply_live_boss_flags() -> None:
    """프로덕션 mobs.is_boss 는 시드 stat-sync 제외 컬럼이라 admin API로 직접 반영."""
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "")
    if not admin_pw:
        sys.exit("GAME_ADMIN_PASSWORD 환경변수가 필요합니다")
    for mob_id, kr, _ in [*NEW_BOSSES, THE_BOSS]:
        req = urllib.request.Request(
            f"{API_BASE}/api/admin/mobs/{mob_id}",
            data=json.dumps({"is_boss": 1, "name_kr": kr}, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Admin-Password": admin_pw},
            method="PATCH",
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"live PATCH {mob_id} {kr}:", json.load(r))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--live", action="store_true", help="프로덕션 is_boss 플래그 admin PATCH")
    args = ap.parse_args()

    if args.live:
        apply_live_boss_flags()
        return 0

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    mobs_node = ref["entities"]["mobs"]["records"]
    maps_node = ref["entities"]["maps"]["records"]
    ref_mob_ids = {int(r["id"]) for r in mobs_node}
    ref_map_ids = {int(r["id"]) for r in maps_node}

    conn = sqlite3.connect(DB_PATH)
    map_kr = {i: kr for i, kr, _ in NEW_MAPS}

    # 1. 맵 — area/is_town 지정 + reference + 한글명
    for i, kr, is_town in NEW_MAPS:
        row = conn.execute("SELECT name FROM maps WHERE id=?", (i,)).fetchone()
        if not row:
            print(f"경고: maps 에 {i}({kr}) 없음 — GMS/92 크롤 데이터 확인 필요")
            continue
        print(f"map: {i} {row[0]} ({kr}){' [마을]' if is_town else ''}")
        if args.apply:
            conn.execute("UPDATE maps SET area=?, is_town=? WHERE id=?", ("말레이시아", is_town, i))
            conn.execute(
                "INSERT OR IGNORE INTO entity_names_en (entity_type, entity_id, name_en, source) VALUES ('map', ?, ?, 'kms')",
                (i, kr),
            )
        if i not in ref_map_ids:
            maps_node.append({"id": i, "name_kr": kr})
            ref_map_ids.add(i)
            print(f"  reference 맵 등록: {i} {kr}")

    # 2. 몹 — 한글명 + reference (레벨·HP는 GMS/92 값이 이미 mobs 테이블에 있음)
    for i, kr, lv in NEW_MOBS + NEW_BOSSES + [THE_BOSS]:
        row = conn.execute("SELECT name, level, hp FROM mobs WHERE id=?", (i,)).fetchone()
        if not row:
            print(f"경고: mobs 에 {i}({kr}) 없음 — GMS/92 크롤 데이터 확인 필요")
            continue
        en, db_lv, hp = row
        if db_lv != lv:
            print(f"  주의: {kr} 공지 레벨 {lv} ≠ DB 레벨 {db_lv}")
        print(f"mob: {i} {en} ({kr}) Lv{lv} hp={hp}")
        if args.apply:
            conn.execute(
                "INSERT OR IGNORE INTO entity_names_en (entity_type, entity_id, name_en, source) VALUES ('mob', ?, ?, 'kms')",
                (i, kr),
            )
        if i not in ref_mob_ids:
            rec = {"id": i, "name_kr": kr, "level": lv}
            if hp:
                rec["hp"] = hp
            mobs_node.append(rec)
            ref_mob_ids.add(i)
            print(f"  reference 몹 등록: {i} {kr} Lv{lv}")

    # 3. 보스 플래그 (로컬 시드 — 프로덕션은 --live 로 별도 반영)
    for i, kr, _ in [*NEW_BOSSES, THE_BOSS]:
        print(f"boss 플래그: {i} {kr} is_boss=1" + (f", spawn_time='{BOSS_SPAWN_TIME}'" if i != THE_BOSS[0] else ""))
        if args.apply:
            conn.execute("UPDATE mobs SET is_boss=1 WHERE id=?", (i,))
            if i != THE_BOSS[0]:
                conn.execute("UPDATE mobs SET spawn_time=? WHERE id=?", (BOSS_SPAWN_TIME, i))

    # 4. 스폰 연결
    spawn_count = 0
    for mob_id, places in SPAWNS.items():
        for map_id, points in places:
            exists = conn.execute(
                "SELECT 1 FROM mob_spawns WHERE mob_id=? AND map_id=?", (mob_id, map_id)
            ).fetchone()
            if exists:
                print(f"spawn SKIP(존재): {mob_id} → {map_id}")
                continue
            spawn_count += 1
            print(f"spawn: {mob_id} → {map_id} {map_kr[map_id]} (젠 {points or '―'})")
            if args.apply:
                conn.execute(
                    "INSERT INTO mob_spawns (mob_id, map_id, map_name, spawn_count) VALUES (?,?,?,?)",
                    (mob_id, map_id, map_kr[map_id], points or None),
                )

    # 5. 혼돈의 주문서 드랍 — 공지에만 있는 몹 추가 (기존 maplekibun 참고 행 보존)
    item_name = conn.execute("SELECT name FROM items WHERE id=?", (CHAOS_SCROLL_ID,)).fetchone()
    if not item_name:
        sys.exit(f"items 에 혼돈의 주문서({CHAOS_SCROLL_ID})가 없습니다")
    drop_count = 0
    for mob_id, label in CHAOS_NEW_DROPS:
        exists = conn.execute(
            "SELECT list_source FROM mob_drops WHERE mob_id=? AND item_id=?",
            (mob_id, CHAOS_SCROLL_ID),
        ).fetchone()
        if exists:
            print(f"drop SKIP(존재): {label}({mob_id})")
            continue
        drop_count += 1
        print(f"drop: {label}({mob_id}) → 혼돈의 주문서 60% [official]")
        if args.apply:
            conn.execute(
                "INSERT INTO mob_drops (mob_id, item_id, item_name, drop_rate, drop_rate_source, list_source) VALUES (?,?,?,NULL,NULL,'official')",
                (mob_id, CHAOS_SCROLL_ID, item_name[0]),
            )

    # 6. 스킬 조정
    apply_skills(conn, args.apply)

    if args.apply:
        REF_PATH.write_text(json.dumps(ref, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        from crawler.db import rebuild_search_index

        rebuild_search_index(conn)
        conn.commit()
        print(f"\napplied: maps={len(NEW_MAPS)}, mobs={len(NEW_MOBS) + len(NEW_BOSSES) + 1}, "
              f"spawns={spawn_count}, chaos_drops={drop_count}")
        print("다음 단계: python3 crawler/fetch_map_details.py  (말레이시아 13맵 상세 수집)")
        print("          python3 scripts/export_skill_levels.py (skillLevels.json 재생성)")
    else:
        print(f"\ndry-run: spawns={spawn_count}, chaos_drops={drop_count}; --apply 로 반영")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
