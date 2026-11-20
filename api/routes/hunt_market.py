"""Read-only seat market summaries from the public Mashop board."""
import asyncio
import json
import time
from datetime import datetime, timedelta, timezone
from statistics import median

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/hunt-market")
ORIGIN = "https://api.mashop.kr"
UTC = timezone.utc
_cache: dict[tuple, tuple[float, list]] = {}
_lock = asyncio.Lock()
_next_request = 0.0


async def _public_rows(path: str, ttl: int, **params: str) -> list:
    global _next_request
    key = (path, *params.items())
    entry = _cache.get(key)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    if _lock.locked() or time.monotonic() < _next_request:
        raise HTTPException(429, "잠시 후 다시 조회해 주세요.", headers={"Retry-After": "2"})
    async with _lock:
        try:
            async with asyncio.timeout(8), httpx.AsyncClient(timeout=5) as client:
                async with client.stream("GET", ORIGIN + path, params=params) as response:
                    response.raise_for_status()
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) > 4_000_000:
                            raise ValueError("Mashop response too large")
            rows = json.loads(body)
            if path == "/api/maps/all" and isinstance(rows, dict):
                rows = rows.get("mapInfoList")
            if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
                raise ValueError("Unexpected Mashop response")
            if path == "/api/maps/all":
                rows = list(dict.fromkeys(row["mapName"] for row in rows if isinstance(row.get("mapName"), str)))
            else:
                # Keep only fields needed for the summary, including in the cache.
                fields = ("mapName", "serverType", "userMapId", "tradeType", "price",
                          "isCompleted", "createTime", "updateTime")
                rows = [{field: row.get(field) for field in fields} for row in rows]
            if len(_cache) >= 128:
                del _cache[next(iter(_cache))]
            _cache[key] = (time.monotonic() + ttl, rows)
            if path != "/api/maps/all":
                _next_request = time.monotonic() + 0.5
            return rows
        except (httpx.HTTPError, TimeoutError, ValueError, RecursionError) as exc:
            _next_request = time.monotonic() + 10
            raise HTTPException(502, "메랜샵 정보를 불러오지 못했습니다.") from exc


def _timestamp(value: object) -> datetime | None:
    # Mashop sends UTC timestamps without an offset (x-server-time matches HTTP Date).
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
        except ValueError:
            pass
    return None


def summarize(rows: list[dict], name: str, now: datetime) -> dict:
    groups: dict[str, list[tuple[datetime, int | None]]] = {"buy": [], "sell": [], "completed": []}
    timestamps = []
    seen = set()
    for row in rows:
        if (row.get("mapName") != name or row.get("serverType") != "MAIN"
                or row.get("tradeType") not in ("BUY", "SELL")
                or not isinstance(row.get("isCompleted"), bool)):
            continue
        completed = row["isCompleted"]
        stamp = _timestamp(row.get("updateTime") if completed else row.get("createTime"))
        if stamp is None or stamp > now:
            continue
        row_id = row.get("userMapId")
        if type(row_id) in (str, int):
            if row_id in seen:
                continue
            seen.add(row_id)
        timestamps.append(stamp)
        price = row.get("price")
        group = "completed" if completed else row["tradeType"].lower()
        groups[group].append((stamp, price if type(price) is int and 0 < price <= 2**53 - 1 else None))

    def price_summary(records: list[tuple[datetime, int | None]], hours: int) -> dict:
        prices = [price for stamp, price in records if now - stamp <= timedelta(hours=hours) and price is not None]
        return {"count": len(prices), "median": int(median(prices)) if prices else None}

    return {
        "buy": price_summary(groups["buy"], 1),
        "sell": price_summary(groups["sell"], 1),
        "completed": price_summary(groups["completed"], 24),
        "lastActivityAt": max(timestamps).isoformat() if timestamps else None,
        "lastCompletedUpdateAt": max((stamp for stamp, _ in groups["completed"]), default=None),
        "recentCount": sum(now - stamp <= timedelta(minutes=2) for stamp in timestamps),
        "checkedAt": now.isoformat(),
    }


@router.get("/maps")
async def maps():
    return await _public_rows("/api/maps/all", 3600)


@router.get("/summary")
async def summary(name: str = Query(min_length=1, max_length=100)):
    if name not in await maps():
        raise HTTPException(404, "메랜샵에 등록된 사냥터를 선택해 주세요.")
    rows = await _public_rows("/api/maps", 30, keyword=name, serverType="MAIN")
    return summarize(rows, name, datetime.now(UTC))
