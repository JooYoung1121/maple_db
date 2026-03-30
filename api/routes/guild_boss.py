"""보스 클리어 기록 + 구인 API"""
import os
import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()
KST = timezone(timedelta(hours=9))


def _check_admin(request: Request):
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    if request.headers.get("X-Admin-Password", "") != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀렸습니다.")


# ── 보스 클리어 기록 ──

class BossRunCreate(BaseModel):
    boss_name: str
    character_name: str
    try_number: int = 1
    cleared_at: str
    drops: Optional[str] = None
    note: Optional[str] = None


@router.get("/guild/boss/runs")
def list_boss_runs(
    boss_name: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
):
    try:
        conn = get_connection()
    except Exception:
        return {"items": [], "total": 0}
    try:
        conditions = []
        params: list = []
        if boss_name:
            conditions.append("boss_name = ?")
            params.append(boss_name)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        total = conn.execute(f"SELECT COUNT(*) FROM boss_runs {where}", params).fetchone()[0]
        offset = (page - 1) * per_page
        rows = conn.execute(
            f"SELECT * FROM boss_runs {where} ORDER BY cleared_at DESC LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        return {"items": [dict(r) for r in rows], "total": total, "page": page, "per_page": per_page}
    except Exception as e:
        return {"items": [], "total": 0, "error": str(e)}
    finally:
        conn.close()


@router.post("/guild/boss/runs")
def create_boss_run(body: BossRunCreate):
    if not body.boss_name.strip() or not body.character_name.strip():
        raise HTTPException(status_code=400, detail="보스명과 캐릭터명을 입력하세요.")
    try:
        conn = get_connection()
        cur = conn.execute(
            "INSERT INTO boss_runs (boss_name, character_name, try_number, cleared_at, drops, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [body.boss_name.strip(), body.character_name.strip(), body.try_number,
             body.cleared_at, body.drops, body.note,
             datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")],
        )
        conn.commit()
        row = conn.execute("SELECT * FROM boss_runs WHERE id = ?", [cur.lastrowid]).fetchone()
        result = dict(row)
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/guild/boss/runs/{run_id}")
def delete_boss_run(run_id: int, request: Request):
    _check_admin(request)
    try:
        conn = get_connection()
        conn.execute("DELETE FROM boss_runs WHERE id = ?", [run_id])
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 보스 구인 ──

class RecruitCreate(BaseModel):
    boss_name: str
    author: str
    message: Optional[str] = None
    scheduled_at: Optional[str] = None
    max_members: int = 6


class RecruitJoin(BaseModel):
    nickname: str


@router.get("/guild/boss/recruit")
def list_recruits(
    boss_name: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
):
    try:
        conn = get_connection()
    except Exception:
        return {"items": [], "total": 0}
    try:
        conditions = []
        params: list = []
        if boss_name:
            conditions.append("boss_name = ?")
            params.append(boss_name)
        if status:
            conditions.append("status = ?")
            params.append(status)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        total = conn.execute(f"SELECT COUNT(*) FROM boss_recruitments {where}", params).fetchone()[0]
        offset = (page - 1) * per_page
        rows = conn.execute(
            f"SELECT * FROM boss_recruitments {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        return {"items": [dict(r) for r in rows], "total": total, "page": page, "per_page": per_page}
    except Exception as e:
        return {"items": [], "total": 0, "error": str(e)}
    finally:
        conn.close()


@router.post("/guild/boss/recruit")
def create_recruit(body: RecruitCreate):
    if not body.boss_name.strip() or not body.author.strip():
        raise HTTPException(status_code=400, detail="보스명과 작성자를 입력하세요.")
    if body.max_members < 2 or body.max_members > 6:
        raise HTTPException(status_code=400, detail="최대 인원은 2~6명입니다.")
    try:
        conn = get_connection()
        cur = conn.execute(
            "INSERT INTO boss_recruitments (boss_name, author, message, scheduled_at, max_members, participants_json, status, created_at) VALUES (?, ?, ?, ?, ?, '[]', 'open', ?)",
            [body.boss_name.strip(), body.author.strip(), body.message,
             body.scheduled_at, body.max_members,
             datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")],
        )
        conn.commit()
        row = conn.execute("SELECT * FROM boss_recruitments WHERE id = ?", [cur.lastrowid]).fetchone()
        result = dict(row)
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/guild/boss/recruit/{recruit_id}/join")
def join_recruit(recruit_id: int, body: RecruitJoin):
    if not body.nickname.strip():
        raise HTTPException(status_code=400, detail="닉네임을 입력하세요.")
    try:
        conn = get_connection()
        row = conn.execute("SELECT * FROM boss_recruitments WHERE id = ?", [recruit_id]).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="구인글을 찾을 수 없습니다.")
        row = dict(row)
        participants = json.loads(row["participants_json"] or "[]")
        if body.nickname.strip() in participants:
            raise HTTPException(status_code=400, detail="이미 참가한 닉네임입니다.")
        if len(participants) >= row["max_members"]:
            raise HTTPException(status_code=400, detail="인원이 마감되었습니다.")
        participants.append(body.nickname.strip())
        new_status = "closed" if len(participants) >= row["max_members"] else "open"
        conn.execute(
            "UPDATE boss_recruitments SET participants_json = ?, status = ? WHERE id = ?",
            [json.dumps(participants, ensure_ascii=False), new_status, recruit_id],
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM boss_recruitments WHERE id = ?", [recruit_id]).fetchone()
        result = dict(updated)
        conn.close()
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/guild/boss/recruit/{recruit_id}/leave")
def leave_recruit(recruit_id: int, body: RecruitJoin):
    if not body.nickname.strip():
        raise HTTPException(status_code=400, detail="닉네임을 입력하세요.")
    try:
        conn = get_connection()
        row = conn.execute("SELECT * FROM boss_recruitments WHERE id = ?", [recruit_id]).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="구인글을 찾을 수 없습니다.")
        row = dict(row)
        participants = json.loads(row["participants_json"] or "[]")
        if body.nickname.strip() not in participants:
            raise HTTPException(status_code=400, detail="참가하지 않은 닉네임입니다.")
        participants.remove(body.nickname.strip())
        conn.execute(
            "UPDATE boss_recruitments SET participants_json = ?, status = 'open' WHERE id = ?",
            [json.dumps(participants, ensure_ascii=False), recruit_id],
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM boss_recruitments WHERE id = ?", [recruit_id]).fetchone()
        result = dict(updated)
        conn.close()
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/guild/boss/recruit/{recruit_id}")
def delete_recruit(recruit_id: int, request: Request):
    _check_admin(request)
    try:
        conn = get_connection()
        conn.execute("DELETE FROM boss_recruitments WHERE id = ?", [recruit_id])
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
