"""자유게시판 API — 글/댓글/추천"""
import json
import os
from fastapi import APIRouter, Query, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()

ADMIN_PW = os.environ.get("GAME_ADMIN_PASSWORD", "1004")


class PostCreate(BaseModel):
    nickname: str
    title: str
    content: str


class CommentCreate(BaseModel):
    nickname: str
    content: str


# ── 글 목록 ──────────────────────────────────────────────
@router.get("/guild/board/posts")
def list_posts(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
):
    try:
        conn = get_connection()
    except Exception:
        return {"posts": [], "total": 0}

    try:
        total = conn.execute("SELECT COUNT(*) FROM free_board_posts").fetchone()[0]
        offset = (page - 1) * per_page
        rows = conn.execute(
            """SELECT p.*, (SELECT COUNT(*) FROM free_board_comments c WHERE c.post_id = p.id) AS comment_count
               FROM free_board_posts p
               ORDER BY p.created_at DESC LIMIT ? OFFSET ?""",
            [per_page, offset],
        ).fetchall()
        posts = [dict(r) for r in rows]
        return {"posts": posts, "total": total, "page": page, "per_page": per_page}
    except Exception as e:
        return {"posts": [], "total": 0, "error": str(e)}
    finally:
        conn.close()


# ── 글 작성 ──────────────────────────────────────────────
@router.post("/guild/board/posts")
def create_post(body: PostCreate):
    if not body.nickname.strip():
        raise HTTPException(status_code=400, detail="닉네임을 입력하세요.")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="제목을 입력하세요.")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="내용을 입력하세요.")

    try:
        conn = get_connection()
        cur = conn.execute(
            "INSERT INTO free_board_posts (nickname, title, content) VALUES (?, ?, ?)",
            [body.nickname.strip(), body.title.strip(), body.content.strip()],
        )
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return {"id": new_id, "nickname": body.nickname.strip(), "title": body.title.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 글 상세 + 댓글 ──────────────────────────────────────
@router.get("/guild/board/posts/{post_id}")
def get_post(
    post_id: int,
    sort: str = Query(default="newest", regex="^(newest|upvotes)$"),
):
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=500, detail="DB 연결 실패")

    try:
        row = conn.execute("SELECT * FROM free_board_posts WHERE id = ?", [post_id]).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")

        order = "upvotes DESC, created_at DESC" if sort == "upvotes" else "created_at DESC"
        comments = conn.execute(
            f"SELECT * FROM free_board_comments WHERE post_id = ? ORDER BY {order}",
            [post_id],
        ).fetchall()

        post = dict(row)
        post["comments"] = [dict(c) for c in comments]
        return post
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── 글 삭제 (Admin) ──────────────────────────────────────
@router.delete("/guild/board/posts/{post_id}")
def delete_post(post_id: int, password: str = Query(...)):
    if password != ADMIN_PW:
        raise HTTPException(status_code=403, detail="비밀번호가 틀립니다.")

    try:
        conn = get_connection()
        # 댓글 투표 삭제
        conn.execute(
            "DELETE FROM free_board_comment_votes WHERE comment_id IN (SELECT id FROM free_board_comments WHERE post_id = ?)",
            [post_id],
        )
        conn.execute("DELETE FROM free_board_comments WHERE post_id = ?", [post_id])
        conn.execute("DELETE FROM free_board_posts WHERE id = ?", [post_id])
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 댓글 작성 ────────────────────────────────────────────
@router.post("/guild/board/posts/{post_id}/comments")
def create_comment(post_id: int, body: CommentCreate):
    if not body.nickname.strip():
        raise HTTPException(status_code=400, detail="닉네임을 입력하세요.")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="내용을 입력하세요.")

    try:
        conn = get_connection()
        # 글 존재 확인
        post = conn.execute("SELECT id FROM free_board_posts WHERE id = ?", [post_id]).fetchone()
        if not post:
            conn.close()
            raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")

        cur = conn.execute(
            "INSERT INTO free_board_comments (post_id, nickname, content) VALUES (?, ?, ?)",
            [post_id, body.nickname.strip(), body.content.strip()],
        )
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return {"id": new_id, "post_id": post_id, "nickname": body.nickname.strip()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 댓글 삭제 (Admin) ────────────────────────────────────
@router.delete("/guild/board/comments/{comment_id}")
def delete_comment(comment_id: int, password: str = Query(...)):
    if password != ADMIN_PW:
        raise HTTPException(status_code=403, detail="비밀번호가 틀립니다.")

    try:
        conn = get_connection()
        conn.execute("DELETE FROM free_board_comment_votes WHERE comment_id = ?", [comment_id])
        conn.execute("DELETE FROM free_board_comments WHERE id = ?", [comment_id])
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 댓글 추천 (IP 중복방지) ──────────────────────────────
@router.post("/guild/board/comments/{comment_id}/upvote")
def upvote_comment(comment_id: int, request: Request):
    voter_ip = request.client.host if request.client else "unknown"

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=500, detail="DB 연결 실패")

    try:
        comment = conn.execute("SELECT id FROM free_board_comments WHERE id = ?", [comment_id]).fetchone()
        if not comment:
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")

        # 중복 확인
        existing = conn.execute(
            "SELECT id FROM free_board_comment_votes WHERE comment_id = ? AND voter_ip = ?",
            [comment_id, voter_ip],
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="이미 추천하셨습니다.")

        conn.execute(
            "INSERT INTO free_board_comment_votes (comment_id, voter_ip) VALUES (?, ?)",
            [comment_id, voter_ip],
        )
        conn.execute(
            "UPDATE free_board_comments SET upvotes = upvotes + 1 WHERE id = ?",
            [comment_id],
        )
        conn.commit()

        new_upvotes = conn.execute("SELECT upvotes FROM free_board_comments WHERE id = ?", [comment_id]).fetchone()[0]
        conn.close()
        return {"comment_id": comment_id, "upvotes": new_upvotes}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            conn.close()
        except Exception:
            pass
