"""구인·구직 카드 메이커 — AI 일러스트 생성 (Gemini 무료 티어 테스트).

카드 합성 자체는 전부 프론트(브라우저 캔버스)에서 처리한다. 이 라우트는
선택 기능인 "캐릭터 캡쳐 → 치비 일러스트 변환" 한 가지만 담당한다.

- 모델: GEMINI_IMAGE_MODEL (기본 gemini-2.5-flash-image) — fortune/nhit과 동일하게
  httpx REST 직접 호출 (SDK 미설치 환경)
- 남용 방지: fortune_rate_limit 패턴 그대로 — IP당 일 3회 + 쿨다운 30초,
  무료 티어 보호용 전역 일일 상한 30회
"""
from __future__ import annotations

import base64
import os
import time
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from crawler.db import get_connection

router = APIRouter()

KST = timezone(timedelta(hours=9))
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
GEMINI_IMAGE_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
GEMINI_IMAGE_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_IMAGE_MODEL}:generateContent"
)

DAILY_LIMIT_PER_IP = 3
GLOBAL_DAILY_LIMIT = 30  # 무료 티어 보호 — 전 사용자 합산
COOLDOWN_SEC = 30
MAX_IMAGE_BYTES = 4 * 1024 * 1024  # base64 디코드 기준 4MB

ILLUST_PROMPT = """You are illustrating a MapleStory classic (pre-Big Bang) character.
Reference screenshot of the player's character is attached.

Draw a single high-quality chibi (SD, super-deformed) illustration of this exact character:
- Keep the SAME outfit, weapon, hair style/color, and overall color scheme as the screenshot.
- Job/class hint: {job}. Give a confident, dynamic pose fitting this class.
- Clean bold outlines, vivid cel shading, cute proportions (large head, small body).
- Background: fully transparent or a simple dark radial glow only. NO text, NO logo, NO frame.
- One character only, centered, full body visible."""


