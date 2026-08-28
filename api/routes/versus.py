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


WORDCHAIN_TURN_SECONDS = 45


def _dueum_starts(ch: str) -> set[str]:
    """두음법칙 허용 시작 글자 집합 (ㄹ→ㄴ/ㅇ, ㄴ+ㅣ계열→ㅇ)."""
    out = {ch}
    code = ord(ch) - 0xAC00
    if not (0 <= code < 11172):
        return out
    cho, rest = divmod(code, 588)
    jung = rest // 28
    Y_VOWELS = {6, 2, 12, 17, 20, 7, 3}  # ㅕ,ㅑ,ㅛ,ㅠ,ㅣ,ㅖ,ㅒ (유니코드 중성 인덱스)
    if cho == 5:  # ㄹ
        out.add(chr(0xAC00 + 2 * 588 + rest))  # ㄴ
        if jung in Y_VOWELS:
            out.add(chr(0xAC00 + 11 * 588 + rest))  # ㅇ
    elif cho == 2 and jung in Y_VOWELS:  # ㄴ + ㅣ계열
        out.add(chr(0xAC00 + 11 * 588 + rest))  # ㅇ
    return out


def _maple_word_exists(word: str) -> bool:
    """메랜 사전 모드 — 몹/아이템/맵/NPC 한글명 또는 퀘스트명과 정확 일치."""
    conn = get_connection()
    try:
        r = conn.execute(
            "SELECT 1 FROM entity_names_en WHERE source='kms' AND name_en = ? LIMIT 1", (word,)
        ).fetchone()
        if r:
            return True
        try:
            r = conn.execute("SELECT 1 FROM mapledb_quests WHERE name = ? LIMIT 1", (word,)).fetchone()
            return bool(r)
        except Exception:
            return False
    finally:
        conn.close()


