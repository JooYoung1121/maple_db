"""이벤트 정리 아카이브 API — 이벤트별 요약·정리본을 모아두는 페이지.

- event_guides: 관리자가 라이브에서 편집하는 큐레이션 테이블 (시드 동기화 제외,
  비어 있을 때만 기본 정리본 삽입 — community_channels와 동일한 정책)
- content_json 구조:
  {
    "tldr": ["핵심 요약 한 줄", ...],
    "sections": [
      {"heading": "제목", "body": "문단\\n문단"},
      {"heading": "표 제목", "table": {"headers": [...], "rows": [[...], ...]}, "note": "표 주석"}
    ],
    "links": [{"label": "출처/관련 링크", "url": "..."}]
  }
"""
import json
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from crawler.db import get_connection

router = APIRouter()

STATUSES = {"active", "ended"}

# 첫 번째 정리본: 버닝 월드 몬스터파크 (2026-07-10 시작)
_MONSTER_PARK_CONTENT = {
    "tldr": [
        "버닝 월드 전용 파티 테마던전 — 각 마을의 '몬스터파크 셔틀' NPC로 입장 (레벨 50 이상)",
        "몬스터파크 안 NPC 메리에게 매일 레벨 구간에 맞는 입장 티켓 2매 수령 (계정당 1캐릭터, 당일 23:59까지 사용)",
        "몹 처치 시엔 경험치가 없고, 마지막 단계 클리어 후 포탈로 이탈할 때 최종 경험치가 한 번에 지급됨",
        "같은 등급 안에서도 맵(던전)마다 클리어 경험치가 크게 다름 — 아래 표 참고",
    ],
    "sections": [
        {
            "heading": "기본 정보",
            "table": {
                "headers": ["항목", "내용"],
                "rows": [
                    ["기간", "2026년 7월 10일 점검 후 ~ 버닝 월드 운영 종료"],
                    ["입장 조건", "레벨 50 이상, 각 마을 몬스터파크 셔틀 NPC"],
                    ["티켓 수령", "몬스터파크 내 NPC 메리 — 매일 1회, 레벨 구간 티켓 2매 (계정당 1캐릭터)"],
                    ["초급 던전", "Lv.50~70 · 얼룩무늬 티켓"],
                    ["중급 던전", "Lv.71~100 · 표범무늬 티켓"],
                    ["고급 던전", "Lv.101~119 · 호랑무늬 티켓"],
                    ["경험치 지급", "몹 처치 시 0, 최종 클리어 후 포탈 이탈 시 일괄 지급"],
                ],
            },
        },
        {
            "heading": "맵별 클리어 경험치 (커뮤니티 정리)",
            "table": {
                "headers": ["등급", "던전(맵)", "클리어 경험치"],
                "rows": [
                    ["초급 (50~70)", "고요한 바다", "약 32만"],
                    ["초급 (50~70)", "그레이의 습격", "약 36만"],
                    ["초급 (50~70)", "골렘의 숲", "약 45만"],
                    ["초급 (50~70)", "까막산", "약 63만"],
                    ["중급 (71~100)", "하늘 숲", "약 105만"],
                    ["중급 (71~100)", "마녀의 숲", "약 160만"],
                    ["중급 (71~100)", "어둠의 신전", "약 270만"],
                    ["중급 (71~100)", "자동 경비구역", "약 430만"],
                    ["고급 (101~119)", "죽은 숲", "약 650만"],
                    ["고급 (101~119)", "금지된 시간", "약 745만"],
                ],
            },
            "note": "출처: 아카라이브 메이플랜드 채널 유저 정리(7/10). 오픈 직후 '클리어 경험치 하향 조정' 언급이 커뮤니티에 돌았으므로 실제 수치는 패치에 따라 달라질 수 있습니다. 맵 이름은 정리글 표기를 따랐습니다.",
        },
        {
            "heading": "팁",
            "body": "몹을 잡아도 경험치가 없으므로 중도 포기하면 아무것도 못 받습니다 — 반드시 마지막 단계까지 클리어 후 포탈로 나가세요.\n티켓은 당일 23시 59분까지만 유효하니 받은 날 소진하는 것이 좋습니다.\n같은 등급이면 경험치가 높은 맵(초급은 까막산, 중급은 자동 경비구역, 고급은 금지된 시간)이 효율이 좋다는 것이 커뮤니티 중론입니다. 단, 맵마다 난이도·소요 시간이 다르니 파티 스펙에 맞춰 선택하세요.",
        },
    ],
    "links": [
        {"label": "공식 공지 — [버닝 월드] 테마던전 : 몬스터 파크", "url": "https://maple.land/board/events/mh6b0zive39giwpp8dinmeo8"},
        {"label": "아카라이브 — 몬스터파크 맵마다 경험치 (유저 정리)", "url": "https://arca.live/b/mapleland/176420692"},
        {"label": "난동군 — [버닝월드] 몬스터파크 이벤트 공략 (영상)", "url": "https://www.youtube.com/watch?v=hyJZxvdIHDs"},
        {"label": "디시 메랜갤 — 몬스터파크 실시간 글타래", "url": "https://gall.dcinside.com/mgallery/board/lists/?id=mapleland&s_type=search_subject_memo&s_keyword=%EB%AA%AC%EC%8A%A4%ED%84%B0%ED%8C%8C%ED%81%AC"},
    ],
}