def _kst_today() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _ensure_table(conn) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS recruit_card_rate_limit (
            ip TEXT NOT NULL,
            request_date TEXT NOT NULL,
            request_count INTEGER DEFAULT 0,
            last_request_at REAL,
            PRIMARY KEY (ip, request_date)
        )"""
    )


def _quota(conn, ip: str) -> dict:
    today = _kst_today()
    row = conn.execute(
        "SELECT request_count FROM recruit_card_rate_limit WHERE ip=? AND request_date=?",
        (ip, today),
    ).fetchone()
    used = row["request_count"] if row else 0
    total = conn.execute(
        "SELECT COALESCE(SUM(request_count),0) FROM recruit_card_rate_limit WHERE request_date=?",
        (today,),
    ).fetchone()[0]
    return {
        "remaining": max(DAILY_LIMIT_PER_IP - used, 0),
        "daily_limit": DAILY_LIMIT_PER_IP,
        "global_exhausted": total >= GLOBAL_DAILY_LIMIT,
    }


@router.get("/recruit-card/quota")
def get_quota(request: Request):
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        _ensure_table(conn)
        info = _quota(conn, _client_ip(request))
        info["enabled"] = bool(GEMINI_API_KEY)
        return info
    finally:
        conn.close()


class IllustrationRequest(BaseModel):
    image_base64: str  # data URL 또는 순수 base64 (캐릭터 캡쳐)
    job: str = ""


def _decode_image(data: str) -> tuple[str, str]:
    """(mime_type, base64) 반환. data URL과 순수 base64 모두 허용."""
    mime = "image/png"
    if data.startswith("data:"):
        try:
            head, data = data.split(",", 1)
            mime = head.split(";")[0].split(":", 1)[1] or mime
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="이미지 형식이 올바르지 않습니다.")
    if mime not in ("image/png", "image/jpeg", "image/webp"):
        raise HTTPException(status_code=400, detail="PNG/JPEG/WebP 이미지만 지원합니다.")
    try:
        raw = base64.b64decode(data, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="이미지 데이터를 읽을 수 없습니다.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="이미지가 너무 큽니다 (4MB 이하).")
    if len(raw) < 100:
        raise HTTPException(status_code=400, detail="이미지 데이터가 비어 있습니다.")
    return mime, data


async def _call_gemini(mime: str, image_b64: str, job: str) -> str:
    payload = {
        "contents": [{
            "parts": [
                {"text": ILLUST_PROMPT.format(job=job or "MapleStory adventurer")},
                {"inline_data": {"mime_type": mime, "data": image_b64}},
            ],
        }],
        "generationConfig": {"responseModalities": ["IMAGE"]},
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(GEMINI_IMAGE_URL, params={"key": GEMINI_API_KEY}, json=payload)
    if resp.status_code == 429:
        raise HTTPException(status_code=429, detail="무료 생성 한도가 잠시 소진됐습니다. 잠시 후 다시 시도해주세요.")
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"이미지 생성 실패 (모델 응답 {resp.status_code})")
    data = resp.json()
    try:
        for part in data["candidates"][0]["content"]["parts"]:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                out_mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return f"data:{out_mime};base64,{inline['data']}"
    except (KeyError, IndexError, TypeError):
        pass
    raise HTTPException(status_code=502, detail="이미지 생성 결과가 비어 있습니다.")


class TemplateArtRequest(BaseModel):
    prompt: str


@router.post("/recruit-card/template-art")
async def generate_template_art(body: TemplateArtRequest, request: Request):
    """템플릿 배경 아트 사전 생성 (관리자 전용 — 유저 쿼터와 분리).

    생성물은 web/public/recruit-card/ 에 정적 자산으로 커밋해 두고,
    런타임 카드 합성은 이 아트 위에 값만 얹는다 (무료 티어 보호).
    """
    from api.routes.admin import _require_admin

    _require_admin(request)
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY 미설정")
    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt가 필요합니다.")
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["IMAGE"]},
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(GEMINI_IMAGE_URL, params={"key": GEMINI_API_KEY}, json=payload)
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"생성 실패 ({resp.status_code}): {resp.text[:300]}")
    data = resp.json()
    try:
        for part in data["candidates"][0]["content"]["parts"]:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                out_mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return {"image": f"data:{out_mime};base64,{inline['data']}"}
    except (KeyError, IndexError, TypeError):
        pass
    raise HTTPException(status_code=502, detail="생성 결과가 비어 있습니다.")


@router.post("/recruit-card/illustration")
async def generate_illustration(body: IllustrationRequest, request: Request):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="AI 일러스트 기능이 아직 활성화되지 않았습니다.")
    mime, image_b64 = _decode_image(body.image_base64)

    ip = _client_ip(request)
    now = time.time()
    today = _kst_today()
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        _ensure_table(conn)
        total = conn.execute(
            "SELECT COALESCE(SUM(request_count),0) FROM recruit_card_rate_limit WHERE request_date=?",
            (today,),
        ).fetchone()[0]
        if total >= GLOBAL_DAILY_LIMIT:
            raise HTTPException(status_code=429, detail="오늘의 무료 생성분이 모두 소진됐습니다. 내일 다시 시도해주세요.")
        row = conn.execute(
            "SELECT request_count, last_request_at FROM recruit_card_rate_limit WHERE ip=? AND request_date=?",
            (ip, today),
        ).fetchone()
        if row:
            if now - (row["last_request_at"] or 0) < COOLDOWN_SEC:
                wait = int(COOLDOWN_SEC - (now - row["last_request_at"])) + 1
                raise HTTPException(status_code=429, detail=f"{wait}초 후에 다시 시도해주세요.")
            if row["request_count"] >= DAILY_LIMIT_PER_IP:
                raise HTTPException(
                    status_code=429,
                    detail=f"오늘 생성 횟수를 모두 사용했습니다. (일 {DAILY_LIMIT_PER_IP}회)",
                )
            conn.execute(
                "UPDATE recruit_card_rate_limit SET request_count=request_count+1, last_request_at=? "
                "WHERE ip=? AND request_date=?",
                (now, ip, today),
            )
        else:
            conn.execute(
                "INSERT INTO recruit_card_rate_limit (ip, request_date, request_count, last_request_at) "
                "VALUES (?, ?, 1, ?)",
                (ip, today, now),
            )
        conn.commit()
        remaining = _quota(conn, ip)["remaining"]
    finally:
        conn.close()

    image = await _call_gemini(mime, image_b64, body.job)
    return {"image": image, "remaining": remaining}
