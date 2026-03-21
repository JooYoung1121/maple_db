"""블로그 몬스터/보스 정보 페이지 전용 파서.

대상 블로그 포스트:
- /86: 보스 몬스터 통합 (보스이름\\n(\\nLv.XX\\n)\\nHP/경험치\\n맵 출현\\n젠타임\\n드롭)
- /351~/350, /656: 일반 몬스터 레벨별 (이름 (레벨 : XX)\\nHP/경험치\\n맵 출현\\n드롭)
- /655: 황금사원 몬스터
- /714: 세계여행 몬스터
"""
from __future__ import annotations

import re
import sqlite3


# 보스 페이지 URL 패턴
BOSS_URLS = [
    "maplekibun.tistory.com/86",
    "maplekibun.tistory.com/259",
    "maplekibun.tistory.com/261",
    "maplekibun.tistory.com/283",
]

# 몬스터 정보 페이지 URL 패턴
MONSTER_URLS = [
    "maplekibun.tistory.com/351",  # 1-10
    "maplekibun.tistory.com/352",  # 11-20
    "maplekibun.tistory.com/79",   # 21-30
    "maplekibun.tistory.com/80",   # 31-40
    "maplekibun.tistory.com/81",   # 41-50
    "maplekibun.tistory.com/82",   # 51-60
    "maplekibun.tistory.com/83",   # 61-70
    "maplekibun.tistory.com/345",  # 71-80
    "maplekibun.tistory.com/346",  # 81-90
    "maplekibun.tistory.com/347",  # 91-100
    "maplekibun.tistory.com/348",  # 101-110
    "maplekibun.tistory.com/349",  # 111-120
    "maplekibun.tistory.com/350",  # 121-200
    "maplekibun.tistory.com/655",  # 황금사원
    "maplekibun.tistory.com/714",  # 세계여행
    "maplekibun.tistory.com/656",  # 통합
    "maplekibun.tistory.com/939",  # 빅뱅후 몬스터 레벨 (참고용)
]


def parse_blog_monster_info(conn: sqlite3.Connection) -> dict:
    """블로그 몬스터/보스 정보 페이지를 파싱하여 DB 보강."""
    stats = {
        "mobs_matched": 0,
        "mobs_updated": 0,
        "bosses_found": 0,
        "spawns_added": 0,
        "drops_added": 0,
        "unmatched": [],
    }

    # 한국어 이름 → mob ID 캐시
    kr_to_id = _build_kr_name_cache(conn)
    # 아이템 한국어 이름 → item ID 캐시
    item_kr_to_id = _build_item_name_cache(conn)

    # 보스 페이지 파싱
    for url_part in BOSS_URLS:
        full_url = f"https://{url_part}"
        row = conn.execute(
            "SELECT content FROM blog_posts WHERE url = ? AND content IS NOT NULL",
            (full_url,),
        ).fetchone()
        if not row:
            continue
        _parse_boss_page(conn, row["content"], kr_to_id, item_kr_to_id, stats)

    # 몬스터 정보 페이지 파싱 (통합 페이지 /656 우선, 개별 페이지 보완)
    seen_mobs: set[int] = set()
    for url_part in MONSTER_URLS:
        full_url = f"https://{url_part}"
        row = conn.execute(
            "SELECT content FROM blog_posts WHERE url = ? AND content IS NOT NULL",
            (full_url,),
        ).fetchone()
        if not row:
            continue
        _parse_monster_page(conn, row["content"], kr_to_id, item_kr_to_id, stats, seen_mobs)

    conn.commit()
    return stats


def _build_kr_name_cache(conn: sqlite3.Connection) -> dict[str, int]:
    """한국어 몬스터 이름 → mob ID 매핑 구축."""
    cache: dict[str, int] = {}

    # entity_names_en에서 KMS 한국어 이름
    rows = conn.execute(
        "SELECT entity_id, name_en FROM entity_names_en WHERE entity_type='mob' AND source='kms'"
    ).fetchall()
    for r in rows:
        name = r["name_en"].strip()
        if name:
            cache[name] = r["entity_id"]

    # mobs 테이블의 영문명도 캐시 (일부 일치 가능)
    rows = conn.execute("SELECT id, name FROM mobs").fetchall()
    for r in rows:
        name = r["name"].strip()
        if name:
            cache[name] = r["id"]

    return cache


