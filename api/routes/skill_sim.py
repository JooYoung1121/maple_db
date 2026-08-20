"""스킬 시뮬레이터 API — sim_jobs / sim_skills 레퍼런스 테이블 기반.

데이터 적재: scripts/import_skill_sim.py (mapleland.st WZ 추출 데이터, 로컬 v83 WZ 교차검증)
"""
import json

from fastapi import APIRouter, HTTPException, Query

from crawler.config import DATA_DIR
from crawler.db import get_connection

router = APIRouter()


def _table_exists(conn, name: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone() is not None


def _ensure_data(conn) -> bool:
    """sim 테이블 존재 보장. 없거나 비어 있으면 JSON 번들에서 자가 복구.

    배포 환경의 볼륨 DB는 start.sh 시드 동기화로 채워지지만, 동기화가 누락돼도
    data/skill_sim_data.json(이미지에 포함)으로 즉시 복구되도록 이중화한다.
    """
    if (
        _table_exists(conn, "sim_jobs")
        and _table_exists(conn, "sim_skills")
        and conn.execute("SELECT COUNT(*) FROM sim_skills").fetchone()[0] > 0
    ):
        return True
    bundle = DATA_DIR / "skill_sim_data.json"
    if not bundle.exists():
        return False
    try:
        data = json.loads(bundle.read_text(encoding="utf-8"))
        conn.executescript("""
            DROP TABLE IF EXISTS sim_jobs;
            DROP TABLE IF EXISTS sim_skills;
            CREATE TABLE sim_jobs (
                id INTEGER PRIMARY KEY,
                name_ko TEXT NOT NULL,
                name_en TEXT,
                job_class TEXT NOT NULL,
                faction TEXT NOT NULL,
                branch INTEGER NOT NULL,
                parent_id INTEGER
            );
            CREATE TABLE sim_skills (
                id INTEGER PRIMARY KEY,
                job_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                detail_template TEXT,
                master_level INTEGER NOT NULL,
                weapons TEXT,
                required_skills TEXT,
                level_properties TEXT,
                icon_path TEXT,
                source_url TEXT,
                FOREIGN KEY (job_id) REFERENCES sim_jobs(id)
            );
        """)
        conn.executemany("INSERT INTO sim_jobs VALUES (?,?,?,?,?,?,?)", data["jobs"])
        conn.executemany("INSERT INTO sim_skills VALUES (?,?,?,?,?,?,?,?,?,?,?)", data["skills"])
        conn.commit()
        print(f"[skill-sim] JSON 번들에서 자가 복구 — 스킬 {len(data['skills'])}개")
        return True
    except Exception as e:
        print(f"[skill-sim] 자가 복구 실패: {e}")
        return False


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
        if not _ensure_data(conn):
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
