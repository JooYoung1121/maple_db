"""정보공유 게시판 API — 글/댓글/추천 + 첨부 업로드(표 뷰 JSON + 원본 스타일 HTML).

엑셀(.xlsx)·한글(.hwp/.hwpx, 바이너리)을 base64(JSON)로 받아 백엔드에서 파싱한다.
  - xlsx: openpyxl 로 병합셀/배경색/글자색/볼드/정렬까지 보존
  - hwp : 표 구조(셀·병합·텍스트) 보존 (색상은 미지원)
둘 다 동일한 형식({sheets}, html)을 만들어 표 뷰 / 원본 뷰에 그대로 사용.
"""
import base64
import binascii
import json
import os

from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection
from crawler.excel_render import parse_excel
from crawler.hwp_render import parse_hwp, is_hwp


def parse_upload(data: bytes, filename: Optional[str] = None):
    """첨부 형식 판별 후 파싱 → (excel_json, html). xlsx / hwp 지원."""
    name = (filename or "").lower()
    if is_hwp(data) or name.endswith((".hwp", ".hwpx")):
        return parse_hwp(data)
    return parse_excel(data)

router = APIRouter()

ADMIN_PW = os.environ.get("GAME_ADMIN_PASSWORD", "1004")

MAX_EXCEL_BYTES = 8 * 1024 * 1024  # 8MB


class PostCreate(BaseModel):
    nickname: str
    title: str
    content: str = ""
    excel_filename: Optional[str] = None
    excel_base64: Optional[str] = None  # data URL 또는 순수 base64


class CommentCreate(BaseModel):
    nickname: str
    content: str


def _decode_excel(b64: str) -> bytes:
    if "," in b64 and b64.strip().startswith("data:"):
        b64 = b64.split(",", 1)[1]
    try:
        data = base64.b64decode(b64, validate=False)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="엑셀 파일 디코딩에 실패했습니다.")
    if len(data) > MAX_EXCEL_BYTES:
        raise HTTPException(status_code=400, detail="엑셀 파일이 너무 큽니다(최대 8MB).")
    return data


# ── 첨부 미리보기(저장 전) ───────────────────────────────
class ExcelPreview(BaseModel):
    excel_base64: str
    excel_filename: Optional[str] = None


@router.post("/guild/info/excel/preview")
def excel_preview(body: ExcelPreview):
    data = _decode_excel(body.excel_base64)
    try:
        excel_json, excel_html = parse_upload(data, body.excel_filename)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파일 파싱 실패: {e}")
    return {"excel_json": excel_json, "excel_html": excel_html}


# ── 글 목록 ──────────────────────────────────────────────
@router.get("/guild/info/posts")
def list_posts(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
    sort: str = Query(default="newest", pattern="^(newest|upvotes)$"),
):
    try:
        conn = get_connection()
    except Exception:
        return {"posts": [], "total": 0}
    try:
        total = conn.execute("SELECT COUNT(*) FROM info_posts").fetchone()[0]
        offset = (page - 1) * per_page
        order = "p.upvotes DESC, p.created_at DESC" if sort == "upvotes" else "p.created_at DESC"
        rows = conn.execute(
            f"""SELECT p.id, p.nickname, p.title, p.upvotes, p.views, p.created_at,
                       (p.excel_json IS NOT NULL) AS has_excel,
                       (SELECT COUNT(*) FROM info_comments c WHERE c.post_id = p.id) AS comment_count
               FROM info_posts p
               ORDER BY {order} LIMIT ? OFFSET ?""",
            [per_page, offset],
        ).fetchall()
        return {"posts": [dict(r) for r in rows], "total": total, "page": page, "per_page": per_page}
    except Exception as e:
        return {"posts": [], "total": 0, "error": str(e)}
    finally:
        conn.close()


