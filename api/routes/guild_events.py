"""길드 이벤트 모집 API — 유저가 직접 이벤트를 열고, 기간 내 지원받고, 마감 후 추첨/클리어 처리.

- guild_events: 유저 데이터 (SEED_TABLES 제외)
- 주최자 식별: 생성 시 발급되는 owner_token(브라우저 저장) 또는 로그인 user_id 또는 관리자
- 추첨은 서버에서 secrets 기반으로 뽑아 결과를 기록 (재추첨 불가 — 공정성)
"""
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from crawler.db import get_connection

router = APIRouter()

KST = timezone(timedelta(hours=9))


def _ensure_table() -> None:
    conn = get_connection()
    try:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS guild_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                reward TEXT,
                author TEXT NOT NULL,
                owner_token TEXT NOT NULL,
                user_id INTEGER,
                deadline TEXT NOT NULL,
                capacity INTEGER,
                participants_json TEXT NOT NULL DEFAULT '[]',
                status TEXT NOT NULL DEFAULT 'open',
                result_json TEXT,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )"""
        )
        conn.commit()
    finally:
        conn.close()


_ensure_table()


def _now_kst() -> datetime:
    return datetime.now(KST)


def _row_public(row, include_token: bool = False) -> dict:
    d = dict(row)
    d["participants"] = json.loads(d.pop("participants_json") or "[]")
    d["result"] = json.loads(d["result_json"]) if d.get("result_json") else None
    d.pop("result_json", None)
    d.pop("user_id", None)
    if not include_token:
        d.pop("owner_token", None)
    return d


def _is_owner(row, request: Request, body_token: Optional[str]) -> bool:
    import os

    if body_token and secrets.compare_digest(body_token, row["owner_token"]):
        return True
    pw = request.headers.get("X-Admin-Password", "")
    if pw and pw == os.environ.get("GAME_ADMIN_PASSWORD", ""):
        return True
    from api.routes.auth import current_user_id

    uid = current_user_id(request)
    return uid is not None and row["user_id"] == uid


def _display_name(request: Request) -> Optional[str]:
    from api.routes.auth import current_user_id

    uid = current_user_id(request)
    if uid is None:
        return None
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT COALESCE(site_nickname, guild_nick, global_name, username) AS name FROM users WHERE id=?",
            (uid,),
        ).fetchone()
        return (str(row["name"])[:12], uid) if row and row["name"] else (None, uid)
    finally:
        conn.close()


@router.get("/guild/events")
def list_events(status: Optional[str] = None):
    conn = get_connection()
    try:
        where, params = "", []
        if status in ("open", "closed", "done"):
            where, params = "WHERE status = ?", [status]
        rows = conn.execute(
            f"SELECT * FROM guild_events {where} ORDER BY (status='done'), created_at DESC LIMIT 100",
            params,
        ).fetchall()
        now = _now_kst().strftime("%Y-%m-%dT%H:%M")
        items = []
        for r in rows:
            d = _row_public(r)
            d["expired"] = d["status"] == "open" and d["deadline"] < now
            items.append(d)
        return {"events": items, "server_now": now}
    finally:
        conn.close()


class EventCreate(BaseModel):
    title: str
    description: str = ""
    reward: str = ""
    author: Optional[str] = None
    deadline: str  # "YYYY-MM-DDTHH:MM" (KST)
    capacity: Optional[int] = None


@router.post("/guild/events")
def create_event(body: EventCreate, request: Request):
    title = body.title.strip()
    if not title or len(title) > 60:
        raise HTTPException(status_code=400, detail="제목은 1~60자로 입력하세요.")
    if len(body.description) > 2000:
        raise HTTPException(status_code=400, detail="설명은 2000자 이내로 입력하세요.")
    try:
        deadline = datetime.strptime(body.deadline, "%Y-%m-%dT%H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="마감 일시 형식이 올바르지 않습니다.")
    if deadline.replace(tzinfo=KST) <= _now_kst():
        raise HTTPException(status_code=400, detail="마감 일시는 미래여야 합니다.")
    if body.capacity is not None and not (2 <= body.capacity <= 100):
        raise HTTPException(status_code=400, detail="정원은 2~100명이거나 비워두세요(무제한).")

    name, uid = _display_name(request) or (None, None)
    author = (body.author or "").strip()[:12] or name
    if not author:
        raise HTTPException(status_code=400, detail="주최자 닉네임을 입력하세요.")

    token = secrets.token_urlsafe(24)
    conn = get_connection()
    try:
        recent = conn.execute(
            "SELECT COUNT(*) FROM guild_events WHERE created_at > datetime('now','localtime','-10 minutes')"
        ).fetchone()[0]
        if recent >= 10:
            raise HTTPException(status_code=429, detail="잠시 후 다시 시도해주세요.")
        cur = conn.execute(
            """INSERT INTO guild_events (title, description, reward, author, owner_token, user_id, deadline, capacity)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (title, body.description.strip(), body.reward.strip()[:100], author,
             token, uid, body.deadline, body.capacity),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM guild_events WHERE id=?", (cur.lastrowid,)).fetchone()
        result = _row_public(row, include_token=True)
    finally:
        conn.close()

    # 디스코드 알림 (실패해도 이벤트 생성은 유지)
    try:
        import asyncio

        from api.discord_bot import get_bot

        bot = get_bot()
        if bot and bot.is_ready():
            asyncio.create_task(bot.send_guild_post_embed("event", f"[이벤트 모집] {title}", author))
    except Exception:
        pass
    return result


