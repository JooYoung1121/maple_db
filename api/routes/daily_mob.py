"""오늘의 몬스터 — 매일 바뀌는 몬스터 추리 게임 (Wordle 계열).

- 정답 몬스터는 KST 날짜 기반 해시로 결정적 선정 (서버만 정답을 앎)
- 추측 시 레벨/HP/EXP 높낮이, 보스·언데드 여부, 서식 지역 일치를 힌트로 반환
- 풀: 메이플랜드 레퍼런스 몹 (id<9000000, 숨김 제외, 한글명 존재)
"""
import hashlib
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from crawler.db import get_connection

router = APIRouter()

KST = timezone(timedelta(hours=9))
EPOCH = "2026-07-10"  # 1번째 퍼즐 날짜

# 맵 ID 접두어 → 지역명 (v1.2.x 기준 대분류)
REGION_RANGES = [
    (0, 99_999_999, "메이플 아일랜드"),
    (100_000_000, 104_999_999, "빅토리아 아일랜드"),
    (105_000_000, 105_999_999, "슬리피우드"),
    (106_000_000, 199_999_999, "빅토리아 아일랜드"),
    (200_000_000, 209_999_999, "오르비스"),
    (210_000_000, 219_999_999, "엘나스"),
    (220_000_000, 220_999_999, "루디브리엄"),
    (221_000_000, 221_999_999, "오메가섹터"),
    (222_000_000, 229_999_999, "루디브리엄"),
    (230_000_000, 239_999_999, "아쿠아로드"),
    (240_000_000, 249_999_999, "리프레"),
    (250_000_000, 259_999_999, "무릉도원"),
    (260_000_000, 260_999_999, "니할사막"),
    (261_000_000, 269_999_999, "마가티아"),
    (270_000_000, 271_999_999, "시간의 신전"),
    (600_000_000, 699_999_999, "마스테리아"),
    (800_000_000, 809_999_999, "지팡구"),
    (900_000_000, 999_999_999, "히든스트리트"),
]


def region_of_map(map_id: int) -> str:
    for lo, hi, name in REGION_RANGES:
        if lo <= map_id <= hi:
            return name
    return "기타"


def clean_name(s: str | None) -> str | None:
    """현대 KMS 표기 접두어 제거: '[★] 버푼' → '버푼'"""
    if not s:
        return None
    cleaned = re.sub(r"\[[^\]]*\]\s*", "", s).strip()
    return cleaned or None


def kst_today() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


def puzzle_no(date_str: str) -> int:
    d = datetime.strptime(date_str, "%Y-%m-%d") - datetime.strptime(EPOCH, "%Y-%m-%d")
    return d.days + 1


