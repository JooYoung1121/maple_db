"""길드 출석부 — 1일 1회 출석 체크 (KST).

디스코드 로그인 활성 시: 로그인 + 길드 서버 멤버만 체크 가능 (계정당 1일 1회).
로그인 기능 미설정 환경(로컬 등)에선 기존 닉네임 방식으로 동작.
guild_attendance는 유저 데이터 테이블 — 시드 동기화 대상 아님.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from crawler.db import get_connection
from api.routes.auth import auth_config, current_user_id

router = APIRouter()
KST = timezone(timedelta(hours=9))


def _ensure_tables() -> None:
    conn = get_connection()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS guild_attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT NOT NULL,
            date TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(nickname, date)
        )"""
    )
    try:
        conn.execute("ALTER TABLE guild_attendance ADD COLUMN user_id INTEGER")
    except Exception:
        pass  # 이미 존재
    conn.commit()
    conn.close()


_ensure_tables()


def kst_today() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


class CheckInPayload(BaseModel):
    nickname: str


@router.post("/guild/attendance")
def check_in(payload: CheckInPayload, request: Request):
    nickname = payload.nickname.strip()[:20]
    if not nickname:
        raise HTTPException(status_code=400, detail="닉네임을 입력하세요")
    today = kst_today()
    conn = get_connection()
    try:
        user_id: Optional[int] = None
        if auth_config()["enabled"]:
            # 로그인 활성 환경: 길드 디스코드 멤버만 출석 가능
            uid = current_user_id(request)
            if uid is None:
                raise HTTPException(status_code=401, detail="출석 체크는 디스코드 로그인이 필요합니다")
            user = conn.execute(
                "SELECT guild_member FROM users WHERE id = ?", (uid,)
            ).fetchone()
            if not user or user["guild_member"] != 1:
                raise HTTPException(status_code=403, detail="추억길드 디스코드 멤버만 출석할 수 있습니다")
            if conn.execute(
                "SELECT 1 FROM guild_attendance WHERE user_id = ? AND date = ?", (uid, today)
            ).fetchone():
                raise HTTPException(status_code=409, detail="오늘은 이미 출석했습니다")
            user_id = uid
        dup = conn.execute(
            "SELECT 1 FROM guild_attendance WHERE nickname = ? AND date = ?", (nickname, today)
        ).fetchone()
        if dup:
            raise HTTPException(status_code=409, detail="오늘은 이미 출석했습니다")
        conn.execute(
            "INSERT INTO guild_attendance (nickname, date, user_id) VALUES (?, ?, ?)",
            (nickname, today, user_id),
        )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True, "date": today, "nickname": nickname}


@router.get("/guild/attendance/today")
def today_list():
    today = kst_today()
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT nickname, created_at FROM guild_attendance WHERE date = ? ORDER BY created_at",
            (today,),
        ).fetchall()
    finally:
        conn.close()
    return {"date": today, "checked_in": [dict(r) for r in rows]}


@router.get("/guild/attendance/stats")
def month_stats(
    month: Optional[str] = Query(default=None, description="YYYY-MM, 기본 이번 달(KST)"),
    nickname: Optional[str] = Query(default=None, description="개인 달력용 닉네임"),
):
    m = month or datetime.now(KST).strftime("%Y-%m")
    if len(m) != 7 or m[4] != "-":
        raise HTTPException(status_code=400, detail="month는 YYYY-MM 형식")
    conn = get_connection()
    try:
        # 월간 랭킹 (출석 일수)
        ranking = conn.execute(
            """SELECT nickname, COUNT(*) AS days FROM guild_attendance
               WHERE date LIKE ? GROUP BY nickname ORDER BY days DESC, nickname LIMIT 50""",
            (m + "-%",),
        ).fetchall()
        # 개인 달력 (해당 월 출석 날짜들)
        my_days: list[str] = []
        streak = 0
        if nickname:
            my_days = [
                r["date"]
                for r in conn.execute(
                    "SELECT date FROM guild_attendance WHERE nickname = ? AND date LIKE ? ORDER BY date",
                    (nickname.strip(), m + "-%"),
                ).fetchall()
            ]
            # 연속 출석 (오늘 또는 어제부터 거꾸로) — 월 경계 넘어 전체 이력 기준
            all_dates = {
                r["date"]
                for r in conn.execute(
                    "SELECT date FROM guild_attendance WHERE nickname = ?", (nickname.strip(),)
                ).fetchall()
            }
            cursor = datetime.now(KST)
            if cursor.strftime("%Y-%m-%d") not in all_dates:
                cursor -= timedelta(days=1)  # 오늘 아직 출석 전이면 어제부터 카운트
            while cursor.strftime("%Y-%m-%d") in all_dates:
                streak += 1
                cursor -= timedelta(days=1)
    finally:
        conn.close()
    return {
        "month": m,
        "ranking": [dict(r) for r in ranking],
        "my_days": my_days,
        "streak": streak,
    }
