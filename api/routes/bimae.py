"""비매유저 박제 게시판 API"""
import time
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()

# IP 기반 투표 쿨다운 (5초)
_vote_cooldowns: dict[str, float] = {}
VOTE_COOLDOWN_SEC = 5


class BimaePostCreate(BaseModel):
    nickname: str
    job_class: Optional[str] = None
    level: Optional[int] = None
    reason: Optional[str] = None
    image_url: Optional[str] = None
    author: Optional[str] = "익명"


class BimaeVote(BaseModel):
    vote: str  # "up" or "down"


@router.get("/bimae")
def list_bimae(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
    sort: Optional[str] = Query(default=None),
):
    offset = (page - 1) * per_page

    order = "created_at DESC"
    if sort == "upvotes":
        order = "upvotes DESC"
    elif sort == "downvotes":
        order = "downvotes DESC"
    elif sort == "controversial":
        order = "(upvotes + downvotes) DESC"

    try:
        conn = get_connection()
    except Exception:
        return {"posts": [], "total": 0, "page": page, "per_page": per_page}

    try:
        total = conn.execute("SELECT COUNT(*) FROM bimae_posts").fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM bimae_posts ORDER BY {order} LIMIT ? OFFSET ?",
            [per_page, offset],
        ).fetchall()
        posts = [dict(r) for r in rows]
    except Exception:
        posts = []
        total = 0
    finally:
        conn.close()

    return {"posts": posts, "total": total, "page": page, "per_page": per_page}


@router.post("/bimae")
def create_bimae(post: BimaePostCreate):
    if not post.nickname.strip():
        raise HTTPException(status_code=400, detail="닉네임을 입력해주세요")

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        cur = conn.execute(
            """INSERT INTO bimae_posts (nickname, job_class, level, reason, image_url, author)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [
                post.nickname.strip(),
                post.job_class,
                post.level,
                post.reason,
                post.image_url,
                post.author or "익명",
            ],
        )
        conn.commit()
        new_id = cur.lastrowid
        row = conn.execute("SELECT * FROM bimae_posts WHERE id = ?", [new_id]).fetchone()
        return {"post": dict(row)}
    finally:
        conn.close()


@router.post("/bimae/{post_id}/vote")
def vote_bimae(post_id: int, vote: BimaeVote, request: Request):
    if vote.vote not in ("up", "down"):
        raise HTTPException(status_code=400, detail="vote는 'up' 또는 'down'")

    # IP 기반 쿨다운 체크
    client_ip = request.client.host if request.client else "unknown"
    cooldown_key = f"{client_ip}:{post_id}"
    now = time.time()
    last_vote = _vote_cooldowns.get(cooldown_key, 0)
    if now - last_vote < VOTE_COOLDOWN_SEC:
        remaining = int(VOTE_COOLDOWN_SEC - (now - last_vote)) + 1
        raise HTTPException(status_code=429, detail=f"{remaining}초 후 다시 투표할 수 있습니다")
    _vote_cooldowns[cooldown_key] = now

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        row = conn.execute("SELECT * FROM bimae_posts WHERE id = ?", [post_id]).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")

        col = "upvotes" if vote.vote == "up" else "downvotes"
        conn.execute(f"UPDATE bimae_posts SET {col} = {col} + 1 WHERE id = ?", [post_id])
        conn.commit()

        updated = conn.execute("SELECT * FROM bimae_posts WHERE id = ?", [post_id]).fetchone()
        return {"post": dict(updated)}
    finally:
        conn.close()


@router.delete("/bimae/{post_id}")
def delete_bimae(post_id: int):
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        row = conn.execute("SELECT id FROM bimae_posts WHERE id = ?", [post_id]).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")
        conn.execute("DELETE FROM bimae_posts WHERE id = ?", [post_id])
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