def _build_item_name_cache(conn: sqlite3.Connection) -> dict[str, int]:
    """한국어 아이템 이름 → item ID 매핑 구축."""
    cache: dict[str, int] = {}

    rows = conn.execute(
        "SELECT entity_id, name_en FROM entity_names_en WHERE entity_type='item' AND source='kms'"
    ).fetchall()
    for r in rows:
        name = r["name_en"].strip()
        if name:
            cache[name] = r["entity_id"]

    rows = conn.execute("SELECT id, name FROM items").fetchall()
    for r in rows:
        name = r["name"].strip()
        if name:
            cache[name] = r["id"]

    return cache


def _find_mob_id(name: str, cache: dict[str, int]) -> int | None:
    """몬스터 이름으로 ID 찾기 (정확매칭 → 공백제거 → 부분매칭)."""
    name = name.strip()
    if not name or len(name) < 2:
        return None
    if name in cache:
        return cache[name]
    # 공백 제거 후 시도
    no_space = name.replace(" ", "")
    for k, v in cache.items():
        if k.replace(" ", "") == no_space:
            return v
    return None


def _find_item_id(name: str, cache: dict[str, int]) -> int | None:
    """아이템 이름으로 ID 찾기."""
    name = name.strip()
    if not name or len(name) < 2:
        return None
    if name in cache:
        return cache[name]
    no_space = name.replace(" ", "")
    for k, v in cache.items():
        if k.replace(" ", "") == no_space:
            return v
    return None


def _safe_int(text: str) -> int:
    """숫자 문자열을 int로 변환. 콤마/공백/만 단위 처리."""
    if not text:
        return 0
    text = text.replace(",", "").replace(" ", "").replace(".", "")
    # "0000" 패턴 (한국식 만 단위 구분) 처리
    m = re.match(r'^(\d+)$', text)
    if m:
        return int(m.group(1))
    return 0


def _parse_boss_page(
    conn: sqlite3.Connection,
    content: str,
    kr_to_id: dict[str, int],
    item_kr_to_id: dict[str, int],
    stats: dict,
) -> None:
    """보스 페이지 파싱.

    포맷 (줄 분리형):
      보스이름
      (
      Lv.XX
      )
      HP XXXXX/경험치 XXXXX
      맵이름 출현  (또는 맵이름\\n출현)
      젠타임
      XX분/시간
      드롭 아이템
      아이템1
      아이템2
      ...
    """
    lines = content.split('\n')
    i = 0

    while i < len(lines):
        line = lines[i].strip()
        mob_name = None
        level = 0

        # 패턴 1: "이름\n(\nLv.XX\n)" (줄 분리형)
        if (i + 2 < len(lines) and
            lines[i + 1].strip() == '(' and
            re.match(r'Lv\.?\s*(\d+)', lines[i + 2].strip())):

            mob_name = line
            lv_match = re.match(r'Lv\.?\s*(\d+)', lines[i + 2].strip())
            level = int(lv_match.group(1)) if lv_match else 0
            j = i + 3
            while j < len(lines) and lines[j].strip() in (')', ''):
                j += 1
            i = j

        # 패턴 2: "이름(Lv.XX)" (같은 줄)
        elif re.match(r'^(.+?)\s*[\(（]\s*Lv\.?\s*(\d+)\s*[\)）]', line):
            m = re.match(r'^(.+?)\s*[\(（]\s*Lv\.?\s*(\d+)\s*[\)）]', line)
            mob_name = m.group(1).strip()
            level = int(m.group(2))
            i += 1
        else:
            i += 1
            continue

        # 헤더 스킵
        if not mob_name or mob_name in ('보', '보스', '보스 몬스터'):
            continue
        if '몬스터' in mob_name and len(mob_name) < 10:
            continue

        mob_id = _find_mob_id(mob_name, kr_to_id)
        if not mob_id:
            stats["unmatched"].append(f"BOSS:{mob_name}")
            continue

        stats["mobs_matched"] += 1
        stats["bosses_found"] += 1

        hp = 0
        exp = 0
        spawn_map = None
        spawn_time = None
        drop_items: list[str] = []

        # HP/경험치 파싱 (최대 3줄 탐색)
        scan_start = i
        while i < len(lines) and i < scan_start + 3:
            cur = lines[i].strip()
            hp_match = re.search(r'HP\s*([\d,]+)\s*/?\s*경험치\s*([\d,]+)', cur)
            if hp_match:
                hp = _safe_int(hp_match.group(1))
                exp = _safe_int(hp_match.group(2))
                i += 1
                break
            if cur and not cur.startswith('(') and cur != ')':
                break
            i += 1

        # 출현맵 파싱 (최대 5줄 탐색)
        scan_start = i
        while i < len(lines) and i < scan_start + 5:
            cur = lines[i].strip()
            if '출현' in cur:
                spawn_map = cur.replace('출현', '').strip()
                # "출현"만 있는 줄이면 이전 줄이 맵이름
                if not spawn_map and i > scan_start:
                    spawn_map = lines[i - 1].strip()
                i += 1
                break
            if cur.startswith('젠타임') or cur.startswith('드롭'):
                break
            i += 1

        # 젠타임 파싱 (최대 5줄 탐색)
        scan_start = i
        while i < len(lines) and i < scan_start + 5:
            cur = lines[i].strip()
            if cur == '젠타임':
                i += 1
                if i < len(lines):
                    spawn_time = lines[i].strip()
                    i += 1
                break
            if cur.startswith('드롭'):
                break
            i += 1

        # 드롭 아이템 헤더 (최대 3줄 탐색)
        scan_start = i
        while i < len(lines) and i < scan_start + 3:
            cur = lines[i].strip()
            if cur in ('드롭 아이템', '드롭아이템'):
                i += 1
                break
            i += 1

        # 드롭 아이템 수집 (다음 보스 이름까지)
        while i < len(lines):
            cur = lines[i].strip()
            if not cur:
                i += 1
                if i < len(lines) and not lines[i].strip():
                    break
                continue

            # 다음 보스 시작 감지
            if (i + 1 < len(lines) and lines[i + 1].strip() == '(' and
                i + 2 < len(lines) and re.match(r'Lv\.?\s*\d+', lines[i + 2].strip())):
                break
            if re.match(r'^(.+?)\s*[\(（]\s*Lv\.?\s*\d+', cur):
                break
            # 블로그 푸터 감지
            if '공유하기' in cur or '게시글 관리' in cur or '카테고리' in cur:
                break

            # 콤마로 구분된 여러 아이템
            if ',' in cur or '，' in cur:
                items = re.split(r'[,，]\s*', cur)
                drop_items.extend([it.strip() for it in items if it.strip()])
            # 공백으로 구분된 아이템들 (한 줄에 여러개)
            elif len(cur) > 30 and '  ' in cur:
                items = [it.strip() for it in re.split(r'\s{2,}', cur) if it.strip()]
                drop_items.extend(items)
            else:
                drop_items.append(cur)

            i += 1

        # DB 업데이트
        _update_mob(conn, mob_id, level, hp, exp, is_boss=1, spawn_time=spawn_time)
        stats["mobs_updated"] += 1

        if spawn_map:
            _add_spawn_by_name(conn, mob_id, spawn_map, stats)

        for item_name in drop_items:
            _add_drop_by_name(conn, mob_id, item_name, item_kr_to_id, stats)

    conn.commit()


