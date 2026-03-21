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
    """Extract individual skills from content.

    블로그 포스트의 두 가지 형식을 지원:
    1) 한 줄 형식: ■ 스킬이름 (마스터 레벨: 20)
    2) 여러 줄 형식 (티스토리):
       스킬이름
       마스터 레벨:
       20
       타입:
       패시브
       스킬 설명:
       설명 텍스트
       레벨 1:
       효과 텍스트
    """
    # 먼저 여러 줄 형식 시도
    skills = _parse_multiline_format(content, job_class, job_branch, url)
    if skills:
        return skills

    # 한 줄 형식 폴백
    return _parse_inline_format(content, job_class, job_branch, url)


def _parse_multiline_format(
    content: str, job_class: str, job_branch: str | None, url: str
) -> list[dict]:
    """여러 줄 키-값 형식 파싱 (티스토리 블로그).

    '마스터 레벨:' 키워드를 기준으로 스킬 블록을 감지한다.
    스킬 이름은 '마스터 레벨:' 직전의 비어있지 않은 줄.
    """
    skills: list[dict] = []
    lines = content.split('\n')

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # '마스터 레벨:' 키워드를 찾으면 스킬 블록 시작
        if re.match(r'^마스터\s*레벨\s*[:：]?\s*$', line):
            # 스킬 이름 = 직전 비어있지 않은 줄
            skill_name = None
            for j in range(i - 1, max(i - 5, -1), -1):
                prev = lines[j].strip()
                if prev and not re.match(r'^(1차|2차|3차|4차|전사|마법사|궁수|도적|해적)', prev):
                    skill_name = prev
                    break

            if not skill_name:
                i += 1
                continue

            # 마스터 레벨 값 (다음 줄)
            master_level = None
            if i + 1 < len(lines):
                ml_match = re.match(r'^\s*(\d+)\s*$', lines[i + 1].strip())
                if ml_match:
                    master_level = int(ml_match.group(1))
                    i += 2
                else:
                    i += 1
            else:
                i += 1

            # 나머지 키-값 쌍 수집
            skill_type = "active"
            description = ""
            level_data: list[dict] = []
            pending_key = None

            while i < len(lines):
                cur = lines[i].strip()

                # 다음 스킬 블록 시작이면 중단
                if re.match(r'^마스터\s*레벨\s*[:：]?\s*$', cur):
                    break

                # 차수 헤더(1차 해적 등)가 나오면 중단
                if re.match(r'^[1-4]차\s+', cur):
                    # job_branch를 업데이트
                    branch_m = re.match(r'^([1-4])차', cur)
                    if branch_m:
                        job_branch = f"{branch_m.group(1)}차"
                    break

                if cur == '':
                    i += 1
                    continue

                # 키 감지
                if re.match(r'^타입\s*[:：]?\s*$', cur):
                    pending_key = "type"
                    i += 1
                    continue
                elif re.match(r'^스킬\s*설명\s*[:：]?\s*$', cur):
                    pending_key = "desc"
                    i += 1
                    continue

                # 레벨 데이터: "레벨 N:" 키
                level_key = re.match(r'^레벨\s*(\d+)\s*[:：]?\s*$', cur)
                if level_key:
                    pending_key = ("level", int(level_key.group(1)))
                    i += 1
                    continue

                # 값 처리
                if pending_key == "type":
                    if "패시브" in cur or "passive" in cur.lower():
                        skill_type = "passive"
                    pending_key = None
                elif pending_key == "desc":
                    description = cur
                    pending_key = None
                elif isinstance(pending_key, tuple) and pending_key[0] == "level":
                    level_data.append({"level": pending_key[1], "effect": cur})
                    pending_key = None
                else:
                    # 인라인 "레벨 N: 효과" 형식도 처리
                    inline_level = re.match(r'^레벨\s*(\d+)\s*[:：]\s*(.+)', cur)
                    if inline_level:
                        level_data.append({
                            "level": int(inline_level.group(1)),
                            "effect": inline_level.group(2).strip(),
                        })
                    # 알 수 없는 줄 — 스킵

                i += 1

            skill = {
                "job_class": job_class,
                "job_branch": job_branch,
                "skill_name": skill_name,
                "master_level": master_level,
                "skill_type": skill_type,
                "description": description,
                "source_post_url": url,
            }
            if level_data:
                skill["level_data"] = json.dumps(level_data, ensure_ascii=False)
            skills.append(skill)
        else:
            # 차수 헤더에서 job_branch 업데이트
            branch_m = re.match(r'^([1-4])차', line)
            if branch_m:
                job_branch = f"{branch_m.group(1)}차"
            i += 1

    return skills


def _parse_inline_format(
    content: str, job_class: str, job_branch: str | None, url: str
) -> list[dict]:
    """한 줄 형식 파싱: ■ 스킬이름 (마스터 레벨: 20)"""
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
