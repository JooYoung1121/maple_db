"""Persistent crawler diagnostics. A quiet board is not a failed crawler."""
import os
import asyncio
from datetime import datetime, timezone
from functools import wraps


def ensure_runs(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS crawl_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL,
        started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL,
        checked INTEGER DEFAULT 0, saved INTEGER DEFAULT 0, errors INTEGER DEFAULT 0,
        error_kind TEXT)""")
    conn.commit()


def observed_crawl(source):
    def decorate(fn):
        @wraps(fn)
        async def run(conn, *args, **kwargs):
            ensure_runs(conn)
            run_id = conn.execute("INSERT INTO crawl_runs(source, started_at, status) VALUES (?, ?, 'running')",
                                  (source, datetime.now(timezone.utc).isoformat())).lastrowid
            conn.commit()
            stats = {'checked': 0, 'errors': 0}
            saved, error_kind = 0, None
            try:
                saved = await fn(conn, *args, **kwargs, stats=stats)
                return saved
            except (Exception, asyncio.CancelledError) as exc:
                # Do not persist exception messages: URLs/credentials may be embedded.
                error_kind = type(exc).__name__
                stats['errors'] += 1
                raise
            finally:
                status = 'error' if error_kind else 'warning' if stats['errors'] or not stats['checked'] else 'ok'
                conn.execute("""UPDATE crawl_runs SET finished_at=?, status=?, checked=?, saved=?, errors=?, error_kind=?
                    WHERE id=?""", (datetime.now(timezone.utc).isoformat(), status, stats['checked'], saved,
                                     stats['errors'], error_kind, run_id))
                conn.execute("DELETE FROM crawl_runs WHERE source=? AND id NOT IN (SELECT id FROM crawl_runs WHERE source=? ORDER BY id DESC LIMIT 200)", (source, source))
                conn.commit()
                if status != 'ok':
                    print(f'[crawler-alert] {source}: {status}, checked={stats["checked"]}, errors={stats["errors"]}')
        return run
    return decorate


def crawl_status(conn):
    ensure_runs(conn)
    result = []
    for source, enabled_var, interval_var, default_minutes in [
        ('maple_land', 'MAPLE_LAND_CRAWLER_ENABLED', 'MAPLE_LAND_CRAWL_INTERVAL_MINUTES', 30),
        ('dcinside', 'COMMUNITY_CRAWLER_ENABLED', 'COMMUNITY_CRAWL_INTERVAL_MINUTES', 360),
    ]:
        latest = conn.execute("SELECT * FROM crawl_runs WHERE source=? ORDER BY id DESC LIMIT 1", (source,)).fetchone()
        success = conn.execute("SELECT finished_at FROM crawl_runs WHERE source=? AND status='ok' ORDER BY id DESC LIMIT 1", (source,)).fetchone()
        enabled = os.environ.get(enabled_var, 'true').strip().lower() not in {'0', 'false', 'no', 'off'}
        try:
            minutes = max(int(os.environ.get(interval_var, str(default_minutes))), 5 if source == 'maple_land' else 30)
        except ValueError:
            minutes = default_minutes
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(success[0])).total_seconds() if success else None
        result.append({'source': source, 'enabled': enabled, 'interval_minutes': minutes,
                       'latest_run': dict(latest) if latest else None,
                       'last_success_at': success[0] if success else None,
                       'needs_attention': not enabled or age is None or age > minutes * 120
                                          or bool(latest and latest['status'] in {'warning', 'error'})})
    return result
