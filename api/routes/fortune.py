"""오늘의 운세 — Rate Limiting + Gemini AI 생성 (매 요청마다 새로 생성, 캐시 미사용)"""
import json
import os
import random
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import httpx
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

# v62(메이플랜드) 유효 ID 로드
_V62_IDS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "v62_ids.json"
_MAPLELAND_REF_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "mapleland_reference.json"
_v62_mob_ids: set[str] = set()
_v62_map_ids: set[str] = set()
_v62_item_ids: set[str] = set()
_mapleland_mobs: list[dict] = []
_mapleland_maps: list[dict] = []
_mapleland_items: list[dict] = []
try:
    with open(_V62_IDS_PATH) as _f:
        _v62 = json.load(_f)
        _v62_mob_ids = set(_v62["mob_ids"])
        _v62_map_ids = set(_v62["map_ids"])
        _v62_item_ids = set(_v62["item_ids"])
    print(f"[fortune] v62 ID 로드 완료: mob={len(_v62_mob_ids)}, map={len(_v62_map_ids)}, item={len(_v62_item_ids)}")
except Exception as e:
    print(f"[fortune] v62 ID 로드 실패 (DB 전체 데이터 사용): {e}")

try:
    with open(_MAPLELAND_REF_PATH) as _f:
        _mapleland_ref = json.load(_f).get("entities", {})
        _mapleland_mobs = _mapleland_ref.get("mobs", {}).get("records", [])
        _mapleland_maps = _mapleland_ref.get("maps", {}).get("records", [])
        _mapleland_items = _mapleland_ref.get("items", {}).get("records", [])
    print(
        "[fortune] MapleLand 기준 데이터 로드 완료: "
        f"mob={len(_mapleland_mobs)}, map={len(_mapleland_maps)}, item={len(_mapleland_items)}"
    )
except Exception as e:
    print(f"[fortune] MapleLand 기준 데이터 로드 실패: {type(e).__name__}")

router = APIRouter()

KST = timezone(timedelta(hours=9))
COOLDOWN_SEC = 30
DAILY_LIMIT = 3

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")

# ── 띠 & 별자리 계산 ──────────────────────────────────────

ZODIAC_ANIMALS = [
    "원숭이", "닭", "개", "돼지", "쥐", "소",
    "호랑이", "토끼", "용", "뱀", "말", "양",
]

# (별자리명, 시작 월, 시작 일) — 국내 운세 통용 기준
# 물병 1.20~2.18 / 물고기 2.19~3.20 / 양 3.21~4.19 / 황소 4.20~5.20 /
# 쌍둥이 5.21~6.21 / 게 6.22~7.22 / 사자 7.23~8.22 / 처녀 8.23~9.23 /
# 천칭 9.24~10.22 / 전갈 10.23~11.22 / 사수 11.23~12.24 / 염소 12.25~1.19
CONSTELLATIONS = [
    ("물병자리", 1, 20), ("물고기자리", 2, 19), ("양자리", 3, 21),
    ("황소자리", 4, 20), ("쌍둥이자리", 5, 21), ("게자리", 6, 22),
    ("사자자리", 7, 23), ("처녀자리", 8, 23), ("천칭자리", 9, 24),
    ("전갈자리", 10, 23), ("사수자리", 11, 23), ("염소자리", 12, 25),
]


def _get_zodiac(year: int) -> str:
    return ZODIAC_ANIMALS[year % 12]


