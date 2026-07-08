"""주간 메랜 (주간 메이플랜드 뉴스) API

- 공개: 과월호 목록 / 최신호 / 특정 호 / 스프라이트 배치 해석
- 관리자: 주간 원자료 번들(material) / 발행(POST) / 수정(PUT) / 삭제(DELETE)

발행본(content_json)은 로컬에서 Claude Code로 생성해 admin POST로 올린다.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from crawler.db import get_connection
from api.routes.admin import _require_admin

router = APIRouter()

KST = timezone(timedelta(hours=9))

# 유저 대면 기능에서 900만번대 퀘스트/이벤트 변종몹 제외 (스프라이트 재사용 몹)
MOB_ID_LIMIT = 9_000_000

SPRITE_TABLES = {
    "mob": "mobs",
    "npc": "npcs",
    "item": "items",
}

REQUIRED_SECTION_KEYS = {"id", "heading", "articles"}


def _validate_content(content: dict) -> None:
    sections = content.get("sections")
    if not isinstance(sections, list) or not sections:
        raise HTTPException(status_code=422, detail="content_json.sections 배열이 필요합니다.")
    for section in sections:
        if not isinstance(section, dict) or not REQUIRED_SECTION_KEYS.issubset(section):
            raise HTTPException(
                status_code=422,
                detail="각 섹션은 id/heading/articles 키가 필요합니다.",
            )
        if not isinstance(section["articles"], list):
            raise HTTPException(status_code=422, detail="articles는 배열이어야 합니다.")


def _issue_row_to_dict(row, with_content: bool = True) -> dict:
    d = {
        "id": row["id"],
        "issue_no": row["issue_no"],
        "title": row["title"],
        "week_start": row["week_start"],
        "week_end": row["week_end"],
        "status": row["status"],
        "published_at": row["published_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
    if with_content:
        try:
            d["content"] = json.loads(row["content_json"])
        except (TypeError, ValueError):
            d["content"] = None
    return d


@router.get("/weekly-news")
def list_issues(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    """과월호 아카이브 목록 (본문 제외)."""
    conn = get_connection()
    try:
        total = conn.execute(
            "SELECT COUNT(*) AS cnt FROM weekly_news_issues WHERE status='published'"
        ).fetchone()["cnt"]
        rows = conn.execute(
            """
            SELECT id, issue_no, title, week_start, week_end, status,
                   published_at, created_at, updated_at
            FROM weekly_news_issues
            WHERE status='published'
            ORDER BY issue_no DESC
            LIMIT ? OFFSET ?
            """,
            (per_page, (page - 1) * per_page),
        ).fetchall()
        return {
            "issues": [_issue_row_to_dict(r, with_content=False) for r in rows],
            "total": total,
            "page": page,
            "per_page": per_page,
        }
    finally:
        conn.close()


@router.get("/weekly-news/latest")
def get_latest_issue():
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM weekly_news_issues WHERE status='published' "
            "ORDER BY issue_no DESC LIMIT 1"
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="발행된 호가 없습니다.")
        return {"issue": _issue_row_to_dict(row)}
    finally:
        conn.close()


@router.get("/weekly-news/sprites")
def resolve_sprites(refs: str = Query(default="")):
    """'mob:100100,item:2000001' 형식의 참조를 icon_url로 배치 해석."""
    conn = get_connection()
    try:
        sprites = []
        for raw in refs.split(","):
            raw = raw.strip()
            if not raw or ":" not in raw:
                continue
            ref_type, _, raw_id = raw.partition(":")
            table = SPRITE_TABLES.get(ref_type)
            if not table or not raw_id.isdigit():
                continue
            entity_id = int(raw_id)
            if ref_type == "mob" and entity_id >= MOB_ID_LIMIT:
                continue
            row = conn.execute(
                f"SELECT id, name, icon_url FROM {table} WHERE id = ? AND icon_url IS NOT NULL",
                (entity_id,),
            ).fetchone()
            if row:
                sprites.append({
                    "type": ref_type,
                    "id": row["id"],
                    "name": row["name"],
                    "icon_url": row["icon_url"],
                })
        return {"sprites": sprites}
    finally:
        conn.close()


@router.get("/weekly-news/material")
def get_weekly_material(
    request: Request,
    week_start: str = Query(..., description="YYYY-MM-DD (월요일)"),
    week_end: Optional[str] = Query(default=None),
    community_limit: int = Query(default=40, ge=1, le=100),
):
    """주간호 생성용 원자료 번들 (관리자 전용) — 공식 소식 + 커뮤니티 인기글 + 스프라이트 후보."""
    _require_admin(request)
    try:
        start = datetime.strptime(week_start, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="week_start는 YYYY-MM-DD 형식이어야 합니다.")
    if week_end:
        end_str = week_end
    else:
        end_str = (start + timedelta(days=6)).strftime("%Y-%m-%d")

    conn = get_connection()
    try:
        # 공식 소식: published_at은 'YYYY.MM.DD' 표기라 비교 전 정규화
        official = conn.execute(
            """
            SELECT post_id, source, board, category, title, url, published_at,
                   summary, SUBSTR(COALESCE(content, ''), 1, 800) AS content_excerpt
            FROM maple_land_posts
            WHERE REPLACE(COALESCE(published_at, SUBSTR(created_at, 1, 10)), '.', '-')
                  BETWEEN ? AND ?
            ORDER BY published_at
            """,
            (week_start, end_str),
        ).fetchall()

        community = conn.execute(
            """
            SELECT source, source_post_id, board, title, excerpt, url, author,
                   views, recommends, comment_count, is_recommended, has_image,
                   published_at
            FROM community_posts
            WHERE SUBSTR(COALESCE(published_at, first_seen_at), 1, 10) BETWEEN ? AND ?
            ORDER BY is_recommended DESC, recommends DESC, views DESC
            LIMIT ?
            """,
            (week_start, end_str, community_limit),
        ).fetchall()

        sprite_pool = []
        for ref_type, table, limit in (("mob", "mobs", 30), ("npc", "npcs", 15), ("item", "items", 15)):
            extra = f"AND id < {MOB_ID_LIMIT}" if ref_type == "mob" else ""
            rows = conn.execute(
                f"""
                SELECT id, name FROM {table}
                WHERE icon_url IS NOT NULL AND icon_url != '' {extra}
                ORDER BY RANDOM() LIMIT {limit}
                """
            ).fetchall()
            sprite_pool.extend({"type": ref_type, "id": r["id"], "name": r["name"]} for r in rows)

        return {
            "week_start": week_start,
            "week_end": end_str,
            "official_posts": [dict(r) for r in official],
            "community_posts": [dict(r) for r in community],
            "sprite_pool": sprite_pool,
        }
    finally:
        conn.close()


class IssueUpsert(BaseModel):
    issue_no: Optional[int] = None
    title: str
    week_start: str
    week_end: str
    content: dict
    status: str = "published"


@router.post("/weekly-news")
def create_issue(body: IssueUpsert, request: Request):
    """주간호 발행 (관리자). issue_no 생략 시 자동 증가, 동일 호수는 덮어쓴다."""
    _require_admin(request)
    if body.status not in ("draft", "published"):
        raise HTTPException(status_code=422, detail="status는 draft|published 만 가능합니다.")
    _validate_content(body.content)

    conn = get_connection()
    try:
        issue_no = body.issue_no
        if issue_no is None:
            row = conn.execute(
                "SELECT COALESCE(MAX(issue_no), 0) AS max_no FROM weekly_news_issues"
            ).fetchone()
            issue_no = row["max_no"] + 1

        now = datetime.now(KST).isoformat()
        published_at = now if body.status == "published" else None
        conn.execute(
            """
            INSERT INTO weekly_news_issues
                (issue_no, title, week_start, week_end, content_json, status, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(issue_no) DO UPDATE SET
                title = excluded.title,
                week_start = excluded.week_start,
                week_end = excluded.week_end,
                content_json = excluded.content_json,
                status = excluded.status,
                published_at = COALESCE(weekly_news_issues.published_at, excluded.published_at),
                updated_at = ?
            """,
            (
                issue_no, body.title, body.week_start, body.week_end,
                json.dumps(body.content, ensure_ascii=False),
                body.status, published_at, now,
            ),
        )
        conn.commit()
        return {"ok": True, "issue_no": issue_no}
    finally:
        conn.close()


@router.put("/weekly-news/{issue_no}")
def update_issue(issue_no: int, body: IssueUpsert, request: Request):
    """기존 호 수정 (관리자)."""
    _require_admin(request)
    _validate_content(body.content)
    conn = get_connection()
    try:
        now = datetime.now(KST).isoformat()
        cur = conn.execute(
            """
            UPDATE weekly_news_issues
            SET title=?, week_start=?, week_end=?, content_json=?, status=?, updated_at=?
            WHERE issue_no=?
            """,
            (
                body.title, body.week_start, body.week_end,
                json.dumps(body.content, ensure_ascii=False),
                body.status, now, issue_no,
            ),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="해당 호가 없습니다.")
        return {"ok": True, "issue_no": issue_no}
    finally:
        conn.close()


@router.delete("/weekly-news/{issue_no}")
def delete_issue(issue_no: int, request: Request):
    _require_admin(request)
    conn = get_connection()
    try:
        cur = conn.execute("DELETE FROM weekly_news_issues WHERE issue_no=?", (issue_no,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="해당 호가 없습니다.")
        return {"ok": True}
    finally:
        conn.close()


@router.get("/weekly-news/{issue_no}")
def get_issue(issue_no: int):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM weekly_news_issues WHERE issue_no=? AND status='published'",
            (issue_no,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="해당 호가 없습니다.")
        return {"issue": _issue_row_to_dict(row)}
    finally:
        conn.close()
