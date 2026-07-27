"""Admin routes for data management"""
import os
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()


def _require_admin(request: Request):
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "")
    if request.headers.get("X-Admin-Password", "") != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀립니다.")


@router.post("/admin/verify")
def admin_verify(request: Request):
    """관리자 비밀번호 확인용 엔드포인트"""
    _require_admin(request)
    return {"ok": True}


@router.post("/admin/fortune/reset-rate-limit")
def admin_reset_fortune_rate_limit(request: Request, all_dates: bool = Query(default=False)):
    """운세 일일 조회 제한 리셋. 기본은 오늘치만, all_dates=true면 전체 삭제.

    fortune_rate_limit 은 IP·날짜별 사용 횟수만 담는 일시적 테이블이라 삭제해도 안전하다.
    """
    _require_admin(request)
    from datetime import datetime, timezone, timedelta

    today = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d")
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        if all_dates:
            cur = conn.execute("DELETE FROM fortune_rate_limit")
        else:
            cur = conn.execute("DELETE FROM fortune_rate_limit WHERE request_date = ?", [today])
        conn.commit()
        return {"ok": True, "deleted": cur.rowcount, "scope": "all" if all_dates else today}
    finally:
        conn.close()


class NewsSummaryUpdate(BaseModel):
    post_id: str
    summary: str