def _get_constellation(month: int, day: int) -> str:
    # CONSTELLATIONS[i] = (별자리명, 시작 월, 시작 일).
    # 해당 월의 시작일 이상이면 그 별자리, 미만이면 직전(이전 달에서 시작한) 별자리.
    for i, (name, m, start_day) in enumerate(CONSTELLATIONS):
        if month == m:
            if day >= start_day:
                return name
            return CONSTELLATIONS[(i - 1) % len(CONSTELLATIONS)][0]
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
    """DB에서 v62(메이플랜드) 데이터만 랜덤 샘플링하여 프롬프트 컨텍스트로 반환."""
    if _mapleland_mobs and _mapleland_maps and _mapleland_items:
        mob_pool = [
            r for r in _mapleland_mobs
            if r.get("name_kr") and int(r.get("level") or 0) > 0 and int(r.get("level") or 0) <= 150
        ]
        map_pool = [
            r for r in _mapleland_maps
            if r.get("name_kr")
            and "스테이지" not in r["name_kr"]
            and "입구" not in r["name_kr"]
            and "퇴장" not in r["name_kr"]
        ]
        item_pool = [
            r for r in _mapleland_items
            if r.get("name_kr")
            and "헤어" not in r["name_kr"]
            and "성형" not in r["name_kr"]
            and "얼굴" not in r["name_kr"]
        ]

        mob_rows = random.sample(mob_pool, min(30, len(mob_pool)))
        map_rows = random.sample(map_pool, min(30, len(map_pool)))
        item_rows = random.sample(item_pool, min(30, len(item_pool)))

        monsters = "\n".join(
            f"{i+1}. {r['name_kr']}(Lv.{int(r.get('level') or 0)})"
            for i, r in enumerate(mob_rows)
        )
        maps = "\n".join(f"{i+1}. {r['name_kr']}" for i, r in enumerate(map_rows))
        items = "\n".join(f"{i+1}. {r['name_kr']}" for i, r in enumerate(item_rows))
        return monsters, maps, items

    # v62 ID 필터 조건 생성
    def _id_filter(ids: set[str], col: str = "e.entity_id") -> str:
        normalized_ids = sorted({int(i) for i in ids if str(i).isdigit()})
        if not normalized_ids:
            return "1=1"
        return f"CAST({col} AS INTEGER) IN ({','.join(str(i) for i in normalized_ids)})"

    # 몬스터: v62에 존재 + 레벨 있고 보스/소환물 제외
    mob_rows = conn.execute(f"""
        SELECT e.name_en, m.level FROM mobs m
        JOIN entity_names_en e ON e.entity_type='mob' AND e.entity_id=m.id AND e.source='kms'
        WHERE COALESCE(m.is_hidden, 0) = 0
          AND m.level > 0 AND m.level <= 150
          AND COALESCE(m.is_boss, 0) = 0
          AND {_id_filter(_v62_mob_ids, 'm.id')}
          AND e.name_en NOT LIKE '%소환%'
          AND e.name_en NOT LIKE '%의 %손%'
          AND e.name_en NOT LIKE '%의 %머리%'
          AND e.name_en NOT LIKE '%팔_'
        ORDER BY RANDOM() LIMIT 30
    """).fetchall()
    monsters = "\n".join(f"{i+1}. {r[0]}(Lv.{r[1]})" for i, r in enumerate(mob_rows))

    # 맵: v62에 존재 + 마을/도장/자유시장/PQ 스테이지 제외
    map_rows = conn.execute(f"""
        SELECT e.name_en FROM maps mp
        JOIN entity_names_en e ON e.entity_type='map' AND e.entity_id=mp.id AND e.source='kms'
        WHERE COALESCE(mp.is_town, 0) = 0
          AND {_id_filter(_v62_map_ids, 'mp.id')}
          AND mp.street_name IS NOT NULL AND mp.street_name != ''
          AND mp.street_name NOT LIKE '%Dojo%'
          AND mp.street_name NOT LIKE '%Free Market%'
          AND e.name_en NOT LIKE '%스테이지%'
          AND e.name_en NOT LIKE '%나가는%'
          AND e.name_en NOT LIKE '%입장%'
        ORDER BY RANDOM() LIMIT 30
    """).fetchall()
    maps = "\n".join(f"{i+1}. {r[0]}" for i, r in enumerate(map_rows))

    # 아이템: v62에 존재 + 장비/무기/소비 (헤어/성형/캐시 제외)
    item_rows = conn.execute(f"""
        SELECT e.name_en FROM items i
        JOIN entity_names_en e ON e.entity_type='item' AND e.entity_id=i.id AND e.source='kms'
        WHERE COALESCE(i.is_hidden, 0) = 0
          AND {_id_filter(_v62_item_ids, 'i.id')}
          AND i.overall_category IN ('Equip', 'Use')
          AND e.name_en != ''
          AND e.name_en NOT LIKE '%헤어%'
          AND e.name_en NOT LIKE '%머리%'
          AND e.name_en NOT LIKE '%얼굴%'
          AND e.name_en NOT LIKE '%성형%'
          AND e.name_en NOT LIKE '%*%천%'
          AND i.category NOT IN ('Character', 'Face', 'Hair')
        ORDER BY RANDOM() LIMIT 30
    """).fetchall()
    items = "\n".join(f"{i+1}. {r[0]}" for i, r in enumerate(item_rows))

    return monsters, maps, items


JOB_HINTS = {
    "전사": "몸으로 길을 열기보다 한 박자 늦게 들어가면 사냥 흐름이 더 안정적입니다.",
    "궁수": "자리 선정과 거리 조절이 좋은 날입니다. 욕심내기보다 명중률 높은 루트가 잘 맞습니다.",
    "마법사": "마나 관리와 동선 정리가 잘 풀리는 날입니다. 몰이 사냥보다 안정적인 순환이 좋습니다.",
    "도적": "빠른 판단이 빛나는 날입니다. 드롭 확인과 포션 타이밍만 챙기면 손해를 줄일 수 있습니다.",
}


def _pick_from_context(rng: random.Random, text: str, fallback: str) -> str:
    lines = [line for line in text.splitlines() if ". " in line]
    if not lines:
        return fallback
    value = rng.choice(lines).split(". ", 1)[1].strip()
    if "(Lv." in value:
        value = value.rsplit("(Lv.", 1)[0].strip()
    return value or fallback


