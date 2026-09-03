"""공유 보스 타이머 — 혼테일·카오스 자쿰 공대원끼리 타이머 상태를 실시간 동기화.

- 방 코드(6자)가 곧 접근 키. 방 상태(섹션·타이머 JSON)는 서버가 보관
- 타이머 시작은 서버 시각 기준 endAt(ms)으로 기록 → 클라이언트는 server_now로 시계 오차 보정
- 클라이언트는 2초 폴링(version 증가분만 수신). 웹소켓 없이 동작
- boss_timer_rooms는 유저 데이터 테이블 — 시드 동기화 대상 아님
"""
import json
import secrets
import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from crawler.db import get_connection

router = APIRouter()

ROOM_TTL_SECONDS = 48 * 3600  # 마지막 조작 후 48시간 지나면 정리
PRESENCE_TTL = 10.0  # 폴링 10초 끊기면 이탈 간주
LOG_LIMIT = 8
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # 혼동 문자(I/L/O/0/1) 제외

# 접속자 표시는 단일 인스턴스 가정의 in-memory (Railway 단일 컨테이너)
_presence: dict[str, dict[str, tuple[str, float]]] = {}  # code -> client_id -> (nickname, last_seen)
_last_touch: dict[str, float] = {}  # code -> updated_at 마지막 갱신 시각 (폴링 쓰기 절감)
TOUCH_INTERVAL = 600.0  # 폴링에 의한 TTL 갱신은 10분에 1회면 충분