DEFAULT_GUIDES = [
    {
        "slug": "monster-park-2026",
        "title": "테마던전 : 몬스터 파크",
        "world": "버닝 월드",
        "status": "active",
        "period_start": "2026-07-10",
        "period_end": None,
        "source_post_id": "mh6b0zive39giwpp8dinmeo8",
        "content_json": json.dumps(_MONSTER_PARK_CONTENT, ensure_ascii=False),
    },
]


def _require_admin(request: Request):
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    if request.headers.get("X-Admin-Password", "") != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀립니다.")


def ensure_tables(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS event_guides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            world TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            period_start TEXT,
            period_end TEXT,
            source_post_id TEXT,
            content_json TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    """)
    if conn.execute("SELECT COUNT(*) FROM event_guides").fetchone()[0] == 0:
        for g in DEFAULT_GUIDES:
            conn.execute(
                """INSERT INTO event_guides
                   (slug, title, world, status, period_start, period_end, source_post_id, content_json)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (g["slug"], g["title"], g["world"], g["status"], g["period_start"],
                 g["period_end"], g["source_post_id"], g["content_json"]),
            )
    conn.commit()


@router.get("/events")
def list_events():
    conn = get_connection()
    try:
        ensure_tables(conn)
        rows = conn.execute(
            """SELECT id, slug, title, world, status, period_start, period_end, updated_at
               FROM event_guides
               ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, period_start DESC"""
        ).fetchall()
        return {"events": [dict(r) for r in rows]}
    finally:
        conn.close()


@router.get("/events/{slug}")
def get_event(slug: str):
    conn = get_connection()
    try:
        ensure_tables(conn)
        row = conn.execute("SELECT * FROM event_guides WHERE slug=?", (slug,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="이벤트 정리를 찾을 수 없습니다")
        d = dict(row)
        try:
            d["content"] = json.loads(d.pop("content_json"))
        except json.JSONDecodeError:
            d["content"] = {"tldr": [], "sections": [], "links": []}
        return {"event": d}
    finally:
        conn.close()


class EventPayload(BaseModel):
    slug: str
    title: str
    world: Optional[str] = None
    status: str = "active"
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    source_post_id: Optional[str] = None
    content_json: str


def _validate(payload: EventPayload):
    if payload.status not in STATUSES:
        raise HTTPException(status_code=400, detail="status는 active 또는 ended여야 합니다")
    if not payload.slug.strip() or not payload.title.strip():
        raise HTTPException(status_code=400, detail="slug와 제목은 필수입니다")
    try:
        json.loads(payload.content_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"content_json이 올바른 JSON이 아닙니다: {e}")


@router.post("/events")
def create_event(payload: EventPayload, request: Request):
    _require_admin(request)
    _validate(payload)
    conn = get_connection()
    try:
        ensure_tables(conn)
        try:
            cur = conn.execute(
                """INSERT INTO event_guides
                   (slug, title, world, status, period_start, period_end, source_post_id, content_json)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (payload.slug.strip(), payload.title.strip(), payload.world, payload.status,
                 payload.period_start, payload.period_end, payload.source_post_id, payload.content_json),
            )
        except Exception:
            raise HTTPException(status_code=409, detail="이미 존재하는 slug입니다")
        conn.commit()
        return {"id": cur.lastrowid, "ok": True}
    finally:
        conn.close()


@router.put("/events/{slug}")
def update_event(slug: str, payload: EventPayload, request: Request):
    _require_admin(request)
    _validate(payload)
    conn = get_connection()
    try:
        ensure_tables(conn)
        cur = conn.execute(
            """UPDATE event_guides SET slug=?, title=?, world=?, status=?, period_start=?,
               period_end=?, source_post_id=?, content_json=?, updated_at=datetime('now','localtime')
               WHERE slug=?""",
            (payload.slug.strip(), payload.title.strip(), payload.world, payload.status,
             payload.period_start, payload.period_end, payload.source_post_id,
             payload.content_json, slug),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="이벤트 정리를 찾을 수 없습니다")
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/events/{slug}")
def delete_event(slug: str, request: Request):
    _require_admin(request)
    conn = get_connection()
    try:
        ensure_tables(conn)
        cur = conn.execute("DELETE FROM event_guides WHERE slug=?", (slug,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="이벤트 정리를 찾을 수 없습니다")
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
