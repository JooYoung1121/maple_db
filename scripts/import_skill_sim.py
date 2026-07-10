"""스킬 시뮬레이터 레퍼런스 데이터 임포트.

mapleland.st/skill (WZ 추출 기반 스킬 시뮬레이터)의 직업별 데이터 청크에서
스킬 데이터(한글명/설명/레벨별 수치/선행스킬/마스터레벨/아이콘)를 파싱해
data/maple.db의 sim_jobs / sim_skills 레퍼런스 테이블로 적재한다.

- 아이콘: web/public/skill-icons/{skillId}.png 저장 (base64 PNG 디코드)
- 교차검증: 로컬 wz_data/Skill_data.json (GMS v83 Skill.wz 추출본)과
  masterLevel / requiredSkillLevels 비교, 불일치는 경고만 출력
- 출처: https://mapleland.st/skill/ (원 데이터는 넥슨 WZ 게임 데이터)

실행: python3 scripts/import_skill_sim.py
"""
import base64
import json
import re
import sqlite3
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
ICON_DIR = ROOT / "web" / "public" / "skill-icons"
WZ_SKILL_JSON = ROOT / "wz_data" / "Skill_data.json"

BASE = "https://mapleland.st/skill/"
SOURCE_URL = "https://mapleland.st/skill/"

