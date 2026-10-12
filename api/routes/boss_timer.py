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
    # 원정대 관리 보드(v4.11) — 기존 섹션 state와 분리된 컬럼이라 구버전 클라이언트와 호환
    cols = [row[1] for row in conn.execute("PRAGMA table_info(boss_timer_rooms)")]
    if "expedition" not in cols:
        conn.execute("ALTER TABLE boss_timer_rooms ADD COLUMN expedition TEXT NOT NULL DEFAULT 'null'")
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
        "SELECT state, log, version, expedition FROM boss_timer_rooms WHERE code = ?", (code.upper(),)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="방을 찾을 수 없습니다 (만료되었거나 잘못된 코드)")
    try:
        expedition = json.loads(row[3]) if row[3] else None
    except (TypeError, ValueError):
        expedition = None
    return json.loads(row[0]), json.loads(row[1]), row[2], expedition


def _default_expedition() -> dict:
    return {"startedAt": None, "parties": []}


def _normalize_expedition(raw: Any) -> dict:
    """클라이언트가 보낸 원정대 상태 방어적 정규화 — 멤버 타이머는 시계 기준이 달라 리셋."""
    exp = _default_expedition()
    if not isinstance(raw, dict):
        return exp
    parties = raw.get("parties")
    if not isinstance(parties, list):
        return exp
    for i, party in enumerate(parties[:EXP_MAX_PARTIES]):
        if not isinstance(party, dict):
            continue
        members = []
        for j, member in enumerate((party.get("members") or [])[:EXP_MAX_MEMBERS]):
            if not isinstance(member, dict):
                continue
            members.append({
                "id": str(member.get("id") or f"m{secrets.token_hex(3)}"),
                "name": str(member.get("name") or f"파티원 {j + 1}")[:12],
                "job": str(member.get("job") or "비숍")[:10],
                "deathEndAt": None,
                "skillEndAt": None,
            })
        exp["parties"].append({"id": str(party.get("id") or f"p{secrets.token_hex(3)}"), "members": members})
    return exp


EXP_MAX_PARTIES = 6
EXP_MAX_MEMBERS = 6
EXP_TIMER_MIN = 10          # 초 — 멤버 타이머 최소/최대 (클라이언트 값 방어)
EXP_TIMER_MAX = 2 * 3600


class CreateRoomPayload(BaseModel):
    state: Any  # 프론트 섹션 구조 그대로 보관
    expedition: Any = None  # 원정대 관리 보드 (없으면 null)
    nickname: str = "익명"
    client_id: Optional[str] = None


class ActionPayload(BaseModel):
    client_id: Optional[str] = None
    nickname: str = "익명"
    type: str  # start | stop | edit | add | remove | repeat | exp_*
    section_id: Optional[str] = None  # 타이머 액션용 (exp_* 액션에선 생략)
    timer_id: Optional[str] = None
    label: Optional[str] = None
    duration: Optional[int] = None  # 초
    # 원정대 관리(exp_*) 액션용
    party_id: Optional[str] = None
    member_id: Optional[str] = None
    job: Optional[str] = None
    kind: Optional[str] = None  # death | skill
    op: Optional[str] = None  # start | stop


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
        expedition = _normalize_expedition(payload.expedition)
        log = [{"at": _now_ms(), "text": f"{payload.nickname}님이 방을 만들었습니다"}]
        conn.execute(
            "INSERT INTO boss_timer_rooms (code, state, log, version, created_at, updated_at, expedition) VALUES (?,?,?,1,?,?,?)",
            (code, json.dumps(state, ensure_ascii=False), json.dumps(log, ensure_ascii=False), now, now,
             json.dumps(expedition, ensure_ascii=False)),
        )
        conn.commit()
        members = _touch_presence(code, payload.client_id, payload.nickname)
        return {"code": code, "version": 1, "state": state, "expedition": expedition, "log": log, "server_now": _now_ms(), "members": members}
    finally:
        conn.close()


@router.get("/boss-timer/rooms/{code}")
def poll_room(code: str, since: int = 0, client_id: Optional[str] = None, nickname: str = "익명"):
    conn = _conn()
    try:
        state, log, version, expedition = _load_room(conn, code)
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
        "expedition": expedition,
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
        state, log, version, expedition = _load_room(conn, code)

        nick = (payload.nickname or "익명").strip()[:12] or "익명"
        log_text: Optional[str] = None

        if payload.type.startswith("exp_"):
            expedition, log_text = _apply_expedition_action(expedition, payload, nick)
            if log_text:
                log.append({"at": _now_ms(), "text": log_text})
                log = log[-LOG_LIMIT:]
            version += 1
            conn.execute(
                "UPDATE boss_timer_rooms SET expedition = ?, log = ?, version = ?, updated_at = ? WHERE code = ?",
                (json.dumps(expedition, ensure_ascii=False), json.dumps(log, ensure_ascii=False), version, time.time(), code),
            )
            conn.commit()
            members = _touch_presence(code, payload.client_id, nick)
            return {"changed": True, "version": version, "state": state, "expedition": expedition,
                    "log": log, "server_now": _now_ms(), "members": members}

        section = next((s for s in state if s.get("id") == payload.section_id), None)
        if section is None:
            raise HTTPException(status_code=400, detail="알 수 없는 섹션")
        timers = section.setdefault("timers", [])
        timer = next((t for t in timers if t.get("id") == payload.timer_id), None)

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
    return {"changed": True, "version": version, "state": state, "expedition": expedition,
            "log": log, "server_now": _now_ms(), "members": members}


