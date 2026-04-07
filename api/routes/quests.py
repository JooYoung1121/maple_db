"""Quest routes — extended with Quest.wz data"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import json
import logging

from crawler.db import get_connection

router = APIRouter()
logger = logging.getLogger(__name__)

# 목록 API에서 반환할 컬럼 (npc_dialogue 등 대용량 필드 제외)
_LIST_COLUMNS = (
    "id, name, level_req, npc_start, npc_end, category, area, quest_type, "
    "auto_start, exp_reward, meso_reward, reward_items, prerequisite_quests, "
    "start_level, end_level, required_mobs, completion_items, next_quest_id, is_mapleland"
)


@router.get("/quests")
def list_quests(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    level_min: Optional[int] = Query(default=None, ge=0),
    level_max: Optional[int] = Query(default=None, ge=0),
    q: Optional[str] = Query(default=None, max_length=100),
    category: Optional[str] = Query(default=None, max_length=50),
    area: Optional[str] = Query(default=None, max_length=50),
    quest_type: Optional[str] = Query(default=None, max_length=50),
    has_rewards: Optional[int] = Query(default=None),
    sort: Optional[str] = Query(default=None, max_length=20),
):
    offset = (page - 1) * per_page
    conditions = ["is_mapleland = 1"]
    params: list = []

    if level_min is not None:
        conditions.append("(level_req >= ? OR start_level >= ?)")
        params.extend([level_min, level_min])
    if level_max is not None:
        conditions.append("(level_req <= ? OR (start_level <= ? AND start_level > 0))")
        params.extend([level_max, level_max])
    if q:
        conditions.append(
            "(name LIKE ? OR id IN (SELECT entity_id FROM entity_names_en WHERE entity_type='quest' AND name_en LIKE ?))"
        )
        params.append(f"%{q}%")
        params.append(f"%{q}%")
    if category:
        conditions.append("category = ?")
        params.append(category)
    if area:
        conditions.append("area = ?")
        params.append(area)
    if quest_type:
        conditions.append("quest_type = ?")
        params.append(quest_type)
    if has_rewards is not None and has_rewards == 1:
        conditions.append("(exp_reward > 0 OR meso_reward > 0 OR reward_items IS NOT NULL)")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # Sort
    order = "ORDER BY level_req, id"
    if sort == "level_desc":
        order = "ORDER BY level_req DESC, id"
    elif sort == "exp_reward":
        order = "ORDER BY exp_reward DESC, id"
    elif sort == "meso_reward":
        order = "ORDER BY meso_reward DESC, id"
    elif sort == "name":
        order = "ORDER BY name, id"

    try:
        conn = get_connection()
    except Exception:
        return {"quests": [], "total": 0, "page": page, "per_page": per_page}

    try:
        total = conn.execute(f"SELECT COUNT(*) FROM quests {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT {_LIST_COLUMNS} FROM quests {where} {order} LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()

        # Batch fetch KR names (N+1 → 1+1 쿼리 최적화)
        results = [dict(row) for row in rows]
        quest_ids = [q["id"] for q in results]
        kr_map = {}
        if quest_ids:
            placeholders = ",".join("?" for _ in quest_ids)
            kr_rows = conn.execute(
                f"SELECT entity_id, name_en FROM entity_names_en WHERE entity_type='quest' AND source='kms' AND entity_id IN ({placeholders})",
                quest_ids,
            ).fetchall()
            kr_map = {r["entity_id"]: r["name_en"] for r in kr_rows}

        for quest in results:
            kr_name = kr_map.get(quest["id"])
            quest["name_kr"] = kr_name.strip() if kr_name else None
            # Parse JSON fields present in _LIST_COLUMNS
            for jf in ["prerequisite_quests", "required_mobs", "completion_items", "reward_items"]:
                if quest.get(jf):
                    try:
                        quest[jf] = json.loads(quest[jf])
                    except Exception:
                        pass
            # Strip whitespace from name
            if quest.get("name"):
                quest["name"] = quest["name"].strip()
    except Exception as e:
        logger.warning("list_quests error: %s", e)
        results = []
        total = 0
    finally:
        conn.close()

    return {"quests": results, "total": total, "page": page, "per_page": per_page}


@router.get("/quests/categories")
def get_quest_categories():
    """카테고리, 지역, 퀘스트 유형 목록 반환"""
    try:
        conn = get_connection()
    except Exception:
        return {"categories": [], "areas": [], "quest_types": []}

    try:
        categories = [r[0] for r in conn.execute(
            "SELECT DISTINCT category FROM quests WHERE is_mapleland = 1 AND category IS NOT NULL AND category != '' ORDER BY category"
        ).fetchall()]
        areas = [r[0] for r in conn.execute(
            "SELECT DISTINCT area FROM quests WHERE is_mapleland = 1 AND area IS NOT NULL AND area != '' ORDER BY area"
        ).fetchall()]
        quest_types = [r[0] for r in conn.execute(
            "SELECT DISTINCT quest_type FROM quests WHERE is_mapleland = 1 AND quest_type IS NOT NULL AND quest_type != '' ORDER BY quest_type"
        ).fetchall()]
    except Exception:
        categories, areas, quest_types = [], [], []
    finally:
        conn.close()

    return {"categories": categories, "areas": areas, "quest_types": quest_types}


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
        # Strip whitespace from name
        if quest.get("name"):
            quest["name"] = quest["name"].strip()

        # 영문명
        en_rows = conn.execute(
            "SELECT name_en, source FROM entity_names_en WHERE entity_type = 'quest' AND entity_id = ?",
            (quest_id,),
        ).fetchall()
        quest["names_en"] = [dict(r) for r in en_rows]

        # KR name (source='kms')
        kr_row = next((r for r in en_rows if r["source"] == "kms"), None)
        quest["name_kr"] = kr_row["name_en"].strip() if kr_row else None

        # Parse JSON fields
        for jf in ["prerequisite_quests", "required_items", "required_mobs", "completion_items", "reward_items"]:
            if quest.get(jf):
                try:
                    quest[jf] = json.loads(quest[jf])
                except Exception:
                    pass
            else:
                quest[jf] = None

        # Parse dialogue
        if quest.get("npc_dialogue"):
            try:
                quest["npc_dialogue"] = json.loads(quest["npc_dialogue"])
            except Exception:
                pass

        # Parse structured rewards
        rewards_raw = quest.get("rewards")
        if rewards_raw:
            try:
                quest["rewards_detail"] = json.loads(rewards_raw)
            except Exception:
                quest["rewards_detail"] = None
        else:
            quest["rewards_detail"] = None

        # Resolve prerequisite quest names
        if quest.get("prerequisite_quests"):
            prereq_ids = [int(p["id"]) for p in quest["prerequisite_quests"] if isinstance(p, dict) and isinstance(p.get("id"), (int, float, str))]
            if prereq_ids:
                placeholders = ",".join("?" for _ in prereq_ids)
                prereq_rows = conn.execute(
                    f"SELECT id, name, level_req FROM quests WHERE id IN ({placeholders})",
                    prereq_ids,
                ).fetchall()
                prereq_map = {r["id"]: dict(r) for r in prereq_rows}
                for p in quest["prerequisite_quests"]:
                    if isinstance(p, dict) and p["id"] in prereq_map:
                        p["name"] = prereq_map[p["id"]]["name"]
                        p["level_req"] = prereq_map[p["id"]]["level_req"]

        # Resolve reward item names (if names missing)
        if quest.get("reward_items"):
            item_ids = [int(r["id"]) for r in quest["reward_items"] if isinstance(r, dict) and not r.get("name") and isinstance(r.get("id"), (int, float, str))]
            if item_ids:
                placeholders = ",".join("?" for _ in item_ids)
                item_rows = conn.execute(
                    f"SELECT id, name FROM items WHERE id IN ({placeholders})",
                    item_ids,
                ).fetchall()
                name_map = {r["id"]: r["name"] for r in item_rows}
                for r in quest["reward_items"]:
                    if isinstance(r, dict) and not r.get("name") and r["id"] in name_map:
                        r["name"] = name_map[r["id"]]

        # Find quests that require this quest (후행 퀘스트)
        following = conn.execute(
            "SELECT id, name, level_req FROM quests WHERE prerequisite_quests LIKE ?",
            (f'%"id":{quest_id}%',),
        ).fetchall()
        # Also check via next_quest_id
        next_q = conn.execute(
            "SELECT id, name, level_req FROM quests WHERE id = ?",
            (quest.get("next_quest_id"),),
        ).fetchone() if quest.get("next_quest_id") else None

        quest["following_quests"] = [dict(r) for r in following]
        if next_q and next_q["id"] not in [f["id"] for f in quest["following_quests"]]:
            quest["following_quests"].append(dict(next_q))

        # NPC names from DB
        for npc_field, name_field in [("npc_start_id", "npc_start_name"), ("npc_end_id", "npc_end_name")]:
            npc_id = quest.get(npc_field)
            if npc_id:
                npc_row = conn.execute("SELECT name FROM npcs WHERE id = ?", (npc_id,)).fetchone()
                quest[name_field] = npc_row["name"] if npc_row else None
            else:
                quest[name_field] = None

    finally:
        conn.close()

    return {"quest": quest}


@router.get("/quests/{quest_id}/chain")
def get_quest_chain(quest_id: int):
    """선행퀘 체인 전체 반환 (앞으로 + 뒤로)"""
    MAX_CHAIN_DEPTH = 50

    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        chain = []
        visited = set()

        def collect_prereqs(qid, depth=0):
            if qid in visited or depth > MAX_CHAIN_DEPTH:
                return
            visited.add(qid)
            row = conn.execute(
                "SELECT id, name, level_req, prerequisite_quests, next_quest_id FROM quests WHERE id = ?",
                (qid,),
            ).fetchone()
            if not row:
                return
            q = dict(row)
            chain.append({"id": q["id"], "name": q["name"], "level_req": q["level_req"]})

            # Go backwards (prerequisites)
            if q.get("prerequisite_quests"):
                try:
                    prereqs = json.loads(q["prerequisite_quests"]) if isinstance(q["prerequisite_quests"], str) else q["prerequisite_quests"]
                    for p in prereqs:
                        if isinstance(p, dict) and p.get("id"):
                            collect_prereqs(int(p["id"]), depth + 1)
                except Exception:
                    pass

        def collect_following(qid, depth=0):
            if qid in visited or depth > MAX_CHAIN_DEPTH:
                return
            visited.add(qid)
            row = conn.execute(
                "SELECT id, name, level_req, next_quest_id FROM quests WHERE id = ?",
                (qid,),
            ).fetchone()
            if not row:
                return
            q = dict(row)
            if q["id"] != quest_id:  # avoid duplicating the starting quest
                chain.append({"id": q["id"], "name": q["name"], "level_req": q["level_req"]})

            # Go forward (next_quest)
            if q.get("next_quest_id"):
                collect_following(q["next_quest_id"], depth + 1)

            # Also find quests that have this as prerequisite
            followers = conn.execute(
                "SELECT id FROM quests WHERE prerequisite_quests LIKE ? OR next_quest_id = ?",
                (f'%"id":{qid}%', qid),
            ).fetchall()
            for f in followers:
                collect_following(f["id"], depth + 1)

        collect_prereqs(quest_id)
        collect_following(quest_id)

        # Sort by level_req
        chain.sort(key=lambda x: (x["level_req"] or 0, x["id"]))

    finally:
        conn.close()

    return {"chain": chain, "quest_id": quest_id}
