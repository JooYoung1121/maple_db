"""Idempotent, source-scoped audit repairs; run after seed sync, before serving.

Shared thief skills already exist under Shadower. Retire only the incorrectly
classified duplicates, preserving their entire old record and URL in aliases.
No inferred quest rewards or unverified drop data are inserted.
"""
import json
from crawler.data_quality import MAYA_CONDITIONS


def repair_quest_conditions(conn):
    row = conn.execute("SELECT * FROM quests WHERE id=9 AND name='마야와 이상한 약'").fetchone()
    if not row or '드롭 아이템' not in (row['quest_conditions'] or ''):
        return 0
    conn.execute('CREATE TABLE IF NOT EXISTS quest_audit_backups (id INTEGER PRIMARY KEY, original_json TEXT NOT NULL)')
    conn.execute('INSERT OR IGNORE INTO quest_audit_backups VALUES (?, ?)', (row['id'], json.dumps(dict(row), ensure_ascii=False)))
    conn.execute('UPDATE quests SET quest_conditions=? WHERE id=?', (json.dumps(MAYA_CONDITIONS, ensure_ascii=False), row['id']))
    conn.commit()
    return 1


def repair_skill_classes(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS skill_aliases (
        old_id INTEGER PRIMARY KEY, canonical_id INTEGER NOT NULL,
        original_json TEXT NOT NULL)""")
    rows = conn.execute("""SELECT * FROM skills WHERE job_class='전사'
        AND source_post_url IN ('https://maplekibun.tistory.com/895',
                               'http://maplekibun.tistory.com/895')""").fetchall()
    for row in rows:
        canonical = conn.execute(
            "SELECT id FROM skills WHERE job_class='도적' AND skill_name=?",
            (row['skill_name'],),
        ).fetchone()
        if canonical:
            conn.execute("INSERT OR REPLACE INTO skill_aliases VALUES (?, ?, ?)",
                         (row['id'], canonical['id'], json.dumps(dict(row), ensure_ascii=False)))
            conn.execute("DELETE FROM skills WHERE id=?", (row['id'],))
        else:
            conn.execute("UPDATE skills SET job_class='도적' WHERE id=?", (row['id'],))
    conn.commit()
    return len(rows)


def repair_broken_icon_entities(conn):
    """아이콘 원본이 404 인 엔티티를 숨긴다 (목록은 crawler/broken_icons.py, 2026-10-14 전수 점검).

    mobs 는 start.sh 가 additive 로만 동기화해 시드의 is_hidden 변경이 라이브에 전달되지 않으므로
    기동 시마다 멱등 적용한다. items 는 시드 전체 교체 대상이지만 같은 경로로 한 번 더 보장한다.
    """
    from crawler.broken_icons import BROKEN_ICON_ITEM_IDS, BROKEN_ICON_MOB_IDS

    changed = 0
    for table, ids in (("mobs", BROKEN_ICON_MOB_IDS), ("items", BROKEN_ICON_ITEM_IDS)):
        if not ids:
            continue
        cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
        if "is_hidden" not in cols:
            continue
        ph = ",".join("?" for _ in ids)
        cur = conn.execute(
            f"UPDATE {table} SET is_hidden=1 WHERE id IN ({ph}) AND COALESCE(is_hidden, 0) = 0",
            tuple(ids),
        )
        changed += cur.rowcount or 0
    if changed:
        conn.commit()
    return changed
