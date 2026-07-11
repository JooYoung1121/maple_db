"""카카오톡 오픈채팅 봇 브릿지 API.

구조: 상시 구동 안드로이드 기기(메신저봇R)가 이 API를 호출하는 브릿지 방식.
- POST /kakao-bot/chat   : 방 메시지(!명령, 푸확아 ~) 처리 → 응답 텍스트 반환
- GET  /kakao-bot/outbox : 공홈 새 글 알림 큐 폴링 (기기가 방에 대신 전송)
- POST /kakao-bot/outbox/ack : 전송 완료 처리
- 룰/테스트 관리는 X-Admin-Password, 기기 인증은 X-Kakao-Bot-Token

환경변수:
- KAKAO_BOT_TOKEN  : 기기↔서버 인증 토큰 (미설정 시 봇 API 전체 비활성 — 안전 기본값)
- GEMINI_API_KEY   : !질문 자유 대화용 무료 LLM (미설정 시 질문 기능만 비활성)
- GEMINI_MODEL     : 기본 gemini-2.5-flash (404 시 gemini-2.0-flash 폴백)
- PUBLIC_SITE_URL  : 링크 생성 기준 (기본 memorymapledb.up.railway.app)
"""
import os
import time
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from crawler.db import get_connection

router = APIRouter()

HELP_TEXT = """[추억길드 봇 명령어]
!공지 — 최근 공홈 소식 3건
!이벤트 — 진행 중 이벤트 정리
!몹 <이름> — 몬스터 정보 + 링크
!아이템 <이름> — 아이템 검색 링크
!맵 <이름> — 맵 검색 링크
!스킬 [직업/스킬명] — 스킬 시뮬레이터
!주간 — 최신 주간 메랜
!놀이터 [핀볼/로또/운세/퀴즈…] — 놀이터 링크
!오늘의몬스터 — 데일리 추리 게임
!질문 <내용> 또는 푸확아 <내용> — 자유 질문"""

# 놀이터 하위 메뉴 매핑
PLAYGROUND = {
    "핀볼": ("/play", "핀볼 (놀이터)"),
    "룰렛": ("/play", "룰렛 (놀이터)"),
    "주사위": ("/play", "주사위 (놀이터)"),
    "사다리": ("/play", "사다리 타기 (놀이터)"),
    "로또": ("/lotto", "로또"),
    "운세": ("/fortune", "오늘의 운세"),
    "퀴즈": ("/quiz", "메이플 퀴즈 (실루엣 모드 포함)"),
    "실루엣": ("/quiz", "실루엣 퀴즈"),
    "오늘의몬스터": ("/daily-mob", "오늘의 몬스터"),
}

# 자유 질문에서 LLM 이전에 확인하는 기본 링크 룰 (빈 테이블일 때 시드)
DEFAULT_RULES = [
    ("시세,가격,경매,메소", "시세·거래 정보는 여기서 확인하세요", "/market", 10),
    ("몬스터파크,몬파", "몬스터파크 정리본이 있어요 (맵별 경험치 표)", "/events/monster-park-2026", 20),
    ("이벤트", "진행 중 이벤트 정리 페이지예요", "/events", 30),
    ("주문서,강화,스크롤", "주문서 강화 계산기를 써보세요", "/scroll", 40),
    ("사냥터,레벨업,육성", "레벨별 사냥터 추천이 있어요", "/hunt", 50),
    ("파퀘,파티퀘스트", "파티퀘스트 공략은 여기요", "/pq", 60),
    ("배,배시간,배시간표", "배 시간표 페이지예요", "/ship", 70),
    ("스트리머,유튜버,방송", "메랜 스트리머·유튜버 모음이에요", "/channels", 80),
    ("주간,신문", "주간 메랜 최신호를 보세요", "/weekly", 90),
    ("전직,직업추천", "전직 가이드가 있어요", "/job", 100),
    ("수수료", "수수료 계산기를 써보세요", "/fee", 110),
]


def _site() -> str:
    return os.environ.get("PUBLIC_SITE_URL", "https://memorymapledb.up.railway.app").rstrip("/")


