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
# 2026-04-07 이후 3으로 복원할 것
DAILY_LIMIT = 999

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

아래는 메이플랜드 DB에서 추출한 실제 데이터야.

[몬스터 — 번호와 이름]
{monsters}

[사냥터 — 번호와 이름]
{maps}

[아이템 — 번호와 이름 (장비/무기/방어구/소비 등)]
{items}

아래 JSON 형식으로 오늘의 운세를 생성해줘. 반드시 유효한 JSON만 출력해.

{{
  "maple_fortune": "메이플랜드 세계관 운세 (3~4문장. {job} 직업 특성 반영. 사냥, 강화, 파티퀘스트, 보스 등 게임 콘텐츠 언급. 구체적이고 재미있게)",
  "real_fortune": "현실 운세 (3~4문장. {constellation}의 오늘 운세. 금전/연애/건강/직장 중 2~3가지 언급. 따뜻하고 긍정적으로)",
  "lucky_monster": "위 몬스터 목록에서 번호 하나를 골라 그 이름을 정확히 복사",
  "lucky_map": "위 사냥터 목록에서 번호 하나를 골라 그 이름을 정확히 복사",
  "lucky_item": "위 아이템 목록에서 번호 하나를 골라 그 이름을 정확히 복사",
  "enhance_luck": (1~5 사이 정수. 오늘의 강화 운. 1=매우나쁨, 5=대박)
}}

절대 규칙:
- lucky_monster, lucky_map, lucky_item 값은 위 목록에 있는 이름을 한 글자도 바꾸지 말고 그대로 복사해야 함
- 목록에 없는 몬스터/맵/아이템을 절대 만들어내지 마
- 코드블록(```) 없이 순수 JSON만 출력
- {zodiac}띠와 {constellation}의 특성을 운세에 자연스럽게 녹여줘
- 메이플 운세는 {job} 직업의 실제 플레이 스타일을 반영해"""


def _sample_game_data(conn) -> tuple[str, str, str]:
    """DB에서 몬스터/맵/아이템을 랜덤 샘플링하여 프롬프트 컨텍스트로 반환."""
    # 몬스터: 레벨 있고 숨김 아닌 것 30개 랜덤
    mob_rows = conn.execute("""
        SELECT e.name_en, m.level FROM mobs m
        JOIN entity_names_en e ON e.entity_type='mob' AND e.entity_id=m.id AND e.source='kms'
        WHERE COALESCE(m.is_hidden, 0) = 0 AND m.level > 0 AND m.level <= 150
        ORDER BY RANDOM() LIMIT 30
    """).fetchall()
    monsters = "\n".join(f"{i+1}. {r[0]}(Lv.{r[1]})" for i, r in enumerate(mob_rows))

    # 맵: 마을 제외, 사냥 가능 맵 30개 랜덤 (다양한 지역에서)
    map_rows = conn.execute("""
        SELECT e.name_en, mp.street_name FROM maps mp
        JOIN entity_names_en e ON e.entity_type='map' AND e.entity_id=mp.id AND e.source='kms'
        WHERE COALESCE(mp.is_town, 0) = 0
          AND mp.street_name IS NOT NULL AND mp.street_name != ''
          AND mp.street_name NOT LIKE '%Dojo%'
          AND mp.street_name NOT LIKE '%Free Market%'
          AND e.name_en NOT LIKE '%스테이지%'
        ORDER BY RANDOM() LIMIT 30
    """).fetchall()
    maps = "\n".join(f"{i+1}. {r[0]}" for i, r in enumerate(map_rows))

    # 아이템: 장비(무기+방어구) + 소비 섞어서 30개 랜덤
    item_rows = conn.execute("""
        SELECT e.name_en, i.overall_category, i.category FROM items i
        JOIN entity_names_en e ON e.entity_type='item' AND e.entity_id=i.id AND e.source='kms'
        WHERE COALESCE(i.is_hidden, 0) = 0
          AND i.overall_category IN ('Equip', 'Use')
          AND e.name_en != ''
        ORDER BY RANDOM() LIMIT 30
    """).fetchall()
    items = "\n".join(f"{i+1}. {r[0]}" for i, r in enumerate(item_rows))

    return monsters, maps, items


async def _generate_fortune_ai(
    zodiac: str, constellation: str, job: str, date_str: str, conn,
) -> dict:
    """Gemini API로 운세를 생성한다. DB에서 실제 게임 데이터를 프롬프트에 포함."""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="AI API 키가 설정되지 않았습니다.")

    import google.generativeai as genai

    monsters, maps, items = _sample_game_data(conn)

    prompt = FORTUNE_PROMPT.format(
        date=date_str, zodiac=zodiac, constellation=constellation, job=job,
        monsters=monsters, maps=maps, items=items,
    )

    def _sync_generate() -> dict:
        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        text = response.text.strip() if response.text else ""
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
                    detail=f"오늘의 운세 조회 횟수를 모두 사용했습니다. (일일 {DAILY_LIMIT}회)",
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

        # 3. Gemini AI로 운세 생성 (DB에서 실제 게임 데이터 샘플링)
        fortune = await _generate_fortune_ai(zodiac, constellation, body.job, date_str, conn)

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
