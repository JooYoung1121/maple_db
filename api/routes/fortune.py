"""오늘의 운세 — 캐시 CRUD + Rate Limiting API"""
import time
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()

KST = timezone(timedelta(hours=9))
MAX_CACHE_PER_COMBO = 3
COOLDOWN_SEC = 30
DAILY_LIMIT = 10


def _kst_today() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── 캐시 조회 ──────────────────────────────────────────────

@router.get("/fortune/cache")
def get_fortune_cache(
    date: str = Query(...),
    zodiac: str = Query(...),
    constellation: str = Query(...),
    job: str = Query(...),
):
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        rows = conn.execute(
            """SELECT id, maple_fortune, real_fortune,
                      lucky_monster, lucky_map, lucky_item, enhance_luck, created_at
               FROM fortune_cache
               WHERE cache_date = ? AND zodiac = ? AND constellation = ? AND job = ?
               ORDER BY created_at DESC""",
            [date, zodiac, constellation, job],
        ).fetchall()
        results = [dict(r) for r in rows]
        return {"results": results, "count": len(results)}
    finally:
        conn.close()


# ── 캐시 저장 ──────────────────────────────────────────────

class FortuneCacheCreate(BaseModel):
    cache_date: str
    zodiac: str
    constellation: str
    job: str
    maple_fortune: str
    real_fortune: str
    lucky_monster: Optional[str] = None
    lucky_map: Optional[str] = None
    lucky_item: Optional[str] = None
    enhance_luck: Optional[int] = 3


@router.post("/fortune/cache")
def save_fortune_cache(body: FortuneCacheCreate):
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        # 같은 조합 캐시 수 확인
        count = conn.execute(
            """SELECT COUNT(*) FROM fortune_cache
               WHERE cache_date = ? AND zodiac = ? AND constellation = ? AND job = ?""",
            [body.cache_date, body.zodiac, body.constellation, body.job],
        ).fetchone()[0]
        if count >= MAX_CACHE_PER_COMBO:
            # 이미 3개면 랜덤 반환
            rows = conn.execute(
                """SELECT id, maple_fortune, real_fortune,
                          lucky_monster, lucky_map, lucky_item, enhance_luck, created_at
                   FROM fortune_cache
                   WHERE cache_date = ? AND zodiac = ? AND constellation = ? AND job = ?""",
                [body.cache_date, body.zodiac, body.constellation, body.job],
            ).fetchall()
            return {"saved": False, "result": dict(random.choice(rows))}

        conn.execute(
            """INSERT INTO fortune_cache
               (cache_date, zodiac, constellation, job,
                maple_fortune, real_fortune, lucky_monster, lucky_map, lucky_item, enhance_luck)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                body.cache_date, body.zodiac, body.constellation, body.job,
                body.maple_fortune, body.real_fortune,
                body.lucky_monster, body.lucky_map, body.lucky_item,
                body.enhance_luck,
            ],
        )
        conn.commit()
        return {"saved": True}
    finally:
        conn.close()


# ── Rate Limit 체크 + 증가 ─────────────────────────────────

@router.post("/fortune/rate-check")
def check_rate_limit(request: Request):
    ip = _get_client_ip(request)
    today = _kst_today()
    now = time.time()

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        row = conn.execute(
            "SELECT request_count, last_request_at FROM fortune_rate_limit WHERE ip = ? AND request_date = ?",
            [ip, today],
        ).fetchone()

        if row:
            # 쿨다운 체크
            elapsed = now - row["last_request_at"]
            if elapsed < COOLDOWN_SEC:
                remaining = int(COOLDOWN_SEC - elapsed) + 1
                raise HTTPException(
                    status_code=429,
                    detail=f"{remaining}초 후에 다시 시도해주세요.",
                    headers={"Retry-After": str(remaining)},
                )
            # 일일 제한 체크
            if row["request_count"] >= DAILY_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail="오늘의 운세 조회 횟수를 모두 사용했습니다. (일일 10회)",
                )
            # 카운트 증가
            conn.execute(
                """UPDATE fortune_rate_limit
                   SET request_count = request_count + 1, last_request_at = ?
                   WHERE ip = ? AND request_date = ?""",
                [now, ip, today],
            )
        else:
            # 첫 요청
            conn.execute(
                """INSERT INTO fortune_rate_limit (ip, request_date, request_count, last_request_at)
                   VALUES (?, ?, 1, ?)""",
                [ip, today, now],
            )
        conn.commit()

        remaining_count = DAILY_LIMIT
        if row:
            remaining_count = DAILY_LIMIT - row["request_count"] - 1
        else:
            remaining_count = DAILY_LIMIT - 1

        return {"allowed": True, "remaining": max(remaining_count, 0)}
    except HTTPException:
        raise
    finally:
        conn.close()
