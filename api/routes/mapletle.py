"""메랜틀 — 꼬맨틀(단어 의미 유사도 추리 게임)의 메이플랜드 버전.

매일 자정(KST) 메이플랜드 단어(몹·아이템 한글명) 하나가 비밀 단어로 선정된다.
아무 단어나 자유롭게 입력하면 비밀 단어와의 '의미 유사도'를 알려주고,
정확히 맞추면 성공. 유사도는 Gemini 임베딩(무료 쿼터) 코사인 유사도.

- 임베딩 벡터는 mapletle_vectors 테이블에 영구 캐시 — 같은 단어는 API 재호출 없음
- GEMINI_API_KEY/GOOGLE_API_KEY 미설정 시 유사도 기능 비활성 (enabled=false)
- 하루 임베딩 호출 상한(기본 3000)으로 무료 쿼터 보호
"""
import hashlib
import json
import math
import os
import struct
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from crawler.db import get_connection

router = APIRouter()

KST = timezone(timedelta(hours=9))
EPOCH = "2026-07-14"  # 1번째 퍼즐 날짜
REF_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "mapleland_reference.json"

# 온도 밴드 (cosine*100 기준 — 배포 후 실측 보정 가능)
BANDS = [
    (75.0, "🔥 매우 뜨거움"),
    (65.0, "🌶️ 뜨거움"),
    (55.0, "🌤️ 따뜻함"),
    (45.0, "😐 미지근함"),
    (35.0, "🌬️ 쌀쌀함"),
    (-101.0, "🧊 차가움"),
]

DAILY_EMBED_BUDGET = int(os.environ.get("MAPLETLE_DAILY_BUDGET", "3000"))
_embed_day = {"day": "", "count": 0}
_ip_last: dict[str, float] = {}


def _api_key() -> str:
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")


def kst_today() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


def puzzle_no(date_str: str) -> int:
    d = datetime.strptime(date_str, "%Y-%m-%d") - datetime.strptime(EPOCH, "%Y-%m-%d")
    return d.days + 1


def norm(w: str) -> str:
    return (w or "").replace(" ", "").strip().lower()


