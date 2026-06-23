"""maple.land 공지사항 / 이벤트 API"""
from datetime import datetime, timedelta, timezone
import re

from fastapi import APIRouter, Query

from crawler.db import get_connection

router = APIRouter()


def _row_to_dict(row) -> dict:
    return dict(row) if row else {}


def _date_digits(*vals) -> str:
    """published_at / created_at 를 'YYYYMMDD' 8자리로 정규화해 시간순 비교에 사용."""
    for v in vals:
        if v:
            digits = re.sub(r"\D", "", str(v))
            if len(digits) >= 8:
                return digits[:8]
    return ""


def _version_tuple(title: str | None) -> tuple:
    """제목의 'Ver. Test X.Y.Z' 를 (X, Y, Z) 숫자 튜플로 추출. 없으면 빈 튜플."""
    match = re.search(r"Ver\.\s*Test\s*([0-9.]+)", title or "")
    if not match:
        return ()
    parts = []
    for seg in match.group(1).split("."):
        if seg.isdigit():
            parts.append(int(seg))
    return tuple(parts)


def _recency_sort_key(row):
    """최신 우선 정렬 키 (reverse=True 와 함께 사용 → 큰 값이 위로).

    id 는 크롤 순서라 환경마다 방향이 달라 신뢰할 수 없으므로 보조 키로만 쓴다:
    - 테스피아: 증분 크롤이라 나중 글 = 큰 id → 큰 id 가 최신
    - 공홈(main): 일괄 백필이라 최신 글 = 작은 id → 작은 id 가 최신 (부호 반전)
    버전 번호(Ver. Test X.Y.Z)는 단조 증가하므로 같은 날짜 패치노트의 확실한 최신순 키.
    """
    source = (row["source"] or "main") if "source" in row.keys() else "main"
    date_key = _date_digits(row["published_at"], row["created_at"])
    # 원문이 수정된 글은 수정일을 활동일로 반영해 최신순에서 위로 올라오게 한다.
    if "updated_at" in row.keys():
        date_key = max(date_key, _date_digits(row["updated_at"]))
    version = _version_tuple(row["title"])
    id_signed = row["id"] if source == "tespia" else -row["id"]
    return (date_key, version, id_signed)


@router.get("/news/recent-count")
def get_recent_count(since: str | None = Query(default=None)):
    """최근 신규 공지 건수 (뱃지용). since: ISO 날짜 문자열, 기본 7일 전."""
    conn = get_connection()
    try:
        if since:
            cutoff = since
        else:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        # 신규(created_at)뿐 아니라 원문이 수정된 글(updated_at)도 '최근 활동'으로 집계
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM maple_land_posts "
            "WHERE created_at >= ? OR (updated_at IS NOT NULL AND updated_at >= ?)",
            (cutoff, cutoff),
        ).fetchone()
        return {"count": row["cnt"] if row else 0}
    finally:
        conn.close()


@router.get("/news")
def list_news(
    source: str | None = Query(default=None),
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

        if source and source != "all":
            conditions.append("COALESCE(source, 'main') = ?")
            params.append(source)
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

        # id 기반 정렬은 크롤 순서에 의존해 환경마다 방향이 뒤집히므로(특히 테스피아),
        # 전체를 가져와 버전/날짜 기반 키로 Python 정렬 후 페이지네이션한다. (공지 총량이 작음)
        all_rows = conn.execute(
            f"""
            SELECT id, post_id, COALESCE(source, 'main') as source, board, category, title, published_at, created_at, updated_at, url, summary
            FROM maple_land_posts
            {where}
            """,
            params,
        ).fetchall()

        ordered = sorted(all_rows, key=_recency_sort_key, reverse=True)
        total = len(ordered)
        offset = (page - 1) * per_page
        page_rows = ordered[offset:offset + per_page]

        return {
            "posts": [_row_to_dict(r) for r in page_rows],
            "total": total,
            "page": page,
            "per_page": per_page,
        }
    finally:
        conn.close()


def _extract_version(title: str) -> str | None:
    match = re.search(r"Ver\.\s*Test\s*([0-9.]+)", title)
    return f"Test {match.group(1)}" if match else None


def _summary_lines(summary: str | None, content: str | None, max_lines: int = 5) -> list[str]:
    text = summary or content or ""
    lines = []
    for raw in text.splitlines():
        line = raw.strip().strip("-*•> ").strip()
        if not line:
            continue
        if line.startswith(("안녕하세요", "감사합니다", "Mapleland 드림", "※")):
            continue
        if len(line) > 120:
            line = line[:117].rstrip() + "..."
        if line not in lines:
            lines.append(line)
        if len(lines) >= max_lines:
            break
    return lines


@router.get("/news/tespia-summary")
def get_tespia_summary(limit: int = Query(default=12, ge=1, le=30)):
    """Latest Tespia 2.0 patch-note summaries."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, post_id, COALESCE(source, 'main') as source, title, category, published_at, created_at, updated_at, url, summary, content
            FROM maple_land_posts
            WHERE COALESCE(source, 'main') = 'tespia'
              AND category = '업데이트'
            """
        ).fetchall()
        rows = sorted(rows, key=_recency_sort_key, reverse=True)[:limit]

        patches = []
        for row in rows:
            patches.append({
                "post_id": row["post_id"],
                "title": row["title"],
                "category": row["category"],
                "published_at": row["published_at"],
                "version": _extract_version(row["title"]),
                "url": row["url"],
                "summary_lines": _summary_lines(row["summary"], row["content"]),
            })

        return {
            "source": "tespia",
            "total": len(patches),
            "patches": patches,
        }
    finally:
        conn.close()


@router.get("/news/{post_id}")
def get_news_post(post_id: str):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT *, COALESCE(source, 'main') as source FROM maple_land_posts WHERE post_id = ?", (post_id,)
        ).fetchone()
        if not row:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not found")
        return {"post": _row_to_dict(row)}
    finally:
        conn.close()