def _generate_fortune_local(
    zodiac: str, constellation: str, job: str, date_str: str, conn,
) -> dict:
    """외부 AI 없이 DB 샘플과 규칙만으로 운세를 생성한다."""
    monsters, maps, items = _sample_game_data(conn)
    rng = random.Random(f"{date_str}:{zodiac}:{constellation}:{job}:{time.time_ns()}")

    lucky_monster = _pick_from_context(rng, monsters, "달팽이")
    lucky_map = _pick_from_context(rng, maps, "헤네시스")
    lucky_item = _pick_from_context(rng, items, "주황 포션")
    enhance_luck = rng.randint(1, 5)
    hint = JOB_HINTS.get(job, "무리하지 않고 기본기를 지키면 흐름이 좋아지는 날입니다.")

    maple_messages = [
        f"오늘은 {lucky_map} 쪽 기운이 좋습니다. {job} 특성상 {hint} {lucky_monster}를 만나면 드롭 운을 한 번 기대해봐도 좋습니다.",
        f"{zodiac}띠의 끈기가 메랜에서도 잘 살아나는 날입니다. {lucky_item}처럼 작지만 확실한 준비물이 사냥 흐름을 편하게 만들어줍니다.",
        f"강화운은 {enhance_luck}/5 정도입니다. 큰 승부보다는 필요한 장비를 차분히 점검하고, 사냥 루틴을 짧게 끊어가는 쪽이 좋습니다.",
    ]
    real_messages = [
        f"{constellation}의 흐름은 정리와 회복 쪽에 가깝습니다. 급하게 결론을 내기보다 미뤄둔 일을 하나씩 끝내면 마음이 가벼워집니다.",
        "금전운은 작은 지출을 줄이는 쪽에서 이득이 있습니다. 사람 관계에서는 먼저 단정하지 않고 한 번 더 들어주는 태도가 도움이 됩니다.",
        "컨디션은 무리하면 바로 표시가 날 수 있습니다. 짧은 휴식과 가벼운 정리가 오늘의 페이스를 오래 붙잡아줍니다.",
    ]

    return {
        "maple_fortune": "\n".join(maple_messages),
        "real_fortune": "\n".join(real_messages),
        "lucky_monster": lucky_monster,
        "lucky_map": lucky_map,
        "lucky_item": lucky_item,
        "enhance_luck": enhance_luck,
        "source": "local",
    }


GEMINI_FORTUNE_MODEL = os.environ.get("GEMINI_FORTUNE_MODEL", "gemini-2.5-flash")
GEMINI_FORTUNE_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_FORTUNE_MODEL}:generateContent"
)


async def _generate_fortune_ai(
    zodiac: str, constellation: str, job: str, date_str: str, conn,
) -> dict:
    """Gemini API(httpx REST)로 운세를 생성한다. DB에서 실제 게임 데이터를 프롬프트에 포함.

    google-generativeai SDK는 설치돼 있지 않으므로 httpx REST 직접 호출을 사용한다
    (summarizer/nhit과 동일한 방식). 캐시 없이 매 요청마다 호출되므로 사용자마다 다른 운세가 나온다.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="AI API 키가 설정되지 않았습니다.")

    monsters, maps, items = _sample_game_data(conn)

    prompt = FORTUNE_PROMPT.format(
        date=date_str, zodiac=zodiac, constellation=constellation, job=job,
        monsters=monsters, maps=maps, items=items,
    )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 1.0},
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            GEMINI_FORTUNE_URL,
            params={"key": GEMINI_API_KEY},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    cleaned = text.replace("```json", "").replace("```", "").strip()
    return json.loads(cleaned)


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

        # 2. 운세 생성: 캐시 없이 매 요청마다 새로 생성한다.
        #    일일 3회 제한이 있어 매번 모델을 새로 돌려도 부담이 적고,
        #    캐시를 쓰면 같은 조합(띠/별자리/직업)의 모든 사용자가 동일한 운세를 보던 문제가 있었다.
        #    Gemini 키가 없거나 호출이 실패하면 DB 기반 로컬 운세로 fallback.
        try:
            fortune = await _generate_fortune_ai(zodiac, constellation, body.job, date_str, conn)
            fortune["source"] = "ai"
        except Exception as e:
            print(f"[fortune] AI 운세 실패, 로컬 운세 사용: {type(e).__name__}: {e}")
            fortune = _generate_fortune_local(zodiac, constellation, body.job, date_str, conn)

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
    except Exception as e:
        print(f"[fortune] 오류: {e}")
        raise HTTPException(status_code=500, detail="운세 생성 중 오류가 발생했습니다.")
    finally:
        conn.close()
