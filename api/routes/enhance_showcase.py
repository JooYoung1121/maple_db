"""강화 명예의전당 — 메이커 강화 시뮬 결과를 공유·전시.

- 유저가 시뮬한 리버스·타임리스 강화 결과(최종 스탯·등급·주문서 내역·비용)를 저장
- 등급 증가분(grade_sum) 순 / 최신순 갤러리 + 개별 공유(id)
- enhance_showcase 는 유저 데이터 테이블 — 시드 동기화 대상 아님 (boss_timer_rooms 와 동일 규칙)
"""
import json
import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from crawler.db import get_connection

router = APIRouter()

MAX_LIST = 100
DETAIL_MAX_BYTES = 8000  # scroll_detail/gems/stats JSON 상한 (악의적 대용량 차단)


def _conn():
    conn = get_connection()
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def _ensure_tables() -> None:
    conn = _conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS enhance_showcase (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            kind TEXT,
            icon_url TEXT,
            base_stats TEXT NOT NULL DEFAULT '{}',
            final_stats TEXT NOT NULL DEFAULT '{}',
            grade_key TEXT,
            grade_name TEXT,
            grade_sum INTEGER NOT NULL DEFAULT 0,
            level INTEGER NOT NULL DEFAULT 0,
            success_count INTEGER NOT NULL DEFAULT 0,
            fail_count INTEGER NOT NULL DEFAULT 0,
            scroll_detail TEXT NOT NULL DEFAULT '[]',
            gems TEXT NOT NULL DEFAULT '[]',
            used_accel INTEGER NOT NULL DEFAULT 0,
            cost INTEGER NOT NULL DEFAULT 0,
            created_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_showcase_grade ON enhance_showcase(grade_sum DESC)")
    conn.commit()
    conn.close()


_ensure_tables()


def _json_ok(value: Any) -> str:
    s = json.dumps(value, ensure_ascii=False)
    if len(s.encode("utf-8")) > DETAIL_MAX_BYTES:
        raise HTTPException(status_code=400, detail="데이터가 너무 큽니다")
    return s


class ShowcaseCreate(BaseModel):
    nickname: str
    item_id: int
    item_name: str
    kind: Optional[str] = None
    icon_url: Optional[str] = None
    base_stats: dict = {}
    final_stats: dict = {}
    grade_key: Optional[str] = None
    grade_name: Optional[str] = None
    grade_sum: int = 0
    level: int = 0
    success_count: int = 0
    fail_count: int = 0
    scroll_detail: Any = []
    gems: Any = []
    used_accel: bool = False
    cost: int = 0


def _row_to_dict(row) -> dict:
    d = dict(row)
    for k in ("base_stats", "final_stats", "scroll_detail", "gems"):
        try:
            d[k] = json.loads(d.get(k) or ("{}" if "stats" in k else "[]"))
        except Exception:
            d[k] = {} if "stats" in k else []
    return d


@router.get("/enhance-showcase")
def list_showcase(
    sort: str = Query(default="grade", pattern="^(grade|recent)$"),
    kind: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=30, ge=1, le=MAX_LIST),
):
    offset = (page - 1) * per_page
    order = "grade_sum DESC, created_at DESC" if sort == "grade" else "created_at DESC"
    try:
        conn = _conn()
    except Exception:
        return {"showcase": [], "total": 0, "page": page, "per_page": per_page}
    try:
        where, params = "", []
        if kind:
            where = "WHERE kind = ?"
            params.append(kind)
        total = conn.execute(f"SELECT COUNT(*) FROM enhance_showcase {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM enhance_showcase {where} ORDER BY {order} LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        showcase = [_row_to_dict(r) for r in rows]
    except Exception:
        showcase, total = [], 0
    finally:
        conn.close()
    return {"showcase": showcase, "total": total, "page": page, "per_page": per_page}


@router.get("/enhance-showcase/{showcase_id}")
def get_showcase(showcase_id: int):
    try:
        conn = _conn()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        row = conn.execute("SELECT * FROM enhance_showcase WHERE id = ?", [showcase_id]).fetchone()
    finally:
        conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="공유된 강화 결과를 찾을 수 없습니다")
    return {"showcase": _row_to_dict(row)}


@router.post("/enhance-showcase")
def create_showcase(entry: ShowcaseCreate):
    nick = entry.nickname.strip()[:16]
    if not nick:
        raise HTTPException(status_code=400, detail="닉네임을 입력해주세요")
    if not entry.item_name.strip():
        raise HTTPException(status_code=400, detail="아이템 정보가 없습니다")
    base_s = _json_ok(entry.base_stats)
    final_s = _json_ok(entry.final_stats)
    scroll_s = _json_ok(entry.scroll_detail)
    gems_s = _json_ok(entry.gems)

    try:
        conn = _conn()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        cur = conn.execute(
            """INSERT INTO enhance_showcase
               (nickname, item_id, item_name, kind, icon_url, base_stats, final_stats,
                grade_key, grade_name, grade_sum, level, success_count, fail_count,
                scroll_detail, gems, used_accel, cost, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            [
                nick, entry.item_id, entry.item_name.strip()[:60], (entry.kind or "")[:20],
                (entry.icon_url or "")[:300], base_s, final_s,
                (entry.grade_key or "")[:16], (entry.grade_name or "")[:20], int(entry.grade_sum),
                int(entry.level), int(entry.success_count), int(entry.fail_count),
                scroll_s, gems_s, 1 if entry.used_accel else 0, max(0, int(entry.cost)),
                time.time(),
            ],
        )
        conn.commit()
        new_id = cur.lastrowid
        row = conn.execute("SELECT * FROM enhance_showcase WHERE id = ?", [new_id]).fetchone()
        return {"showcase": _row_to_dict(row)}
    finally:
        conn.close()
