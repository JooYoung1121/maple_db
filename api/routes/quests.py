"""Quest routes — rebuilt for excel-based quest data"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import json
import logging

from crawler.db import get_connection

router = APIRouter()
logger = logging.getLogger(__name__)

# 목록 API에서 반환할 컬럼
_LIST_COLUMNS = (
    "id, name, level_req, area, start_location, quest_conditions, "
    "exp_reward, meso_reward, item_reward, extra_reward, note, tip, "
    "difficulty, is_chain, chain_parent, quest_type, is_mapleland"
)


@router.get("/quests")
def list_quests(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    level_min: Optional[int] = Query(default=None, ge=0),
    level_max: Optional[int] = Query(default=None, ge=0),
    q: Optional[str] = Query(default=None, max_length=100),
    area: Optional[str] = Query(default=None, max_length=50),
    quest_type: Optional[str] = Query(default=None, max_length=50),
    difficulty: Optional[str] = Query(default=None, max_length=20),
    has_rewards: Optional[int] = Query(default=None),
    sort: Optional[str] = Query(default=None, max_length=20),
):
    offset = (page - 1) * per_page
    conditions: list[str] = []
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
    if area:
        conditions.append("area = ?")
        params.append(area)
    if quest_type:
        conditions.append("quest_type = ?")
        params.append(quest_type)
    if difficulty:
        conditions.append("difficulty = ?")
        params.append(difficulty)
    if has_rewards is not None and has_rewards == 1:
        conditions.append("(exp_reward > 0 OR meso_reward > 0 OR item_reward IS NOT NULL)")

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

        results = []
        for row in rows:
            quest = dict(row)
            # Parse JSON fields
            if quest.get("quest_conditions"):
                try:
                    quest["quest_conditions"] = json.loads(quest["quest_conditions"])
                except Exception:
                    pass
            # Strip whitespace from name
            if quest.get("name"):
                quest["name"] = quest["name"].strip()
            results.append(quest)

    except Exception as e:
        logger.warning("list_quests error: %s", e)
        results = []
        total = 0
    finally:
        conn.close()

    return {"quests": results, "total": total, "page": page, "per_page": per_page}


@router.get("/quests/categories")
def get_quest_categories():
    """지역, 퀘스트 유형, 난이도 목록 반환"""
    try:
        conn = get_connection()
    except Exception:
        return {"areas": [], "quest_types": [], "difficulties": []}

    try:
        areas = [r[0] for r in conn.execute(
            "SELECT DISTINCT area FROM quests WHERE area IS NOT NULL AND area != '' ORDER BY area"
        ).fetchall()]
        quest_types = [r[0] for r in conn.execute(
            "SELECT DISTINCT quest_type FROM quests WHERE quest_type IS NOT NULL AND quest_type != '' ORDER BY quest_type"
        ).fetchall()]
        difficulties = [r[0] for r in conn.execute(
            "SELECT DISTINCT difficulty FROM quests WHERE difficulty IS NOT NULL AND difficulty != '' ORDER BY difficulty"
        ).fetchall()]
    except Exception:
        areas, quest_types, difficulties = [], [], []
    finally:
        conn.close()

    return {"areas": areas, "quest_types": quest_types, "difficulties": difficulties}


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

        # Parse JSON fields
        if quest.get("quest_conditions"):
            try:
                quest["quest_conditions"] = json.loads(quest["quest_conditions"])
            except Exception:
                pass

        # 같은 체인의 퀘스트 찾기
        chain_quests = []
        if quest.get("chain_parent"):
            # 같은 chain_parent를 가진 퀘스트들 + chain_parent 자체
            parent_name = quest["chain_parent"]
            chain_rows = conn.execute(
                "SELECT id, name, level_req FROM quests WHERE name = ? OR chain_parent = ? ORDER BY id",
                (parent_name, parent_name),
            ).fetchall()
            chain_quests = [dict(r) for r in chain_rows]
        elif quest.get("is_chain") == 0:
            # 이 퀘스트가 부모인 경우: 자식 찾기
            child_rows = conn.execute(
                "SELECT id, name, level_req FROM quests WHERE chain_parent = ? ORDER BY id",
                (quest["name"],),
            ).fetchall()
            if child_rows:
                chain_quests = [{"id": quest["id"], "name": quest["name"], "level_req": quest["level_req"]}]
                chain_quests.extend([dict(r) for r in child_rows])

        quest["chain_quests"] = chain_quests

    finally:
        conn.close()

    return {"quest": quest}


@router.get("/quests/{quest_id}/chain")
def get_quest_chain(quest_id: int):
    """체인 퀘스트 전체 반환"""
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        row = conn.execute("SELECT name, chain_parent FROM quests WHERE id = ?", (quest_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Quest not found")

        quest_name = row["name"]
        chain_parent = row["chain_parent"]

        # 부모 이름 결정
        parent_name = chain_parent if chain_parent else quest_name

        # 부모 + 같은 체인의 모든 퀘스트
        chain_rows = conn.execute(
            "SELECT id, name, level_req FROM quests WHERE name = ? OR chain_parent = ? ORDER BY id",
            (parent_name, parent_name),
        ).fetchall()

        chain = [dict(r) for r in chain_rows]
    finally:
        conn.close()

    return {"chain": chain, "quest_id": quest_id}
