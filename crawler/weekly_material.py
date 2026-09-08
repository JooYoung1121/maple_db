"""Shared period semantics for API and CLI weekly collections (KST)."""


def updated_official_posts(conn, start, end, excerpt_chars=5000):
    # Supports older offline exports; live init_db always adds updated_at.
    if 'updated_at' not in {r[1] for r in conn.execute('PRAGMA table_info(maple_land_posts)')}:
        return []
    rows = conn.execute("""SELECT post_id, source, board, category, title, url,
        published_at, updated_at, last_crawled_at, summary,
        SUBSTR(COALESCE(content, ''), 1, ?) AS content_excerpt
        FROM maple_land_posts
        WHERE DATE(updated_at, '+9 hours') BETWEEN ? AND ?
        AND REPLACE(COALESCE(published_at, SUBSTR(created_at, 1, 10)), '.', '-') NOT BETWEEN ? AND ?
        ORDER BY updated_at""", (excerpt_chars, start, end, start, end)).fetchall()
    return [dict(r, change_kind='updated', date_note='수정 감지일(KST); 실제 편집 시각은 공식 원문 확인') for r in rows]
