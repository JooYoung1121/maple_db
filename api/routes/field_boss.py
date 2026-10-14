"""필드보스 채널 트래커 API — 보스를 잡은 채널·시각을 공유해 채널 로테이션을 돕는다.

- field_boss_reports: 유저 제보 데이터 (SEED_TABLES 제외 — 라이브 볼륨에서 유지)
- 젠 주기(respawn_min)는 확정된 보스만 기본값 제공, 나머지는 None (경과 시간만 표시)
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from crawler.db import get_connection
from crawler.field_bosses import FIELD_BOSSES

router = APIRouter()

# 메랜 2.0은 혼잡도에 따라 채널이 241+까지 열림(2026-10 실측) — 상한은 검증용 여유값
MAX_CHANNEL = 999
REPORT_WINDOW_HOURS = 24

# 채널 로테이션으로 잡는 필드보스 큐레이션 — 단일 목록은 crawler/field_bosses.py (몬스터 목록 노출 정리와 공유)
BOSSES = FIELD_BOSSES
BOSS_IDS = {b["id"] for b in BOSSES}
RESPAWN_BY_ID = {b["id"]: b["respawn_min"] for b in BOSSES}


def _ensure_table() -> None:
    conn = get_connection()
    try:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS field_boss_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                boss_id INTEGER NOT NULL,
                channel INTEGER NOT NULL,
                killed_at TEXT NOT NULL,
                reporter TEXT,
                user_id INTEGER,
                client_ip TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )"""
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_fbr_boss_channel ON field_boss_reports(boss_id, channel, killed_at)"
        )
        conn.commit()
    finally:
        conn.close()


_ensure_table()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("/field-boss/bosses")
def list_bosses():
    conn = get_connection()
    try:
        rows = conn.execute(
            f"""SELECT m.id, COALESCE(n.name_en, m.name) AS name, m.level, m.icon_url
                FROM mobs m
                LEFT JOIN entity_names_en n
                  ON n.entity_type='mob' AND n.entity_id=m.id AND n.source='kms'
                WHERE m.id IN ({','.join('?' * len(BOSS_IDS))})""",
            list(BOSS_IDS),
        ).fetchall()
        by_id = {r["id"]: dict(r) for r in rows}
        # 출현 맵 (mob_spawns · 한글 맵명 우선) — 보스 선택 시 어디서 젠되는지 바로 보이게
        maps_by_id: dict[int, list[str]] = {}
        for r in conn.execute(
            f"""SELECT s.mob_id, COALESCE(n.name_en, mp.name) AS map_name
                FROM mob_spawns s
                JOIN maps mp ON mp.id = s.map_id
                LEFT JOIN entity_names_en n
                  ON n.entity_type='map' AND n.entity_id=mp.id AND n.source='kms'
                WHERE s.mob_id IN ({','.join('?' * len(BOSS_IDS))})
                ORDER BY s.map_id""",
            list(BOSS_IDS),
        ).fetchall():
            maps_by_id.setdefault(r["mob_id"], []).append(r["map_name"])
        bosses = []
        for b in BOSSES:
            info = by_id.get(b["id"])
            if not info:
                continue
            info["respawn_min"] = b["respawn_min"]
            info["maps"] = maps_by_id.get(b["id"], [])
            if b.get("label"):
                info["name"] = b["label"]
            bosses.append(info)
        return {"bosses": bosses, "max_channel": MAX_CHANNEL}
    finally:
        conn.close()


@router.get("/field-boss/reports")
def get_reports(boss_id: int):
    if boss_id not in BOSS_IDS:
        raise HTTPException(status_code=404, detail="지원하지 않는 보스입니다.")
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=REPORT_WINDOW_HOURS)).isoformat()
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT id, channel, killed_at, reporter, user_id
               FROM field_boss_reports
               WHERE boss_id = ? AND killed_at > ?
               ORDER BY killed_at DESC
               LIMIT 300""",
            (boss_id, cutoff),
        ).fetchall()
        latest_by_channel = {}
        recent = []
        for r in rows:
            d = dict(r)
            d.pop("user_id", None)
            if r["channel"] not in latest_by_channel:
                latest_by_channel[r["channel"]] = d
            if len(recent) < 30:
                recent.append(d)
        return {
            "boss_id": boss_id,
            "respawn_min": RESPAWN_BY_ID.get(boss_id),
            "channels": latest_by_channel,
            "recent": recent,
            "server_now": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        conn.close()


class ReportCreate(BaseModel):
    boss_id: int
    channel: int
    minutes_ago: int = 0
    reporter: Optional[str] = None


@router.post("/field-boss/reports")
def create_report(body: ReportCreate, request: Request):
    if body.boss_id not in BOSS_IDS:
        raise HTTPException(status_code=404, detail="지원하지 않는 보스입니다.")
    if not (1 <= body.channel <= MAX_CHANNEL):
        raise HTTPException(status_code=400, detail=f"채널은 1~{MAX_CHANNEL} 사이여야 합니다.")
    if not (0 <= body.minutes_ago <= 180):
        raise HTTPException(status_code=400, detail="처치 시각은 지금부터 180분 전까지만 입력할 수 있습니다.")

    from api.routes.auth import current_user_id

    uid = current_user_id(request)
    reporter = (body.reporter or "").strip()[:12]
    if uid is not None and not reporter:
        conn = get_connection()
        try:
            row = conn.execute(
                "SELECT COALESCE(site_nickname, guild_nick, global_name, username) AS name FROM users WHERE id=?",
                (uid,),
            ).fetchone()
            if row and row["name"]:
                reporter = str(row["name"])[:12]
        finally:
            conn.close()
    if not reporter:
        reporter = "익명"

    ip = _client_ip(request)
    killed_at = (datetime.now(timezone.utc) - timedelta(minutes=body.minutes_ago)).isoformat()
    conn = get_connection()
    try:
        recent = conn.execute(
            "SELECT COUNT(*) FROM field_boss_reports WHERE client_ip=? AND created_at > datetime('now','-1 minute')",
            (ip,),
        ).fetchone()[0]
        if recent >= 12:
            raise HTTPException(status_code=429, detail="잠시 후 다시 시도해주세요.")
        cur = conn.execute(
            """INSERT INTO field_boss_reports (boss_id, channel, killed_at, reporter, user_id, client_ip)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (body.boss_id, body.channel, killed_at, reporter, uid, ip),
        )
        conn.commit()
        return {"ok": True, "id": cur.lastrowid, "killed_at": killed_at}
    finally:
        conn.close()


@router.delete("/field-boss/reports/{report_id}")
def delete_report(report_id: int, request: Request):
    """본인(로그인) 또는 관리자(X-Admin-Password)만 삭제. 익명 오기록은 새 제보로 덮으면 된다."""
    import os

    from api.routes.auth import current_user_id

    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT user_id FROM field_boss_reports WHERE id=?", (report_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="제보를 찾을 수 없습니다.")
        uid = current_user_id(request)
        pw = request.headers.get("X-Admin-Password", "")
        is_admin = bool(pw) and pw == os.environ.get("GAME_ADMIN_PASSWORD", "")
        if not is_admin and (uid is None or row["user_id"] != uid):
            raise HTTPException(status_code=403, detail="본인 제보만 삭제할 수 있습니다.")
        conn.execute("DELETE FROM field_boss_reports WHERE id=?", (report_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
