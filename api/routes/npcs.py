"""NPC routes"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import json

from crawler.db import get_connection

router = APIRouter()


@router.get("/npcs/filters")
def npc_filters():
    try:
        conn = get_connection()
    except Exception:
        return {"shop_count": 0}
    try:
        shop_count = conn.execute("SELECT COUNT(*) FROM npcs WHERE is_shop=1").fetchone()[0]
        return {"shop_count": shop_count}
    finally:
        conn.close()


@router.get("/npcs")
def list_npcs(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    is_shop: Optional[bool] = Query(default=None),
    q: Optional[str] = Query(default=None),
):
    offset = (page - 1) * per_page
    conditions = []
    params: list = []

    if is_shop is not None:
        conditions.append("is_shop = ?")
        params.append(1 if is_shop else 0)
    if q:
        conditions.append("name LIKE ?")
        params.append(f"%{q}%")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    try:
        conn = get_connection()
    except Exception:
        return {"npcs": [], "total": 0, "page": page, "per_page": per_page}

    try:
        total = conn.execute(f"SELECT COUNT(*) FROM npcs {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM npcs {where} ORDER BY id LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        results = []
        for row in rows:
            n = dict(row)
            kr = conn.execute(
                "SELECT name_en FROM entity_names_en WHERE entity_type='npc' AND entity_id=? AND source='kms'",
                (n["id"],),
            ).fetchone()
            n["name_kr"] = kr["name_en"] if kr else None
            results.append(n)
    except Exception:
        results = []
        total = 0
    finally:
        conn.close()

    return {"npcs": results, "total": total, "page": page, "per_page": per_page}


@router.get("/npcs/{npc_id}")
def get_npc(npc_id: int):
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        row = conn.execute("SELECT * FROM npcs WHERE id = ?", (npc_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="NPC not found")
        npc = dict(row)

        # 영문명
        en_rows = conn.execute(
            "SELECT name_en, source FROM entity_names_en WHERE entity_type = 'npc' AND entity_id = ?",
            (npc_id,),
        ).fetchall()
        npc["names_en"] = [dict(r) for r in en_rows]

        # Related quests
        related_quests_raw = npc.get("related_quests")
        if related_quests_raw:
            try:
                quest_ids = json.loads(related_quests_raw)
                if isinstance(quest_ids, list):
                    quests = []
                    for qid in quest_ids[:20]:
                        q = conn.execute(
                            "SELECT id, name, level_req FROM quests WHERE id=?", (qid,)
                        ).fetchone()
                        if q:
                            quests.append(dict(q))
                    npc["related_quests_detail"] = quests
            except Exception:
                npc["related_quests_detail"] = []
        else:
            npc["related_quests_detail"] = []
    finally:
        conn.close()

    return {"npc": npc}
