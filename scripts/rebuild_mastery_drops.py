#!/usr/bin/env python3
"""maplekibun 블로그 마스터리북 드롭 글(/99)에서 mob_drops 보강.

배경: /99 (마스터리북) 원문은 blog_posts 에 저장돼 있으나, 어떤 파서도 다루지 않아
마스터리북 드롭 정보가 mob_drops 에 0건이었다. items 테이블에는 마스터리북 아이템이
영문명([Mastery Book] ...)으로 존재하고, KMS 한글명은 [마스터리북]<스킬명> <레벨> 형태다.

/99 포맷:
    전사 (공통)            <- 섹션 헤더(직업/분류), 건너뜀
    몬스터 마그넷 20 :      <- 스킬명 + 레벨 + 콜론
    네스트 골렘, 피아누스    <- 드롭 몬스터 목록(다음 줄들, 줄바꿈으로 쪼개질 수 있음)
    몬스터 마그넷 30 :
    피아누스
레벨 10 은 '4차 전직'/'<퀘스트>'로 획득(드롭 아님)이고 마스터리북 아이템도 20/30 만 존재.

스킬명+레벨 -> [마스터리북]<스킬명> <레벨> (공백무시) 로 item_id 매칭, 몬스터명은 mob 캐시로 매칭.
드롭률은 /99 에 없으므로 NULL 로 저장(어떤 몬스터가 드롭하는지 자체가 신규 정보).

사용:
  python3 scripts/rebuild_mastery_drops.py            # dry-run
  python3 scripts/rebuild_mastery_drops.py --apply
"""
from __future__ import annotations

import argparse
import re
import sqlite3
from collections import Counter
from pathlib import Path

from rebuild_drops_from_blog import (
    build_name_cache,
    augment_mob_cache,
    make_nospace_index,
    find_id,
)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "maple.db"
MASTERY_URL = "https://maplekibun.tistory.com/99"

# 스킬 + 레벨 + 콜론. "몬스터 마그넷 20 :", "블래스트20 :" 모두 처리. 콜론 뒤 인라인 값(g3)도 캡처.
SKILL_RE = re.compile(r"^(.+?)\s*(\d+)\s*[:：]\s*(.*)$")
FOOTER_RE = re.compile(r"(공유하기|게시글 관리|댓글을 달아|TistoryWhaleSkin|아이템/드롭 관련 글|글 더보기)")
# 드롭이 아닌 값 토큰
NON_DROP = ("4차 전직", "4차전직")

# 섹션 헤더 경계 판정용 키워드 (줄바꿈으로 쪼개진 헤더도 잡기 위해 토큰 기반).
_JOB = {"스토리북", "전직업", "전사", "마법사", "궁수", "도적", "해적"}
_SUB = {"공통", "드롭률", "히어로", "팔라딘", "다크나이트", "아크메이지", "비숍",
        "신궁", "보우마스터", "나이트로드", "섀도어", "바이퍼", "캡틴",
        "썬", "콜", "불", "독"}

# 블로그 스킬명 -> KMS 마스터리북 스킬명 (개명)
_SKILL_ALIAS = {"브랜디쉬": "브레이브 슬래시"}
# 몬스터명 접두어 제거 (왼/오 = 좌우 파츠 표기)
_MOB_PREFIX_RE = re.compile(r"^[\(（]?\s*(왼|오|좌|우)\s*[\)）]?\s*")


def is_section_boundary(line: str) -> bool:
    s = line.strip()
    if not s or ":" in s or "：" in s:
        return False
    if s[0] in "(（":
        return True
    tokens = [t for t in re.split(r"[\s,，.·()（）]+", s) if t]
    if not tokens:
        return False
    if tokens[0] in _JOB:
        return True
    # 모든 토큰이 직업/직업분류 키워드면 헤더(예: "썬,콜 아크메이지", "아크메이지")
    if all(t in _JOB or t in _SUB for t in tokens) and any(t in _SUB for t in tokens):
        return True
    return False


def build_mastery_item_cache(conn: sqlite3.Connection) -> dict[str, int]:
    """[마스터리북]<스킬명> <레벨> KMS명 -> item_id. 키는 '[마스터리북]' 제거 + 공백제거."""
    cache: dict[str, int] = {}
    rows = conn.execute(
        "SELECT entity_id, name_en FROM entity_names_en "
        "WHERE entity_type='item' AND source='kms' AND name_en LIKE '[마스터리북]%'"
    ).fetchall()
    for r in rows:
        name = r[1]
        key = name.replace("[마스터리북]", "").replace(" ", "")
        cache.setdefault(key, (r[0], name))
    return cache


def find_mastery_item(skill: str, level: str, cache: dict):
    skill = _SKILL_ALIAS.get(skill, skill)
    key = (skill + level).replace(" ", "")
    return cache.get(key)


def split_mob_names(value_lines: list[str]) -> list[str]:
    """값 줄들을 합쳐(줄바꿈으로 쪼개진 이름 복원) 콤마로 분리."""
    joined = " ".join(v.strip() for v in value_lines if v.strip())
    joined = re.sub(r"\s+", " ", joined)
    parts = re.split(r"[,，、]\s*", joined)
    return [p.strip() for p in parts if p.strip()]


