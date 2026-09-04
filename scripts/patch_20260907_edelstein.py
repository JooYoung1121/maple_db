#!/usr/bin/env python3
"""2026-09-07 메이플랜드 패치(레지스탕스 배틀메이지 · 에델슈타인) 선반영.

출처:
- 메랜 9/7 패치노트: https://maple.land/board/notices/nbudy1h3t2wjeqrx8i94yupm (몹 25종 + 맵 목록, 한글명)
- 원본 공지(KMS 1.2.105, 2010-07-22): https://archive.maplestory.nexon.com/News/Update/147
  → 몬스터 29종 레벨(훈련로봇 A~D 포함), 맵 47개(이동 맵 별도), 퀘스트 117종
- 몹/맵 ID: maplestory.io GMS/117(빅뱅기, 원본 ID·레벨 보존)에서 한글명·레벨 대조로 확정
  · 저레벨 몹 ID가 공지 레벨과 전부 일치(새싹 화분 150000=Lv5 … 광석 이터 8105005=Lv101)
- 몹 상세(HP·EXP): GMS/117 크롤값 — 메랜은 "빅뱅 이전 KMST" 수치라 실측과 다를 수 있음(레벨은 공지 확정)

동작:
- mobs / maps / skills 테이블에 신규 행 INSERT (기존 행 미접촉 — start.sh additive 시드로 라이브 반영)
- KMS 1.2.105 공지의 퀘스트 117종을 원작 참고 데이터(is_mapleland=0)로 등록
- entity_names_en 에 kms 한글명 추가
- mapleland_reference.json 에 몹/맵 등록 (사이트 노출 화이트리스트)
- mob_spawns 연결 (GMS/117 foundAt ∩ 등록 맵)

사용:
  python3 scripts/patch_20260907_edelstein.py          # dry-run
  python3 scripts/patch_20260907_edelstein.py --apply
  (--details 생략 시 저장소에 보존한 GMS/95 원본 상세를 자동 사용)
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"
RESEARCH_DIR = ROOT / "data" / "research" / "battle_mage"
DEFAULT_DETAILS_PATH = RESEARCH_DIR / "edel_mob_details_gms95.json"
KMS_105_PATH = RESEARCH_DIR / "kms_1_2_105_update_147.txt"
KMST_SKILLS_PATH = RESEARCH_DIR / "kmst_skills_20100608.txt"

ICON = "https://maplestory.io/api/GMS/117/mob/{id}/icon"
SRC = "https://maplestory.io/api/GMS/95/mob/{id}"

MAPLELAND_NOTICE = "https://maple.land/board/notices/nbudy1h3t2wjeqrx8i94yupm"
KMS_105_NOTICE = "https://archive.maplestory.nexon.com/News/Update/147?p=12"
KMST_SKILL_SOURCE = "https://maplestory.pe.kr/1873"

# (id, 메랜 한글명, 공지 레벨, GMS 영문명)
NEW_MOBS = [
    (150000, "새싹 화분", 5, "Potted Sprout"),
    (150001, "나팔꽃 화분", 6, "Potted Morning Glory"),
    (150002, "포도주스병", 8, "Grape Juice Bottle"),
    (1150000, "순찰로봇", 14, "Patrol Robot"),
    (1150001, "이상한 이정표", 16, "Strange Sign"),
    (1150002, "구렁이", 18, "Serpent"),
    (2150000, "물 도둑", 20, "Water Thief Monster"),
    (2150001, "더스트 박스", 22, "Dust Box"),
    (2150002, "가로등", 25, "Streetlight"),
    (2150003, "순찰로봇S", 28, "Patrol Robot S"),
    (3150000, "안전제일", 31, "Safety First"),
    (3150001, "아기 바위베어먹기", 33, "Baby Boulder Muncher"),
    (3150002, "큰 바위베어먹기", 35, "Big Boulder Muncher"),
    (6150000, "경비로봇", 67, "Guard Robot"),
    (7150000, "라키", 70, "Racoco"),
    (7150001, "빅 스파이더", 72, "Big Spider"),
    (7150002, "카트베어", 74, "Cart Bear"),
    (7150003, "라쿤", 76, "Racaroni"),
    (7150004, "경비로봇L", 79, "Guard Robot L"),
    (8105000, "라칸", 82, "Raco"),
    (8105001, "방어 시스템", 87, "Security System"),
    (8105002, "강화된 방어 시스템", 90, "Enhanced Security System"),
    (8105003, "AF형 안드로이드", 93, "AF Android"),
    (8105004, "고장난 DF형 안드로이드", 96, "Broken DF Android"),
    (8105005, "광석 이터", 101, "Ore Muncher"),
    # 트레이닝 룸 몹 — 메랜 9/7 공지 몹 목록엔 없지만 원본 공지(1.2.105)와 트레이닝 룸 맵 존재로 포함
    (9300409, "훈련로봇A", 10, "Training Robot A"),
    (9300410, "훈련로봇B", 11, "Training Robot B"),
    (9300411, "훈련로봇C", 12, "Training Robot C"),
    (9300412, "훈련로봇D", 13, "Training Robot O"),
]

# (id, 메랜 한글명, GMS street, GMS name) — 메랜 9/7 공지 목록 순
NEW_MAPS = [
    (104020130, "에델슈타인행 승강장", "Port Road", "Station to Edelstein"),
    (200000170, "정거장<에델슈타인행>", "Orbis", "Station <To Edelstein>"),
    (200090600, "에델슈타인행", "In Flight", "To Edelstein"),
    (310000010, "에델슈타인 임시공항", "Edelstein", "Edelstein Temporary Airport"),
    (310020200, "에델슈타인 공원3", "Concrete Road", "Edelstein Park 3"),
    (310020100, "에델슈타인 공원2", "Concrete Road", "Edelstein Park 2"),
    (310020000, "에델슈타인 공원1", "Concrete Road", "Edelstein Park"),
    (310000000, "에델슈타인", "Edelstein", "Edelstein"),
    (310000004, "저택", "Edelstein", "Mansion"),
    (310000001, "에델슈타인 의회", "Edelstein", "Edelstein City Hall"),
    (310000003, "에델슈타인 헤어샵", "Edelstein", "Edelstein Hair Salon"),
    (310010000, "비밀 광장", "Resistance Headquarters", "Secret Plaza"),
    (310010010, "트레이닝 룸 입구", "Resistance Headquarters", "Training Room Entrance"),
    (310010100, "지하 2층 트레이닝 룸 A", "Resistance Headquarters", "Training Room A"),
    (310010200, "지하 3층 트레이닝 룸 B", "Resistance Headquarters", "Training Room B"),
    (310010300, "지하 4층 트레이닝 룸 C", "Resistance Headquarters", "Training Room C"),
    (310010400, "지하 5층 트레이닝 룸 D", "Resistance Headquarters", "Training Room D"),
    (310010500, "지하 6층 트레이닝 룸 포스", "Resistance Headquarters", "Training Room E"),
    (310030000, "에델슈타인 산책로1", "Concrete Road", "Edelstein Strolling Path"),
    (310030100, "에델슈타인 산책로2", "Concrete Road", "Edelstein Strolling Path 2"),
    (310030110, "뱀 나오는 길", "Concrete Road", "Serpent Path"),
    (310030200, "에델슈타인 산책로3", "Concrete Road", "Edelstein Strolling Path 3"),
    (310030300, "에델슈타인 산책로4", "Concrete Road", "Edelstein Strolling Path 4"),
    (310030310, "가로등길", "Concrete Road", "Streetlight Row"),
    (310040000, "광산 가는 길1", "Dry Road", "Road to the Mine 1"),
    (310040100, "광산 가는 길2", "Dry Road", "Road to the Mine 2"),
    (310040110, "숨겨진 포탈", "Dry Road", "Hidden Portal"),
    (310040400, "광석길", "Dry Road", "Ore Trail"),
    (310040300, "바위길", "Dry Road", "Rocky Road"),
    (310040200, "광산 입구", "Dry Road", "Mine Entrance"),
    (310050000, "발전소 로비", "Verne Mine", "Power Plant Lobby"),
    (310050100, "발전소 보안대", "Verne Mine", "Power Plant Security"),
    (310050200, "갱도 입구1", "Verne Mine", "Shaft Entrance 1"),
    (310050300, "갱도 입구2", "Verne Mine", "Shaft Entrance 2"),
    (310050400, "제 1 광장", "Verne Mine", "First Square"),
    (310050500, "갱도1", "Verne Mine", "Shaft 1"),
    (310050510, "너구리 소굴", "Verne Mine", "Raccoon Nest"),
    (310050520, "위험한 너구리 소굴", "Verne Mine", "Dangerous Raccoon Nest"),
    (310050600, "갱도2", "Verne Mine", "Shaft 2"),
    (310050700, "갱도3", "Verne Mine", "Shaft 3"),
    (310050800, "갱도4", "Verne Mine", "Shaft 4"),
    (310060000, "제 2 광장", "Gelimer Research Lab", "Second Square"),
    (310060100, "안드로이드 연구소1", "Gelimer Research Lab", "Android Research Lab"),
    (310060110, "안드로이드 연구소2", "Gelimer Research Lab", "Android Research Lab 2"),
    (310060120, "안드로이드 연구소3", "Gelimer Research Lab", "Android Research Lab 3"),
    (310060200, "방어 시스템 연구소1", "Gelimer Research Lab", "Security System Research Center 1"),
    (310060210, "방어 시스템 연구소2", "Gelimer Research Lab", "Security System Research Center 2"),
    (310060220, "방어 시스템 연구소3", "Gelimer Research Lab", "Security System Research Center 3"),
]


# 초기 KMST 덤프에 실제 레벨별 수치가 있는 스킬과 당시 마스터 레벨.
# KMS 1.2.105 최종 목록에서 마스터 레벨이 바뀐 경우에는 잘못된 레벨표를 노출하지 않는다.
RAW_MASTER_LEVELS = {
    "크리스탈스로우": 3,
    "잠입": 3,
    "이피션시": 3,
    "트리플블로우": 20,
    "피니쉬어택": 10,
    "텔레포트": 15,
    "다크오라": 20,
    "쿼드블로우": 20,
    "다크체인": 30,
    "블루오라": 20,
    "옐로우오라": 20,
    "블러드드레인": 20,
    "스태프부스터": 20,
    "어드밴스드블루오라": 20,
    "스태프마스터리": 20,
    "데스블로우": 30,
    "다크라이트닝": 30,
    "컨버전": 20,
    "슈퍼바디": 20,
    "리바이브": 20,
    "스탠스": 30,
    "어드밴스드다크오라": 30,
    "어드밴스드옐로우오라": 30,
    "피니쉬블로우": 30,
    "싸이클론": 30,
    "다크제네시스": 30,
    "쉘터": 30,
}

PASSIVE_SKILLS = {
    "이피션시", "스태프 마스터리", "배틀 마스터리", "어드밴스드 블루 오라",
    "텔레포트 마스터리", "에너자이즈",
}

SKILL_FALLBACKS = {
    "스태프 마스터리": "스태프 계열 무기의 숙련도와 마력을 높인다.",
    "배틀 마스터리": "근접 전투 능력을 강화하는 배틀메이지 패시브 스킬.",
    "어드밴스드 다크체인": "다크 체인을 강화하여 더 강하게 적을 끌어온다.",
    "텔레포트 마스터리": "텔레포트에 공격 기능을 더한다.",
    "메이플 용사": "일정 시간 파티원의 모든 능력치를 향상시킨다.",
    "용사의 의지": "특정 상태 이상에서 벗어난다.",
    "에너자이즈": "배틀메이지의 전투 능력을 강화하는 4차 패시브 스킬.",
}

RESEARCH_NOTE_MARKER = "[배틀메이지 9/7 리서치]"


def _clean_line(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def _skill_key(value: str) -> str:
    return value.replace(" ", "").replace("컨버젼", "컨버전")


def parse_kmst_skill_blocks() -> dict[str, dict]:
    """2010-06-08 KMST 덤프에서 설명과 레벨별 효과를 추출한다."""
    lines = [_clean_line(line) for line in KMST_SKILLS_PATH.read_text(encoding="utf-8").splitlines()]
    header = re.compile(r"^(시티즌|배틀메이지\(\d차\))>(.+)$")
    indices = [i for i, line in enumerate(lines) if header.match(line)]
    blocks: dict[str, dict] = {}
    for pos, start in enumerate(indices):
        match = header.match(lines[start])
        assert match is not None
        raw_name = match.group(2)
        key = _skill_key(raw_name)
        if key not in RAW_MASTER_LEVELS:
            continue
        end = indices[pos + 1] if pos + 1 < len(indices) else len(lines)
        body = [line for line in lines[start + 1:end] if line and not re.fullmatch(r"[- ]+", line)]
        expected = RAW_MASTER_LEVELS[key]
        if len(body) < expected:
            raise ValueError(f"KMST 스킬 레벨 데이터 부족: {raw_name} {len(body)}<{expected}")
        effects = body[-expected:]
        description = " ".join(body[:-expected])
        blocks[key] = {
            "description": description,
            "raw_master_level": expected,
            "effects": effects,
        }
    return blocks


def parse_official_battle_mage_skills() -> list[dict]:
    """KMS 1.2.105 공식 공지의 최종 스킬명·마스터 레벨을 기준축으로 삼는다."""
    lines = [_clean_line(line) for line in KMS_105_PATH.read_text(encoding="utf-8").splitlines()]
    branch_by_section = {1: "시티즌", 2: "1차", 3: "2차", 4: "3차", 5: "4차"}
    current_branch: str | None = None
    rows: list[dict] = []
    in_resistance_skills = False
    raw_blocks = parse_kmst_skill_blocks()
    for line in lines:
        if line == "[레지스탕스] 배틀메이지, 와일드헌터 신규스킬이 추가되었습니다.":
            in_resistance_skills = True
            continue
        if not in_resistance_skills:
            continue
        section = re.match(r"^(\d+)\. (.+)$", line)
        if section:
            number = int(section.group(1))
            if number == 6:
                break
            current_branch = branch_by_section.get(number)
            continue
        if not current_branch or not line.startswith("-"):
            continue
        match = re.match(r"^-\s*(.+?)\((\d+)\)$", line)
        if not match:
            continue
        name = match.group(1).strip()
        master_level = int(match.group(2))
        key = _skill_key(name)
        raw = raw_blocks.get(key)
        level_data: list[dict] = []
        if raw and raw["raw_master_level"] == master_level:
            level_data = [
                {"level": level, "effect": effect}
                for level, effect in enumerate(raw["effects"], start=1)
            ]
        description = SKILL_FALLBACKS.get(name)
        if raw:
            description = raw["description"]
            if raw["raw_master_level"] != master_level:
                description += (
                    f" 초기 KMST 시험판은 마스터 Lv.{raw['raw_master_level']}였으나 "
                    f"KMS 1.2.105 최종 목록은 Lv.{master_level}이다."
                )
        rows.append({
            "job_class": "배틀메이지",
            "job_branch": current_branch,
            "skill_name": name,
            "master_level": master_level,
            "skill_type": "passive" if name in PASSIVE_SKILLS else "active",
            "description": description or "KMS 1.2.105 공식 스킬 목록에서 확인된 배틀메이지 스킬.",
            "level_data": json.dumps(level_data, ensure_ascii=False),
            "source_post_url": KMST_SKILL_SOURCE if raw else KMS_105_NOTICE,
        })
    if len(rows) != 33:
        raise ValueError(f"배틀메이지 공식 스킬 파싱 결과가 33개가 아님: {len(rows)}")
    return rows


def parse_legacy_quests() -> list[dict]:
    """KMS 1.2.105 공지에 열거된 레지스탕스·에델슈타인 퀘스트 117종."""
    lines = [_clean_line(line) for line in KMS_105_PATH.read_text(encoding="utf-8").splitlines()]
    rows: list[dict] = []
    group: str | None = None
    for line in lines:
        if "레지스탕스에 관련된 새로운 퀘스트가 추가되었습니다." in line:
            group = "레지스탕스"
            continue
        if "에델슈타인에 관련된 새로운 퀘스트가 추가되었습니다." in line:
            group = "에델슈타인"
            continue
        if group and line == "이전글":
            break
        if not group or not line.startswith("-"):
            continue
        payload = line[1:].strip()
        if not payload:
            continue
        name, separator, rest = payload.partition(":")
        name = name.strip()
        rest = rest.strip() if separator else ""
        level_match = re.search(r"(?:레벨\s*)?(\d+)\s*이상", rest)
        level = int(level_match.group(1)) if level_match else 0
        npc = rest.split(",", 1)[0].strip() if rest else ""
        if npc.startswith("레벨") or re.match(r"^\d+\s*이상", npc):
            npc = ""
        condition = rest or "원문에 NPC·레벨 조건 미기재"
        rows.append({
            "name": name,
            "level_req": level,
            "area": "에델슈타인",
            "start_location": f"에델슈타인 · {npc}" if npc else "에델슈타인",
            "quest_conditions": json.dumps([condition], ensure_ascii=False),
            "note": (
                f"{RESEARCH_NOTE_MARKER} KMS 1.2.105 공식 공지의 {group} 퀘스트 목록. "
                "메이플랜드의 세부 수행 조건·보상·대사는 출시 후 인게임 확인이 필요합니다."
            ),
            "tip": "원작 공식 목록 기반 참고 데이터입니다. 메이플랜드 확정값과 구분해 확인하세요.",
            "difficulty": "필수" if group == "레지스탕스" else None,
            "is_chain": 0,
            "quest_type": "직업" if group == "레지스탕스" else "일반",
            "is_mapleland": 0,
            "category": group,
            "start_level": level,
        })
    if len(rows) != 117:
        raise ValueError(f"KMS 1.2.105 퀘스트 파싱 결과가 117개가 아님: {len(rows)}")
    return rows


def sync_skills(conn: sqlite3.Connection, apply: bool) -> int:
    rows = parse_official_battle_mage_skills()
    for row in rows:
        print(f"skill: {row['job_branch']} {row['skill_name']} Lv{row['master_level']}")
        if apply:
            conn.execute(
                """INSERT INTO skills
                   (job_class, job_branch, skill_name, master_level, skill_type, description, level_data, source_post_url)
                   VALUES (:job_class, :job_branch, :skill_name, :master_level, :skill_type, :description, :level_data, :source_post_url)
                   ON CONFLICT(job_class, skill_name) DO UPDATE SET
                     job_branch=excluded.job_branch,
                     master_level=excluded.master_level,
                     skill_type=excluded.skill_type,
                     description=excluded.description,
                     level_data=excluded.level_data,
                     source_post_url=excluded.source_post_url""",
                row,
            )
    return len(rows)


def sync_legacy_quests(conn: sqlite3.Connection, apply: bool) -> int:
    rows = parse_legacy_quests()
    inserted = 0
    for row in rows:
        exists = conn.execute(
            "SELECT id FROM quests WHERE name=? AND area=?",
            (row["name"], row["area"]),
        ).fetchone()
        if exists:
            print(f"quest SKIP(existing): {row['name']}")
            continue
        print(f"quest: Lv{row['level_req']} {row['name']}")
        inserted += 1
        if apply:
            conn.execute(
                """INSERT INTO quests
                   (name, level_req, area, start_location, quest_conditions, exp_reward, meso_reward,
                    note, tip, difficulty, is_chain, quest_type, is_mapleland, category, start_level)
                   VALUES (:name, :level_req, :area, :start_location, :quest_conditions, 0, 0,
                    :note, :tip, :difficulty, :is_chain, :quest_type, :is_mapleland, :category, :start_level)""",
                row,
            )
    return inserted


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--details", help="edel_mob_details.json 경로 (GMS/117 크롤 결과)")
    args = ap.parse_args()

    details_path = Path(args.details) if args.details else DEFAULT_DETAILS_PATH
    details = {}
    if details_path.exists():
        details = {int(k): v for k, v in json.loads(details_path.read_text(encoding="utf-8")).items()}
        print(f"몹 상세 로드: {len(details)}종")

    if not details:
        print(f"monster details unavailable: {details_path} (HP/EXP will use zero)")

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    mobs_node = ref["entities"]["mobs"]["records"]
    maps_node = ref["entities"]["maps"]["records"]
    mob_ids = {int(r["id"]) for r in mobs_node}
    map_ids = {int(r["id"]) for r in maps_node}

    conn = sqlite3.connect(DB_PATH)
    registered_map_ids = {i for i, *_ in NEW_MAPS}

    # 1. 맵 — maps 테이블 + reference + 한글명
    for i, kr, street, en in NEW_MAPS:
        if not conn.execute("SELECT 1 FROM maps WHERE id=?", (i,)).fetchone():
            print(f"maps INSERT: {i} {en} ({kr})")
            if args.apply:
                conn.execute(
                    "INSERT INTO maps (id, name, street_name, area, source_url) VALUES (?,?,?,?,?)",
                    (i, en, street, "에델슈타인", f"https://maplestory.io/api/GMS/117/map/{i}"),
                )
        if i not in map_ids:
            maps_node.append({"id": i, "name_kr": kr})
            map_ids.add(i)
            print(f"reference 맵: {i} {kr}")
        if args.apply:
            conn.execute("UPDATE maps SET area=? WHERE id=?", ("에델슈타인", i))
            conn.execute(
                "INSERT OR IGNORE INTO entity_names_en (entity_type, entity_id, name_en, source) VALUES ('map', ?, ?, 'kms')",
                (i, kr),
            )

    # 2. 몹 — mobs 테이블 + reference + 한글명
    for i, kr, lv, en in NEW_MOBS:
        d = details.get(i, {})
        if not conn.execute("SELECT 1 FROM mobs WHERE id=?", (i,)).fetchone():
            print(f"mobs INSERT: {i} {en} ({kr}) Lv{lv} hp={d.get('hp')} exp={d.get('exp')}")
            if args.apply:
                conn.execute(
                    """INSERT INTO mobs (id, name, level, hp, mp, exp, defense, accuracy, evasion,
                       is_boss, icon_url, source_url, physical_damage, magic_damage, magic_defense, speed, is_undead)
                       VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?)""",
                    (
                        i, en, lv, d.get("hp") or 0, d.get("mp") or 0, d.get("exp") or 0,
                        d.get("pdd") or 0, d.get("acc") or 0, d.get("eva") or 0,
                        ICON.format(id=i), SRC.format(id=i),
                        d.get("padamage"), d.get("madamage"), d.get("mdd"), d.get("speed"),
                        1 if d.get("isUndead") else 0,
                    ),
                )
        if i not in mob_ids:
            rec = {"id": i, "name_kr": kr, "level": lv}
            if d.get("hp"):
                rec["hp"] = d["hp"]
            mobs_node.append(rec)
            mob_ids.add(i)
            print(f"reference 몹: {i} {kr} Lv{lv}")
        if args.apply:
            conn.execute(
                "INSERT OR IGNORE INTO entity_names_en (entity_type, entity_id, name_en, source) VALUES ('mob', ?, ?, 'kms')",
                (i, kr),
            )

    # 3. 스폰 연결 — GMS/95 응답에 foundAt이 없어 원본 지역 구조 기준 수동 매핑
    #    (레벨 구간 ↔ 지역 진행 순서. 9/7 이후 인게임 실측으로 보정 예정)
    MANUAL_SPAWNS: dict[int, list[int]] = {
        150000: [310020000, 310020100],              # 새싹 화분 — 공원1·2
        150001: [310020100, 310020200],              # 나팔꽃 화분 — 공원2·3
        150002: [310020200, 310030000],              # 포도주스병 — 공원3·산책로1
        1150000: [310030000, 310030100],             # 순찰로봇 — 산책로1·2
        1150001: [310030100, 310030200],             # 이상한 이정표 — 산책로2·3
        1150002: [310030110],                        # 구렁이 — 뱀 나오는 길
        2150000: [310040000],                        # 물 도둑 — 광산 가는 길1
        2150001: [310030300, 310040000],             # 더스트 박스 — 산책로4·광산 가는 길1
        2150002: [310030310],                        # 가로등 — 가로등길
        2150003: [310040100],                        # 순찰로봇S — 광산 가는 길2
        3150000: [310040200, 310040300],             # 안전제일 — 광산 입구·바위길
        3150001: [310040300, 310040400],             # 아기 바위베어먹기 — 바위길·광석길
        3150002: [310040400],                        # 큰 바위베어먹기 — 광석길
        6150000: [310050000, 310050100],             # 경비로봇 — 발전소 로비·보안대
        7150000: [310050200, 310050300],             # 라키 — 갱도 입구1·2
        7150001: [310050500],                        # 빅 스파이더 — 갱도1
        7150002: [310050600],                        # 카트베어 — 갱도2
        7150003: [310050510, 310050520],             # 라쿤 — 너구리 소굴·위험한 너구리 소굴
        7150004: [310050700, 310050800],             # 경비로봇L — 갱도3·4
        8105000: [310060000],                        # 라칸 — 제 2 광장
        8105001: [310060200],                        # 방어 시스템 — 방시 연구소1
        8105002: [310060210, 310060220],             # 강화된 방어 시스템 — 방시 연구소2·3
        8105003: [310060100, 310060110],             # AF형 안드로이드 — 안드 연구소1·2
        8105004: [310060120],                        # 고장난 DF형 안드로이드 — 안드 연구소3
        # 광석 이터(8105005) 원본 서식지 '깊은 갱도'는 메랜 공지 맵 목록에 없어 스폰 보류
        9300409: [310010100],                        # 훈련로봇A — 트레이닝 룸 A
        9300410: [310010200],
        9300411: [310010300],
        9300412: [310010400],
    }
    map_name_kr = {i: kr for i, kr, *_ in NEW_MAPS}
    spawn_rows = []
    for mob_id, mids in MANUAL_SPAWNS.items():
        for mid in mids:
            if mid in registered_map_ids:
                spawn_rows.append((mob_id, mid, map_name_kr[mid]))
    for mob_id, mid, mname in spawn_rows:
        print(f"spawn: {mob_id} → {mid} {mname}")
        if args.apply:
            conn.execute(
                "INSERT OR IGNORE INTO mob_spawns (mob_id, map_id, map_name, spawn_count) VALUES (?,?,?,NULL)",
                (mob_id, mid, mname),
            )
    if not spawn_rows:
        print("스폰 연결 없음 (--details 미지정 또는 foundAt 비어 있음)")

    # 4. Skills and quests: final names/master levels come from KMS 1.2.105.
    # Detailed level data is kept only where the earlier KMST revision matches.
    skill_count = sync_skills(conn, args.apply)
    quest_count = sync_legacy_quests(conn, args.apply)

    if args.apply:
        REF_PATH.write_text(json.dumps(ref, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        from crawler.db import rebuild_search_index

        rebuild_search_index(conn)
        conn.commit()
        print(
            f"applied: maps={len(NEW_MAPS)}, mobs={len(NEW_MOBS)}, spawns={len(spawn_rows)}, "
            f"skills={skill_count}, legacy_quests={quest_count}"
        )
    else:
        print(
            f"dry-run: spawns={len(spawn_rows)}, skills={skill_count}, "
            f"new_legacy_quests={quest_count}; pass --apply to write"
        )
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