def _parse_monster_page(
    conn: sqlite3.Connection,
    content: str,
    kr_to_id: dict[str, int],
    item_kr_to_id: dict[str, int],
    stats: dict,
    seen_mobs: set[int],
) -> None:
    """일반 몬스터 정보 페이지 파싱.

    포맷:
      몬스터이름 (레벨 : XX)
      HP XX /경험치 XX
      [속성정보 (optional)]
      맵1, 맵2, 맵3 출현
      드롭아이템1, 드롭아이템2, ...
    """
    lines = content.split('\n')
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        # 몬스터 시작: "이름 (레벨 : XX)" 패턴
        m = re.match(r'^(.+?)\s*[\(（]\s*레벨\s*[:：]?\s*(\d+)\s*[\)）]', line)
        if not m:
            i += 1
            continue

        mob_name = m.group(1).strip()
        level = int(m.group(2))
        i += 1

        mob_id = _find_mob_id(mob_name, kr_to_id)
        if not mob_id:
            stats["unmatched"].append(f"MOB:{mob_name}(Lv.{level})")
            i += 1
            continue

        if mob_id in seen_mobs:
            i += 1
            continue
        seen_mobs.add(mob_id)

        stats["mobs_matched"] += 1

        hp = 0
        exp = 0
        spawn_maps: list[str] = []
        drop_items: list[str] = []

        # HP/경험치 파싱
        if i < len(lines):
            hp_line = lines[i].strip()
            hp_match = re.search(r'HP\s*([\d,]+)\s*/?\s*경험치\s*([\d,]+)', hp_line)
            if hp_match:
                hp = _safe_int(hp_match.group(1))
                exp = _safe_int(hp_match.group(2))
                i += 1

        # 속성 정보 (optional) + 출현맵 + 드롭아이템
        while i < len(lines):
            cur = lines[i].strip()

            # 빈줄 = 몬스터 구분 끝 (일부 페이지에서)
            if not cur:
                i += 1
                break

            # 다음 몬스터 시작 감지
            if re.match(r'^.+?\s*[\(（]\s*레벨\s*[:：]?\s*\d+\s*[\)）]', cur):
                break

            # 블로그 푸터 감지
            if '공유하기' in cur or '게시글 관리' in cur or '카테고리의 다른 글' in cur:
                break

            # 출현맵 라인
            if '출현' in cur:
                map_text = cur.replace('출현', '').strip()
                spawn_maps = [m.strip() for m in re.split(r'[,，]\s*', map_text) if m.strip()]
                i += 1
                continue

            # 속성 정보 (약점, 반감, 무효, 점프 등) - 스킵
            if re.match(r'^(독|불|얼음|전기|성|암흑)\s*(약점|반감|무효|무시)', cur) or cur in ('점프',):
                i += 1
                continue

            # 드롭 아이템 (콤마 구분)
            items = re.split(r'[,，]\s*', cur)
            drop_items.extend([it.strip() for it in items if it.strip() and len(it.strip()) >= 2])
            i += 1

        # DB 업데이트
        _update_mob(conn, mob_id, level, hp, exp, is_boss=0, spawn_time=None)
        stats["mobs_updated"] += 1

        for map_name in spawn_maps:
            _add_spawn_by_name(conn, mob_id, map_name, stats)

        for item_name in drop_items:
            _add_drop_by_name(conn, mob_id, item_name, item_kr_to_id, stats)

    conn.commit()


