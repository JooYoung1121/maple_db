"""메이플 퀴즈 점수 기록 API"""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()

ALLOWED_TOTALS = {10, 20, 30}
ALLOWED_CATEGORIES = {"all", "mob", "npc"}


class QuizScoreCreate(BaseModel):
    nickname: str
    score: int
    total: int
    best_streak: int = 0
    category: str = "all"


@router.get("/quiz/pool")
def quiz_pool():
    """퀴즈 출제용 경량 데이터 — 필요 필드만 (icon_url은 클라이언트에서 조립)"""
    from api.routes.mapleland_reference import id_filter_sql

    conn = get_connection()
    try:
        mob_filter = id_filter_sql("m.id", "mobs")
        mob_where = f"AND {mob_filter}" if mob_filter else ""
        mobs = conn.execute(
            f"""SELECT m.id, m.name, en.name_en AS name_kr
                FROM mobs m
                LEFT JOIN entity_names_en en
                  ON en.entity_type='mob' AND en.entity_id=m.id AND en.source='kms'
                WHERE m.id < 9000000
                  AND COALESCE(m.is_hidden, 0) = 0
                  {mob_where}""",
        ).fetchall()

        npc_filter = id_filter_sql("n.id", "npcs")
        npc_where = f"AND {npc_filter}" if npc_filter else ""
        npcs = conn.execute(
            f"""SELECT n.id, n.name, en.name_en AS name_kr
                FROM npcs n
                LEFT JOIN entity_names_en en
                  ON en.entity_type='npc' AND en.entity_id=n.id AND en.source='kms'
                WHERE 1=1 {npc_where}""",
        ).fetchall()

        return {"mobs": [dict(r) for r in mobs], "npcs": [dict(r) for r in npcs]}
    finally:
        conn.close()


@router.post("/quiz/scores")
def create_quiz_score(payload: QuizScoreCreate):
    nickname = payload.nickname.strip()
    if not (1 <= len(nickname) <= 12):
        raise HTTPException(status_code=400, detail="닉네임은 1~12자여야 합니다")
    if payload.total not in ALLOWED_TOTALS:
        raise HTTPException(status_code=400, detail="문제 수가 올바르지 않습니다")
    if not (0 <= payload.score <= payload.total):
        raise HTTPException(status_code=400, detail="점수가 올바르지 않습니다")
    if not (0 <= payload.best_streak <= payload.total):
        raise HTTPException(status_code=400, detail="연속 기록이 올바르지 않습니다")
    if payload.category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail="카테고리가 올바르지 않습니다")

    conn = get_connection()
    try:
        cur = conn.execute(
            """INSERT INTO quiz_scores (nickname, score, total, best_streak, category)
               VALUES (?, ?, ?, ?, ?)""",
            (nickname, payload.score, payload.total, payload.best_streak, payload.category),
        )
        conn.commit()
        return {"id": cur.lastrowid, "ok": True}
    finally:
        conn.close()


@router.get("/quiz/scores")
def list_quiz_scores(
    total: Optional[int] = Query(default=None),
    category: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
):
    conditions = []
    params: list = []
    if total in ALLOWED_TOTALS:
        conditions.append("total = ?")
        params.append(total)
    if category in ALLOWED_CATEGORIES:
        conditions.append("category = ?")
        params.append(category)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    conn = get_connection()
    try:
        rows = conn.execute(
            f"""SELECT id, nickname, score, total, best_streak, category, created_at
                FROM quiz_scores {where}
                ORDER BY CAST(score AS REAL) / total DESC, best_streak DESC, created_at ASC
                LIMIT ?""",
            params + [limit],
        ).fetchall()
        return {"scores": [dict(r) for r in rows]}
    finally:
        conn.close()
