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
