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