def _new_wordchain_state(host_client: str, host_nick: str, mode: str = "free") -> dict:
    return {
        "game": "wordchain",
        "mode": mode,  # free | maple
        "seats": {"P1": {"client_id": host_client, "nickname": host_nick} if host_client else None, "P2": None},
        "turn": "P1",
        "words": [],          # [{word, by}]
        "winner": None,
        "deadline": None,     # epoch ms — 양쪽 착석 후 턴 제한
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


CARD_COLORS = ("R", "B", "G", "Y")


def _onecard_deck() -> list[str]:
    cards: list[str] = []
    serial = 0
    for color in CARD_COLORS:
        for value in [str(n) for n in range(1, 10)] + ["S", "D2"]:
            for _ in range(2):
                cards.append(f"{color}:{value}:{serial}")
                serial += 1
    for _ in range(4):
        cards.append(f"W:W:{serial}")
        serial += 1
    random.shuffle(cards)
    return cards


def _draw_cards(state: dict, seat: str, count: int) -> None:
    for _ in range(count):
        if not state["deck"]:
            top = state["discard"][-1]
            state["deck"] = state["discard"][:-1]
            random.shuffle(state["deck"])
            state["discard"] = [top]
        if state["deck"]:
            state["hands"][seat].append(state["deck"].pop())


def _new_onecard_state(host_client: str, host_nick: str, first: str = "P1") -> dict:
    deck = _onecard_deck()
    hands = {"P1": [], "P2": []}
    for _ in range(7):
        hands["P1"].append(deck.pop())
        hands["P2"].append(deck.pop())
    first_card = deck.pop()
    while first_card.split(":", 1)[0] == "W":
        deck.insert(0, first_card)
        first_card = deck.pop()
    return {
        "game": "onecard", "turn": first,
        "seats": {"P1": {"client_id": host_client, "nickname": host_nick} if host_client else None, "P2": None},
        "hands": hands, "deck": deck, "discard": [first_card],
        "active_color": first_card.split(":", 1)[0],
        "winner": None, "rematch": [], "log": [],
    }


def _new_yut_state(host_client: str, host_nick: str, first: str = "P1") -> dict:
    return {
        "game": "yut", "turn": first,
        "seats": {"P1": {"client_id": host_client, "nickname": host_nick} if host_client else None, "P2": None},
        "pieces": {"P1": [-1, -1, -1, -1], "P2": [-1, -1, -1, -1]},
        "roll": None, "roll_name": None,
        "winner": None, "rematch": [], "log": [],
    }


def _public_state(state: dict, client_id: Optional[str]) -> dict:
    """원카드의 상대 패와 덱 순서를 숨긴 전송 상태."""
    if state.get("game") != "onecard":
        return state
    public = json.loads(json.dumps(state))
    my_seat = next(
        (seat for seat, member in state["seats"].items() if member and member["client_id"] == client_id),
        None,
    )
    public["my_hand"] = list(state["hands"].get(my_seat, [])) if my_seat else []
    public["hand_counts"] = {seat: len(cards) for seat, cards in state["hands"].items()}
    public.pop("hands", None)
    public["deck_count"] = len(state["deck"])
    public.pop("deck", None)
    return public


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
    mode: str = "free"  # wordchain: free | maple


class RoomAction(BaseModel):
    client_id: str
    nickname: str = "익명"
    action: dict


@router.post("/versus/rooms")
def create_room(body: CreateRoom):
    if body.game not in ("omok", "memory", "wordchain", "onecard", "yut"):
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
        elif body.game == "wordchain":
            mode = "maple" if body.mode == "maple" else "free"
            state = _new_wordchain_state(body.client_id, nick, mode)
            _log(state, f"{nick} 님이 끝말잇기 방을 만들었습니다 ({'메랜 사전' if mode == 'maple' else '자유'} 모드)")
        elif body.game == "onecard":
            state = _new_onecard_state(body.client_id, nick)
            _log(state, f"{nick} 님이 메랜 원카드 방을 만들었습니다 (P1)")
        elif body.game == "yut":
            state = _new_yut_state(body.client_id, nick)
            _log(state, f"{nick} 님이 메랜 윷놀이 방을 만들었습니다 (P1)")
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
    return {"code": code, "version": 1, "state": _public_state(state, body.client_id), "members": members, "server_now": int(time.time() * 1000)}


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
            "state": _public_state(json.loads(row["state"]), client_id) if changed else None,
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
            if game == "wordchain" and seats.get("P1") and seats.get("P2") and not state["winner"]:
                state["deadline"] = int(time.time() * 1000) + WORDCHAIN_TURN_SECONDS * 1000
                _log(state, f"⏱️ 시작! {seats[state['turn']]['nickname']} 님부터 — 턴당 {WORDCHAIN_TURN_SECONDS}초")

        elif a_type == "stand":
            if not my_seat:
                raise HTTPException(status_code=400, detail="착석 중이 아닙니다")
            if game == "omok":
                started = state.get("move_count", 0) > 0
            elif game == "wordchain":
                started = len(state.get("words") or []) > 0
            elif game == "onecard":
                started = len(state.get("discard") or []) > 1 or any(len(cards) != 7 for cards in state.get("hands", {}).values())
            elif game == "yut":
                started = state.get("roll") is not None or any(pos >= 0 for pieces in state.get("pieces", {}).values() for pos in pieces)
            else:
                started = bool(state.get("flip")) or any(state.get("revealed") or []) or sum((state.get("scores") or {}).values()) > 0
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

        elif a_type == "word":
            if game != "wordchain":
                raise HTTPException(status_code=400, detail="이 방의 게임이 아닙니다")
            if state["winner"]:
                raise HTTPException(status_code=409, detail="이미 끝난 게임입니다")
            if not my_seat:
                raise HTTPException(status_code=403, detail="관전 중에는 참여할 수 없어요 — 빈 자리에 앉아주세요")
            if not (seats.get("P1") and seats.get("P2")):
                raise HTTPException(status_code=409, detail="상대가 앉을 때까지 기다려주세요")
            if state["turn"] != my_seat:
                raise HTTPException(status_code=409, detail="상대 차례입니다")
            now_ms = int(time.time() * 1000)
            if state.get("deadline") and now_ms > state["deadline"]:
                other = "P2" if my_seat == "P1" else "P1"
                state["winner"] = other
                _log(state, f"⏱️ {nickname} 님 시간 초과 — {seats[other]['nickname']} 님 승리!")
            else:
                word = str(act.get("word") or "").strip()
                if len(word) < 2:
                    raise HTTPException(status_code=400, detail="두 글자 이상이어야 해요")
                used = {w["word"] for w in state["words"]}
                if word in used:
                    raise HTTPException(status_code=409, detail="이미 나온 단어예요")
                if state["words"]:
                    last = state["words"][-1]["word"].replace(" ", "")
                    allowed = _dueum_starts(last[-1])
                    if word.replace(" ", "")[0] not in allowed:
                        raise HTTPException(status_code=400, detail=f"'{'/'.join(sorted(allowed))}' 로 시작해야 해요")
                if state["mode"] == "maple" and not _maple_word_exists(word):
                    raise HTTPException(status_code=400, detail="메랜 사전에 없는 이름이에요 (몹·아이템·맵·NPC·퀘스트 정확한 이름만)")
                state["words"].append({"word": word, "by": nickname})
                state["turn"] = "P2" if my_seat == "P1" else "P1"
                state["deadline"] = now_ms + WORDCHAIN_TURN_SECONDS * 1000

        elif a_type == "timeout_claim":
            if game != "wordchain":
                raise HTTPException(status_code=400, detail="이 방의 게임이 아닙니다")
            if state["winner"] or not state.get("deadline"):
                raise HTTPException(status_code=409, detail="진행 중이 아닙니다")
            if int(time.time() * 1000) <= state["deadline"]:
                raise HTTPException(status_code=409, detail="아직 시간이 남았어요")
            loser = state["turn"]
            other = "P2" if loser == "P1" else "P1"
            state["winner"] = other
            _log(state, f"⏱️ {seats[loser]['nickname'] if seats.get(loser) else loser} 님 시간 초과 — {seats[other]['nickname']} 님 승리!")

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

        elif a_type == "onecard_play":
            if game != "onecard":
                raise HTTPException(status_code=400, detail="이 방의 게임이 아닙니다")
            if state["winner"]:
                raise HTTPException(status_code=409, detail="이미 끝난 게임입니다")
            if not my_seat or not (seats.get("P1") and seats.get("P2")):
                raise HTTPException(status_code=403, detail="양쪽 플레이어가 앉아야 합니다")
            if state["turn"] != my_seat:
                raise HTTPException(status_code=409, detail="상대 차례입니다")
            card_id = str(act.get("card_id") or "")
            if card_id not in state["hands"][my_seat]:
                raise HTTPException(status_code=400, detail="내 손에 없는 카드입니다")
            color, value, _ = card_id.split(":", 2)
            top_color, top_value, _ = state["discard"][-1].split(":", 2)
            if color != "W" and color != state["active_color"] and value != top_value:
                raise HTTPException(status_code=409, detail="같은 색이나 같은 숫자 카드만 낼 수 있어요")
            state["hands"][my_seat].remove(card_id)
            state["discard"].append(card_id)
            chosen_color = str(act.get("color") or "")
            state["active_color"] = chosen_color if color == "W" and chosen_color in CARD_COLORS else color
            other = "P2" if my_seat == "P1" else "P1"
            if not state["hands"][my_seat]:
                state["winner"] = my_seat
                _log(state, f"🏆 {nickname} 님이 마지막 카드를 내고 승리!")
            elif value == "D2":
                _draw_cards(state, other, 2)
                _log(state, f"{nickname}: +2 공격 — {seats[other]['nickname']} 님 2장 드로우")
                state["turn"] = my_seat
            elif value == "S":
                _log(state, f"{nickname}: 상대 턴 건너뛰기")
                state["turn"] = my_seat
            else:
                state["turn"] = other

        elif a_type == "onecard_draw":
            if game != "onecard" or state["winner"]:
                raise HTTPException(status_code=409, detail="진행 중인 원카드 게임이 아닙니다")
            if not my_seat or state["turn"] != my_seat:
                raise HTTPException(status_code=409, detail="내 차례가 아닙니다")
            _draw_cards(state, my_seat, 1)
            state["turn"] = "P2" if my_seat == "P1" else "P1"
            _log(state, f"{nickname}: 카드 1장 드로우")

        elif a_type == "yut_roll":
            if game != "yut" or state["winner"]:
                raise HTTPException(status_code=409, detail="진행 중인 윷놀이가 아닙니다")
            if not my_seat or not (seats.get("P1") and seats.get("P2")) or state["turn"] != my_seat:
                raise HTTPException(status_code=409, detail="내 차례가 아닙니다")
            if state.get("roll") is not None:
                raise HTTPException(status_code=409, detail="움직일 말을 먼저 골라주세요")
            sticks = [random.choice((0, 1)) for _ in range(4)]
            fronts = sum(sticks)
            moves = {0: 5, 1: 1, 2: 2, 3: 3, 4: 4}[fronts]
            names = {1: "도", 2: "개", 3: "걸", 4: "윷", 5: "모"}
            state["roll"] = moves
            state["roll_name"] = names[moves]
            _log(state, f"{nickname}: {names[moves]}! ({moves}칸)")

        elif a_type == "yut_move":
            if game != "yut" or state["winner"]:
                raise HTTPException(status_code=409, detail="진행 중인 윷놀이가 아닙니다")
            if not my_seat or state["turn"] != my_seat or state.get("roll") is None:
                raise HTTPException(status_code=409, detail="먼저 윷을 던져주세요")
            piece = act.get("piece")
            if not isinstance(piece, int) or not 0 <= piece < 4 or state["pieces"][my_seat][piece] >= 20:
                raise HTTPException(status_code=400, detail="움직일 수 없는 말입니다")
            current = state["pieces"][my_seat][piece]
            target = min(20, max(0, current + int(state["roll"])))
            state["pieces"][my_seat][piece] = target
            other = "P2" if my_seat == "P1" else "P1"
            if target < 20:
                captured = [i for i, pos in enumerate(state["pieces"][other]) if pos == target]
                for i in captured:
                    state["pieces"][other][i] = -1
                if captured:
                    _log(state, f"{nickname}: 상대 말 {len(captured)}개 잡기!")
            bonus = state["roll"] in (4, 5)
            state["roll"] = None
            state["roll_name"] = None
            if all(pos >= 20 for pos in state["pieces"][my_seat]):
                state["winner"] = my_seat
                _log(state, f"🏆 {nickname} 님이 모든 말을 완주했습니다!")
            elif not bonus:
                state["turn"] = other

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
                elif game == "wordchain":
                    state.update(_new_wordchain_state("", "", state.get("mode", "free")))
                elif game == "onecard":
                    state.update(_new_onecard_state("", ""))
                elif game == "yut":
                    state.update(_new_yut_state("", ""))
                else:
                    state.update(_new_omok_state("", ""))
                state["seats"] = {a: new_a, b: new_b}
                if game == "wordchain":
                    state["deadline"] = int(time.time() * 1000) + WORDCHAIN_TURN_SECONDS * 1000
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
    return {"code": code, "version": new_version, "changed": True, "state": _public_state(state, body.client_id),
            "members": members, "server_now": int(time.time() * 1000)}