def parse_mastery(content: str, mob_cache, mob_nospace, item_cache):
    lines = [l.strip() for l in content.split("\n")]
    drops: list[tuple[int, int, str, str]] = []  # (mob_id, item_id, item_name, mob_name)
    stats = {
        "skill_blocks": 0,
        "matched_items": 0,
        "unmatched_skill": Counter(),
        "drops": 0,
        "unmatched_mob": Counter(),
        "skipped_quest_or_4th": 0,
    }

    pending: dict | None = None  # {skill, level, item, value:[...]}

    def flush():
        if not pending or pending["item"] is None:
            return
        item_id, item_name = pending["item"]
        mobs = split_mob_names(pending["value"])
        for mn in mobs:
            if any(tok in mn for tok in NON_DROP) or "<" in mn or ">" in mn:
                stats["skipped_quest_or_4th"] += 1
                continue
            mn = _MOB_PREFIX_RE.sub("", mn).strip()
            mid = find_id(mn, mob_cache, mob_nospace)
            if mid is None:
                if len(mn) > 1:
                    stats["unmatched_mob"][mn] += 1
                continue
            drops.append((mid, item_id, item_name, mn))
            stats["drops"] += 1

    started = False
    for line in lines:
        if not line:
            continue
        if FOOTER_RE.search(line):
            break
        if is_section_boundary(line):
            started = True
            flush()
            pending = None
            continue
        if not started:
            continue  # 제목/머리말 영역
        m = SKILL_RE.match(line)
        if m:
            flush()
            skill, level, inline = m.group(1).strip(), m.group(2), m.group(3).strip()
            stats["skill_blocks"] += 1
            item = find_mastery_item(skill, level, item_cache)
            if item is None:
                # 레벨 10 등은 아이템이 없을 수 있음(정상). 20/30만 카운트.
                if level in ("20", "30"):
                    stats["unmatched_skill"][f"{skill} {level}"] += 1
                pending = {"skill": skill, "level": level, "item": None, "value": []}
            else:
                stats["matched_items"] += 1
                pending = {"skill": skill, "level": level, "item": item,
                           "value": [inline] if inline else []}
            continue
        # 레벨 없는 콜론 줄("용사의 의지 :" 등 퀘스트/무레벨 스킬)도 블록 경계로 처리.
        # (몬스터 목록 줄에는 콜론이 없으므로, 콜론이 있으면 새 헤더로 간주해 현재 블록 종료)
        if ":" in line or "：" in line:
            flush()
            pending = None
            continue
        # 값(몬스터 목록) 줄
        if pending is not None:
            pending["value"].append(line)
    flush()
    return drops, stats


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    row = conn.execute("SELECT content FROM blog_posts WHERE url=?", (MASTERY_URL,)).fetchone()
    if not row or not row["content"]:
        print(f"[ERROR] {MASTERY_URL} 본문 없음")
        return 1

    mob_cache = build_name_cache(conn, "mob", "mobs")
    augment_mob_cache(mob_cache)
    mob_nospace = make_nospace_index(mob_cache)
    item_cache = build_mastery_item_cache(conn)

    drops, stats = parse_mastery(row["content"], mob_cache, mob_nospace, item_cache)
    distinct_books = len({d[1] for d in drops})
    distinct_mobs = len({d[0] for d in drops})

    print("=" * 60)
    print(f"스킬 블록 수            : {stats['skill_blocks']}")
    print(f"아이템 매칭 성공 스킬    : {stats['matched_items']}")
    print(f"드롭(몬스터-마스터리북)   : {stats['drops']}  (책 {distinct_books}종 / 몹 {distinct_mobs})")
    print(f"퀘스트/4차전직 스킵      : {stats['skipped_quest_or_4th']}")
    print("=" * 60)
    print("\n[아이템 미매칭 스킬(20/30) 상위 15]")
    for name, cnt in stats["unmatched_skill"].most_common(15):
        print(f"  {cnt:3d}  {name}")
    print("\n[몬스터 미매칭 상위 15]")
    for name, cnt in stats["unmatched_mob"].most_common(15):
        print(f"  {cnt:3d}  {name}")

    if not args.apply:
        print("\n(dry-run)")
        conn.close()
        return 0

    applied = 0
    for mob_id, item_id, item_name, _mn in drops:
        conn.execute(
            """
            INSERT INTO mob_drops (mob_id, item_id, item_name, drop_rate)
            VALUES (?, ?, ?, NULL)
            ON CONFLICT(mob_id, item_id) DO UPDATE SET item_name=excluded.item_name
            """,
            (mob_id, item_id, item_name),
        )
        applied += 1
    conn.commit()
    book_rows = conn.execute(
        "SELECT COUNT(*) FROM mob_drops WHERE item_id BETWEEN 2290000 AND 2299999"
    ).fetchone()[0]
    print(f"\n[APPLIED] upsert {applied}건 / 마스터리북 드롭 행 총 {book_rows}건")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
