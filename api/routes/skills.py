"""Skill routes"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import json

from crawler.db import get_connection

router = APIRouter()


@router.get("/skills/filters")
def skill_filters():
    try:
        conn = get_connection()
    except Exception:
        return {"job_classes": [], "job_branches": [], "skill_types": []}
    try:
        jobs = conn.execute(
            "SELECT DISTINCT job_class FROM skills WHERE job_class IS NOT NULL ORDER BY job_class"
        ).fetchall()
        branches = conn.execute(
            "SELECT DISTINCT job_branch FROM skills WHERE job_branch IS NOT NULL ORDER BY job_branch"
        ).fetchall()
        types = conn.execute(
            "SELECT DISTINCT skill_type FROM skills WHERE skill_type IS NOT NULL ORDER BY skill_type"
        ).fetchall()
        return {
            "job_classes": [r["job_class"] for r in jobs],
            "job_branches": [r["job_branch"] for r in branches],
            "skill_types": [r["skill_type"] for r in types],
        }
    finally:
        conn.close()


@router.get("/skills")
def list_skills(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    job_class: Optional[str] = Query(default=None),
    job_branch: Optional[str] = Query(default=None),
    skill_type: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
):
    offset = (page - 1) * per_page
    conditions = []
    params: list = []

    if job_class:
        conditions.append("job_class = ?")
        params.append(job_class)
    if job_branch:
        conditions.append("job_branch = ?")
        params.append(job_branch)
    if skill_type:
        conditions.append("skill_type = ?")
        params.append(skill_type)
    if q:
        conditions.append("skill_name LIKE ?")
        params.append(f"%{q}%")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    try:
        conn = get_connection()
    except Exception:
        return {"skills": [], "total": 0, "page": page, "per_page": per_page}

    try:
        total = conn.execute(f"SELECT COUNT(*) FROM skills {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM skills {where} ORDER BY job_class, job_branch, skill_name LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        results = [dict(r) for r in rows]
    except Exception:
        results = []
        total = 0
    finally:
        conn.close()

    return {"skills": results, "total": total, "page": page, "per_page": per_page}


@router.get("/skills/{skill_id}")
def get_skill(skill_id: int):
    try:
        conn = get_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        row = conn.execute("SELECT * FROM skills WHERE id = ?", (skill_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Skill not found")
        skill = dict(row)
        # Parse level_data JSON
        if skill.get("level_data"):
            try:
                skill["level_data_parsed"] = json.loads(skill["level_data"])
            except Exception:
                skill["level_data_parsed"] = None
    finally:
        conn.close()

    return {"skill": skill}
