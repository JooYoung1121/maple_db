"""블로그 한국어 몬스터명을 레벨+HP 기반으로 DB 영문 몬스터에 매칭.

세계여행(싱가포르, 말레이시아, 일본 등) GMS 전용 몬스터의
한국어 이름을 entity_names_en에 추가.
"""
from __future__ import annotations

import re
import sqlite3


# 블로그 URL: 세계여행 몬스터 정보
WORLD_TRAVEL_URLS = [
    "https://maplekibun.tistory.com/714",  # 세계여행/해외여행
    "https://maplekibun.tistory.com/655",  # 황금사원
]

# 수동 매칭 (영문명 → 한국어명, 블로그에서 확인된 것)
MANUAL_MATCHES = {
    # 쇼와/일본
    "Crow": "까마귀",
    "Fire Raccoon": "불너구리",
    "Cloud Fox": "구름여우",
    "Big Cloud Fox": "큰 구름여우",
    "Nightghost": "망령",
    "Paper Lantern Ghost": "제등귀신",
    "Water Goblin": "물도깨비",
    "Dreamy Ghost": "몽롱귀신",
    "Black Crow": "천구",
    # 닌자성
    "Genin": "하급닌자",
    "Ashigaru": "아시가루",
    "Chunin": "중급닌자",
    "Kunoichi": "여닌자",
    "Jonin": "우두머리닌자",
    "Castellan": "성주",
    # 싱가포르
    "Mr. Anchor": "앵커",
    "Capt. Latanica": "캡틴 라타니카",
    # 말레이시아 보스
    "Targa": "타르가",
    "Scarlion Boss": "스칼리온",
}


def match_korean_names(conn: sqlite3.Connection) -> dict:
    """블로그 세계여행 몬스터의 한국어 이름을 DB에 매칭."""
    stats = {
        "blog_monsters_found": 0,
        "matched_by_level_hp": 0,
        "matched_manual": 0,
        "already_has_name": 0,
        "no_match": [],
        "names_added": 0,
    }

    # 1) 블로그에서 한국어명 + 레벨 + HP 추출
    blog_monsters = []
    for url in WORLD_TRAVEL_URLS:
        row = conn.execute(
            "SELECT content FROM blog_posts WHERE url=? AND content IS NOT NULL",
            (url,),
        ).fetchone()
        if row:
            blog_monsters.extend(_parse_blog_monsters(row["content"]))

    stats["blog_monsters_found"] = len(blog_monsters)

    # 2) 수동 매칭 처리
    for eng_name, kr_name in MANUAL_MATCHES.items():
        rows = conn.execute(
            "SELECT id FROM mobs WHERE name=? AND COALESCE(is_hidden,0)=0", (eng_name,)
        ).fetchall()
        for row in rows:
            mob_id = row["id"]
            existing = conn.execute(
                "SELECT 1 FROM entity_names_en WHERE entity_type='mob' AND entity_id=? AND source='kms'",
                (mob_id,),
            ).fetchone()
            if not existing:
                _add_kr_name(conn, mob_id, kr_name)
                stats["matched_manual"] += 1

    # 3) 레벨+HP 기반 매칭
    for monster in blog_monsters:
        kr_name = monster["name"]
        level = monster["level"]
        hp = monster["hp"]

        if not kr_name or level <= 0:
            continue

        # 이미 한국어 이름이 있는 몬스터인지 확인
        existing = conn.execute(
            "SELECT entity_id FROM entity_names_en WHERE entity_type='mob' AND source IN ('kms','blog_match') AND name_en=?",
            (kr_name,),
        ).fetchone()
        if existing:
            stats["already_has_name"] += 1
            continue

        # 레벨+HP로 매칭 (HP 오차 10% 허용)
        hp_min = int(hp * 0.9) if hp > 0 else 0
        hp_max = int(hp * 1.1) if hp > 0 else 0

        if hp > 0:
            candidates = conn.execute(
                """SELECT id, name FROM mobs
                   WHERE level=? AND hp BETWEEN ? AND ?
                   AND id NOT IN (SELECT entity_id FROM entity_names_en WHERE entity_type='mob' AND source='kms')""",
                (level, hp_min, hp_max),
            ).fetchall()
        else:
            candidates = conn.execute(
                """SELECT id, name FROM mobs
                   WHERE level=?
                   AND id NOT IN (SELECT entity_id FROM entity_names_en WHERE entity_type='mob' AND source='kms')""",
                (level,),
            ).fetchall()

        if len(candidates) == 1:
            # 유일한 후보 → 확실한 매칭
            _add_kr_name(conn, candidates[0]["id"], kr_name)
            stats["matched_by_level_hp"] += 1
        elif len(candidates) > 1:
            # 여러 후보 → 이름 유사성으로 필터링
            matched = _best_name_match(kr_name, candidates)
            if matched:
                _add_kr_name(conn, matched, kr_name)
                stats["matched_by_level_hp"] += 1
            else:
                stats["no_match"].append(f"{kr_name}(Lv.{level},HP{hp}) -> {len(candidates)} candidates")
        else:
            stats["no_match"].append(f"{kr_name}(Lv.{level},HP{hp}) -> no candidates")

    conn.commit()
    stats["names_added"] = stats["matched_by_level_hp"] + stats["matched_manual"]
    return stats


