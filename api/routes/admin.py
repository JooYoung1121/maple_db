"""Admin routes for data management"""
import os
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from crawler.db import get_connection

router = APIRouter()


@router.post("/admin/verify")
def admin_verify(request: Request):
    """관리자 비밀번호 확인용 엔드포인트"""
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    if request.headers.get("X-Admin-Password", "") != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀립니다.")
    return {"ok": True}


class MobUpdate(BaseModel):
    is_hidden: Optional[int] = None
    is_boss: Optional[int] = None
    name_kr: Optional[str] = None


@router.get("/admin/stats")
def admin_stats():
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
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    q: Optional[str] = Query(default=None),
    is_hidden: Optional[str] = Query(default="all"),
    is_boss: Optional[str] = Query(default="all"),
):
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
def admin_update_mob(mob_id: int, body: MobUpdate):
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
def admin_delete_mob(mob_id: int):
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
