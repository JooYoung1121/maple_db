"""maple.land 공지사항 / 이벤트 API"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query

from crawler.db import get_connection

router = APIRouter()


def _row_to_dict(row) -> dict:
    return dict(row) if row else {}


@router.get("/news/recent-count")
def get_recent_count(since: str | None = Query(default=None)):
    """최근 신규 공지 건수 (뱃지용). since: ISO 날짜 문자열, 기본 7일 전."""
    conn = get_connection()
    try:
        if since:
            cutoff = since
        else:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM maple_land_posts WHERE created_at >= ?",
            (cutoff,),
        ).fetchone()
        return {"count": row["cnt"] if row else 0}
    finally:
        conn.close()


@router.get("/news")
def list_news(
    board: str | None = Query(default=None),
    category: str | None = Query(default=None),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    conn = get_connection()
    try:
        conditions = []
        params: list = []

        if board:
            conditions.append("board = ?")
            params.append(board)
        if category:
            conditions.append("category = ?")
            params.append(category)
        if q:
            conditions.append("(title LIKE ? OR content LIKE ?)")
            params.extend([f"%{q}%", f"%{q}%"])

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        total = conn.execute(
            f"SELECT COUNT(*) as cnt FROM maple_land_posts {where}", params
        ).fetchone()["cnt"]

        offset = (page - 1) * per_page
        rows = conn.execute(
            f"""
            SELECT id, post_id, board, category, title, published_at, created_at, url
            FROM maple_land_posts
            {where}
            ORDER BY
                CASE WHEN published_at IS NOT NULL
                     THEN published_at ELSE created_at END DESC
            LIMIT ? OFFSET ?
            """,
            params + [per_page, offset],
        ).fetchall()

        return {
            "posts": [_row_to_dict(r) for r in rows],
            "total": total,
            "page": page,
            "per_page": per_page,
        }
    finally:
        conn.close()


@router.get("/news/{post_id}")
def get_news_post(post_id: str):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM maple_land_posts WHERE post_id = ?", (post_id,)
        ).fetchone()
        if not row:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not found")
        return {"post": _row_to_dict(row)}
    finally:
        conn.close()