def _parse_blog_monsters(content: str) -> list[dict]:
    """블로그 콘텐츠에서 몬스터명 + 레벨 + HP 추출."""
    monsters = []
    lines = content.split('\n')

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # 패턴: "이름 (레벨: XX)" 또는 "이름 (레벨 : XX)"
        m = re.match(r'^(.+?)\s*[\(（]\s*레벨\s*[:：]?\s*(\d+)\s*[\)）]', line)
        if m:
            name = m.group(1).strip()
            level = int(m.group(2))
            hp = 0

            # 다음 줄에서 HP 추출
            if i + 1 < len(lines):
                hp_line = lines[i + 1].strip()
                hp_match = re.search(r'HP\s*([\d,]+)', hp_line)
                if hp_match:
                    hp = int(hp_match.group(1).replace(',', ''))

            monsters.append({"name": name, "level": level, "hp": hp})

        i += 1

    return monsters


def _best_name_match(kr_name: str, candidates: list) -> int | None:
    """한국어 이름과 영어 이름의 유사성으로 최적 매칭."""
    # 한국어→영어 번역 패턴
    patterns = {
        "다크": "Dark", "블루": "Blue", "레드": "Red", "그린": "Green",
        "블랙": "Black", "화이트": "White", "골드": "Gold", "주니어": "Jr",
        "좀비": "Zombie", "슬라임": "Slime", "고스트": "Ghost",
    }

    for cand in candidates:
        eng_lower = cand["name"].lower()
        # 한국어 이름의 첫 글자가 영어 이름에 반영되는지 확인
        for kr_part, eng_part in patterns.items():
            if kr_part in kr_name and eng_part.lower() in eng_lower:
                return cand["id"]

    # 9420XXX (싱가포르/말레이시아/해외 전용 몬스터) 우선
    overseas_942 = [c for c in candidates if 9420000 <= c["id"] < 9430000]
    if len(overseas_942) == 1:
        return overseas_942[0]["id"]

    # 9400XXX 대역 (일본/세계여행)
    overseas_940 = [c for c in candidates if 9400000 <= c["id"] < 9410000]
    if len(overseas_940) == 1:
        return overseas_940[0]["id"]

    # 9409XXX (라바나 등)
    overseas_9409 = [c for c in candidates if 9409000 <= c["id"] < 9410000]
    if len(overseas_9409) == 1:
        return overseas_9409[0]["id"]

    # 어떤 해외 대역이든 1개만 있으면
    overseas_all = [c for c in candidates if 9400000 <= c["id"] < 9500000]
    if len(overseas_all) == 1:
        return overseas_all[0]["id"]

    return None


def _add_kr_name(conn: sqlite3.Connection, mob_id: int, kr_name: str) -> None:
    """entity_names_en에 한국어 이름 추가."""
    conn.execute(
        """INSERT OR IGNORE INTO entity_names_en
           (entity_type, entity_id, name_en, source, source_url, last_crawled_at)
           VALUES ('mob', ?, ?, 'blog_match', NULL, datetime('now'))""",
        (mob_id, kr_name),
    )
    # 숨겨진 몬스터면 노출로 변경
    conn.execute(
        "UPDATE mobs SET is_hidden=0 WHERE id=? AND COALESCE(is_hidden,1)=1",
        (mob_id,),
    )