@router.post("/admin/news/summary")
def admin_update_news_summary(body: NewsSummaryUpdate, request: Request):
    """공지/개발일지 요약을 큐레이션 요약으로 교체 (자동 요약이 부실할 때 사용)."""
    _require_admin(request)
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        cur = conn.execute(
            "UPDATE maple_land_posts SET summary = ? WHERE post_id = ?",
            (body.summary, body.post_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="해당 post_id가 없습니다.")
        return {"ok": True, "post_id": body.post_id}
    finally:
        conn.close()


class MobUpdate(BaseModel):
    is_hidden: Optional[int] = None
    is_boss: Optional[int] = None
    name_kr: Optional[str] = None


@router.get("/admin/stats")
def admin_stats(request: Request):
    _require_admin(request)
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        total_mobs = conn.execute("SELECT COUNT(*) FROM mobs").fetchone()[0]
        hidden_count = conn.execute("SELECT COUNT(*) FROM mobs WHERE COALESCE(is_hidden,0)=1").fetchone()[0]
        visible_count = total_mobs - hidden_count
        boss_count = conn.execute("SELECT COUNT(*) FROM mobs WHERE is_boss=1").fetchone()[0]
        drop_count = conn.execute("SELECT COUNT(*) FROM mob_drops").fetchone()[0]
        spawn_count = conn.execute("SELECT COUNT(*) FROM mob_spawns").fetchone()[0]
        no_kr_name = conn.execute(
            "SELECT COUNT(*) FROM mobs WHERE id NOT IN (SELECT entity_id FROM entity_names_en WHERE entity_type='mob' AND source='kms')"
        ).fetchone()[0]
    finally:
        conn.close()

    return {
        "total_mobs": total_mobs,
        "hidden_count": hidden_count,
        "visible_count": visible_count,
        "boss_count": boss_count,
        "drop_count": drop_count,
        "spawn_count": spawn_count,
        "no_kr_name": no_kr_name,
    }


@router.get("/admin/mobs")
def admin_list_mobs(
    request: Request,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    q: Optional[str] = Query(default=None),
    is_hidden: Optional[str] = Query(default="all"),
    is_boss: Optional[str] = Query(default="all"),
):
    _require_admin(request)
    offset = (page - 1) * per_page
    conditions = []
    params: list = []

    if is_hidden == "0":
        conditions.append("COALESCE(is_hidden,0) = 0")
    elif is_hidden == "1":
        conditions.append("COALESCE(is_hidden,0) = 1")
    # "all" -> no filter

    if is_boss == "0":
        conditions.append("is_boss = 0")
    elif is_boss == "1":
        conditions.append("is_boss = 1")

    if q:
        conditions.append(
            "(name LIKE ? OR id IN (SELECT entity_id FROM entity_names_en WHERE entity_type='mob' AND name_en LIKE ?))"
        )
        params.append(f"%{q}%")
        params.append(f"%{q}%")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        total = conn.execute(f"SELECT COUNT(*) FROM mobs {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM mobs {where} ORDER BY id LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        results = []
        for row in rows:
            mob = dict(row)
            kr = conn.execute(
                "SELECT name_en FROM entity_names_en WHERE entity_type='mob' AND entity_id=? AND source='kms'",
                (mob["id"],),
            ).fetchone()
            mob["name_kr"] = kr["name_en"] if kr else None
            drop_count = conn.execute(
                "SELECT COUNT(*) FROM mob_drops WHERE mob_id=?", (mob["id"],)
            ).fetchone()[0]
            mob["drop_count"] = drop_count
            spawn_count = conn.execute(
                "SELECT COUNT(*) FROM mob_spawns WHERE mob_id=?", (mob["id"],)
            ).fetchone()[0]
            mob["spawn_count"] = spawn_count
            results.append(mob)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

    return {"mobs": results, "total": total, "page": page, "per_page": per_page}


@router.patch("/admin/mobs/{mob_id}")
def admin_update_mob(mob_id: int, body: MobUpdate, request: Request):
    _require_admin(request)
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        row = conn.execute("SELECT id FROM mobs WHERE id=?", (mob_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Mob not found")

        if body.is_hidden is not None:
            conn.execute("UPDATE mobs SET is_hidden=? WHERE id=?", (body.is_hidden, mob_id))

        if body.is_boss is not None:
            conn.execute("UPDATE mobs SET is_boss=? WHERE id=?", (body.is_boss, mob_id))

        if body.name_kr is not None:
            existing = conn.execute(
                "SELECT rowid FROM entity_names_en WHERE entity_type='mob' AND entity_id=? AND source='kms'",
                (mob_id,),
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE entity_names_en SET name_en=? WHERE entity_type='mob' AND entity_id=? AND source='kms'",
                    (body.name_kr, mob_id),
                )
            else:
                conn.execute(
                    "INSERT INTO entity_names_en (entity_type, entity_id, name_en, source) VALUES ('mob', ?, ?, 'kms')",
                    (mob_id, body.name_kr),
                )

        conn.commit()
    finally:
        conn.close()

    return {"ok": True}


@router.delete("/admin/mobs/{mob_id}")
def admin_delete_mob(mob_id: int, request: Request):
    _require_admin(request)
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        row = conn.execute("SELECT id FROM mobs WHERE id=?", (mob_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Mob not found")

        conn.execute("DELETE FROM mob_drops WHERE mob_id=?", (mob_id,))
        conn.execute("DELETE FROM mob_spawns WHERE mob_id=?", (mob_id,))
        conn.execute("DELETE FROM entity_names_en WHERE entity_type='mob' AND entity_id=?", (mob_id,))
        conn.execute("DELETE FROM mobs WHERE id=?", (mob_id,))
        conn.commit()
    finally:
        conn.close()

    return {"ok": True}


@router.get("/admin/db-status")
def admin_db_status(request: Request):
    """시드 동기화 진단 — 주요 테이블 존재·행수 + DB 파일/디스크 상태."""
    _require_admin(request)
    import os
    import shutil

    from crawler.db import get_connection, DB_PATH

    out: dict = {"tables": {}, "db": {}}
    check_tables = [
        "quests", "mob_drops", "mob_spawns", "items", "map_details", "mapledb_quests",
        "sim_jobs", "sim_skills", "codi_posts", "game_results", "entity_names_en", "mobs", "maps",
    ]
    conn = get_connection()
    try:
        for t in check_tables:
            try:
                out["tables"][t] = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            except Exception as e:
                out["tables"][t] = f"ERROR: {e}"
    finally:
        conn.close()
    conn = get_connection()
    try:
        out["sync_log"] = [dict(r) for r in conn.execute("SELECT * FROM seed_sync_log").fetchall()]
    except Exception:
        out["sync_log"] = None
    finally:
        conn.close()
    try:
        p = str(DB_PATH)
        out["db"]["path"] = p
        out["db"]["size_mb"] = round(os.path.getsize(p) / 1024 / 1024, 1)
        real = os.path.realpath(p)
        out["db"]["realpath"] = real
        usage = shutil.disk_usage(os.path.dirname(real))
        out["db"]["disk_free_mb"] = round(usage.free / 1024 / 1024, 1)
        out["db"]["disk_total_mb"] = round(usage.total / 1024 / 1024, 1)
    except Exception as e:
        out["db"]["error"] = str(e)
    return out


@router.post("/admin/sync-tables")
def admin_sync_tables(request: Request, tables: str = Query(default="map_details,mapledb_quests")):
    """레퍼런스 테이블을 GitHub 시드에서 직접 당겨와 교체 (시작 스크립트 동기화 실패 시 수동 레버).

    화이트리스트 테이블만 허용 — 유저 데이터 테이블은 건드릴 수 없다.
    """
    _require_admin(request)
    import sqlite3
    import tempfile
    import urllib.request

    ALLOWED = {"quests", "mob_drops", "mob_spawns", "sim_jobs", "sim_skills", "items", "map_details", "mapledb_quests"}
    want = [t.strip() for t in tables.split(",") if t.strip()]
    bad = [t for t in want if t not in ALLOWED]
    if bad:
        raise HTTPException(status_code=400, detail=f"허용되지 않는 테이블: {bad}")

    SEED_URL = "https://raw.githubusercontent.com/JooYoung1121/maple_db/main/data/maple.db"
    results: dict = {}
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    try:
        req = urllib.request.Request(SEED_URL, headers={"User-Agent": "maple-db-sync/1.0"})
        with urllib.request.urlopen(req, timeout=180) as r:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                tmp.write(chunk)
        tmp.close()

        from crawler.db import get_connection
        conn = get_connection()
        try:
            conn.execute(f"ATTACH '{tmp.name}' AS seed")
            for tbl in want:
                try:
                    row = conn.execute(
                        "SELECT sql FROM seed.sqlite_master WHERE type='table' AND name=?", (tbl,)
                    ).fetchone()
                    if not row or not row[0]:
                        results[tbl] = "seed에 없음"
                        continue
                    conn.execute(f"DROP TABLE IF EXISTS {tbl}")
                    conn.execute(row[0])
                    conn.execute(f"INSERT INTO {tbl} SELECT * FROM seed.{tbl}")
                    conn.commit()
                    cnt = conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
                    results[tbl] = f"ok: {cnt} rows"
                except Exception as te:
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    results[tbl] = f"fail: {te!r}"
            conn.execute("DETACH seed")
        finally:
            conn.close()
    finally:
        import os as _os2
        try:
            _os2.unlink(tmp.name)
        except Exception:
            pass
    return {"results": results}