def ensure_tables(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS mapletle_vectors (
            word TEXT PRIMARY KEY,
            model TEXT,
            vec BLOB NOT NULL,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );
        CREATE TABLE IF NOT EXISTS mapletle_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            puzzle_date TEXT NOT NULL,
            attempts INTEGER NOT NULL,
            nickname TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );
    """)
    conn.commit()


def secret_pool() -> list[str]:
    """비밀 단어 후보: 레퍼런스 몹+아이템 한글명 (2~10자, 결측 제외)."""
    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    names = set()
    for kind in ("mobs", "items"):
        for r in ref["entities"][kind]["records"]:
            name = (r.get("name_kr") or "").strip()
            if 2 <= len(name.replace(" ", "")) <= 10 and "없음" not in name:
                names.add(name)
    return sorted(names)


def pick_secret(date_str: str) -> str:
    pool = secret_pool()
    seed = int(hashlib.sha256(f"mapletle-{date_str}".encode()).hexdigest(), 16)
    return pool[seed % len(pool)]


# ── 임베딩 ────────────────────────────────────────────
def _pack(values: list[float]) -> bytes:
    return struct.pack(f"{len(values)}f", *values)


def _unpack(blob: bytes) -> list[float]:
    n = len(blob) // 4
    return list(struct.unpack(f"{n}f", blob))


async def _embed_api(text: str) -> Optional[list[float]]:
    key = _api_key()
    if not key:
        return None
    day = kst_today()
    if _embed_day["day"] != day:
        _embed_day["day"], _embed_day["count"] = day, 0
    if _embed_day["count"] >= DAILY_EMBED_BUDGET:
        raise HTTPException(status_code=429, detail="오늘 유사도 계산 한도를 다 썼어요. 내일 다시!")
    models = [os.environ.get("MAPLETLE_EMBED_MODEL", "gemini-embedding-001"), "text-embedding-004"]
    async with httpx.AsyncClient(timeout=15) as client:
        for model in dict.fromkeys(models):
            try:
                r = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent",
                    params={"key": key},
                    json={"model": f"models/{model}", "content": {"parts": [{"text": text}]}},
                )
                if r.status_code == 404:
                    continue
                if r.status_code != 200:
                    print(f"[mapletle] embed {model} 오류 {r.status_code}: {r.text[:150]}")
                    continue
                values = (r.json().get("embedding") or {}).get("values")
                if values:
                    _embed_day["count"] += 1
                    return values
            except Exception as e:
                print(f"[mapletle] embed 호출 실패 ({model}): {e}")
    return None


async def get_vector(conn, word: str) -> Optional[list[float]]:
    """캐시 우선 임베딩. 실패 시 None."""
    key = norm(word)
    row = conn.execute("SELECT vec FROM mapletle_vectors WHERE word=?", (key,)).fetchone()
    if row:
        return _unpack(row["vec"])
    values = await _embed_api(word.strip())
    if not values:
        return None
    conn.execute(
        "INSERT OR REPLACE INTO mapletle_vectors (word, model, vec) VALUES (?,?,?)",
        (key, os.environ.get("MAPLETLE_EMBED_MODEL", "gemini-embedding-001"), _pack(values)),
    )
    conn.commit()
    return values


def cosine(a: list[float], b: list[float]) -> float:
    n = min(len(a), len(b))
    dot = sum(a[i] * b[i] for i in range(n))
    na = math.sqrt(sum(x * x for x in a[:n]))
    nb = math.sqrt(sum(x * x for x in b[:n]))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def band_for(sim100: float) -> str:
    for threshold, label in BANDS:
        if sim100 >= threshold:
            return label
    return BANDS[-1][1]


# ── 엔드포인트 ────────────────────────────────────────
@router.get("/mapletle")
def mapletle_meta():
    conn = get_connection()
    try:
        ensure_tables(conn)
        date_str = kst_today()
        stats = conn.execute(
            "SELECT COUNT(*) AS solvers, ROUND(AVG(attempts),1) AS avg_attempts "
            "FROM mapletle_results WHERE puzzle_date=?",
            (date_str,),
        ).fetchone()
        ranking = conn.execute(
            """SELECT COALESCE(NULLIF(TRIM(nickname), ''), '익명') AS nickname, attempts,
                      SUBSTR(created_at, 12, 5) AS solved_at
               FROM mapletle_results WHERE puzzle_date=?
               ORDER BY attempts ASC, created_at ASC LIMIT 20""",
            (date_str,),
        ).fetchall()
        return {
            "date": date_str,
            "puzzle_no": puzzle_no(date_str),
            "enabled": bool(_api_key()),
            "secret_len": len(pick_secret(date_str).replace(" ", "")),
            "stats": {"solvers": stats["solvers"], "avg_attempts": stats["avg_attempts"]},
            "ranking": [dict(r) for r in ranking],
        }
    finally:
        conn.close()


class GuessPayload(BaseModel):
    word: str


@router.post("/mapletle/guess")
async def mapletle_guess(payload: GuessPayload, request: Request):
    word = payload.word.strip()
    if not (1 <= len(word.replace(" ", "")) <= 20):
        raise HTTPException(status_code=400, detail="1~20자 단어를 입력해주세요")

    # IP 쿨다운 2초 (임베딩 쿼터 보호)
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (
        request.client.host if request.client else "?"
    )
    now = time.time()
    if now - _ip_last.get(ip, 0) < 2:
        raise HTTPException(status_code=429, detail="너무 빨라요! 잠시 후 다시 시도해주세요")
    _ip_last[ip] = now

    date_str = kst_today()
    secret = pick_secret(date_str)
    if norm(word) == norm(secret):
        return {"date": date_str, "word": word, "correct": True, "similarity": 100.0, "band": "🎉 정답!", "answer": secret}

    conn = get_connection()
    try:
        ensure_tables(conn)
        if not _api_key():
            return {"date": date_str, "word": word, "correct": False, "similarity": None,
                    "band": "유사도 서비스 준비 중 (정답 판정만 가능)"}
        sv = await get_vector(conn, secret)
        gv = await get_vector(conn, word)
        if not sv or not gv:
            return {"date": date_str, "word": word, "correct": False, "similarity": None,
                    "band": "유사도 계산에 실패했어요. 잠시 후 다시!"}
        sim100 = round(cosine(sv, gv) * 100, 2)
        return {"date": date_str, "word": word, "correct": False, "similarity": sim100, "band": band_for(sim100)}
    finally:
        conn.close()


class SolvePayload(BaseModel):
    attempts: int
    nickname: str = ""


@router.post("/mapletle/solve")
def mapletle_solve(payload: SolvePayload):
    if not (1 <= payload.attempts <= 2000):
        raise HTTPException(status_code=400, detail="시도 횟수가 올바르지 않습니다")
    nickname = payload.nickname.strip()[:12] or None
    conn = get_connection()
    try:
        ensure_tables(conn)
        conn.execute(
            "INSERT INTO mapletle_results (puzzle_date, attempts, nickname) VALUES (?, ?, ?)",
            (kst_today(), payload.attempts, nickname),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


class DebugSimPayload(BaseModel):
    a: str
    b: str


@router.post("/mapletle/debug-sim")
async def mapletle_debug_sim(payload: DebugSimPayload, request: Request):
    """관리자용 — 두 단어의 유사도 측정 (온도 밴드 보정용)."""
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    if request.headers.get("X-Admin-Password", "") != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀립니다.")
    conn = get_connection()
    try:
        ensure_tables(conn)
        va = await get_vector(conn, payload.a)
        vb = await get_vector(conn, payload.b)
        if not va or not vb:
            raise HTTPException(status_code=503, detail="임베딩 실패 (키/쿼터 확인)")
        sim100 = round(cosine(va, vb) * 100, 2)
        return {"a": payload.a, "b": payload.b, "similarity": sim100, "band": band_for(sim100)}
    finally:
        conn.close()
