"""대전 게임 방 (오목 등) — 혼테일 타이머 공유 방 패턴 재사용

- versus_rooms 는 유저 데이터 테이블 (시드 동기화 대상 아님)
- 웹소켓 없이 버전 증분 폴링으로 동기화, 관전은 읽기 전용 폴링이라 무제한
- 방은 마지막 조작 후 6시간 지나면 삭제
"""
from __future__ import annotations

import json
import random
import string
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from crawler.db import get_connection

router = APIRouter()

ROOM_TTL_SECONDS = 6 * 3600
PRESENCE_TTL = 10  # 초 — 이 안에 폴링 없으면 방에서 나간 것으로 간주
BOARD_SIZE = 15

# 코드별 접속자 (메모리) — {code: {client_id: (nickname, last_seen)}}
_presence: dict[str, dict[str, tuple[str, float]]] = {}


def _conn():
    conn = get_connection()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS versus_rooms (
            code TEXT PRIMARY KEY,
            game TEXT NOT NULL,
            state TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )"""
    )
    return conn


def _purge(conn) -> None:
    conn.execute("DELETE FROM versus_rooms WHERE updated_at < ?", (time.time() - ROOM_TTL_SECONDS,))


def _touch(code: str, client_id: Optional[str], nickname: str) -> list[dict]:
    now = time.time()
    room = _presence.setdefault(code, {})
    if client_id:
        room[client_id] = (nickname or "익명", now)
    for cid in [c for c, (_, ts) in room.items() if now - ts > PRESENCE_TTL]:
        del room[cid]
    return [{"client_id": c, "nickname": n} for c, (n, _) in room.items()]


MEMORY_PAIRS = 18  # 6x6


def _pick_memory_mobs(n: int) -> list[int]:
    """레퍼런스 몹 중 아이콘 있는 n종 랜덤 (부위몹·변종 제외)."""
    from api.routes.mapleland_reference import id_filter_sql

    conn = get_connection()
    try:
        flt = id_filter_sql("m.id", "mobs")
        rows = conn.execute(
            f"""SELECT m.id FROM mobs m
                WHERE m.icon_url IS NOT NULL AND m.id < 9000000
                {f'AND {flt}' if flt else ''}
                AND NOT EXISTS (
                    SELECT 1 FROM entity_names_en e
                    WHERE e.entity_type='mob' AND e.entity_id=m.id AND e.source='kms'
                      AND (e.name_en LIKE '%팔_' OR e.name_en LIKE '%의 다리' OR e.name_en LIKE '%훈련용%')
                )
                ORDER BY RANDOM() LIMIT ?""",
            (n,),
        ).fetchall()
        return [r["id"] for r in rows]
    finally:
        conn.close()


def _new_memory_state(host_client: str, host_nick: str, first: str = "P1") -> dict:
    mobs = _pick_memory_mobs(MEMORY_PAIRS)
    cards = mobs * 2
    random.shuffle(cards)
    return {
        "game": "memory",
        "cards": cards,
        "revealed": [False] * len(cards),
        "flip": [],
        "last_pair": None,  # [i, j, matched]
        "turn": first,
        "seats": {"P1": {"client_id": host_client, "nickname": host_nick} if host_client else None, "P2": None},
        "scores": {"P1": 0, "P2": 0},
        "winner": None,
        "rematch": [],
        "log": [],
    }


def _new_omok_state(host_client: str, host_nick: str) -> dict:
    return {
        "game": "omok",
        "board": "." * (BOARD_SIZE * BOARD_SIZE),
        "turn": "B",
        "seats": {"B": {"client_id": host_client, "nickname": host_nick}, "W": None},
        "winner": None,
        "last_move": None,
        "move_count": 0,
        "rematch": [],
        "log": [],
    }


def _check_win(board: str, x: int, y: int, stone: str) -> bool:
    """마지막 착수 기준 5목 이상 (freestyle)."""
    for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
        cnt = 1
        for sign in (1, -1):
            nx, ny = x, y
            while True:
                nx += dx * sign
                ny += dy * sign
                if not (0 <= nx < BOARD_SIZE and 0 <= ny < BOARD_SIZE):
                    break
                if board[ny * BOARD_SIZE + nx] != stone:
                    break
                cnt += 1
        if cnt >= 5:
            return True
    return False


def _log(state: dict, text: str) -> None:
    state["log"] = (state.get("log") or [])[-19:] + [{"at": int(time.time() * 1000), "text": text}]


class CreateRoom(BaseModel):
    game: str
    nickname: str = "익명"
    client_id: str


class RoomAction(BaseModel):
    client_id: str
    nickname: str = "익명"
    action: dict


@router.post("/versus/rooms")
def create_room(body: CreateRoom):
    if body.game not in ("omok", "memory"):
        raise HTTPException(status_code=400, detail="지원하지 않는 게임입니다.")
    if not body.client_id:
        raise HTTPException(status_code=400, detail="client_id 필요")
    conn = _conn()
    try:
        _purge(conn)
        for _ in range(20):
            code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if not conn.execute("SELECT 1 FROM versus_rooms WHERE code=?", (code,)).fetchone():
                break
        else:
            raise HTTPException(status_code=500, detail="방 코드 생성 실패")
        nick = body.nickname.strip()[:12] or "익명"
        if body.game == "memory":
            state = _new_memory_state(body.client_id, nick)
            _log(state, f"{nick} 님이 같은그림찾기 방을 만들었습니다 (P1)")
        else:
            state = _new_omok_state(body.client_id, nick)
            _log(state, f"{state['seats']['B']['nickname']} 님이 방을 만들었습니다 (흑)")
        now = time.time()
        conn.execute(
            "INSERT INTO versus_rooms (code, game, state, version, created_at, updated_at) VALUES (?,?,?,1,?,?)",
            (code, body.game, json.dumps(state, ensure_ascii=False), now, now),
        )
        conn.commit()
    finally:
        conn.close()
    members = _touch(code, body.client_id, body.nickname)
    return {"code": code, "version": 1, "state": state, "members": members, "server_now": int(time.time() * 1000)}


@router.get("/versus/rooms/{code}")
def poll_room(
    code: str,
    since: int = Query(default=0, ge=0),
    client_id: Optional[str] = Query(default=None),
    nickname: str = Query(default="익명"),
):
    code = code.upper()
    conn = _conn()
    try:
        _purge(conn)
        row = conn.execute("SELECT game, state, version FROM versus_rooms WHERE code=?", (code,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="방을 찾을 수 없습니다 (만료되었을 수 있어요)")
        members = _touch(code, client_id, nickname)
        changed = row["version"] > since
        return {
            "code": code,
            "game": row["game"],
            "version": row["version"],
            "changed": changed,
            "state": json.loads(row["state"]) if changed else None,
            "members": members,
            "server_now": int(time.time() * 1000),
        }
    finally:
        conn.close()


@router.post("/versus/rooms/{code}/action")
def room_action(code: str, body: RoomAction):
    code = code.upper()
    nickname = body.nickname.strip()[:12] or "익명"
    act = body.action or {}
    a_type = act.get("type")
    conn = _conn()
    try:
        row = conn.execute("SELECT game, state, version FROM versus_rooms WHERE code=?", (code,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="방을 찾을 수 없습니다")
        state = json.loads(row["state"])
        seats = state["seats"]
        game = row["game"]
        seat_keys = ("B", "W") if game == "omok" else ("P1", "P2")
        seat_label = (lambda s: ("흑" if s == "B" else "백")) if game == "omok" else (lambda s: s)
        my_seat = next((s for s in seat_keys if seats.get(s) and seats[s]["client_id"] == body.client_id), None)

        if a_type == "sit":
            seat = act.get("seat")
            if seat not in seat_keys:
                raise HTTPException(status_code=400, detail="잘못된 좌석")
            if seats.get(seat):
                raise HTTPException(status_code=409, detail="이미 다른 분이 앉아 있어요")
            if my_seat:
                raise HTTPException(status_code=409, detail="이미 착석 중입니다")
            seats[seat] = {"client_id": body.client_id, "nickname": nickname}
            _log(state, f"{nickname} 님이 {seat_label(seat)}에 앉았습니다")

        elif a_type == "stand":
            if not my_seat:
                raise HTTPException(status_code=400, detail="착석 중이 아닙니다")
            started = (state.get("move_count", 0) > 0) if game == "omok" else (
                bool(state.get("flip")) or any(state.get("revealed") or []) or sum((state.get("scores") or {}).values()) > 0
            )
            if started and not state["winner"]:
                # 게임 중 이탈 = 기권
                other = seat_keys[1] if my_seat == seat_keys[0] else seat_keys[0]
                state["winner"] = other
                _log(state, f"{nickname} 님 기권 — {seat_label(other)} 승리")
            else:
                _log(state, f"{nickname} 님이 자리에서 일어났습니다")
            seats[my_seat] = None

        elif a_type == "flip":
            if game != "memory":
                raise HTTPException(status_code=400, detail="이 방의 게임이 아닙니다")
            if state["winner"]:
                raise HTTPException(status_code=409, detail="이미 끝난 게임입니다")
            if not my_seat:
                raise HTTPException(status_code=403, detail="관전 중에는 뒤집을 수 없어요 — 빈 자리에 앉아주세요")
            if not (seats.get("P1") and seats.get("P2")):
                raise HTTPException(status_code=409, detail="상대가 앉을 때까지 기다려주세요")
            if state["turn"] != my_seat:
                raise HTTPException(status_code=409, detail="상대 차례입니다")
            i = act.get("index")
            cards = state["cards"]
            if not (isinstance(i, int) and 0 <= i < len(cards)):
                raise HTTPException(status_code=400, detail="잘못된 카드")
            if state["revealed"][i] or i in state["flip"]:
                raise HTTPException(status_code=409, detail="이미 열린 카드입니다")
            if not state["flip"]:
                state["flip"] = [i]
                state["last_pair"] = None
            else:
                j = state["flip"][0]
                matched = cards[i] == cards[j]
                state["flip"] = []
                state["last_pair"] = [j, i, matched]
                if matched:
                    state["revealed"][i] = True
                    state["revealed"][j] = True
                    state["scores"][my_seat] += 1
                    if all(state["revealed"]):
                        s1, s2 = state["scores"]["P1"], state["scores"]["P2"]
                        state["winner"] = "draw" if s1 == s2 else ("P1" if s1 > s2 else "P2")
                        if state["winner"] == "draw":
                            _log(state, f"게임 종료 — {s1}:{s2} 무승부!")
                        else:
                            _log(state, f"🏆 게임 종료 — {seats[state['winner']]['nickname']} 님 승리 ({max(s1,s2)}:{min(s1,s2)})")
                else:
                    state["turn"] = "P2" if my_seat == "P1" else "P1"

        elif a_type == "place":
            if game != "omok":
                raise HTTPException(status_code=400, detail="이 방의 게임이 아닙니다")
            if state["winner"]:
                raise HTTPException(status_code=409, detail="이미 끝난 대국입니다")
            if not my_seat:
                raise HTTPException(status_code=403, detail="관전 중에는 둘 수 없어요 — 빈 자리에 앉아주세요")
            if not (seats.get("B") and seats.get("W")):
                raise HTTPException(status_code=409, detail="상대가 앉을 때까지 기다려주세요")
            if state["turn"] != my_seat:
                raise HTTPException(status_code=409, detail="상대 차례입니다")
            x, y = act.get("x"), act.get("y")
            if not (isinstance(x, int) and isinstance(y, int) and 0 <= x < BOARD_SIZE and 0 <= y < BOARD_SIZE):
                raise HTTPException(status_code=400, detail="잘못된 좌표")
            idx = y * BOARD_SIZE + x
            board = state["board"]
            if board[idx] != ".":
                raise HTTPException(status_code=409, detail="이미 돌이 있는 자리입니다")
            board = board[:idx] + my_seat + board[idx + 1:]
            state["board"] = board
            state["last_move"] = [x, y]
            state["move_count"] += 1
            if _check_win(board, x, y, my_seat):
                state["winner"] = my_seat
                _log(state, f"🏆 {nickname} 님({'흑' if my_seat == 'B' else '백'}) 오목 완성 — 승리!")
            elif state["move_count"] >= BOARD_SIZE * BOARD_SIZE:
                state["winner"] = "draw"
                _log(state, "무승부 — 판이 가득 찼습니다")
            else:
                state["turn"] = "W" if my_seat == "B" else "B"

        elif a_type == "rematch":
            if not state["winner"]:
                raise HTTPException(status_code=409, detail="대국이 끝난 뒤에 재대결할 수 있어요")
            if not my_seat:
                raise HTTPException(status_code=403, detail="플레이어만 재대결 신청 가능")
            votes = set(state.get("rematch") or [])
            votes.add(my_seat)
            state["rematch"] = sorted(votes)
            _log(state, f"{nickname} 님 재대결 신청 ({len(votes)}/2)")
            if len(votes) >= 2:
                # 자리 교대 재시작
                a, b = seat_keys
                new_a, new_b = seats[b], seats[a]
                if game == "memory":
                    state.update(_new_memory_state("", ""))
                else:
                    state.update(_new_omok_state("", ""))
                state["seats"] = {a: new_a, b: new_b}
                _log(state, "🔄 재대결 시작 — 자리 교대")

        else:
            raise HTTPException(status_code=400, detail="알 수 없는 액션")

        new_version = row["version"] + 1
        conn.execute(
            "UPDATE versus_rooms SET state=?, version=?, updated_at=? WHERE code=?",
            (json.dumps(state, ensure_ascii=False), new_version, time.time(), code),
        )
        conn.commit()
    finally:
        conn.close()
    members = _touch(code, body.client_id, nickname)
    return {"code": code, "version": new_version, "changed": True, "state": state,
            "members": members, "server_now": int(time.time() * 1000)}
