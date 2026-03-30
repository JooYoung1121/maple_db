"""디스코드 봇 설정 / 수동 알림 관리 API"""
import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection
from api.discord_bot import get_bot

router = APIRouter()

ALLOWED_KEYS = {"channel_id", "notify_maple_land", "notify_guild_post"}


def _check_admin(request: Request):
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    provided_pw = request.headers.get("X-Admin-Password", "")
    if provided_pw != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀렸습니다.")


@router.get("/discord/status")
def discord_status():
    bot = get_bot()
    online = bot is not None and bot.is_ready()
    return {
        "online": online,
        "user": str(bot.user) if online and bot else None,
    }


@router.get("/discord/settings")
def discord_settings(request: Request):
    _check_admin(request)
    conn = get_connection()
    rows = conn.execute("SELECT key, value FROM bot_settings").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


class SettingsUpdate(BaseModel):
    channel_id: Optional[str] = None
    notify_maple_land: Optional[str] = None
    notify_guild_post: Optional[str] = None


@router.patch("/discord/settings")
def update_discord_settings(body: SettingsUpdate, request: Request):
    _check_admin(request)
    updates = {k: v for k, v in body.model_dump().items() if v is not None and k in ALLOWED_KEYS}
    if not updates:
        raise HTTPException(status_code=400, detail="변경할 설정이 없습니다.")

    conn = get_connection()
    for key, value in updates.items():
        conn.execute(
            "INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )
    conn.commit()
    conn.close()
    return {"ok": True, "updated": updates}


class ManualNotify(BaseModel):
    message: str


@router.post("/discord/notify")
async def send_discord_notify(body: ManualNotify, request: Request):
    _check_admin(request)
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="메시지를 입력하세요.")

    bot = get_bot()
    if not bot or not bot.is_ready():
        raise HTTPException(status_code=503, detail="봇이 오프라인 상태입니다.")

    await bot.send_manual(body.message.strip())
    return {"ok": True}


@router.post("/discord/notify/guild-post/{post_id}")
async def send_guild_post_notify(post_id: int, request: Request):
    """길드 게시글을 디스코드로 전송"""
    _check_admin(request)

    conn = get_connection()
    row = conn.execute("SELECT * FROM guild_posts WHERE id = ?", [post_id]).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")

    bot = get_bot()
    if not bot or not bot.is_ready():
        raise HTTPException(status_code=503, detail="봇이 오프라인 상태입니다.")

    await bot.send_guild_post_detail(
        row["post_type"], row["title"], row["content"], row["author"],
    )
    return {"ok": True}
