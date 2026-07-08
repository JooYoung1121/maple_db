"""디스코드 봇 설정 / 수동 알림 관리 API"""
import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection
from api.discord_bot import get_bot

router = APIRouter()

ALLOWED_KEYS = {"channel_id", "notify_maple_land", "notify_guild_post", "notify_weekly_news", "weekly_reminder_channel_id", "mention_type", "mention_role_id"}


def _explain_channel_error(error: Exception) -> str:
    message = str(error)
    if "10003" in message or "Unknown Channel" in message:
        return (
            "채널을 찾을 수 없습니다. 채널 ID가 실제 텍스트 채널 ID인지, "
            "봇이 해당 서버에 초대되어 있는지, 채널 보기/메시지 보내기/임베드 링크 권한이 있는지 확인하세요."
        )
    if "50001" in message or "Missing Access" in message:
        return "봇이 채널에 접근할 권한이 없습니다. 채널 보기 권한과 역할 권한을 확인하세요."
    if "50013" in message or "Missing Permissions" in message:
        return "봇 권한이 부족합니다. 메시지 보내기와 임베드 링크 권한을 확인하세요."
    return "채널 연결 확인 중 오류가 발생했습니다. 봇 권한과 채널 ID를 확인하세요."


def _check_admin(request: Request):
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    provided_pw = request.headers.get("X-Admin-Password", "")
    if provided_pw != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀렸습니다.")


@router.get("/discord/status")
async def discord_status():
    bot = get_bot()
    online = bot is not None and bot.is_ready()
    result: dict = {
        "online": online,
        "user": str(bot.user) if online and bot else None,
    }
    # 채널 접근 테스트
    if online and bot:
        ch_id = bot.get_channel_id()
        result["channel_id"] = str(ch_id) if ch_id else None
        if ch_id:
            try:
                ch = await bot.fetch_channel(ch_id)
                result["channel_name"] = ch.name
                result["channel_ok"] = True
            except Exception as e:
                result["channel_error"] = str(e)
                result["channel_help"] = _explain_channel_error(e)
                result["channel_ok"] = False
    return result


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
    notify_weekly_news: Optional[str] = None
    weekly_reminder_channel_id: Optional[str] = None
    mention_type: Optional[str] = None
    mention_role_id: Optional[str] = None


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
    bot = get_bot()
    if bot:
        bot.clear_channel_errors()
    return {"ok": True, "updated": updates}


@router.post("/discord/weekly-reminder-test")
async def weekly_reminder_test(request: Request):
    """주간 메랜 리마인더 테스트 전송 — 요일 조건·주간 중복 방지 없이 즉시 발송.

    실제 일요일 알림과 동일한 채널(weekly_reminder_channel_id, 미설정 시 기본 채널)과
    동일한 메시지 형식을 사용한다.
    """
    _check_admin(request)
    bot = get_bot()
    if not bot or not bot.is_ready():
        raise HTTPException(status_code=503, detail="봇이 오프라인 상태입니다.")

    from datetime import datetime, timedelta, timezone

    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    week_start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
    week_end = now.strftime("%Y-%m-%d")

    conn = get_connection()
    try:
        official = conn.execute(
            "SELECT COUNT(*) FROM maple_land_posts "
            "WHERE REPLACE(COALESCE(published_at, SUBSTR(created_at, 1, 10)), '.', '-') BETWEEN ? AND ?",
            (week_start, week_end),
        ).fetchone()[0]
        community = conn.execute(
            "SELECT COUNT(*) FROM community_posts "
            "WHERE SUBSTR(COALESCE(published_at, first_seen_at), 1, 10) BETWEEN ? AND ?",
            (week_start, week_end),
        ).fetchone()[0]
        top_titles = [
            r[0] for r in conn.execute(
                "SELECT title FROM community_posts "
                "WHERE SUBSTR(COALESCE(published_at, first_seen_at), 1, 10) BETWEEN ? AND ? "
                "ORDER BY recommends DESC, views DESC LIMIT 3",
                (week_start, week_end),
            ).fetchall()
        ]
    finally:
        conn.close()

    try:
        await bot.send_weekly_news_reminder(week_start, week_end, official, community, top_titles)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"디스코드 전송 실패: {e}")
    return {
        "ok": True,
        "week": f"{week_start} ~ {week_end}",
        "official": official,
        "community": community,
        "reminder_channel": str(bot.get_weekly_reminder_channel_id() or bot.get_channel_id()),
    }


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

    try:
        await bot.send_manual(body.message.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"디스코드 전송 실패: {e}")
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

    # 요청 Origin에서 사이트 URL 추출
    origin = request.headers.get("origin") or request.headers.get("referer", "")
    if origin.endswith("/"):
        origin = origin.rstrip("/")
    post_url = f"{origin}/guild" if origin else None

    try:
        await bot.send_guild_post_detail(
            row["post_type"], row["title"], row["content"], row["author"],
            url=post_url,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"디스코드 전송 실패: {e}")
    return {"ok": True}
