"""메이플랜드 필드보스 단일 목록 — 채널 트래커(api/routes/field_boss.py)·노출 정리(cleanup/audit_repairs)가 공유한다.

배경(2026-10-14): maplestory.io 수집본에는 같은 이름의 복제 몹(무릉도장 9303xxx · 몬스터 카니발/이벤트 9500xxx)이
is_boss=1 로 들어 있어, cleanup 의 "보스와 동명의 일반 몹 숨김" 규칙이 실제 필드 젠 개체(4220000 세르프 등)를 숨기고
스폰·드롭이 없는 복제본만 남겼다. 그 결과 필드보스 29종 중 20종이 몬스터 목록·검색에서 빠져 있었다.
여기 적힌 id 가 유저에게 보여 줄 정본이며, 동명의 다른 개체는 숨긴다.

- respawn_min: 젠 주기(분). mobs.spawn_time(mapledb 크롤)에 근거가 있는 것만 적고 나머지는 None.
- label: 같은 이름이 둘일 때 구분용 표시명.
"""
from __future__ import annotations

import sqlite3

FIELD_BOSSES: list[dict] = [
    {"id": 2220000, "name_kr": "마노", "level": 20, "respawn_min": None},
    {"id": 3220000, "name_kr": "스텀피", "level": 35, "respawn_min": None},
    {"id": 3220001, "name_kr": "데우", "level": 38, "respawn_min": None},
    {"id": 4220000, "name_kr": "세르프", "level": 45, "respawn_min": None},
    {"id": 5220002, "name_kr": "파우스트", "level": 50, "respawn_min": None},
    {"id": 5220004, "name_kr": "대왕지네", "level": 50, "respawn_min": None},
    {"id": 5220000, "name_kr": "킹크랑", "level": 55, "respawn_min": None},
    {"id": 5220003, "name_kr": "타이머", "level": 59, "respawn_min": None},
    {"id": 6130101, "name_kr": "머쉬맘", "level": 60, "respawn_min": None},
    {"id": 6220000, "name_kr": "다일", "level": 65, "respawn_min": None},
    {"id": 6220001, "name_kr": "제노", "level": 65, "respawn_min": None},
    {"id": 6300005, "name_kr": "좀비 머쉬맘", "level": 65, "respawn_min": 117},   # spawn_time "1시간 57"
    {"id": 7220001, "name_kr": "구미호", "level": 70, "respawn_min": None},
    {"id": 7220000, "name_kr": "태륜", "level": 71, "respawn_min": None},
    {"id": 7220002, "name_kr": "요괴선사", "level": 77, "respawn_min": None},
    {"id": 8130100, "name_kr": "주니어 발록", "level": 80, "respawn_min": None},
    {"id": 8220000, "name_kr": "엘리쟈", "level": 83, "respawn_min": None},
    {"id": 8220002, "name_kr": "키메라", "level": 85, "respawn_min": None},
    {"id": 8220009, "name_kr": "포장마차", "level": 85, "respawn_min": None},
    {"id": 8220001, "name_kr": "스노우맨", "level": 90, "respawn_min": None},
    {"id": 8220007, "name_kr": "블루 머쉬맘", "level": 90, "respawn_min": None},
    {"id": 8150000, "name_kr": "크림슨 발록", "level": 100, "respawn_min": None},   # 엘리니아↔오르비스 배 (2026-10-14 추가)
    {"id": 8180000, "name_kr": "마뇽", "level": 105, "respawn_min": None},
    {"id": 8180001, "name_kr": "그리프", "level": 105, "respawn_min": None},
    {"id": 8510000, "name_kr": "피아누스", "level": 110, "respawn_min": None, "label": "피아누스(좌)"},
    {"id": 8520000, "name_kr": "피아누스", "level": 110, "respawn_min": None, "label": "피아누스(우)"},
    {"id": 8220003, "name_kr": "레비아탄", "level": 120, "respawn_min": None},
    {"id": 8220004, "name_kr": "도도", "level": 121, "respawn_min": 60},      # spawn_time "1시간"
    {"id": 8220005, "name_kr": "릴리노흐", "level": 131, "respawn_min": 60},  # spawn_time "1시간"
    {"id": 8220006, "name_kr": "라이카", "level": 141, "respawn_min": 60},    # spawn_time "1시간"
]
FIELD_BOSS_IDS: frozenset[int] = frozenset(b["id"] for b in FIELD_BOSSES)


def enforce_field_boss_visibility(conn: sqlite3.Connection) -> dict:
    """정본 필드보스는 노출(is_hidden=0)·보스(is_boss=1)로, 동명의 복제 개체는 숨긴다. 멱등.

    복제 개체 판정: 정본과 영문명이 같고 정본이 아니며, 9M 이상 id(무릉도장·카니발·이벤트)이거나 스폰 맵이 없는 것.
    (피아누스 좌/우처럼 정본이 둘인 경우는 둘 다 정본으로 남는다)
    """
    cols = {r[1] for r in conn.execute("PRAGMA table_info(mobs)")}
    if "is_hidden" not in cols:
        return {"shown": 0, "hidden_copies": 0}
    ph = ",".join("?" for _ in FIELD_BOSS_IDS)
    ids = tuple(sorted(FIELD_BOSS_IDS))
    shown = conn.execute(
        f"UPDATE mobs SET is_hidden=0, is_boss=1 WHERE id IN ({ph}) "
        "AND (COALESCE(is_hidden,0)=1 OR COALESCE(is_boss,0)=0)",
        ids,
    ).rowcount or 0
    has_spawns = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='mob_spawns'"
    ).fetchone()
    no_spawn_clause = (
        "OR NOT EXISTS (SELECT 1 FROM mob_spawns s WHERE s.mob_id=mobs.id)" if has_spawns else ""
    )
    hidden = conn.execute(
        f"""UPDATE mobs SET is_hidden=1
            WHERE id NOT IN ({ph}) AND COALESCE(is_hidden,0)=0
              AND name IN (SELECT name FROM mobs WHERE id IN ({ph}))
              AND (id >= 9000000 {no_spawn_clause})""",
        ids + ids,
    ).rowcount or 0
    if shown or hidden:
        conn.commit()
    return {"shown": shown, "hidden_copies": hidden}
