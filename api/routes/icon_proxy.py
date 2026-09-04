"""아이콘 프록시 — maplestory.io 아이콘을 서버가 받아 검증·캐시 후 서빙.

배경: maplestory.io CDN이 간헐적으로 500/타임아웃을 내거나 엉뚱한 이미지를 반환한 사례가 있어
(2026-09-04 리버스 그라베 아이콘 오표시), 한 번 받은 아이콘을 파일 캐시로 고정해 일관성을 보장한다.

- GET /api/icon/{entity_type}/{entity_id} → PNG (Cache-Control 30일)
- 캐시: data/icon_cache/{type}_{id}.png (gitignore 대상 — 컨테이너 재시작 시 자연 재수집)
- 원본 URL: items/mobs/npcs 테이블의 icon_url, 없으면 gms/92 기본 URL
- 검증: HTTP 200 + PNG/GIF 시그니처일 때만 캐시 (잘못된 응답 캐시 방지)
- 원본 fetch 실패 시: 302로 원본 URL 리다이렉트 (클라이언트가 직접 시도)
"""
import re
import urllib.request
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse, Response

from crawler.db import get_connection

router = APIRouter()

CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "icon_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

VALID_TYPES = {"item": "items", "mob": "mobs", "npc": "npcs"}
MAX_BYTES = 200_000  # 아이콘은 수 KB — 비정상 대용량 차단
CACHE_HEADERS = {"Cache-Control": "public, max-age=2592000, immutable"}  # 30일

_ID_RE = re.compile(r"^\d{1,9}$")


def _source_url(entity_type: str, entity_id: int) -> str:
    table = VALID_TYPES[entity_type]
    try:
        conn = get_connection()
        row = conn.execute(f"SELECT icon_url FROM {table} WHERE id = ?", (entity_id,)).fetchone()
        conn.close()
        if row and row[0]:
            return row[0]
    except Exception:
        pass
    return f"https://maplestory.io/api/gms/92/{entity_type}/{entity_id}/icon"


def _looks_like_image(data: bytes) -> bool:
    return data.startswith(b"\x89PNG\r\n\x1a\n") or data.startswith(b"GIF8") or data.startswith(b"\xff\xd8\xff")


def _content_type(data: bytes) -> str:
    if data.startswith(b"GIF8"):
        return "image/gif"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return "image/png"


@router.get("/icon/{entity_type}/{entity_id}")
def get_icon(entity_type: str, entity_id: str):
    if entity_type not in VALID_TYPES or not _ID_RE.match(entity_id):
        raise HTTPException(status_code=404, detail="Not found")
    eid = int(entity_id)

    cache_path = CACHE_DIR / f"{entity_type}_{eid}.png"
    if cache_path.exists():
        data = cache_path.read_bytes()
        if _looks_like_image(data):
            return Response(content=data, media_type=_content_type(data), headers=CACHE_HEADERS)
        cache_path.unlink(missing_ok=True)  # 손상 캐시 제거 후 재수집

    src = _source_url(entity_type, eid)
    data = None
    for _ in range(2):
        try:
            req = urllib.request.Request(src, headers={"User-Agent": "mapledb-icon-proxy/1.0"})
            with urllib.request.urlopen(req, timeout=10) as r:
                body = r.read(MAX_BYTES + 1)
            if len(body) <= MAX_BYTES and _looks_like_image(body):
                data = body
                break
        except Exception:
            continue

    if data is None:
        # 원본이 죽어 있으면 클라이언트가 직접 시도하도록 위임 (기존 핫링크와 동일한 동작)
        return RedirectResponse(src, status_code=302)

    try:
        cache_path.write_bytes(data)
    except Exception:
        pass  # 캐시 실패해도 서빙은 계속
    return Response(content=data, media_type=_content_type(data), headers=CACHE_HEADERS)
