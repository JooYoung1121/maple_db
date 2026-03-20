"""Quest routes"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import json

from crawler.db import get_connection

router = APIRouter()


@router.get("/quests")
def list_quests(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    level_min: Optional[int] = Query(default=None, ge=0),
    level_max: Optional[int] = Query(default=None, ge=0),
    q: Optional[str] = Query(default=None),
):
    offset = (page - 1) * per_page
    conditions = []
    params: list = []

    if level_min is not None:
        conditions.append("level_req >= ?")
        params.append(level_min)
    if level_max is not None:
        conditions.append("level_req <= ?")
        params.append(level_max)
    if q:
        conditions.append("name LIKE ?")
        params.append(f"%{q}%")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    try:
        conn = get_connection()
    except Exception:
        return {"quests": [], "total": 0, "page": page, "per_page": per_page}

    try:
        total = conn.execute(f"SELECT COUNT(*) FROM quests {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM quests {where} ORDER BY level_req, id LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        results = []
        for row in rows:
            q = dict(row)
            kr = conn.execute(
                "SELECT name_en FROM entity_names_en WHERE entity_type='quest' AND entity_id=? AND source='kms'",
                (q["id"],),
            ).fetchone()
            q["name_kr"] = kr["name_en"] if kr else None
            results.append(q)
    except Exception:
        results = []
        total = 0
    finally:
        conn.close()

    return {"quests": results, "total": total, "page": page, "per_page": per_page}


@router.get("/quests/{quest_id}")
def get_quest(quest_id: int):
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        row = conn.execute("SELECT * FROM quests WHERE id = ?", (quest_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Quest not found")
        quest = dict(row)

        # 영문명
        en_rows = conn.execute(
            "SELECT name_en, source FROM entity_names_en WHERE entity_type = 'quest' AND entity_id = ?",
            (quest_id,),
        ).fetchall()
        quest["names_en"] = [dict(r) for r in en_rows]

        # Parse structured rewards
        rewards_raw = quest.get("rewards")
        if rewards_raw:
            try:
                quest["rewards_detail"] = json.loads(rewards_raw)
            except Exception:
                quest["rewards_detail"] = None
        else:
            quest["rewards_detail"] = None
    finally:
        conn.close()

    return {"quest": quest}
