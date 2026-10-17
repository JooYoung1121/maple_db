"""mob_drops 정합 정리 (2026-10-17 전수 점검 결과 반영). 모두 멱등.

배경: 드롭 연결 18,670행에 신뢰도가 다른 층이 섞여 있었다.
- 무출처 행 1,149: 메이플기분 블로그 몬스터 정보 글을 "빠진 것만 추가"로 보강할 때 들어온 행. 원작 몬스터북 획득
  목록을 옮긴 것이라 제련 완제·마법의 가루(828행)와 다른 몹 잡템(추억의 사제→바이킹의 돛 등)이 섞여 있다.
- 숨긴 복제 개체(몬스터 카니발 9500xxx 등)에만 붙은 드롭: 노출 중인 정본에는 없어 아이템의 '드롭 몬스터'가 비어 보였다.
- 메팁 단독 행(사설 서버 SQL 출신)의 레벨 불일치 장비(타이머→스파타 등).
- 드롭률 척도: 메랜DB·메팁은 일치(중앙값 비율 1.0)하는데 메이플기분은 7~48배라 한 척도로 통일한다.
  메이플기분 값은 mob_drop_sources(source='maplekibun') 에 보존해 화면에 참고값으로 남긴다.
"""
from __future__ import annotations

import sqlite3
from collections.abc import Iterable

REFINED_RANGES = (
    (4011000, 4011999),  # 제련 광물 (청동·강철·미스릴…)
    (4021000, 4021999),  # 세공 보석 (가넷·자수정…)
    (4005000, 4005999),  # 크리스탈 완제
    (4007000, 4007999),  # 마법의 가루
)
_REFINED_SQL = " OR ".join(f"item_id BETWEEN {a} AND {b}" for a, b in REFINED_RANGES)
_UNSOURCED = "list_source IS NULL AND drop_rate_source IS NULL"


def delete_unsourced_junk(conn: sqlite3.Connection) -> int:
    """무출처 행 중 (1) 제련 완제·마법의 가루이거나 (2) 그 몹에 출처 있는 드롭 목록이 따로 있는 행을 지운다.

    출처 있는 목록이 아예 없는 몹의 고유 잡템(페어리의 더듬이 등)은 남긴다 — 지우면 그 몹 드롭이 통째로 빈다.
    """
    cur = conn.execute(
        f"""DELETE FROM mob_drops
            WHERE {_UNSOURCED}
              AND (({_REFINED_SQL})
                   OR EXISTS (SELECT 1 FROM mob_drops d2 WHERE d2.mob_id = mob_drops.mob_id
                              AND (d2.list_source IS NOT NULL OR d2.drop_rate_source IS NOT NULL)))"""
    )
    conn.commit()
    return cur.rowcount or 0


def merge_duplicate_mob_drops(conn: sqlite3.Connection, whitelist_ids: Iterable[int] | None = None) -> int:
    """숨긴 복제 개체(같은 영문명·같은 레벨)의 드롭을 노출 중인 정본 몹으로 복사한다 (정본에 없는 아이템만).

    레벨이 다른 변형(카니발 Lv35 크림슨발록 등)은 드롭 테이블 성격이 달라 합치지 않는다.
    whitelist_ids 를 주면 정본이 화이트리스트에 있을 때만 합친다.
    """
    pairs = conn.execute(
        """SELECT h.id AS hid, v.id AS vid
           FROM mobs h
           JOIN mobs v ON v.name = h.name AND v.id != h.id AND COALESCE(v.is_hidden, 0) = 0 AND v.level = h.level
           WHERE COALESCE(h.is_hidden, 0) = 1
           ORDER BY h.id, v.id"""
    ).fetchall()
    allowed = set(int(i) for i in whitelist_ids) if whitelist_ids is not None else None
    seen_hidden: set[int] = set()
    copied = 0
    has_sources = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='mob_drop_sources'"
    ).fetchone()
    for hid, vid in pairs:
        if hid in seen_hidden:
            continue  # 정본 후보가 여럿이면 가장 작은 id 하나로만
        if allowed is not None and vid not in allowed:
            continue
        seen_hidden.add(hid)
        cur = conn.execute(
            """INSERT OR IGNORE INTO mob_drops (mob_id, item_id, item_name, drop_rate, drop_rate_source, list_source)
               SELECT ?, item_id, item_name, drop_rate, drop_rate_source, list_source FROM mob_drops WHERE mob_id = ?""",
            (vid, hid),
        )
        copied += cur.rowcount or 0
        if has_sources:
            conn.execute(
                """INSERT OR IGNORE INTO mob_drop_sources
                   (mob_id, item_id, source, rate, chance, chance_denominator, min_qty, max_qty, drop_source, fetched_at)
                   SELECT ?, item_id, source, rate, chance, chance_denominator, min_qty, max_qty, drop_source, fetched_at
                   FROM mob_drop_sources WHERE mob_id = ?""",
                (vid, hid),
            )
    conn.commit()
    return copied


def delete_matip_only_level_gaps(conn: sqlite3.Connection, gap: int = 30) -> int:
    """메팁 단독 목록(list_source='matip')의 장비 중 요구 레벨이 몹 레벨보다 gap 이상 높은 행을 지운다 (몹 레벨 0 제외)."""
    cur = conn.execute(
        """DELETE FROM mob_drops
           WHERE list_source = 'matip'
             AND EXISTS (SELECT 1 FROM items i JOIN mobs m ON m.id = mob_drops.mob_id
                         WHERE i.id = mob_drops.item_id AND m.level > 0 AND COALESCE(i.level_req, 0) - m.level >= ?)""",
        (gap,),
    )
    conn.commit()
    return cur.rowcount or 0


def unify_rate_scale(conn: sqlite3.Connection) -> int:
    """메이플기분 척도 드롭률을 메랜DB·메팁 척도로 통일한다.

    메팁 값이 있는 행만: 기존 값을 mob_drop_sources(source='maplekibun') 에 보존하고 drop_rate 를 메팁 값으로,
    drop_rate_source 를 'matip' 으로 바꾼다. 메팁 값이 없는 행은 그대로 둔다(배지 '참고' 유지).
    """
    rows = conn.execute(
        """SELECT d.mob_id, d.item_id, d.drop_rate, s.rate AS matip_rate
           FROM mob_drops d
           JOIN mob_drop_sources s ON s.mob_id = d.mob_id AND s.item_id = d.item_id AND s.source = 'matip'
           WHERE d.drop_rate_source = 'maplekibun' AND s.rate > 0"""
    ).fetchall()
    for mob_id, item_id, old, new in rows:
        conn.execute(
            """INSERT OR IGNORE INTO mob_drop_sources (mob_id, item_id, source, rate, drop_source, fetched_at)
               VALUES (?, ?, 'maplekibun', ?, 'maplekibun.tistory.com/892', datetime('now'))""",
            (mob_id, item_id, old),
        )
        conn.execute(
            "UPDATE mob_drops SET drop_rate = ?, drop_rate_source = 'matip' WHERE mob_id = ? AND item_id = ?",
            (new, mob_id, item_id),
        )
    conn.commit()
    return len(rows)