# ── 글 작성 ──────────────────────────────────────────────
@router.post("/guild/info/posts")
def create_post(body: PostCreate):
    if not body.nickname.strip():
        raise HTTPException(status_code=400, detail="닉네임을 입력하세요.")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="제목을 입력하세요.")

    excel_json_str = None
    excel_html = None
    if body.excel_base64:
        data = _decode_excel(body.excel_base64)
        try:
            ej, excel_html = parse_upload(data, body.excel_filename)
            excel_json_str = json.dumps(ej, ensure_ascii=False)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"파일 파싱 실패: {e}")

    if not body.content.strip() and not excel_json_str:
        raise HTTPException(status_code=400, detail="내용 또는 엑셀을 첨부하세요.")

    try:
        conn = get_connection()
        cur = conn.execute(
            """INSERT INTO info_posts (nickname, title, content, excel_filename, excel_json, excel_html)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [
                body.nickname.strip(),
                body.title.strip(),
                body.content.strip(),
                (body.excel_filename or None),
                excel_json_str,
                excel_html,
            ],
        )
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return {"id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 글 상세 + 댓글 ──────────────────────────────────────
@router.get("/guild/info/posts/{post_id}")
def get_post(post_id: int, sort: str = Query(default="newest", pattern="^(newest|upvotes)$")):
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=500, detail="DB 연결 실패")
    try:
        row = conn.execute("SELECT * FROM info_posts WHERE id = ?", [post_id]).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
        conn.execute("UPDATE info_posts SET views = views + 1 WHERE id = ?", [post_id])
        conn.commit()

        order = "upvotes DESC, created_at DESC" if sort == "upvotes" else "created_at DESC"
        comments = conn.execute(
            f"SELECT * FROM info_comments WHERE post_id = ? ORDER BY {order}", [post_id]
        ).fetchall()

        post = dict(row)
        if post.get("excel_json"):
            try:
                post["excel_json"] = json.loads(post["excel_json"])
            except Exception:
                post["excel_json"] = None
        post["comments"] = [dict(c) for c in comments]
        return post
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── 글 삭제 (Admin) ──────────────────────────────────────
@router.delete("/guild/info/posts/{post_id}")
def delete_post(post_id: int, request: Request):
    if request.headers.get("X-Admin-Password", "") != ADMIN_PW:
        raise HTTPException(status_code=403, detail="비밀번호가 틀립니다.")
    try:
        conn = get_connection()
        conn.execute(
            "DELETE FROM info_comment_votes WHERE comment_id IN (SELECT id FROM info_comments WHERE post_id = ?)",
            [post_id],
        )
        conn.execute("DELETE FROM info_comments WHERE post_id = ?", [post_id])
        conn.execute("DELETE FROM info_post_votes WHERE post_id = ?", [post_id])
        conn.execute("DELETE FROM info_posts WHERE id = ?", [post_id])
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 글 수정 (Admin — 공략 갱신용) ────────────────────────
class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


@router.patch("/guild/info/posts/{post_id}")
def update_post(post_id: int, body: PostUpdate, request: Request):
    if request.headers.get("X-Admin-Password", "") != ADMIN_PW:
        raise HTTPException(status_code=403, detail="비밀번호가 틀립니다.")
    if body.title is None and body.content is None:
        raise HTTPException(status_code=400, detail="수정할 내용이 없습니다.")
    try:
        conn = get_connection()
        if not conn.execute("SELECT id FROM info_posts WHERE id = ?", [post_id]).fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
        sets, params = [], []
        if body.title is not None:
            sets.append("title = ?")
            params.append(body.title.strip())
        if body.content is not None:
            sets.append("content = ?")
            params.append(body.content.strip())
        conn.execute(f"UPDATE info_posts SET {', '.join(sets)} WHERE id = ?", params + [post_id])
        conn.commit()
        conn.close()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 글 추천 (IP 중복방지) ────────────────────────────────
@router.post("/guild/info/posts/{post_id}/upvote")
def upvote_post(post_id: int, request: Request):
    voter_ip = request.client.host if request.client else "unknown"
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=500, detail="DB 연결 실패")
    try:
        if not conn.execute("SELECT id FROM info_posts WHERE id = ?", [post_id]).fetchone():
            raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
        if conn.execute(
            "SELECT id FROM info_post_votes WHERE post_id = ? AND voter_ip = ?", [post_id, voter_ip]
        ).fetchone():
            raise HTTPException(status_code=409, detail="이미 추천하셨습니다.")
        conn.execute("INSERT INTO info_post_votes (post_id, voter_ip) VALUES (?, ?)", [post_id, voter_ip])
        conn.execute("UPDATE info_posts SET upvotes = upvotes + 1 WHERE id = ?", [post_id])
        conn.commit()
        n = conn.execute("SELECT upvotes FROM info_posts WHERE id = ?", [post_id]).fetchone()[0]
        return {"post_id": post_id, "upvotes": n}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            conn.close()
        except Exception:
            pass


# ── 댓글 작성 ────────────────────────────────────────────
@router.post("/guild/info/posts/{post_id}/comments")
def create_comment(post_id: int, body: CommentCreate):
    if not body.nickname.strip():
        raise HTTPException(status_code=400, detail="닉네임을 입력하세요.")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="내용을 입력하세요.")
    try:
        conn = get_connection()
        if not conn.execute("SELECT id FROM info_posts WHERE id = ?", [post_id]).fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다.")
        cur = conn.execute(
            "INSERT INTO info_comments (post_id, nickname, content) VALUES (?, ?, ?)",
            [post_id, body.nickname.strip(), body.content.strip()],
        )
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return {"id": new_id, "post_id": post_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 댓글 삭제 (Admin) ────────────────────────────────────
@router.delete("/guild/info/comments/{comment_id}")
def delete_comment(comment_id: int, request: Request):
    if request.headers.get("X-Admin-Password", "") != ADMIN_PW:
        raise HTTPException(status_code=403, detail="비밀번호가 틀립니다.")
    try:
        conn = get_connection()
        conn.execute("DELETE FROM info_comment_votes WHERE comment_id = ?", [comment_id])
        conn.execute("DELETE FROM info_comments WHERE id = ?", [comment_id])
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 댓글 추천 ────────────────────────────────────────────
@router.post("/guild/info/comments/{comment_id}/upvote")
def upvote_comment(comment_id: int, request: Request):
    voter_ip = request.client.host if request.client else "unknown"
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=500, detail="DB 연결 실패")
    try:
        if not conn.execute("SELECT id FROM info_comments WHERE id = ?", [comment_id]).fetchone():
            raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
        if conn.execute(
            "SELECT id FROM info_comment_votes WHERE comment_id = ? AND voter_ip = ?", [comment_id, voter_ip]
        ).fetchone():
            raise HTTPException(status_code=409, detail="이미 추천하셨습니다.")
        conn.execute("INSERT INTO info_comment_votes (comment_id, voter_ip) VALUES (?, ?)", [comment_id, voter_ip])
        conn.execute("UPDATE info_comments SET upvotes = upvotes + 1 WHERE id = ?", [comment_id])
        conn.commit()
        n = conn.execute("SELECT upvotes FROM info_comments WHERE id = ?", [comment_id]).fetchone()[0]
        return {"comment_id": comment_id, "upvotes": n}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            conn.close()
        except Exception:
            pass