def _update_mob(
    conn: sqlite3.Connection,
    mob_id: int,
    level: int,
    hp: int,
    exp: int,
    is_boss: int,
    spawn_time: str | None,
) -> None:
    """몹 기본 정보 업데이트. 보스 플래그, 스폰타임, HP/EXP (기존값이 0일 때만)."""
    updates = []
    params: list = []

    if is_boss:
        updates.append("is_boss=1")
        if spawn_time:
            updates.append("spawn_time=?")
            params.append(spawn_time)

    # HP/EXP는 기존 값이 0이거나 NULL일 때만 블로그 데이터로 보강
    if hp > 0:
        updates.append("hp = CASE WHEN hp = 0 OR hp IS NULL THEN ? ELSE hp END")
        params.append(hp)
    if exp > 0:
        updates.append("exp = CASE WHEN exp = 0 OR exp IS NULL THEN ? ELSE exp END")
        params.append(exp)

    if updates:
        params.append(mob_id)
        conn.execute(f"UPDATE mobs SET {', '.join(updates)} WHERE id=?", params)


def _add_spawn_by_name(
    conn: sqlite3.Connection,
    mob_id: int,
    map_name: str,
    stats: dict,
) -> None:
    """맵 이름으로 mob_spawns에 추가. 맵 ID를 찾으면 FK로, 못찾으면 이름만."""
    map_name = map_name.strip()
    if not map_name or len(map_name) < 2:
        return

    # 맵 이름으로 ID 찾기 (한국어 이름 우선)
    row = conn.execute(
        "SELECT entity_id FROM entity_names_en WHERE entity_type='map' AND source='kms' AND name_en=?",
        (map_name,),
    ).fetchone()
    map_id = row["entity_id"] if row else None

    if not map_id:
        row = conn.execute("SELECT id FROM maps WHERE name=?", (map_name,)).fetchone()
        map_id = row["id"] if row else None

    if map_id:
        try:
            conn.execute(
                "INSERT OR IGNORE INTO mob_spawns (mob_id, map_id, map_name) VALUES (?, ?, ?)",
                (mob_id, map_id, map_name),
            )
            stats["spawns_added"] += 1
        except Exception:
            pass


def _add_drop_by_name(
    conn: sqlite3.Connection,
    mob_id: int,
    item_name: str,
    item_cache: dict[str, int],
    stats: dict,
) -> None:
    """아이템 이름으로 mob_drops에 추가."""
    item_name = item_name.strip()
    if not item_name or len(item_name) < 2:
        return
    # 스크린샷 설명이나 불필요한 텍스트 필터링
    skip_patterns = ['스샷', '사진', '이미지', '출처', '참고', '※', '공유하기', '게시글']
    if any(p in item_name for p in skip_patterns):
        return

    item_id = _find_item_id(item_name, item_cache)
    if not item_id:
        return

    try:
        conn.execute(
            "INSERT OR IGNORE INTO mob_drops (mob_id, item_id, item_name, drop_rate) VALUES (?, ?, ?, NULL)",
            (mob_id, item_id, item_name),
        )
        stats["drops_added"] += 1
    except Exception:
        pass
