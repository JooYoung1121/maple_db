"""디스코드 OAuth 로그인 + 세션 쿠키 + 계정별 개인화 저장.

- OAuth scope는 identify 하나만 사용 (id·유저명·아바타). 이메일 등은 받지 않는다.
- 길드 멤버 확인·서버 별명·역할은 기존 봇 토큰으로 서버 측에서 조회
  (DISCORD_BOT_TOKEN + DISCORD_GUILD_ID 환경 변수 필요 — 없으면 미확인으로 동작).
- 세션: HMAC 서명 토큰을 HttpOnly 쿠키에 저장. 시크릿은 bot_settings에 1회 생성·영속.
- users / user_settings 는 유저 데이터 — 시드 동기화 대상 아님.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel

from crawler.db import get_connection

router = APIRouter()


def _migrate() -> None:
    """기존 DB에 site_nickname 컬럼 보강 (신규 DB는 SCHEMA에 포함)."""
    try:
        conn = get_connection()
        try:
            conn.execute("ALTER TABLE users ADD COLUMN site_nickname TEXT")
            conn.commit()
        except Exception:
            pass  # 이미 존재
        conn.close()
    except Exception:
        pass


_migrate()

DISCORD_API = "https://discord.com/api/v10"
COOKIE_NAME = "ml_session"
SESSION_TTL = 60 * 60 * 24 * 30  # 30일
SETTINGS_KEYS = {"brain_char", "brain_pins", "my_maple", "favorites"}
MAX_SETTING_BYTES = 16 * 1024


def _client_id() -> str:
    return os.environ.get("DISCORD_CLIENT_ID", "").strip()


def _client_secret() -> str:
    return os.environ.get("DISCORD_CLIENT_SECRET", "").strip()


def _site_base() -> str:
    return os.environ.get("PUBLIC_SITE_URL", "https://memorymapledb.up.railway.app").rstrip("/")


def _redirect_uri() -> str:
    return f"{_site_base()}/api/auth/discord/callback"


_secret_cache: Optional[bytes] = None


def _session_secret() -> bytes:
    """세션 서명 시크릿 — env 우선, 없으면 bot_settings에 1회 생성 후 영속."""
    global _secret_cache
    if _secret_cache:
        return _secret_cache
    env = os.environ.get("SESSION_SECRET", "").strip()
    if env:
        _secret_cache = env.encode()
        return _secret_cache
    conn = get_connection()
    try:
        row = conn.execute("SELECT value FROM bot_settings WHERE key='session_secret'").fetchone()
        if row and row["value"]:
            _secret_cache = row["value"].encode()
            return _secret_cache
        val = secrets.token_urlsafe(48)
        conn.execute(
            "INSERT INTO bot_settings (key, value) VALUES ('session_secret', ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (val,),
        )
        conn.commit()
        _secret_cache = val.encode()
        return _secret_cache
    finally:
        conn.close()


def _sign(payload: str) -> str:
    sig = hmac.new(_session_secret(), payload.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode().rstrip("=")


def _make_token(user_id: int) -> str:
    payload = f"{user_id}.{int(time.time()) + SESSION_TTL}"
    return f"{payload}.{_sign(payload)}"


def _verify_token(token: str) -> Optional[int]:
    try:
        uid_s, exp_s, sig = token.rsplit(".", 2)[-3:]
        payload = f"{uid_s}.{exp_s}"
        if not hmac.compare_digest(_sign(payload), sig):
            return None
        if int(exp_s) < time.time():
            return None
        return int(uid_s)
    except Exception:
        return None


def current_user_id(request: Request) -> Optional[int]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    return _verify_token(token)


def _require_user(request: Request) -> int:
    uid = current_user_id(request)
    if uid is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    return uid


def _safe_next(next_path: Optional[str]) -> str:
    """오픈 리다이렉트 방지 — 사이트 내부 경로만 허용."""
    if next_path and next_path.startswith("/") and not next_path.startswith("//"):
        return next_path
    return "/"


# ── 설정/상태 ────────────────────────────────────────────
@router.get("/auth/config")
def auth_config():
    return {"enabled": bool(_client_id() and _client_secret())}


@router.get("/auth/discord/login")
def discord_login(next: Optional[str] = Query(default=None)):
    if not _client_id():
        raise HTTPException(status_code=503, detail="디스코드 로그인이 설정되지 않았습니다.")
    state_payload = f"{int(time.time())}:{_safe_next(next)}"
    state = base64.urlsafe_b64encode(state_payload.encode()).decode() + "." + _sign(state_payload)
    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": "identify",
        "state": state,
        "prompt": "none",
    }
    return Response(
        status_code=307,
        headers={"Location": f"https://discord.com/oauth2/authorize?{urlencode(params)}"},
    )


async def _fetch_guild_profile(discord_id: str) -> dict:
    """봇 토큰으로 길드 멤버십·별명·역할 조회. 설정 없으면 미확인."""
    bot_token = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
    guild_id = os.environ.get("DISCORD_GUILD_ID", "").strip()
    if not bot_token or not guild_id:
        return {"member": None, "nick": None, "roles": []}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                f"{DISCORD_API}/guilds/{guild_id}/members/{discord_id}",
                headers={"Authorization": f"Bot {bot_token}"},
            )
            if r.status_code == 404:
                return {"member": False, "nick": None, "roles": []}
            r.raise_for_status()
            data = r.json()
            role_ids = set(data.get("roles") or [])
            role_names: list[str] = []
            if role_ids:
                rr = await client.get(
                    f"{DISCORD_API}/guilds/{guild_id}/roles",
                    headers={"Authorization": f"Bot {bot_token}"},
                )
                if rr.status_code == 200:
                    role_names = [ro["name"] for ro in rr.json() if ro["id"] in role_ids]
            return {"member": True, "nick": data.get("nick"), "roles": role_names}
    except Exception:
        return {"member": None, "nick": None, "roles": []}


@router.get("/auth/discord/callback")
async def discord_callback(code: str = Query(default=""), state: str = Query(default="")):
    if not code:
        raise HTTPException(status_code=400, detail="인증 코드가 없습니다.")
    # state 검증 (CSRF) + next 복원
    next_path = "/"
    try:
        b64, sig = state.rsplit(".", 1)
        payload = base64.urlsafe_b64decode(b64.encode()).decode()
        if not hmac.compare_digest(_sign(payload), sig):
            raise ValueError
        ts_s, next_path = payload.split(":", 1)
        if time.time() - int(ts_s) > 600:
            raise ValueError
        next_path = _safe_next(next_path)
    except Exception:
        raise HTTPException(status_code=400, detail="잘못된 state 입니다.")

    async with httpx.AsyncClient(timeout=10) as client:
        tok = await client.post(
            f"{DISCORD_API}/oauth2/token",
            data={
                "client_id": _client_id(),
                "client_secret": _client_secret(),
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": _redirect_uri(),
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if tok.status_code != 200:
            raise HTTPException(status_code=400, detail="토큰 교환에 실패했습니다.")
        access_token = tok.json().get("access_token")
        me = await client.get(
            f"{DISCORD_API}/users/@me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if me.status_code != 200:
            raise HTTPException(status_code=400, detail="프로필 조회에 실패했습니다.")
        profile = me.json()

    discord_id = str(profile["id"])
    username = profile.get("username")
    global_name = profile.get("global_name")
    avatar_hash = profile.get("avatar")
    avatar_url = (
        f"https://cdn.discordapp.com/avatars/{discord_id}/{avatar_hash}.png?size=64"
        if avatar_hash else None
    )
    guild = await _fetch_guild_profile(discord_id)

    conn = get_connection()
    try:
        conn.execute(
            """INSERT INTO users (discord_id, username, global_name, avatar_url,
                                  guild_member, guild_nick, guild_roles, last_login_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(discord_id) DO UPDATE SET
                 username=excluded.username,
                 global_name=excluded.global_name,
                 avatar_url=excluded.avatar_url,
                 guild_member=excluded.guild_member,
                 guild_nick=excluded.guild_nick,
                 guild_roles=excluded.guild_roles,
                 last_login_at=datetime('now')""",
            (
                discord_id, username, global_name, avatar_url,
                1 if guild["member"] else 0,
                guild["nick"],
                json.dumps(guild["roles"], ensure_ascii=False),
            ),
        )
        conn.commit()
        uid = conn.execute("SELECT id FROM users WHERE discord_id=?", (discord_id,)).fetchone()["id"]
    finally:
        conn.close()

    resp = Response(status_code=307, headers={"Location": next_path})
    resp.set_cookie(
        COOKIE_NAME, _make_token(uid),
        max_age=SESSION_TTL, httponly=True, samesite="lax",
        secure=_site_base().startswith("https"), path="/",
    )
    return resp


@router.get("/auth/me")
def auth_me(request: Request):
    uid = current_user_id(request)
    if uid is None:
        return {"user": None}
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, discord_id, username, global_name, avatar_url, guild_member, guild_nick, guild_roles, site_nickname FROM users WHERE id=?",
            (uid,),
        ).fetchone()
        if not row:
            return {"user": None}
        settings = {
            r["key"]: json.loads(r["value"]) if r["value"] else None
            for r in conn.execute("SELECT key, value FROM user_settings WHERE user_id=?", (uid,))
        }
        user = dict(row)
        try:
            user["guild_roles"] = json.loads(user.get("guild_roles") or "[]")
        except Exception:
            user["guild_roles"] = []
        user["display_name"] = row["site_nickname"] or row["guild_nick"] or row["global_name"] or row["username"]
        return {"user": user, "settings": settings}
    finally:
        conn.close()


class NicknameBody(BaseModel):
    nickname: str = ""


@router.post("/auth/me/nickname")
def set_site_nickname(body: NicknameBody, request: Request):
    """사이트 표시 닉네임 설정 — 빈 값이면 디스코드 이름으로 복귀."""
    uid = _require_user(request)
    nick = body.nickname.strip()[:12]
    conn = get_connection()
    try:
        conn.execute("UPDATE users SET site_nickname=? WHERE id=?", (nick or None, uid))
        conn.commit()
        return {"ok": True, "nickname": nick or None}
    finally:
        conn.close()


@router.post("/auth/logout")
def auth_logout():
    resp = Response(status_code=200, content='{"ok": true}', media_type="application/json")
    resp.delete_cookie(COOKIE_NAME, path="/")
    return resp


# ── 개인화 저장 ──────────────────────────────────────────
class SettingBody(BaseModel):
    value: dict | list | str | int | float | bool | None


@router.put("/me/settings/{key}")
def put_setting(key: str, body: SettingBody, request: Request):
    uid = _require_user(request)
    if key not in SETTINGS_KEYS:
        raise HTTPException(status_code=400, detail=f"허용되지 않는 키: {key}")
    raw = json.dumps(body.value, ensure_ascii=False)
    if len(raw.encode()) > MAX_SETTING_BYTES:
        raise HTTPException(status_code=400, detail="저장 데이터가 너무 큽니다(16KB 제한).")
    conn = get_connection()
    try:
        conn.execute(
            """INSERT INTO user_settings (user_id, key, value, updated_at)
               VALUES (?, ?, ?, datetime('now'))
               ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')""",
            (uid, key, raw),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.get("/me/settings/{key}")
def get_setting(key: str, request: Request):
    uid = _require_user(request)
    if key not in SETTINGS_KEYS:
        raise HTTPException(status_code=400, detail=f"허용되지 않는 키: {key}")
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM user_settings WHERE user_id=? AND key=?", (uid, key)
        ).fetchone()
        return {"value": json.loads(row["value"]) if row and row["value"] else None}
    finally:
        conn.close()
