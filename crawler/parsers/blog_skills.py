from __future__ import annotations
"""블로그 스킬 포스트에서 직업별 스킬 데이터 추출"""
import json
import re
import sqlite3


_JOB_PATTERNS = {
    "전사": re.compile(r'전사|히어로|팔라딘|다크나이트|소울마스터|페이지|파이터|스피어맨|크루세이더|나이트'),
    "마법사": re.compile(r'마법사|아크메이지|비숍|불독|썬콜|메이지|위자드|클레릭|프리스트'),
    "궁수": re.compile(r'궁수|보우마스터|신궁|레인저|저격수|사수|아처|헌터|크로스보우'),
    "도적": re.compile(r'도적|나이트로드|섀도어|어쌔신|시프|허밋|마스터시프|듀얼'),
    "해적": re.compile(r'해적|바이퍼|캡틴|버카니어|발키리|인파이터|건슬링어|캐논'),
}


def parse_blog_skills(conn: sqlite3.Connection) -> dict:
    """blog_posts에서 스킬 포스트를 파싱하여 skills 테이블에 저장."""
    stats = {"skills_added": 0, "posts_parsed": 0}

    rows = conn.execute(
        """SELECT id, title, url, content FROM blog_posts
           WHERE content IS NOT NULL
           AND (title LIKE '%스킬%' OR title LIKE '%skill%' OR category LIKE '%스킬%')"""
    ).fetchall()

    for row in rows:
        content = row["content"]
        title = row["title"] or ""
        url = row["url"] or ""

        job_class = _detect_job_class(title)
        if not job_class:
            job_class = _detect_job_class(content[:500])
        if not job_class:
            continue

        job_branch = _detect_job_branch(title, content[:500])
        skills = _parse_skills_from_content(content, job_class, job_branch, url)

        for skill in skills:
            try:
                conn.execute(
                    """INSERT OR REPLACE INTO skills
                       (job_class, job_branch, skill_name, master_level, skill_type, description, level_data, source_post_url)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        skill["job_class"],
                        skill.get("job_branch"),
                        skill["skill_name"],
                        skill.get("master_level"),
                        skill.get("skill_type"),
                        skill.get("description"),
                        skill.get("level_data"),
                        skill.get("source_post_url"),
                    ),
                )
                stats["skills_added"] += 1
            except Exception:
                pass

        conn.commit()
        stats["posts_parsed"] += 1

    return stats


def _detect_job_class(text: str) -> str | None:
    for job, pattern in _JOB_PATTERNS.items():
        if pattern.search(text):
            return job
    return None


def _detect_job_branch(title: str, content_start: str) -> str | None:
    """Detect job branch (1차, 2차, 3차, 4차)."""
    text = title + " " + content_start
    branch_match = re.search(r'([1-4])\s*차', text)
    if branch_match:
        return f"{branch_match.group(1)}차"
    return None


def _parse_skills_from_content(
    content: str, job_class: str, job_branch: str | None, url: str
) -> list[dict]:
    """Extract individual skills from content."""
    skills = []
    lines = content.split('\n')

    current_skill = None
    level_data_lines: list[dict] = []

    for line in lines:
        line = line.strip()
        if not line:
            if current_skill:
                if level_data_lines:
                    current_skill["level_data"] = json.dumps(
                        level_data_lines, ensure_ascii=False
                    )
                skills.append(current_skill)
                current_skill = None
                level_data_lines = []
            continue

        skill_match = re.match(
            r'^[■◆●▶★☆\-\*]*\s*(.+?)\s*[\(（\[]\s*(?:마스터\s*(?:레벨)?|MAX|max)\s*[:\s]*(\d+)\s*[\)）\]]',
            line,
        )
        if skill_match:
            if current_skill:
                if level_data_lines:
                    current_skill["level_data"] = json.dumps(
                        level_data_lines, ensure_ascii=False
                    )
                skills.append(current_skill)
                level_data_lines = []

            skill_name = skill_match.group(1).strip()
            master_level = int(skill_match.group(2))

            skill_type = "active"
            passive_keywords = ["패시브", "passive", "지속"]
            if any(kw in line.lower() for kw in passive_keywords):
                skill_type = "passive"

            current_skill = {
                "job_class": job_class,
                "job_branch": job_branch,
                "skill_name": skill_name,
                "master_level": master_level,
                "skill_type": skill_type,
                "description": "",
                "source_post_url": url,
            }
            continue

        if current_skill:
            level_match = re.match(
                r'^(?:Lv\.?|레벨)\s*(\d+)\s*[:：]\s*(.+)', line
            )
            if level_match:
                level_data_lines.append(
                    {"level": int(level_match.group(1)), "effect": level_match.group(2).strip()}
                )
            elif not current_skill["description"]:
                current_skill["description"] = line

    if current_skill:
        if level_data_lines:
            current_skill["level_data"] = json.dumps(level_data_lines, ensure_ascii=False)
        skills.append(current_skill)

    return skills