def ensure_tables(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS daily_mob_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            puzzle_date TEXT NOT NULL,
            attempts INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    """)
    conn.commit()


def load_pool(conn) -> list[dict]:
    """출제 가능한 몹 풀 (한글명 정리 + 지역 계산). 이름 중복은 첫 번째만."""
    from api.routes.mapleland_reference import id_filter_sql

    mob_filter = id_filter_sql("m.id", "mobs")
    mob_where = f"AND {mob_filter}" if mob_filter else ""
    rows = conn.execute(
        f"""SELECT m.id, en.name_en AS name_kr, m.level, m.hp, m.exp,
                   COALESCE(m.is_boss,0) AS is_boss, COALESCE(m.is_undead,0) AS is_undead
            FROM mobs m
            JOIN entity_names_en en
              ON en.entity_type='mob' AND en.entity_id=m.id AND en.source='kms'
            WHERE m.id < 9000000
              AND COALESCE(m.is_hidden, 0) = 0
              AND m.level > 0
              {mob_where}
            ORDER BY m.id"""
    ).fetchall()

    spawns: dict[int, list[int]] = {}
    for r in conn.execute("SELECT mob_id, map_id FROM mob_spawns").fetchall():
        spawns.setdefault(r["mob_id"], []).append(r["map_id"])

    pool = []
    seen_names = set()
    for r in rows:
        name = clean_name(r["name_kr"])
        if not name or name == "스트링 없음" or name in seen_names:
            continue
        seen_names.add(name)
        regions: dict[str, int] = {}
        for mid in spawns.get(r["id"], []):
            reg = region_of_map(mid)
            regions[reg] = regions.get(reg, 0) + 1
        region_list = sorted(regions, key=lambda k: -regions[k]) or ["불명"]
        pool.append({
            "id": r["id"],
            "name": name,
            "level": r["level"],
            "hp": r["hp"] or 0,
            "exp": r["exp"] or 0,
            "is_boss": int(r["is_boss"]),
            "is_undead": int(r["is_undead"]),
            "regions": region_list,
        })
    return pool


def pick_answer(pool: list[dict], date_str: str) -> dict:
    seed = int(hashlib.sha256(f"maple-daily-mob-{date_str}".encode()).hexdigest(), 16)
    return pool[seed % len(pool)]


def _num_feedback(guess: int, answer: int, close_abs: int | None = None, close_ratio: float | None = None):
    if guess == answer:
        return {"dir": "match", "close": True}
    close = False
    if close_abs is not None:
        close = abs(guess - answer) <= close_abs
    elif close_ratio is not None and answer > 0:
        close = abs(guess - answer) / answer <= close_ratio
    return {"dir": "up" if answer > guess else "down", "close": close}


@router.get("/daily-mob")
def daily_mob_meta():
    """오늘 퍼즐 메타 + 자동완성용 이름 풀 + 통계 (정답은 노출하지 않음)."""
    conn = get_connection()
    try:
        ensure_tables(conn)
        pool = load_pool(conn)
        if not pool:
            raise HTTPException(status_code=503, detail="출제 가능한 몬스터가 없습니다")
        date_str = kst_today()
        stats = conn.execute(
            "SELECT COUNT(*) AS solvers, ROUND(AVG(attempts),1) AS avg_attempts "
            "FROM daily_mob_results WHERE puzzle_date=?",
            (date_str,),
        ).fetchone()
        return {
            "date": date_str,
            "puzzle_no": puzzle_no(date_str),
            "pool": [{"id": p["id"], "name": p["name"]} for p in pool],
            "stats": {"solvers": stats["solvers"], "avg_attempts": stats["avg_attempts"]},
        }
    finally:
        conn.close()


class GuessPayload(BaseModel):
    name: str


@router.post("/daily-mob/guess")
def daily_mob_guess(payload: GuessPayload):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="이름을 입력해주세요")
    conn = get_connection()
    try:
        pool = load_pool(conn)
    finally:
        conn.close()
    if not pool:
        raise HTTPException(status_code=503, detail="출제 가능한 몬스터가 없습니다")

    date_str = kst_today()
    answer = pick_answer(pool, date_str)
    norm = name.replace(" ", "").lower()
    guess = next((p for p in pool if p["name"].replace(" ", "").lower() == norm), None)
    if not guess:
        raise HTTPException(status_code=404, detail="몬스터 목록에 없는 이름입니다")

    correct = guess["id"] == answer["id"]
    guess_regions = set(guess["regions"])
    answer_regions = set(answer["regions"])
    if guess["regions"][0] == answer["regions"][0]:
        region_fb = "match"
    elif guess_regions & answer_regions:
        region_fb = "partial"
    else:
        region_fb = "none"

    result = {
        "date": date_str,
        "correct": correct,
        "guess": {
            "id": guess["id"],
            "name": guess["name"],
            "icon_url": f"https://maplestory.io/api/gms/92/mob/{guess['id']}/icon",
            "level": guess["level"],
            "hp": guess["hp"],
            "exp": guess["exp"],
            "is_boss": guess["is_boss"],
            "is_undead": guess["is_undead"],
            "region": guess["regions"][0],
        },
        "feedback": {
            "level": _num_feedback(guess["level"], answer["level"], close_abs=5),
            "hp": _num_feedback(guess["hp"], answer["hp"], close_ratio=0.25),
            "exp": _num_feedback(guess["exp"], answer["exp"], close_ratio=0.25),
            "is_boss": guess["is_boss"] == answer["is_boss"],
            "is_undead": guess["is_undead"] == answer["is_undead"],
            "region": region_fb,
        },
    }
    if correct:
        result["answer"] = {
            "id": answer["id"],
            "name": answer["name"],
            "icon_url": f"https://maplestory.io/api/gms/92/mob/{answer['id']}/icon",
        }
    return result


class SolvePayload(BaseModel):
    attempts: int


@router.post("/daily-mob/solve")
def daily_mob_solve(payload: SolvePayload):
    """정답 기록 (통계용). 클라이언트가 정답 직후 1회 호출."""
    if not (1 <= payload.attempts <= 100):
        raise HTTPException(status_code=400, detail="시도 횟수가 올바르지 않습니다")
    conn = get_connection()
    try:
        ensure_tables(conn)
        conn.execute(
            "INSERT INTO daily_mob_results (puzzle_date, attempts) VALUES (?, ?)",
            (kst_today(), payload.attempts),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
