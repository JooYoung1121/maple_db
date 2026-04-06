"""오늘의 운세 — 캐시 + Rate Limiting + Gemini AI 생성"""
import asyncio
import json
import os
import random
import time
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

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

# ── 띠 & 별자리 계산 ──────────────────────────────────────

ZODIAC_ANIMALS = [
    "원숭이", "닭", "개", "돼지", "쥐", "소",
    "호랑이", "토끼", "용", "뱀", "말", "양",
]

CONSTELLATIONS = [
    ("물병자리", 1, 20), ("물고기자리", 2, 19), ("양자리", 3, 21),
    ("황소자리", 4, 20), ("쌍둥이자리", 5, 21), ("게자리", 6, 22),
    ("사자자리", 7, 23), ("처녀자리", 8, 23), ("천칭자리", 9, 23),
    ("전갈자리", 10, 23), ("사수자리", 11, 22), ("염소자리", 12, 22),
]


def _get_zodiac(year: int) -> str:
    return ZODIAC_ANIMALS[year % 12]


def _get_constellation(month: int, day: int) -> str:
    for i, (name, m, start_day) in enumerate(CONSTELLATIONS):
        next_name = CONSTELLATIONS[(i + 1) % len(CONSTELLATIONS)][0]
        if month == m and day >= start_day:
            return next_name
        if month == m and day < start_day:
            return name
    return "염소자리"


def _kst_today() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Gemini AI 운세 생성 ───────────────────────────────────

FORTUNE_PROMPT = """너는 메이플스토리 v62(빅뱅 이전, 메이플랜드) 세계관에 정통한 점술사야.

오늘 날짜: {date}
사용자 정보: {zodiac}띠, {constellation}, 직업: {job}

아래 JSON 형식으로 오늘의 운세를 생성해줘. 반드시 유효한 JSON만 출력해.

{{
  "maple_fortune": "메이플랜드 세계관 운세 (3~4문장. {job} 직업 특성 반영. 사냥, 강화, 파티퀘스트, 보스 등 게임 콘텐츠 언급. 구체적이고 재미있게)",
  "real_fortune": "현실 운세 (3~4문장. {constellation}의 오늘 운세. 금전/연애/건강/직장 중 2~3가지 언급. 따뜻하고 긍정적으로)",
  "lucky_monster": "행운의 몬스터 이름 (메이플랜드 v62에 실제 존재하는 몬스터. 예: 주니어 발록, 크로노스, 머쉬맘, 좀비머쉬룸, 이끼달팽이, 타이머, 블러드하프, 레드 드레이크, 와일드보어, 루이넬 등)",
  "lucky_map": "행운의 사냥터 이름 (메이플랜드 v62에 실제 존재하는 맵. 예: 개미굴 깊은 곳, 루디브리엄 시계탑, 죽은 나무의 숲, 엘나스 산간지역, 지구방위본부 등)",
  "lucky_item": "행운의 아이템 이름 (메이플랜드 v62에 실제 존재하는 아이템. 장비/소비/기타 모두 가능. 예: 청룡언월도, 반 레온 모자, 장갑 공격력 주문서 60%, 엘릭서, 10% 주문서 등)",
  "enhance_luck": (1~5 사이 정수. 오늘의 강화 운. 1=매우나쁨, 5=대박)
}}

중요:
- 코드블록(```) 없이 순수 JSON만 출력
- {zodiac}띠와 {constellation}의 특성을 운세에 자연스럽게 녹여줘
- 메이플 운세는 {job} 직업의 실제 플레이 스타일을 반영해
- 모든 몬스터/맵/아이템은 메이플스토리 v62(빅뱅 이전)에 실제로 존재하는 것이어야 함"""


async def _generate_fortune_ai(
    zodiac: str, constellation: str, job: str, date_str: str,
) -> dict:
    """Gemini API로 운세를 생성한다."""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="AI API 키가 설정되지 않았습니다.")

    import google.generativeai as genai

    prompt = FORTUNE_PROMPT.format(
        date=date_str, zodiac=zodiac, constellation=constellation, job=job,
    )

    def _sync_generate() -> dict:
        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        text = response.text.strip() if response.text else ""
        # JSON 정리 (코드블록 감싸져 있을 수도 있음)
        cleaned = text.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)

    return await asyncio.to_thread(_sync_generate)


