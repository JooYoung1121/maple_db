"""matip.kr 시세 프록시 API — CORS 우회용 백엔드 프록시"""
import asyncio
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Query, HTTPException

router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory cache helpers
# ---------------------------------------------------------------------------
_cache: dict[str, tuple[float, object]] = {}  # key -> (expire_ts, data)

ITEMS_TTL = 60 * 60 * 24  # 24 hours
QUOTE_TTL = 60 * 5  # 5 minutes

MATIP_TIMEOUT = 10.0  # seconds
MATIP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
}


def _cache_get(key: str):
    """Return cached value if still valid, else None."""
    entry = _cache.get(key)
    if entry is None:
        return None
    expire_ts, data = entry
    if time.time() > expire_ts:
        del _cache[key]
        return None
    return data


def _cache_set(key: str, data: object, ttl: int):
    _cache[key] = (time.time() + ttl, data)


def _purge_expired():
    """Remove expired entries to prevent memory leak."""
    now = time.time()
    expired = [k for k, (ts, _) in _cache.items() if now > ts]
    for k in expired:
        del _cache[k]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/matip/items")
async def get_items():
    """아이템 목록 (24시간 캐시)."""
    _purge_expired()

    cached = _cache_get("items")
    if cached is not None:
        return cached

    url = "https://matip.kr/quote/assets/item.json"
    try:
        async with httpx.AsyncClient(timeout=MATIP_TIMEOUT, headers=MATIP_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="matip.kr 요청 시간 초과")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"matip.kr 응답 오류: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"matip.kr 연결 실패: {e}")

    _cache_set("items", data, ITEMS_TTL)
    return data


@router.get("/matip/quote")
async def get_quote(
    itemCode: str = Query(..., description="아이템 코드"),
    resolution: str = Query(default="day", description="해상도 (day, week, month)"),
    filter: str = Query(default="all", description="필터"),
    option: Optional[str] = Query(default=None, description="옵션"),
):
    """단일 아이템 시세 조회 (5분 캐시)."""
    _purge_expired()

    cache_key = f"quote:{itemCode}:{resolution}:{filter}:{option}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    params: dict[str, str] = {
        "itemCode": itemCode,
        "resolution": resolution,
        "filter": filter,
    }
    if option is not None:
        params["option"] = option

    url = "https://matip.kr/quote/get_data2.php"
    try:
        async with httpx.AsyncClient(timeout=MATIP_TIMEOUT, headers=MATIP_HEADERS) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="matip.kr 요청 시간 초과")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"matip.kr 응답 오류: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"matip.kr 연결 실패: {e}")

    _cache_set(cache_key, data, QUOTE_TTL)
    return data


async def _fetch_single_quote(
    client: httpx.AsyncClient,
    item_code: str,
    resolution: str,
    filter_val: str,
) -> tuple[str, object]:
    """Fetch a single quote, returning (itemCode, data_or_error)."""
    params = {
        "itemCode": item_code,
        "resolution": resolution,
        "filter": filter_val,
    }

    # Check cache first
    cache_key = f"quote:{item_code}:{resolution}:{filter_val}:None"
    cached = _cache_get(cache_key)
    if cached is not None:
        return item_code, cached

    try:
        resp = await client.get(
            "https://matip.kr/quote/get_data2.php", params=params,
        )
        resp.raise_for_status()
        data = resp.json()
        _cache_set(cache_key, data, QUOTE_TTL)
        return item_code, data
    except Exception as e:
        return item_code, {"error": str(e)}


@router.get("/matip/quote/batch")
async def get_quote_batch(
    itemCodes: str = Query(..., description="쉼표로 구분된 아이템 코드 목록"),
    resolution: str = Query(default="day", description="해상도"),
    filter: str = Query(default="all", description="필터"),
):
    """여러 아이템 시세 동시 조회."""
    _purge_expired()

    codes = [c.strip() for c in itemCodes.split(",") if c.strip()]
    if not codes:
        raise HTTPException(status_code=400, detail="itemCodes가 비어 있습니다")
    if len(codes) > 50:
        raise HTTPException(status_code=400, detail="한 번에 최대 50개 아이템까지 조회 가능합니다")

    async with httpx.AsyncClient(timeout=MATIP_TIMEOUT, headers=MATIP_HEADERS) as client:
        tasks = [
            _fetch_single_quote(client, code, resolution, filter)
            for code in codes
        ]
        results_list = await asyncio.gather(*tasks)

    results = {code: data for code, data in results_list}
    return {"results": results}