@router.get("/guild/events/{event_id}")
def get_event(event_id: int):
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM guild_events WHERE id=?", (event_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
        d = _row_public(row)
        d["expired"] = d["status"] == "open" and d["deadline"] < _now_kst().strftime("%Y-%m-%dT%H:%M")
        return {"event": d}
    finally:
        conn.close()


class NicknameBody(BaseModel):
    nickname: Optional[str] = None


@router.patch("/guild/events/{event_id}/join")
def join_event(event_id: int, body: NicknameBody, request: Request):
    name, _uid = _display_name(request) or (None, None)
    nickname = (body.nickname or "").strip()[:12] or name
    if not nickname:
        raise HTTPException(status_code=400, detail="닉네임을 입력하세요.")
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM guild_events WHERE id=?", (event_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
        if row["status"] != "open":
            raise HTTPException(status_code=400, detail="지원이 마감된 이벤트입니다.")
        if row["deadline"] < _now_kst().strftime("%Y-%m-%dT%H:%M"):
            raise HTTPException(status_code=400, detail="지원 기간이 지났습니다.")
        participants = json.loads(row["participants_json"] or "[]")
        if nickname in participants:
            raise HTTPException(status_code=400, detail="이미 지원한 닉네임입니다.")
        if row["capacity"] and len(participants) >= row["capacity"]:
            raise HTTPException(status_code=400, detail="정원이 가득 찼습니다.")
        participants.append(nickname)
        conn.execute(
            "UPDATE guild_events SET participants_json=? WHERE id=?",
            (json.dumps(participants, ensure_ascii=False), event_id),
        )
        conn.commit()
        return {"ok": True, "participants": participants}
    finally:
        conn.close()


@router.patch("/guild/events/{event_id}/leave")
def leave_event(event_id: int, body: NicknameBody, request: Request):
    name, _uid = _display_name(request) or (None, None)
    nickname = (body.nickname or "").strip()[:12] or name
    if not nickname:
        raise HTTPException(status_code=400, detail="닉네임을 입력하세요.")
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM guild_events WHERE id=?", (event_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
        if row["status"] != "open":
            raise HTTPException(status_code=400, detail="마감된 이벤트는 지원 취소할 수 없습니다.")
        participants = json.loads(row["participants_json"] or "[]")
        if nickname not in participants:
            raise HTTPException(status_code=400, detail="지원하지 않은 닉네임입니다.")
        participants.remove(nickname)
        conn.execute(
            "UPDATE guild_events SET participants_json=? WHERE id=?",
            (json.dumps(participants, ensure_ascii=False), event_id),
        )
        conn.commit()
        return {"ok": True, "participants": participants}
    finally:
        conn.close()


