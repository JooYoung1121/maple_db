"""길드원 명단 CRUD API"""
import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()
KST = timezone(timedelta(hours=9))

VALID_RANKS = ("마스터", "부마스터", "길드원", "부캐릭", "새싹")


class MemberCreate(BaseModel):
    nickname: str
    job: str
    level: int
    rank: str
    note: Optional[str] = None


class MemberUpdate(BaseModel):
    nickname: Optional[str] = None
    job: Optional[str] = None
    level: Optional[int] = None
    rank: Optional[str] = None
    note: Optional[str] = None


def _check_admin(request: Request):
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    if request.headers.get("X-Admin-Password", "") != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀렸습니다.")


@router.get("/guild/members")
def list_members(
    rank: Optional[str] = Query(default=None),
    sort: str = Query(default="level"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=200, ge=1, le=500),
):
    try:
        conn = get_connection()
    except Exception:
        return {"members": [], "total": 0}

    try:
        where = "WHERE rank = ?" if rank else ""
        params: list = [rank] if rank else []
        order = "nickname ASC" if sort == "nickname" else "level DESC"
        total = conn.execute(f"SELECT COUNT(*) FROM guild_members {where}", params).fetchone()[0]
        offset = (page - 1) * per_page
        rows = conn.execute(
            f"SELECT * FROM guild_members {where} ORDER BY {order} LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        return {"members": [dict(r) for r in rows], "total": total, "page": page, "per_page": per_page}
    except Exception as e:
        return {"members": [], "total": 0, "error": str(e)}
    finally:
        conn.close()


@router.post("/guild/members")
def create_member(body: MemberCreate, request: Request):
    _check_admin(request)
    if body.rank not in VALID_RANKS:
        raise HTTPException(status_code=400, detail=f"rank는 {', '.join(VALID_RANKS)} 중 하나여야 합니다.")
    if not body.nickname.strip():
        raise HTTPException(status_code=400, detail="닉네임을 입력하세요.")
    if not body.job.strip():
        raise HTTPException(status_code=400, detail="직업을 입력하세요.")
    if body.level < 1:
        raise HTTPException(status_code=400, detail="레벨은 1 이상이어야 합니다.")

    try:
        conn = get_connection()
        cur = conn.execute(
            "INSERT INTO guild_members (nickname, job, level, rank, note, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            [body.nickname.strip(), body.job.strip(), body.level, body.rank, body.note,
             datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")],
        )
        conn.commit()
        row = conn.execute("SELECT * FROM guild_members WHERE id = ?", [cur.lastrowid]).fetchone()
        conn.close()
        return dict(row)
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(status_code=409, detail="이미 존재하는 닉네임입니다.")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/guild/members/{member_id}")
def update_member(member_id: int, body: MemberUpdate, request: Request):
    _check_admin(request)
    if body.rank is not None and body.rank not in VALID_RANKS:
        raise HTTPException(status_code=400, detail=f"rank는 {', '.join(VALID_RANKS)} 중 하나여야 합니다.")

    try:
        conn = get_connection()
        if not conn.execute("SELECT id FROM guild_members WHERE id = ?", [member_id]).fetchone():
            raise HTTPException(status_code=404, detail="해당 길드원을 찾을 수 없습니다.")

        updates: dict = {}
        if body.nickname is not None:
            updates["nickname"] = body.nickname.strip()
        if body.job is not None:
            updates["job"] = body.job.strip()
        if body.level is not None:
            updates["level"] = body.level
        if body.rank is not None:
            updates["rank"] = body.rank
        if body.note is not None:
            updates["note"] = body.note
        updates["updated_at"] = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE guild_members SET {set_clause} WHERE id = ?", list(updates.values()) + [member_id])
        conn.commit()
        row = conn.execute("SELECT * FROM guild_members WHERE id = ?", [member_id]).fetchone()
        conn.close()
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(status_code=409, detail="이미 존재하는 닉네임입니다.")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/guild/members/{member_id}")
def delete_member(member_id: int, request: Request):
    _check_admin(request)
    try:
        conn = get_connection()
        if not conn.execute("SELECT id FROM guild_members WHERE id = ?", [member_id]).fetchone():
            raise HTTPException(status_code=404, detail="해당 길드원을 찾을 수 없습니다.")
        conn.execute("DELETE FROM guild_members WHERE id = ?", [member_id])
        conn.commit()
        conn.close()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
