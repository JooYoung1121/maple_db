"""추억길드 전용 게시판 API"""
import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()
KST = timezone(timedelta(hours=9))


class GuildPostCreate(BaseModel):
    post_type: str  # 'announcement' | 'event'
    title: str
    content: Optional[str] = None
    author: Optional[str] = "추억길드"


@router.get("/guild/posts")
def list_guild_posts(
    post_type: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
):
    try:
        conn = get_connection()
    except Exception:
        return {"posts": [], "total": 0}

    try:
        where = "WHERE post_type = ?" if post_type else ""
        params = [post_type] if post_type else []
        total = conn.execute(f"SELECT COUNT(*) FROM guild_posts {where}", params).fetchone()[0]
        offset = (page - 1) * per_page
        rows = conn.execute(
            f"SELECT * FROM guild_posts {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        return {"posts": [dict(r) for r in rows], "total": total, "page": page, "per_page": per_page}
    except Exception as e:
        return {"posts": [], "total": 0, "error": str(e)}
    finally:
        conn.close()


@router.post("/guild/posts")
def create_guild_post(body: GuildPostCreate, request: Request):
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    provided_pw = request.headers.get("X-Admin-Password", "")
    if provided_pw != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀렸습니다.")

    if body.post_type not in ("announcement", "event"):
        raise HTTPException(status_code=400, detail="post_type이 올바르지 않습니다.")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="제목을 입력하세요.")

    try:
        conn = get_connection()
        cur = conn.execute(
            "INSERT INTO guild_posts (post_type, title, content, author, created_at) VALUES (?, ?, ?, ?, ?)",
            [body.post_type, body.title.strip(), body.content, body.author or "추억길드",
             datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")],
        )
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return {"id": new_id, "post_type": body.post_type, "title": body.title}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/guild/posts/{post_id}")
def delete_guild_post(post_id: int, request: Request):
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    provided_pw = request.headers.get("X-Admin-Password", "")
    if provided_pw != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀렸습니다.")

    try:
        conn = get_connection()
        conn.execute("DELETE FROM guild_posts WHERE id = ?", [post_id])
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