def _conn():
    """폴링 다중 클라이언트의 동시 쓰기에서 즉시 lock 에러가 나지 않도록 대기 시간 부여."""
    conn = get_connection()
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def _ensure_tables() -> None:
    conn = _conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS boss_timer_rooms (
            code TEXT PRIMARY KEY,
            state TEXT NOT NULL,
            log TEXT NOT NULL DEFAULT '[]',
            version INTEGER NOT NULL DEFAULT 1,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )"""
    )
    conn.commit()
    conn.close()


_ensure_tables()


def _purge_expired(conn) -> None:
    conn.execute(
        "DELETE FROM boss_timer_rooms WHERE updated_at < ?",
        (time.time() - ROOM_TTL_SECONDS,),
    )


def _now_ms() -> int:
    return int(time.time() * 1000)


def _touch_presence(code: str, client_id: Optional[str], nickname: str) -> int:
    now = time.time()
    room = _presence.setdefault(code, {})
    if client_id:
        room[client_id] = (nickname or "익명", now)
    stale = [cid for cid, (_, seen) in room.items() if now - seen > PRESENCE_TTL]
    for cid in stale:
        del room[cid]
    return len(room)


def _load_room(conn, code: str):
    row = conn.execute(
        "SELECT state, log, version FROM boss_timer_rooms WHERE code = ?", (code.upper(),)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="방을 찾을 수 없습니다 (만료되었거나 잘못된 코드)")
    return json.loads(row[0]), json.loads(row[1]), row[2]


class CreateRoomPayload(BaseModel):
    state: Any  # 프론트 섹션 구조 그대로 보관
    nickname: str = "익명"
    client_id: Optional[str] = None


class ActionPayload(BaseModel):
    client_id: Optional[str] = None
    nickname: str = "익명"
    type: str  # start | stop | edit | add | remove | repeat
    section_id: str
    timer_id: Optional[str] = None
    label: Optional[str] = None
    duration: Optional[int] = None  # 초


@router.post("/boss-timer/rooms")
def create_room(payload: CreateRoomPayload):
    conn = _conn()
    try:
        _purge_expired(conn)
        # 실행 중이던 로컬 타이머(endAt)는 시계 기준이 달라 공유 시 초기화
        state = payload.state
        for section in state:
            for t in section.get("timers", []):
                t["endAt"] = None
        for _ in range(10):
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
            exists = conn.execute(
                "SELECT 1 FROM boss_timer_rooms WHERE code = ?", (code,)
            ).fetchone()
            if not exists:
                break
        else:
            raise HTTPException(status_code=500, detail="방 코드 생성 실패")
        now = time.time()
        log = [{"at": _now_ms(), "text": f"{payload.nickname}님이 방을 만들었습니다"}]
        conn.execute(
            "INSERT INTO boss_timer_rooms (code, state, log, version, created_at, updated_at) VALUES (?,?,?,1,?,?)",
            (code, json.dumps(state, ensure_ascii=False), json.dumps(log, ensure_ascii=False), now, now),
        )
        conn.commit()
        members = _touch_presence(code, payload.client_id, payload.nickname)
        return {"code": code, "version": 1, "state": state, "log": log, "server_now": _now_ms(), "members": members}
    finally:
        conn.close()


@router.get("/boss-timer/rooms/{code}")
def poll_room(code: str, since: int = 0, client_id: Optional[str] = None, nickname: str = "익명"):
    conn = _conn()
    try:
        state, log, version = _load_room(conn, code)
        # TTL 갱신 쓰기는 방당 10분에 1회로 제한 (폴링은 기본 읽기 전용)
        now = time.time()
        if now - _last_touch.get(code.upper(), 0.0) > TOUCH_INTERVAL:
            _last_touch[code.upper()] = now
            conn.execute("UPDATE boss_timer_rooms SET updated_at = ? WHERE code = ?", (now, code.upper()))
            conn.commit()
    finally:
        conn.close()
    members = _touch_presence(code.upper(), client_id, nickname)
    if version <= since:
        return {"changed": False, "version": version, "server_now": _now_ms(), "members": members}
    return {
        "changed": True,
        "version": version,
        "state": state,
        "log": log,
        "server_now": _now_ms(),
        "members": members,
    }


@router.post("/boss-timer/rooms/{code}/action")
def room_action(code: str, payload: ActionPayload):
    code = code.upper()
    conn = _conn()
    try:
        # 동시 액션의 version read-modify-write 유실 방지 — 쓰기 락을 먼저 잡고 읽는다
        conn.execute("BEGIN IMMEDIATE")
        state, log, version = _load_room(conn, code)

        section = next((s for s in state if s.get("id") == payload.section_id), None)
        if section is None:
            raise HTTPException(status_code=400, detail="알 수 없는 섹션")
        timers = section.setdefault("timers", [])
        timer = next((t for t in timers if t.get("id") == payload.timer_id), None)

        nick = (payload.nickname or "익명").strip()[:12] or "익명"
        log_text: Optional[str] = None

        if payload.type == "start":
            if timer is None:
                raise HTTPException(status_code=400, detail="알 수 없는 타이머")
            timer["endAt"] = _now_ms() + int(timer["duration"]) * 1000
            log_text = f"{nick}: {timer['label']} 시작"
        elif payload.type == "stop":
            if timer is None:
                raise HTTPException(status_code=400, detail="알 수 없는 타이머")
            timer["endAt"] = None
            log_text = f"{nick}: {timer['label']} 리셋"
        elif payload.type == "repeat":
            # 반복(만료 시 자동 재시작) 토글 — endAt은 그대로 두어 진행 중이던 카운트를 유지
            if timer is None:
                raise HTTPException(status_code=400, detail="알 수 없는 타이머")
            timer["repeat"] = not bool(timer.get("repeat"))
            log_text = f"{nick}: {timer['label']} 반복 {'켬' if timer['repeat'] else '끔'}"
        elif payload.type == "edit":
            if timer is None:
                raise HTTPException(status_code=400, detail="알 수 없는 타이머")
            if not payload.label or not payload.duration or payload.duration <= 0:
                raise HTTPException(status_code=400, detail="이름/시간이 올바르지 않습니다")
            old = timer["label"]
            timer["label"] = payload.label.strip()[:20]
            timer["duration"] = int(payload.duration)
            timer["endAt"] = None
            log_text = f"{nick}: {old} → {timer['label']} ({timer['duration']}초) 수정"
        elif payload.type == "add":
            new_id = f"{payload.section_id}-x{secrets.token_hex(3)}"
            timers.append({
                "id": new_id,
                "label": (payload.label or "타이머").strip()[:20],
                "duration": int(payload.duration or 60),
                "endAt": None,
                "removable": True,
                "repeat": False,
            })
            log_text = f"{nick}: 타이머 추가"
        elif payload.type == "remove":
            if timer is None:
                raise HTTPException(status_code=400, detail="알 수 없는 타이머")
            section["timers"] = [t for t in timers if t.get("id") != payload.timer_id]
            log_text = f"{nick}: {timer['label']} 삭제"
        else:
            raise HTTPException(status_code=400, detail="알 수 없는 동작")

        if log_text:
            log.append({"at": _now_ms(), "text": log_text})
            log = log[-LOG_LIMIT:]
        version += 1
        conn.execute(
            "UPDATE boss_timer_rooms SET state = ?, log = ?, version = ?, updated_at = ? WHERE code = ?",
            (json.dumps(state, ensure_ascii=False), json.dumps(log, ensure_ascii=False), version, time.time(), code),
        )
        conn.commit()
    finally:
        conn.close()
    members = _touch_presence(code, payload.client_id, nick)
    return {"changed": True, "version": version, "state": state, "log": log, "server_now": _now_ms(), "members": members}