class OwnerAction(BaseModel):
    owner_token: Optional[str] = None


class DrawBody(OwnerAction):
    winner_count: int = 1


class ClearBody(OwnerAction):
    note: str = ""


@router.post("/guild/events/{event_id}/close")
def close_event(event_id: int, body: OwnerAction, request: Request):
    """지원 조기 마감 (open → closed)."""
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM guild_events WHERE id=?", (event_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
        if not _is_owner(row, request, body.owner_token):
            raise HTTPException(status_code=403, detail="주최자만 마감할 수 있습니다.")
        if row["status"] != "open":
            raise HTTPException(status_code=400, detail="이미 마감된 이벤트입니다.")
        conn.execute("UPDATE guild_events SET status='closed' WHERE id=?", (event_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.post("/guild/events/{event_id}/draw")
def draw_event(event_id: int, body: DrawBody, request: Request):
    """룰렛 추첨 (open/closed → done). 서버가 뽑고 결과를 고정 — 재추첨 불가."""
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM guild_events WHERE id=?", (event_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
        if not _is_owner(row, request, body.owner_token):
            raise HTTPException(status_code=403, detail="주최자만 추첨할 수 있습니다.")
        if row["status"] == "done":
            raise HTTPException(status_code=400, detail="이미 완료 처리된 이벤트입니다.")
        participants = json.loads(row["participants_json"] or "[]")
        if len(participants) < 1:
            raise HTTPException(status_code=400, detail="지원자가 없습니다.")
        n = max(1, min(body.winner_count, len(participants)))
        winners = []
        pool = list(participants)
        for _ in range(n):
            pick = secrets.choice(pool)
            winners.append(pick)
            pool.remove(pick)
        result = {
            "type": "roulette",
            "winners": winners,
            "winner_count": n,
            "drawn_at": _now_kst().strftime("%Y-%m-%d %H:%M"),
        }
        conn.execute(
            "UPDATE guild_events SET status='done', result_json=? WHERE id=?",
            (json.dumps(result, ensure_ascii=False), event_id),
        )
        conn.commit()
    finally:
        conn.close()

    try:
        import asyncio

        from api.discord_bot import get_bot

        bot = get_bot()
        if bot and bot.is_ready():
            asyncio.create_task(bot.send_guild_post_embed(
                "event", f"[추첨 결과] {row['title']} → {', '.join(winners)}", row["author"]
            ))
    except Exception:
        pass
    return {"ok": True, "result": result}


@router.post("/guild/events/{event_id}/clear")
def clear_event(event_id: int, body: ClearBody, request: Request):
    """클리어/종료 처리 (open/closed → done)."""
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM guild_events WHERE id=?", (event_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
        if not _is_owner(row, request, body.owner_token):
            raise HTTPException(status_code=403, detail="주최자만 완료 처리할 수 있습니다.")
        if row["status"] == "done":
            raise HTTPException(status_code=400, detail="이미 완료 처리된 이벤트입니다.")
        result = {
            "type": "clear",
            "note": body.note.strip()[:200],
            "cleared_at": _now_kst().strftime("%Y-%m-%d %H:%M"),
        }
        conn.execute(
            "UPDATE guild_events SET status='done', result_json=? WHERE id=?",
            (json.dumps(result, ensure_ascii=False), event_id),
        )
        conn.commit()
        return {"ok": True, "result": result}
    finally:
        conn.close()


@router.delete("/guild/events/{event_id}")
def delete_event(event_id: int, body: OwnerAction, request: Request):
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM guild_events WHERE id=?", (event_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
        if not _is_owner(row, request, body.owner_token):
            raise HTTPException(status_code=403, detail="주최자만 삭제할 수 있습니다.")
        conn.execute("DELETE FROM guild_events WHERE id=?", (event_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