def _apply_expedition_action(expedition: Any, payload: ActionPayload, nick: str) -> tuple[dict, Optional[str]]:
    """원정대 관리 액션 처리 — 구 방(expedition=null)에서도 첫 액션에서 기본 구조를 만든다."""
    exp = expedition if isinstance(expedition, dict) else _default_expedition()
    exp.setdefault("startedAt", None)
    parties = exp.setdefault("parties", [])

    def find_party():
        party = next((p for p in parties if p.get("id") == payload.party_id), None)
        if party is None:
            raise HTTPException(status_code=400, detail="알 수 없는 파티")
        return party

    def find_member(party):
        member = next((m for m in party.get("members", []) if m.get("id") == payload.member_id), None)
        if member is None:
            raise HTTPException(status_code=400, detail="알 수 없는 파티원")
        return member

    if payload.type == "exp_raid":
        if payload.op == "start":
            exp["startedAt"] = _now_ms()
            return exp, f"{nick}: 레이드 입장 — 경과 기록 시작"
        exp["startedAt"] = None
        return exp, f"{nick}: 레이드 경과 초기화"

    if payload.type == "exp_preset":
        # 기본 3파티 편성 — 파티마다 닼나(다크나이트)+비숍+격수 4인 (프론트 defaultExpParties와 동일 구성)
        exp["parties"] = [
            {
                "id": f"p{secrets.token_hex(3)}",
                "members": (
                    [
                        {"id": f"m{secrets.token_hex(3)}", "name": "닼나", "job": "다크나이트", "deathEndAt": None, "skillEndAt": None},
                        {"id": f"m{secrets.token_hex(3)}", "name": "비숍", "job": "비숍", "deathEndAt": None, "skillEndAt": None},
                    ]
                    + [
                        {"id": f"m{secrets.token_hex(3)}", "name": f"격수 {n}", "job": "기타", "deathEndAt": None, "skillEndAt": None}
                        for n in range(1, 5)
                    ]
                ),
            }
            for _ in range(3)
        ]
        return exp, f"{nick}: 기본 3파티 편성 생성"

    if payload.type == "exp_party_add":
        if len(parties) >= EXP_MAX_PARTIES:
            raise HTTPException(status_code=400, detail=f"파티는 최대 {EXP_MAX_PARTIES}개입니다")
        parties.append({"id": f"p{secrets.token_hex(3)}", "members": []})
        return exp, f"{nick}: {len(parties)}파티 추가"

    if payload.type == "exp_party_remove":
        before = len(parties)
        exp["parties"] = [p for p in parties if p.get("id") != payload.party_id]
        if len(exp["parties"]) == before:
            raise HTTPException(status_code=400, detail="알 수 없는 파티")
        return exp, f"{nick}: 파티 삭제"

    if payload.type == "exp_member_add":
        party = find_party()
        members = party.setdefault("members", [])
        if len(members) >= EXP_MAX_MEMBERS:
            raise HTTPException(status_code=400, detail=f"파티원은 최대 {EXP_MAX_MEMBERS}명입니다")
        name = (payload.label or f"파티원 {len(members) + 1}").strip()[:12]
        members.append({
            "id": f"m{secrets.token_hex(3)}",
            "name": name,
            "job": (payload.job or "비숍").strip()[:10],
            "deathEndAt": None,
            "skillEndAt": None,
        })
        return exp, f"{nick}: {name} 합류"

    if payload.type == "exp_member_edit":
        member = find_member(find_party())
        if payload.label is not None and payload.label.strip():
            member["name"] = payload.label.strip()[:12]
        if payload.job is not None and payload.job.strip():
            member["job"] = payload.job.strip()[:10]
            member["skillEndAt"] = None  # 직업 변경 시 이전 스킬 쿨 리셋
        return exp, f"{nick}: {member['name']} 정보 수정"

    if payload.type == "exp_member_remove":
        party = find_party()
        member = find_member(party)
        party["members"] = [m for m in party.get("members", []) if m.get("id") != payload.member_id]
        return exp, f"{nick}: {member.get('name', '파티원')} 제외"

    if payload.type == "exp_member_timer":
        member = find_member(find_party())
        key = "deathEndAt" if payload.kind == "death" else "skillEndAt" if payload.kind == "skill" else None
        if key is None:
            raise HTTPException(status_code=400, detail="알 수 없는 타이머 종류")
        if payload.op == "start":
            duration = min(EXP_TIMER_MAX, max(EXP_TIMER_MIN, int(payload.duration or 0)))
            member[key] = _now_ms() + duration * 1000
            what = "사망" if payload.kind == "death" else "스킬 쿨"
            return exp, f"{nick}: {member.get('name', '파티원')} {what} 시작"
        member[key] = None
        return exp, f"{nick}: {member.get('name', '파티원')} 타이머 리셋"

    raise HTTPException(status_code=400, detail="알 수 없는 동작")
