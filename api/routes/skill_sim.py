"""스킬 시뮬레이터 API — sim_jobs / sim_skills 레퍼런스 테이블 기반.

데이터 적재: scripts/import_skill_sim.py (mapleland.st WZ 추출 데이터, 로컬 v83 WZ 교차검증)
"""
import json

from fastapi import APIRouter, HTTPException, Query

from crawler.db import get_connection

router = APIRouter()


def _table_exists(conn, name: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone() is not None


@router.get("/skill-sim/classes")
def sim_classes():
    """직업 계열 목록 (진영별)."""
    conn = get_connection()
    try:
        if not _table_exists(conn, "sim_jobs"):
            raise HTTPException(status_code=503, detail="스킬 시뮬레이터 데이터가 아직 준비되지 않았습니다")
        rows = conn.execute(
            """SELECT faction, job_class, COUNT(*) AS job_count
               FROM sim_jobs WHERE job_class != '초보자'
               GROUP BY faction, job_class"""
        ).fetchall()
        return {"classes": [dict(r) for r in rows]}
    finally:
        conn.close()


@router.get("/skill-sim/data")
def sim_data(
    job_class: str = Query(..., description="직업 계열 (전사/마법사/궁수/도적/해적)"),
    faction: str = Query(default="adventurer"),
):
    """해당 계열의 전체 직업 트리 + 스킬 데이터."""
    if faction not in {"adventurer", "cygnus"}:
        raise HTTPException(status_code=400, detail="faction은 adventurer 또는 cygnus여야 합니다")
    conn = get_connection()
    try:
        if not _table_exists(conn, "sim_skills"):
            raise HTTPException(status_code=503, detail="스킬 시뮬레이터 데이터가 아직 준비되지 않았습니다")
        jobs = conn.execute(
            """SELECT id, name_ko, name_en, job_class, faction, branch, parent_id
               FROM sim_jobs WHERE job_class = ? AND faction = ? ORDER BY branch, id""",
            (job_class, faction),
        ).fetchall()
        if not jobs:
            raise HTTPException(status_code=404, detail="해당 직업 계열을 찾을 수 없습니다")
        job_ids = [r["id"] for r in jobs]
        placeholders = ",".join("?" for _ in job_ids)
        skills = conn.execute(
            f"""SELECT id, job_id, name, description, detail_template, master_level,
                       weapons, required_skills, level_properties, icon_path
                FROM sim_skills WHERE job_id IN ({placeholders}) ORDER BY job_id, id""",
            job_ids,
        ).fetchall()

        def parse_skill(r):
            d = dict(r)
            for key in ("weapons", "required_skills", "level_properties"):
                try:
                    d[key] = json.loads(d[key]) if d[key] else ({} if key == "required_skills" else [])
                except (json.JSONDecodeError, TypeError):
                    d[key] = {} if key == "required_skills" else []
            return d

        return {
            "jobs": [dict(r) for r in jobs],
            "skills": [parse_skill(r) for r in skills],
        }
    finally:
        conn.close()