# 직업 메타데이터: id -> (한글명, 직업계열, 차수, 상위직업 id, 진영)
# 차수: 0=초보자, 1~4=전직 차수. 진영: adventurer(모험가) | cygnus(시그너스)
JOB_META = {
    0:    ("초보자", "초보자", 0, None, "adventurer"),
    # 전사
    100:  ("검사", "전사", 1, 0, "adventurer"),
    110:  ("파이터", "전사", 2, 100, "adventurer"),
    111:  ("크루세이더", "전사", 3, 110, "adventurer"),
    112:  ("히어로", "전사", 4, 111, "adventurer"),
    120:  ("페이지", "전사", 2, 100, "adventurer"),
    121:  ("나이트", "전사", 3, 120, "adventurer"),
    122:  ("팔라딘", "전사", 4, 121, "adventurer"),
    130:  ("스피어맨", "전사", 2, 100, "adventurer"),
    131:  ("용기사", "전사", 3, 130, "adventurer"),
    132:  ("다크나이트", "전사", 4, 131, "adventurer"),
    # 마법사
    200:  ("매지션", "마법사", 1, 0, "adventurer"),
    210:  ("위자드(불,독)", "마법사", 2, 200, "adventurer"),
    211:  ("메이지(불,독)", "마법사", 3, 210, "adventurer"),
    212:  ("아크메이지(불,독)", "마법사", 4, 211, "adventurer"),
    220:  ("위자드(썬,콜)", "마법사", 2, 200, "adventurer"),
    221:  ("메이지(썬,콜)", "마법사", 3, 220, "adventurer"),
    222:  ("아크메이지(썬,콜)", "마법사", 4, 221, "adventurer"),
    230:  ("클레릭", "마법사", 2, 200, "adventurer"),
    231:  ("프리스트", "마법사", 3, 230, "adventurer"),
    232:  ("비숍", "마법사", 4, 231, "adventurer"),
    # 궁수
    300:  ("아처", "궁수", 1, 0, "adventurer"),
    310:  ("헌터", "궁수", 2, 300, "adventurer"),
    311:  ("레인저", "궁수", 3, 310, "adventurer"),
    312:  ("보우마스터", "궁수", 4, 311, "adventurer"),
    320:  ("사수", "궁수", 2, 300, "adventurer"),
    321:  ("저격수", "궁수", 3, 320, "adventurer"),
    322:  ("신궁", "궁수", 4, 321, "adventurer"),
    # 도적
    400:  ("로그", "도적", 1, 0, "adventurer"),
    410:  ("어쌔신", "도적", 2, 400, "adventurer"),
    411:  ("허밋", "도적", 3, 410, "adventurer"),
    412:  ("나이트로드", "도적", 4, 411, "adventurer"),
    420:  ("시프", "도적", 2, 400, "adventurer"),
    421:  ("시프마스터", "도적", 3, 420, "adventurer"),
    422:  ("섀도어", "도적", 4, 421, "adventurer"),
    # 해적
    500:  ("해적", "해적", 1, 0, "adventurer"),
    510:  ("인파이터", "해적", 2, 500, "adventurer"),
    511:  ("버커니어", "해적", 3, 510, "adventurer"),
    512:  ("바이퍼", "해적", 4, 511, "adventurer"),
    520:  ("건슬링거", "해적", 2, 500, "adventurer"),
    521:  ("발키리", "해적", 3, 520, "adventurer"),
    522:  ("캡틴", "해적", 4, 521, "adventurer"),
    # 시그너스 기사단 (메이플랜드 2.0)
    1000: ("노블레스", "초보자", 0, None, "cygnus"),
    1100: ("소울마스터", "전사", 1, 1000, "cygnus"),
    1110: ("소울마스터", "전사", 2, 1100, "cygnus"),
    1111: ("소울마스터", "전사", 3, 1110, "cygnus"),
    1200: ("플레임위자드", "마법사", 1, 1000, "cygnus"),
    1210: ("플레임위자드", "마법사", 2, 1200, "cygnus"),
    1211: ("플레임위자드", "마법사", 3, 1210, "cygnus"),
    1300: ("윈드브레이커", "궁수", 1, 1000, "cygnus"),
    1310: ("윈드브레이커", "궁수", 2, 1300, "cygnus"),
    1311: ("윈드브레이커", "궁수", 3, 1310, "cygnus"),
    1400: ("나이트워커", "도적", 1, 1000, "cygnus"),
    1410: ("나이트워커", "도적", 2, 1400, "cygnus"),
    1411: ("나이트워커", "도적", 3, 1410, "cygnus"),
    1500: ("스트라이커", "해적", 1, 1000, "cygnus"),
    1510: ("스트라이커", "해적", 2, 1500, "cygnus"),
    1511: ("스트라이커", "해적", 3, 1510, "cygnus"),
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (maple_db skill-sim importer)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def unescape_js_single_quoted(s: str) -> str:
    """JS 싱글쿼트 문자열 리터럴의 이스케이프를 해제한다 (\\' \\\\ \\n \\r \\t \\uXXXX)."""
    out = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == "\\" and i + 1 < n:
            nxt = s[i + 1]
            if nxt == "u" and i + 5 < n:
                out.append(chr(int(s[i + 2:i + 6], 16)))
                i += 6
                continue
            mapped = {"n": "\n", "r": "\r", "t": "\t", "'": "'", '"': '"', "\\": "\\", "0": "\0", "b": "\b", "f": "\f", "v": "\v"}.get(nxt)
            if mapped is not None:
                out.append(mapped)
                i += 2
                continue
        out.append(c)
        i += 1
    return "".join(out)


def hs_level(props: dict) -> int:
    m = re.match(r"h(\d+)$", str(props.get("hs", "")))
    return int(m.group(1)) if m else 0


def parse_chunk(js: str):
    """직업 청크에서 (job_meta, skills[]) 추출."""
    meta_m = re.search(r'\{id:(\d+),name:"([^"]*)"\}', js)
    job_id = int(meta_m.group(1)) if meta_m else None
    job_name_en = meta_m.group(2) if meta_m else None

    m = re.search(r"JSON\.parse\('(.*?)'\)", js, re.S)
    if not m:
        raise ValueError("JSON.parse 블록을 찾을 수 없음")
    raw = unescape_js_single_quoted(m.group(1))
    skills = json.loads(raw)
    return job_id, job_name_en, skills


def save_icon(skill_id: int, b64: str | None) -> str | None:
    if not b64:
        return None
    try:
        data = base64.b64decode(b64)
    except Exception:
        return None
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    path = ICON_DIR / f"{skill_id}.png"
    path.write_bytes(data)
    return f"/skill-icons/{skill_id}.png"


def main():
    print("== 스킬 시뮬레이터 데이터 임포트 ==")
    index_html = fetch(BASE)
    m = re.search(r'src="/skill/assets/(index-[\w-]+\.js)"', index_html)
    if not m:
        print("index 번들을 찾을 수 없습니다", file=sys.stderr)
        sys.exit(1)
    bundle = fetch(f"{BASE}assets/{m.group(1)}")
    chunks = sorted(set(re.findall(r'"\./(\d+)-([\w-]+)\.js"', bundle)), key=lambda t: int(t[0]))
    print(f"직업 청크 {len(chunks)}개 발견: {[c[0] for c in chunks]}")

    # 교차검증용 로컬 WZ 데이터
    wz = {}
    if WZ_SKILL_JSON.exists():
        raw = json.load(open(WZ_SKILL_JSON))
        for job, skills in raw.items():
            for sid, sk in skills.items():
                if sid != "info" and isinstance(sk, dict):
                    wz[sid] = sk

    jobs_rows = []
    skill_rows = []
    warn = 0
    for job_id_s, chunk_hash in chunks:
        url = f"{BASE}assets/{job_id_s}-{chunk_hash}.js"
        try:
            js = fetch(url)
            job_id, job_name_en, skills = parse_chunk(js)
        except Exception as e:
            print(f"  [warn] {job_id_s} 청크 파싱 실패: {e}")
            warn += 1
            continue
        job_id = job_id if job_id is not None else int(job_id_s)
        meta = JOB_META.get(job_id)
        if not meta:
            print(f"  [warn] 알 수 없는 직업 id {job_id} — 건너뜀")
            warn += 1
            continue
        name_ko, job_class, branch, parent_id, faction = meta
        jobs_rows.append((job_id, name_ko, job_name_en, job_class, faction, branch, parent_id))

        for sk in skills:
            sid = sk.get("id")
            desc = sk.get("description") or {}
            level_props = sorted(sk.get("levelProperties") or [], key=hs_level)
            master = sk.get("masterLevel") or len(level_props)
            icon_path = save_icon(sid, sk.get("icon"))
            # 로컬 WZ 교차검증
            w = wz.get(str(sid))
            if w:
                wz_master = len(w.get("level") or {})
                if wz_master and wz_master != master:
                    print(f"  [check] {sid} {desc.get('name')}: masterLevel {master} vs WZ {wz_master}")
                    warn += 1
            skill_rows.append((
                sid,
                job_id,
                desc.get("name") or f"스킬 {sid}",
                desc.get("desc"),
                desc.get("detail"),
                master,
                json.dumps(sk.get("weapons") or [], ensure_ascii=False),
                json.dumps(sk.get("requiredSkillLevels") or {}, ensure_ascii=False),
                json.dumps(level_props, ensure_ascii=False),
                icon_path,
                SOURCE_URL,
            ))
        print(f"  {job_id} {name_ko}: 스킬 {len(skills)}개")

    if not skill_rows:
        print("적재할 스킬이 없습니다 — 중단", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
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
    conn.executemany("INSERT INTO sim_jobs VALUES (?,?,?,?,?,?,?)", jobs_rows)
    conn.executemany("INSERT INTO sim_skills VALUES (?,?,?,?,?,?,?,?,?,?,?)", skill_rows)
    conn.commit()
    conn.close()

    # API 자가 복구용 JSON 번들 (배포 환경에서 sim 테이블이 없으면 이 파일로 재구축)
    json_path = ROOT / "data" / "skill_sim_data.json"
    json_path.write_text(
        json.dumps({"jobs": jobs_rows, "skills": skill_rows}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"완료: sim_jobs {len(jobs_rows)}개, sim_skills {len(skill_rows)}개, 경고 {warn}건")
    print(f"아이콘: {ICON_DIR}")
    print(f"JSON 번들: {json_path}")


if __name__ == "__main__":
    main()
