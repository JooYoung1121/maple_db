"""샤레니안 길드대항전 공유 정산방.

- 방 코드는 읽기 전용 공유 키로 사용한다.
- 생성 시 한 번 발급하는 edit_token의 해시만 서버에 저장하며, 수정 API는 이 키가 필수다.
- 클라이언트는 version 증분 폴링으로 다른 화면의 변경을 확인한다.
"""
from __future__ import annotations

import hashlib
import json
import secrets
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from crawler.db import get_connection

router = APIRouter()

ROOM_TTL_SECONDS = 400 * 24 * 3600
MAX_STATE_BYTES = 750_000
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _conn():
    conn = get_connection()
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS guild_settlement_rooms (
            code TEXT PRIMARY KEY,
            edit_token_hash TEXT NOT NULL,
            title TEXT NOT NULL,
            event_date TEXT NOT NULL,
            event_time TEXT NOT NULL DEFAULT '',
            session_name TEXT NOT NULL DEFAULT '',
            manager TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'selling',
            state TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )"""
    )
    return conn


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _clean(value: str, limit: int) -> str:
    return (value or "").strip()[:limit]


def _state_json(value: Any) -> str:
    try:
        encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="정산 상태를 저장할 수 없습니다") from exc
    if len(encoded.encode("utf-8")) > MAX_STATE_BYTES:
        raise HTTPException(status_code=413, detail="정산방 데이터가 너무 큽니다")
    return encoded


def _room_payload(row, *, changed: bool = True) -> dict:
    payload = {
        "code": row["code"],
        "version": row["version"],
        "changed": changed,
        "server_now": int(time.time() * 1000),
    }
    if changed:
        payload.update(
            {
                "title": row["title"],
                "event_date": row["event_date"],
                "event_time": row["event_time"],
                "session_name": row["session_name"],
                "manager": row["manager"],
                "status": row["status"],
                "state": json.loads(row["state"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        )
    return payload


class SettlementRoomCreate(BaseModel):
    title: str = "길드대항전 정산"
    event_date: str
    event_time: str = ""
    session_name: str = ""
    manager: str = ""
    status: str = "selling"
    state: Any


class SettlementRoomUpdate(SettlementRoomCreate):
    edit_token: str
    expected_version: int = 0


@router.post("/guild-settlements")
def create_settlement_room(body: SettlementRoomCreate):
    state = _state_json(body.state)
    edit_token = secrets.token_urlsafe(32)
    now = time.time()
    conn = _conn()
    try:
        conn.execute("DELETE FROM guild_settlement_rooms WHERE updated_at < ?", (now - ROOM_TTL_SECONDS,))
        for _ in range(20):
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
            if not conn.execute("SELECT 1 FROM guild_settlement_rooms WHERE code=?", (code,)).fetchone():
                break
        else:
            raise HTTPException(status_code=500, detail="정산방 코드 생성에 실패했습니다")
        conn.execute(
            """INSERT INTO guild_settlement_rooms
               (code, edit_token_hash, title, event_date, event_time, session_name,
                manager, status, state, version, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,1,?,?)""",
            (
                code,
                _token_hash(edit_token),
                _clean(body.title, 80) or "길드대항전 정산",
                _clean(body.event_date, 10),
                _clean(body.event_time, 5),
                _clean(body.session_name, 40),
                _clean(body.manager, 20),
                "settled" if body.status == "settled" else "selling",
                state,
                now,
                now,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM guild_settlement_rooms WHERE code=?", (code,)).fetchone()
        return {**_room_payload(row), "edit_token": edit_token}
    finally:
        conn.close()


@router.get("/guild-settlements/{code}")
def get_settlement_room(code: str, since: int = Query(default=0, ge=0)):
    conn = _conn()
    try:
        row = conn.execute(
            "SELECT * FROM guild_settlement_rooms WHERE code=?", (code.upper(),)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="정산방을 찾을 수 없습니다")
        return _room_payload(row, changed=row["version"] > since)
    finally:
        conn.close()


@router.put("/guild-settlements/{code}")
def update_settlement_room(code: str, body: SettlementRoomUpdate):
    state = _state_json(body.state)
    conn = _conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT * FROM guild_settlement_rooms WHERE code=?", (code.upper(),)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="정산방을 찾을 수 없습니다")
        if not secrets.compare_digest(row["edit_token_hash"], _token_hash(body.edit_token)):
            raise HTTPException(status_code=403, detail="이 정산방은 열람만 가능합니다")
        if body.expected_version and row["version"] != body.expected_version:
            raise HTTPException(status_code=409, detail="다른 화면에서 먼저 수정했습니다. 최신 내용을 불러와주세요")
        version = row["version"] + 1
        now = time.time()
        conn.execute(
            """UPDATE guild_settlement_rooms
               SET title=?, event_date=?, event_time=?, session_name=?, manager=?, status=?,
                   state=?, version=?, updated_at=? WHERE code=?""",
            (
                _clean(body.title, 80) or "길드대항전 정산",
                _clean(body.event_date, 10),
                _clean(body.event_time, 5),
                _clean(body.session_name, 40),
                _clean(body.manager, 20),
                "settled" if body.status == "settled" else "selling",
                state,
                version,
                now,
                code.upper(),
            ),
        )
        conn.commit()
        updated = conn.execute(
            "SELECT * FROM guild_settlement_rooms WHERE code=?", (code.upper(),)
        ).fetchone()
        return _room_payload(updated)
    finally:
        conn.close()
