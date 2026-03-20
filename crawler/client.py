"""속도제한 HTTP 클라이언트 + HTML 캐시"""
from __future__ import annotations

import asyncio
import hashlib
import time
from pathlib import Path
from typing import Dict, Optional

import httpx

from .config import CACHE_DIR, MAX_RETRIES, RATE_LIMIT, TIMEOUT


class ThrottledClient:
    """도메인별 속도제한이 적용된 비동기 HTTP 클라이언트"""

    def __init__(self):
        self._last_request: dict[str, float] = {}
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self):
        self._client = httpx.AsyncClient(
            timeout=TIMEOUT,
            follow_redirects=True,
            headers={
                "User-Agent": "MapleDataCollector/1.0 (educational project)",
                "Accept-Language": "ko-KR,ko;q=0.9",
            },
        )
        return self

    async def __aexit__(self, *exc):
        if self._client:
            await self._client.aclose()

    def _get_delay(self, url: str) -> float:
        for domain, delay in RATE_LIMIT.items():
            if domain in url:
                return delay
        return 1.0

    async def get(self, url: str, use_cache: bool = True, cache_key: str | None = None) -> str:
        # 캐시 확인
        if use_cache and cache_key:
            cached = self._read_cache(cache_key)
            if cached is not None:
                return cached

        # 속도제한
        delay = self._get_delay(url)
        domain = url.split("/")[2]
        last = self._last_request.get(domain, 0)
        wait = delay - (time.monotonic() - last)
        if wait > 0:
            await asyncio.sleep(wait)

        # 재시도 로직
        for attempt in range(MAX_RETRIES):
            try:
                resp = await self._client.get(url)
                self._last_request[domain] = time.monotonic()
                resp.raise_for_status()
                html = resp.text

                if use_cache and cache_key:
                    self._write_cache(cache_key, html)

                return html
            except (httpx.HTTPStatusError, httpx.TransportError) as e:
                if attempt == MAX_RETRIES - 1:
                    raise
                await asyncio.sleep(2 ** attempt)

    @staticmethod
    def _cache_path(key: str) -> Path:
        safe = hashlib.md5(key.encode()).hexdigest()
        parts = key.split("/")
        subdir = parts[0] if parts else "misc"
        path = CACHE_DIR / subdir
        path.mkdir(parents=True, exist_ok=True)
        return path / f"{safe}.html"

    def _read_cache(self, key: str) -> str | None:
        path = self._cache_path(key)
        if path.exists():
            return path.read_text(encoding="utf-8")
        return None

    def _write_cache(self, key: str, content: str):
        path = self._cache_path(key)
        path.write_text(content, encoding="utf-8")
