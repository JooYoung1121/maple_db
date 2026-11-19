"""On-demand, name-based Itemchart search. No scheduler or persistent collection."""
import asyncio
import time
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Query, Response

from api.itemchart_service import GEMS, ItemchartFormatError, extract_rows, normalize_row

router = APIRouter()
ORIGIN = "https://itemchart.net"
CACHE_SECONDS = 30
MAX_CACHE_ENTRIES = 128
MAX_HTML_BYTES = 3_000_000
_cache: dict[str, tuple[float, dict]] = {}
_fetch_lock = asyncio.Lock()


@router.get("/itemchart/gems")
def gem_catalog():
    """The same verified code/effect mapping used to decode listings. No external calls."""
    families = ("다이아몬드", "사파이어", "가넷", "오팔", "자수정", "아쿠아마린", "토파즈", "에메랄드",
                "힘의 크리스탈", "지혜의 크리스탈", "행운의 크리스탈", "민첩성의 크리스탈", "비밀의 크리스탈")
    grades = ("하급", "중급", "상급")
    return {"gems": [{"code": code, "itemId": 4250000 + (code % 1000) * 100 + code // 10000,
                       "name": f"{grades[code // 10000]} {families[code % 1000]}",
                       "stat": stat, "amount": amount, "grade": code // 10000,
                       "weaponOnly": code % 1000 in (0, 1)} for code, (stat, amount) in GEMS.items()]}


async def _fetch_page(url: str) -> str:
    async with httpx.AsyncClient(timeout=httpx.Timeout(12.0), follow_redirects=False,
                                 headers={"User-Agent": "Mozilla/5.0", "Accept": "text/html",
                                          "Accept-Language": "ko-KR,ko;q=0.9"}) as client:
        async with client.stream("GET", url) as upstream:
            upstream.raise_for_status()
            content = bytearray()
            async for chunk in upstream.aiter_bytes():
                content.extend(chunk)
                if len(content) > MAX_HTML_BYTES:
                    raise ItemchartFormatError("Search page too large")
            return content.decode("utf-8")


@router.get("/itemchart/search")
async def search(
    response: Response,
    q: str = Query(..., min_length=1, max_length=100),
    kind: Literal["active", "sold"] = "active",
    sort: Literal["price-asc", "price-desc", "time-desc", "time-asc"] = "price-asc",
    stat: Literal["attack", "magicAttack", "STR", "DEX", "INT", "LUK", "HP", "MP",
                  "physicalDefense", "magicDefense", "accuracy", "avoidability", "speed", "jump",
                  "remaining", "upgrades"] | None = None,
    stat_min: int | None = Query(default=None, ge=0, le=9_999_999),
    stat_max: int | None = Query(default=None, ge=0, le=9_999_999),
    gem: Literal["any", "applied", "none"] = "any",
    min_price: int | None = Query(default=None, ge=0, le=9_223_372_036_854_775_807),
    max_price: int | None = Query(default=None, ge=0, le=9_223_372_036_854_775_807),
):
    q = q.strip()
    if not q:
        raise HTTPException(422, "아이템 이름을 입력해 주세요.")
    if kind == "active" and sort == "time-asc":
        raise HTTPException(422, "오래된 거래순은 최근 거래에서 사용할 수 있습니다.")
    if (stat_min is not None or stat_max is not None) and stat is None:
        raise HTTPException(422, "옵션 종류를 선택해 주세요.")
    if any(lo is not None and hi is not None and lo > hi for lo, hi in
           [(stat_min, stat_max), (min_price, max_price)]):
        raise HTTPException(422, "최솟값은 최댓값보다 클 수 없습니다.")
    params = {"q": q, "sort": "collected-desc" if kind == "active" and sort == "time-desc" else sort}
    if min_price is not None:
        params["min"] = str(min_price)
    if max_price is not None:
        params["max"] = str(max_price)
    if stat:
        params["marketOption"] = stat
        if stat_min is not None:
            params["marketMin"] = str(stat_min)
        if stat_max is not None:
            params["marketMax"] = str(stat_max)
    if gem != "any":
        suffix = "2" if stat else ""
        params[f"marketOption{suffix}"] = "gem"
        params[f"marketMin{suffix}"] = gem
    url = f"{ORIGIN}/mapleland/{'market' if kind == 'active' else 'sold'}?{urlencode(params)}"
    response.headers["Cache-Control"] = "no-store"

    def cached():
        entry = _cache.get(url)
        return {**entry[1], "cached": True} if entry and entry[0] > time.monotonic() else None

    if result := cached():
        return result
    # Serialize misses and deduplicate waiting identical searches; don't queue indefinitely.
    try:
        await asyncio.wait_for(_fetch_lock.acquire(), timeout=3)
    except TimeoutError:
        raise HTTPException(429, "조회가 몰리고 있습니다. 잠시 후 다시 검색해 주세요.", headers={"Retry-After": "3"})
    try:
        if result := cached():
            return result
        try:
            html = await asyncio.wait_for(_fetch_page(url), timeout=15)
            rows, observed_at = extract_rows(html, kind)
            result = {"query": q, "kind": kind, "sort": sort, "sourceUrl": url,
                      "fetchedAt": datetime.now(timezone.utc).isoformat(),
                      "observedAt": observed_at, "cacheSeconds": CACHE_SECONDS,
                      "filters": {"stat": stat, "statMin": stat_min, "statMax": stat_max, "gem": gem,
                                  "minPrice": str(min_price) if min_price is not None else None,
                                  "maxPrice": str(max_price) if max_price is not None else None},
                      "rows": [normalize_row(row, kind) for row in rows], "cached": False}
        except (httpx.TimeoutException, TimeoutError):
            raise HTTPException(504, "템차트 응답이 늦어지고 있습니다. 다시 검색해 주세요.")
        except httpx.HTTPStatusError as exc:
            message = "템차트에서 조회 요청을 제한했습니다." if exc.response.status_code in (403, 429) else "템차트 조회에 실패했습니다."
            raise HTTPException(502, message)
        except httpx.RequestError:
            raise HTTPException(502, "템차트에 연결할 수 없습니다.")
        except (ItemchartFormatError, UnicodeError, RecursionError):
            raise HTTPException(502, "템차트 결과 형식을 확인하지 못했습니다. 원문에서 확인해 주세요.")
        now = time.monotonic()
        for key in list(_cache):
            if _cache[key][0] <= now:
                del _cache[key]
        if len(_cache) >= MAX_CACHE_ENTRIES:
            del _cache[next(iter(_cache))]
        _cache[url] = (now + CACHE_SECONDS, result)
        return result
    finally:
        _fetch_lock.release()
