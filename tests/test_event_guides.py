import sqlite3
from datetime import datetime, timezone

from api.routes import kakao_bot
from api.routes.events import effective_event, ensure_tables


def _conn():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    ensure_tables(conn)
    conn.execute("DELETE FROM event_guides")
    return conn


def _insert(conn, slug, title, period_end, status="active"):
    conn.execute(
        "INSERT INTO event_guides (slug, title, status, period_start, period_end, content_json) VALUES (?,?,?,?,?,'{}')",
        (slug, title, status, "2026-09-01", period_end),
    )


def test_iso_deadline_ends_at_that_moment():
    row = {"status": "active", "period_end": "2026-10-30T00:00:00+09:00"}
    before = datetime(2026, 10, 29, 14, 59, tzinfo=timezone.utc)  # 10/29 23:59 KST
    after = datetime(2026, 10, 29, 15, 0, tzinfo=timezone.utc)  # 10/30 00:00 KST
    assert effective_event(row, before)["status"] == "active"
    assert effective_event(row, after)["status"] == "ended"


def test_date_only_deadline_includes_that_day():
    row = {"status": "active", "period_end": "2026-10-30"}
    assert effective_event(row, datetime(2026, 10, 30, 14, 59, tzinfo=timezone.utc))["status"] == "active"
    assert effective_event(row, datetime(2026, 10, 30, 15, 0, tzinfo=timezone.utc))["status"] == "ended"


def test_kakao_event_command_skips_expired_active_rows():
    conn = _conn()
    _insert(conn, "old", "지난 이벤트", "2020-01-01T00:00:00+09:00")
    _insert(conn, "open", "진행 이벤트", "2999-01-01T00:00:00+09:00")
    _insert(conn, "closed", "종료 처리된 이벤트", None, status="ended")
    text = kakao_bot._cmd_event(conn)
    assert "진행 이벤트" in text
    assert "지난 이벤트" not in text
    assert "종료 처리된 이벤트" not in text
