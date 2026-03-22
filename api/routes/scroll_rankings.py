"""주문서 시뮬레이션 랭킹 API"""
import json
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()


class ScrollRankingCreate(BaseModel):
    nickname: str
    equipment_type: str
    scroll_type: str
    slot_count: int
    success_count: int
    total_stat_gain: Optional[str] = None
    scroll_detail: Optional[str] = None  # JSON string


@router.get("/scroll-rankings")
def list_scroll_rankings(
    equipment_type: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
):
    offset = (page - 1) * per_page

    try:
        conn = get_connection()
    except Exception:
        return {"rankings": [], "total": 0, "page": page, "per_page": per_page}

    try:
        if equipment_type:
            total = conn.execute(
                "SELECT COUNT(*) FROM scroll_rankings WHERE equipment_type = ?",
                [equipment_type],
            ).fetchone()[0]
            rows = conn.execute(
                """SELECT * FROM scroll_rankings
                   WHERE equipment_type = ?
                   ORDER BY success_count DESC, created_at ASC
                   LIMIT ? OFFSET ?""",
                [equipment_type, per_page, offset],
            ).fetchall()
        else:
            total = conn.execute("SELECT COUNT(*) FROM scroll_rankings").fetchone()[0]
            rows = conn.execute(
                """SELECT * FROM scroll_rankings
                   ORDER BY success_count DESC, created_at ASC
                   LIMIT ? OFFSET ?""",
                [per_page, offset],
            ).fetchall()
        rankings = [dict(r) for r in rows]
    except Exception:
        rankings = []
        total = 0
    finally:
        conn.close()

    return {"rankings": rankings, "total": total, "page": page, "per_page": per_page}


@router.post("/scroll-rankings")
def create_scroll_ranking(entry: ScrollRankingCreate):
    if not entry.nickname.strip():
        raise HTTPException(status_code=400, detail="닉네임을 입력해주세요")
    if not entry.equipment_type.strip():
        raise HTTPException(status_code=400, detail="장비 종류를 입력해주세요")
    if not entry.scroll_type.strip():
        raise HTTPException(status_code=400, detail="주문서 종류를 입력해주세요")
    if entry.slot_count < 1 or entry.slot_count > 15:
        raise HTTPException(status_code=400, detail="슬롯 수가 올바르지 않습니다")
    if entry.success_count < 0 or entry.success_count > entry.slot_count:
        raise HTTPException(status_code=400, detail="성공 횟수가 올바르지 않습니다")

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        cur = conn.execute(
            """INSERT INTO scroll_rankings
               (nickname, equipment_type, scroll_type, slot_count, success_count, total_stat_gain, scroll_detail)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [
                entry.nickname.strip(),
                entry.equipment_type.strip(),
                entry.scroll_type.strip(),
                entry.slot_count,
                entry.success_count,
                entry.total_stat_gain,
                entry.scroll_detail,
            ],
        )
        conn.commit()
        new_id = cur.lastrowid
        row = conn.execute("SELECT * FROM scroll_rankings WHERE id = ?", [new_id]).fetchone()
        return {"ranking": dict(row)}
    finally:
        conn.close()