# ── 메인 운세 엔드포인트 (통합) ────────────────────────────

class FortuneRequest(BaseModel):
    birthdate: str  # YYYY-MM-DD
    job: str        # 전사 | 궁수 | 마법사 | 도적


@router.post("/fortune")
async def get_fortune(body: FortuneRequest, request: Request):
    # 입력 검증
    if not body.birthdate or not body.job:
        raise HTTPException(status_code=400, detail="생년월일과 직업을 입력해주세요.")

    try:
        parts = body.birthdate.split("-")
        year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    zodiac = _get_zodiac(year)
    constellation = _get_constellation(month, day)
    date_str = _kst_today()

    # 1. Rate Limit 체크
    ip = _get_client_ip(request)
    now = time.time()
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        rl_row = conn.execute(
            "SELECT request_count, last_request_at FROM fortune_rate_limit WHERE ip = ? AND request_date = ?",
            [ip, date_str],
        ).fetchone()

        if rl_row:
            elapsed = now - rl_row["last_request_at"]
            if elapsed < COOLDOWN_SEC:
                remaining_sec = int(COOLDOWN_SEC - elapsed) + 1
                raise HTTPException(
                    status_code=429,
                    detail=f"{remaining_sec}초 후에 다시 시도해주세요.",
                )
            if rl_row["request_count"] >= DAILY_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail="오늘의 운세 조회 횟수를 모두 사용했습니다. (일일 10회)",
                )
            conn.execute(
                "UPDATE fortune_rate_limit SET request_count = request_count + 1, last_request_at = ? WHERE ip = ? AND request_date = ?",
                [now, ip, date_str],
            )
            remaining_count = DAILY_LIMIT - rl_row["request_count"] - 1
        else:
            conn.execute(
                "INSERT INTO fortune_rate_limit (ip, request_date, request_count, last_request_at) VALUES (?, ?, 1, ?)",
                [ip, date_str, now],
            )
            remaining_count = DAILY_LIMIT - 1
        conn.commit()

        # 2. 캐시 확인
        cache_rows = conn.execute(
            """SELECT id, maple_fortune, real_fortune,
                      lucky_monster, lucky_map, lucky_item, enhance_luck, created_at
               FROM fortune_cache
               WHERE cache_date = ? AND zodiac = ? AND constellation = ? AND job = ?
               ORDER BY created_at DESC""",
            [date_str, zodiac, constellation, body.job],
        ).fetchall()

        if len(cache_rows) >= MAX_CACHE_PER_COMBO:
            # 이미 3개 → 랜덤 반환
            cached = dict(random.choice(cache_rows))
            return {
                **cached,
                "zodiac": zodiac,
                "constellation": constellation,
                "job": body.job,
                "cached": True,
                "remaining": max(remaining_count, 0),
            }

        # 3. Gemini AI로 운세 생성
        fortune = await _generate_fortune_ai(zodiac, constellation, body.job, date_str)

        # 4. 캐시 저장
        conn.execute(
            """INSERT INTO fortune_cache
               (cache_date, zodiac, constellation, job,
                maple_fortune, real_fortune, lucky_monster, lucky_map, lucky_item, enhance_luck)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                date_str, zodiac, constellation, body.job,
                fortune.get("maple_fortune", ""),
                fortune.get("real_fortune", ""),
                fortune.get("lucky_monster"),
                fortune.get("lucky_map"),
                fortune.get("lucky_item"),
                fortune.get("enhance_luck", 3),
            ],
        )
        conn.commit()

        return {
            **fortune,
            "zodiac": zodiac,
            "constellation": constellation,
            "job": body.job,
            "cached": False,
            "remaining": max(remaining_count, 0),
        }

    except HTTPException:
        raise
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI 응답을 파싱하지 못했습니다. 다시 시도해주세요.")
    except Exception as e:
        print(f"[fortune] 오류: {e}")
        raise HTTPException(status_code=500, detail="운세 생성 중 오류가 발생했습니다.")
    finally:
        conn.close()