def _require_bot(request: Request):
    token = os.environ.get("KAKAO_BOT_TOKEN", "")
    if not token:
        raise HTTPException(status_code=503, detail="KAKAO_BOT_TOKEN이 설정되지 않았습니다")
    if request.headers.get("X-Kakao-Bot-Token", "") != token:
        raise HTTPException(status_code=403, detail="봇 토큰이 올바르지 않습니다")


def _require_admin(request: Request):
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    if request.headers.get("X-Admin-Password", "") != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀립니다.")


def ensure_tables(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS kakao_outbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            sent_at TEXT
        );
        CREATE TABLE IF NOT EXISTS kakao_link_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keywords TEXT NOT NULL,
            reply TEXT NOT NULL,
            path TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1
        );
    """)
    if conn.execute("SELECT COUNT(*) FROM kakao_link_rules").fetchone()[0] == 0:
        conn.executemany(
            "INSERT INTO kakao_link_rules (keywords, reply, path, sort_order) VALUES (?,?,?,?)",
            DEFAULT_RULES,
        )
    conn.commit()


def queue_outbox(conn, message: str):
    """공지 크롤 잡 등에서 호출 — 카카오방으로 나갈 알림 적재."""
    ensure_tables(conn)
    conn.execute("INSERT INTO kakao_outbox (message) VALUES (?)", (message,))
    conn.commit()


# ── 레이트리밋 (인메모리 — 재시작 시 초기화 허용) ──────
_sender_last: dict[str, float] = {}
_room_daily: dict[str, tuple[str, int]] = {}  # room -> (날짜, LLM 호출 수)
SENDER_COOLDOWN = 15  # 초
ROOM_DAILY_LLM_LIMIT = 150


def _llm_allowed(room: str, sender: str) -> Optional[str]:
    now = time.time()
    if now - _sender_last.get(sender, 0) < SENDER_COOLDOWN:
        return f"질문은 {SENDER_COOLDOWN}초에 한 번만 가능해요. 잠시 후 다시 물어봐주세요!"
    day = time.strftime("%Y-%m-%d")
    d, count = _room_daily.get(room, (day, 0))
    if d != day:
        count = 0
    if count >= ROOM_DAILY_LLM_LIMIT:
        return "오늘 질문 한도를 다 썼어요. 내일 다시 물어봐주세요!"
    _sender_last[sender] = now
    _room_daily[room] = (day, count + 1)
    return None


# ── 무료 LLM (Gemini) ─────────────────────────────────
SYSTEM_PROMPT = (
    "너는 메이플랜드(옛날 메이플스토리 복각 서버) 길드 '추억길드'의 오픈채팅방 봇 '푸확'이야. "
    "짧고 친근하게 한국어로 답해. 답변은 최대 3문장. "
    "확실하지 않은 내용은 지어내지 말고 모른다고 말해. "
    "실시간 정보(오늘 날씨, 현재 시세 등)는 알 수 없다고 안내해. "
    "게임 정보 질문이면 아는 만큼 답하되, 사이트(추억길드 공홈)에 관련 기능이 있으면 언급해도 좋아."
)


async def _ask_gemini(question: str) -> Optional[str]:
    # 기존 운세(fortune.py)와 동일한 키 우선순위 — 라이브에 이미 설정된 키 재사용
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
    if not key:
        return None
    models = [os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"), "gemini-2.0-flash"]
    async with httpx.AsyncClient(timeout=20) as client:
        for model in dict.fromkeys(models):
            body = {
                "contents": [{"parts": [{"text": question}]}],
                "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                "generationConfig": {"maxOutputTokens": 1024, "temperature": 0.7},
            }
            if "2.5" in model:
                body["generationConfig"]["thinkingConfig"] = {"thinkingBudget": 0}
            try:
                r = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    params={"key": key},
                    json=body,
                )
                if r.status_code == 404:
                    continue
                if r.status_code != 200:
                    print(f"[kakao-bot] Gemini {model} 오류 {r.status_code}: {r.text[:200]}")
                    continue
                data = r.json()
                parts = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts).strip()
                if text:
                    return text
            except Exception as e:
                print(f"[kakao-bot] Gemini 호출 실패 ({model}): {e}")
    return None


# ── 명령 핸들러 ───────────────────────────────────────
def _match_rule(conn, q: str) -> Optional[str]:
    ensure_tables(conn)
    q_norm = q.replace(" ", "")
    rows = conn.execute(
        "SELECT keywords, reply, path FROM kakao_link_rules WHERE is_active=1 ORDER BY sort_order, id"
    ).fetchall()
    for r in rows:
        for kw in (r["keywords"] or "").split(","):
            kw = kw.strip()
            if kw and kw in q_norm:
                return f"{r['reply']}\n{_site()}{r['path']}"
    return None


def _cmd_notice(conn) -> str:
    rows = conn.execute(
        "SELECT post_id, title FROM maple_land_posts ORDER BY COALESCE(published_at, created_at) DESC LIMIT 3"
    ).fetchall()
    if not rows:
        return f"아직 수집된 공지가 없어요.\n{_site()}/news"
    lines = ["📢 최근 공홈 소식"]
    for r in rows:
        lines.append(f"· {r['title']}\n  {_site()}/news?post={r['post_id']}")
    return "\n".join(lines)


def _cmd_event(conn) -> str:
    try:
        rows = conn.execute(
            "SELECT slug, title FROM event_guides WHERE status='active' ORDER BY period_start DESC LIMIT 5"
        ).fetchall()
    except Exception:
        rows = []
    if not rows:
        return f"지금 정리된 진행 중 이벤트가 없어요.\n{_site()}/events"
    lines = ["🗂️ 진행 중 이벤트 정리"]
    for r in rows:
        lines.append(f"· {r['title']}\n  {_site()}/events/{r['slug']}")
    return "\n".join(lines)


def _cmd_weekly(conn) -> str:
    try:
        row = conn.execute(
            "SELECT issue_no, title FROM weekly_news_issues WHERE status='published' ORDER BY issue_no DESC LIMIT 1"
        ).fetchone()
    except Exception:
        row = None
    if not row:
        return f"아직 발행된 주간 메랜이 없어요.\n{_site()}/weekly"
    return f"📰 주간 메랜 {row['issue_no']}호\n{row['title']}\n{_site()}/weekly/{row['issue_no']}"


def _search_entity(conn, entity: str, table: str, name: str):
    """kms 한글명 LIKE 검색 → (id, 한글명) 최상위 1건."""
    return conn.execute(
        f"""SELECT e.entity_id AS id, e.name_en AS name_kr
            FROM entity_names_en e JOIN {table} t ON t.id = e.entity_id
            WHERE e.entity_type=? AND e.source='kms' AND e.name_en LIKE ?
              AND COALESCE(t.is_hidden, 0) = 0
            ORDER BY LENGTH(e.name_en) ASC LIMIT 1""",
        (entity, f"%{name}%"),
    ).fetchone()


def _cmd_mob(conn, arg: str) -> str:
    if not arg:
        return f"사용법: !몹 <이름>  (예: !몹 발록)\n{_site()}/mobs"
    row = _search_entity(conn, "mob", "mobs", arg)
    if not row:
        return f"'{arg}' 몬스터를 못 찾았어요. 사이트에서 검색해보세요.\n{_site()}/mobs?q={arg}"
    mob = conn.execute(
        "SELECT level, hp, exp, is_boss FROM mobs WHERE id=?", (row["id"],)
    ).fetchone()
    boss = " (보스)" if mob and mob["is_boss"] else ""
    stats = f"Lv.{mob['level']} · HP {mob['hp']:,} · EXP {mob['exp']:,}" if mob else ""
    return f"👾 {row['name_kr']}{boss}\n{stats}\n{_site()}/mobs/{row['id']}"


def _cmd_item(conn, arg: str) -> str:
    if not arg:
        return f"사용법: !아이템 <이름>  (예: !아이템 노가다 목장갑)\n{_site()}/items"
    row = _search_entity(conn, "item", "items", arg)
    if not row:
        return f"'{arg}' 아이템을 못 찾았어요. 사이트에서 검색해보세요.\n{_site()}/items?q={arg}"
    return f"🗡️ {row['name_kr']}\n{_site()}/items/{row['id']}"


def _cmd_map(conn, arg: str) -> str:
    if not arg:
        return f"사용법: !맵 <이름>  (예: !맵 와토보물섬)\n{_site()}/maps"
    row = conn.execute(
        """SELECT e.entity_id AS id, e.name_en AS name_kr
           FROM entity_names_en e WHERE e.entity_type='map' AND e.source='kms'
             AND e.name_en LIKE ? ORDER BY LENGTH(e.name_en) ASC LIMIT 1""",
        (f"%{arg}%",),
    ).fetchone()
    if not row:
        return f"'{arg}' 맵을 못 찾았어요. 사이트에서 검색해보세요.\n{_site()}/maps?q={arg}"
    return f"🗺️ {row['name_kr']}\n{_site()}/maps/{row['id']}"


def _cmd_skill(arg: str) -> str:
    base = f"✨ 스킬 시뮬레이터에서 직접 빌드를 짜볼 수 있어요.\n{_site()}/skill-sim"
    if arg:
        return f"{base}\n'{arg}' 스킬 정보 검색: {_site()}/skills?q={arg}"
    return base


def _cmd_playground(arg: str) -> str:
    if arg:
        key = arg.replace(" ", "")
        for name, (path, label) in PLAYGROUND.items():
            if name in key or key in name:
                return f"🎮 {label}\n{_site()}{path}"
    lines = ["🎮 추억길드 놀이터"]
    seen = set()
    for path, label in PLAYGROUND.values():
        if path not in seen:
            seen.add(path)
            lines.append(f"· {label}: {_site()}{path}")
    return "\n".join(lines)


async def _handle_question(conn, room: str, sender: str, q: str) -> str:
    if not q:
        return "질문 내용을 같이 적어주세요! (예: !질문 메이플랜드 언제 나왔어?)"
    # 1) 룰 매칭 — 사이트에 연결된 정보면 링크로 즉시 응답 (AI 미사용)
    matched = _match_rule(conn, q)
    if matched:
        return matched
    # 2) 무료 LLM
    limited = _llm_allowed(room, sender)
    if limited:
        return limited
    answer = await _ask_gemini(q)
    if answer:
        return answer
    return "지금은 답변을 만들 수 없어요. 잠시 후 다시 시도해주세요!"


# ── 엔드포인트 ────────────────────────────────────────
class ChatPayload(BaseModel):
    room: str
    sender: str
    text: str


@router.post("/kakao-bot/chat")
async def kakao_chat(payload: ChatPayload, request: Request):
    _require_bot(request)
    text = payload.text.strip()
    conn = get_connection()
    try:
        ensure_tables(conn)
        # 호출어: "푸확아 ~" → 자유 질문
        for wake in ("푸확아", "푸확"):
            if text.startswith(wake):
                q = text[len(wake):].strip(" ,~?!")
                return {"reply": await _handle_question(conn, payload.room, payload.sender, q)}
        if not text.startswith("!"):
            return {"reply": None}
        parts = text[1:].split(maxsplit=1)
        if not parts:
            return {"reply": None}
        cmd = parts[0].strip()
        arg = parts[1].strip() if len(parts) > 1 else ""

        if cmd in ("도움말", "help", "명령어", "메뉴"):
            return {"reply": HELP_TEXT}
        if cmd in ("공지", "소식", "뉴스"):
            return {"reply": _cmd_notice(conn)}
        if cmd in ("이벤트", "몬스터파크"):
            return {"reply": _cmd_event(conn)}
        if cmd in ("주간", "주간메랜", "신문"):
            return {"reply": _cmd_weekly(conn)}
        if cmd in ("몹", "몬스터"):
            return {"reply": _cmd_mob(conn, arg)}
        if cmd in ("아이템", "템"):
            return {"reply": _cmd_item(conn, arg)}
        if cmd == "맵":
            return {"reply": _cmd_map(conn, arg)}
        if cmd in ("스킬", "스킬트리", "시뮬"):
            return {"reply": _cmd_skill(arg)}
        if cmd in ("놀이터", "게임"):
            return {"reply": _cmd_playground(arg)}
        if cmd in ("오늘의몬스터", "데일리"):
            return {"reply": f"👾 오늘의 몬스터 — 매일 자정 새 퍼즐!\n{_site()}/daily-mob"}
        if cmd == "질문":
            return {"reply": await _handle_question(conn, payload.room, payload.sender, arg)}
        # 알 수 없는 명령: 룰 매칭이라도 시도 후 도움말 안내
        matched = _match_rule(conn, f"{cmd} {arg}")
        if matched:
            return {"reply": matched}
        return {"reply": f"모르는 명령어예요. '!도움말'을 입력해보세요!"}
    finally:
        conn.close()


@router.get("/kakao-bot/outbox")
def kakao_outbox(request: Request):
    _require_bot(request)
    conn = get_connection()
    try:
        ensure_tables(conn)
        rows = conn.execute(
            "SELECT id, message FROM kakao_outbox WHERE sent_at IS NULL ORDER BY id LIMIT 5"
        ).fetchall()
        return {"messages": [dict(r) for r in rows]}
    finally:
        conn.close()


class AckPayload(BaseModel):
    ids: list[int]


@router.post("/kakao-bot/outbox/ack")
def kakao_outbox_ack(payload: AckPayload, request: Request):
    _require_bot(request)
    if not payload.ids:
        return {"ok": True, "acked": 0}
    conn = get_connection()
    try:
        ensure_tables(conn)
        placeholders = ",".join("?" for _ in payload.ids)
        cur = conn.execute(
            f"UPDATE kakao_outbox SET sent_at=datetime('now','localtime') WHERE id IN ({placeholders})",
            payload.ids,
        )
        conn.commit()
        return {"ok": True, "acked": cur.rowcount}
    finally:
        conn.close()


# ── 관리자 ────────────────────────────────────────────
class RulePayload(BaseModel):
    keywords: str
    reply: str
    path: str
    sort_order: int = 0
    is_active: int = 1


@router.get("/kakao-bot/rules")
def list_rules(request: Request):
    _require_admin(request)
    conn = get_connection()
    try:
        ensure_tables(conn)
        rows = conn.execute("SELECT * FROM kakao_link_rules ORDER BY sort_order, id").fetchall()
        return {"rules": [dict(r) for r in rows]}
    finally:
        conn.close()


@router.post("/kakao-bot/rules")
def create_rule(payload: RulePayload, request: Request):
    _require_admin(request)
    conn = get_connection()
    try:
        ensure_tables(conn)
        cur = conn.execute(
            "INSERT INTO kakao_link_rules (keywords, reply, path, sort_order, is_active) VALUES (?,?,?,?,?)",
            (payload.keywords, payload.reply, payload.path, payload.sort_order, payload.is_active),
        )
        conn.commit()
        return {"id": cur.lastrowid, "ok": True}
    finally:
        conn.close()


@router.put("/kakao-bot/rules/{rule_id}")
def update_rule(rule_id: int, payload: RulePayload, request: Request):
    _require_admin(request)
    conn = get_connection()
    try:
        ensure_tables(conn)
        cur = conn.execute(
            "UPDATE kakao_link_rules SET keywords=?, reply=?, path=?, sort_order=?, is_active=? WHERE id=?",
            (payload.keywords, payload.reply, payload.path, payload.sort_order, payload.is_active, rule_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="룰을 찾을 수 없습니다")
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/kakao-bot/rules/{rule_id}")
def delete_rule(rule_id: int, request: Request):
    _require_admin(request)
    conn = get_connection()
    try:
        ensure_tables(conn)
        cur = conn.execute("DELETE FROM kakao_link_rules WHERE id=?", (rule_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="룰을 찾을 수 없습니다")
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.post("/kakao-bot/outbox/test")
def queue_test_message(request: Request):
    """관리자용 — 알림 큐에 테스트 메시지 적재 (기기 폴링 동작 확인용)."""
    _require_admin(request)
    conn = get_connection()
    try:
        queue_outbox(conn, "🔔 추억길드 봇 테스트 알림입니다. 이 메시지가 보이면 알림 브릿지가 정상 동작 중!")
        return {"ok": True}
    finally:
        conn.close()
