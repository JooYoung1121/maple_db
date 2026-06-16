#!/usr/bin/env python3
"""maplekibun 블로그 드롭률 글(/892)에서 mob_drops 재구축.

배경: blog_posts에는 maplekibun.tistory.com/892 (드롭률 통합) 원문이 저장돼 있으나,
기존 crawler/parsers/blog_drops.py 의 Format A 파서는 "몬스터 / 아이템 / NN%" 한 줄
형태만 인식해서, /892 의 "몬스터\n아이템\n드롭률%" 3줄 구조를 전혀 파싱하지 못했다.
그 결과 mob_drops 의 drop_rate 가 전부 NULL 이고 1877몹 중 301몹만 드롭이 있었다.

이 스크립트는 /892 를 last_seen_mob 알고리즘으로 파싱한다:
  - 순수 퍼센트 줄(^[\\d.]+%$) = 드롭률
  - 그 직전 줄 = 아이템명 (단, 직전 줄이 몬스터명 자신이면 메소 행이므로 스킵)
  - 가장 최근에 등장한 "알려진 몬스터명" 줄 = 해당 드롭의 몬스터

사용:
  python3 scripts/rebuild_drops_from_blog.py            # dry-run (분석만)
  python3 scripts/rebuild_drops_from_blog.py --apply    # mob_drops 에 반영
"""
from __future__ import annotations

import argparse
import re
import sqlite3
import sys
from collections import Counter
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "maple.db"
DROP_RATE_URL = "https://maplekibun.tistory.com/892"

RATE_RE = re.compile(r"^\s*([\d]+(?:\.[\d]+)?)\s*%\s*$")
FOOTER_MARKERS = ("공유하기", "게시글 관리", "카테고리의 다른 글", "댓글을 달아", "TistoryWhaleSkin")


def build_name_cache(conn: sqlite3.Connection, entity_type: str, table: str) -> dict[str, int]:
    """한국어 이름 -> ID 매핑. entity_names_en(kms) + 본 테이블 name."""
    cache: dict[str, int] = {}
    rows = conn.execute(
        "SELECT entity_id, name_en FROM entity_names_en WHERE entity_type=? AND source='kms'",
        (entity_type,),
    ).fetchall()
    for r in rows:
        name = (r[1] or "").strip()
        if name:
            cache.setdefault(name, r[0])
    rows = conn.execute(f"SELECT id, name FROM {table}").fetchall()
    for r in rows:
        name = (r[1] or "").strip()
        if name:
            cache.setdefault(name, r[0])
    return cache


_BRACKET_PREFIX_RE = re.compile(r"^\s*\[[^\]]*\]\s*")

# 블로그 몬스터명 -> DB(KMS) 명칭 별칭 (오타/표기차)
_MOB_ALIAS = {
    "모래 두더쥐": "모래 두더지",
}


def augment_mob_cache(cache: dict[str, int]) -> None:
    """KMS 보스명의 '[★] ' 등 대괄호 접두어를 제거한 별칭과 수동 별칭을 캐시에 추가.

    예) '[★] 게이트키퍼' -> '게이트키퍼' 키도 같은 id 로 매핑.
    """
    for name, mid in list(cache.items()):
        stripped = _BRACKET_PREFIX_RE.sub("", name).strip()
        if stripped and stripped != name:
            cache.setdefault(stripped, mid)
    for blog_name, db_name in _MOB_ALIAS.items():
        if db_name in cache:
            cache.setdefault(blog_name, cache[db_name])


def make_nospace_index(cache: dict[str, int]) -> dict[str, int]:
    idx: dict[str, int] = {}
    for k, v in cache.items():
        idx.setdefault(k.replace(" ", ""), v)
    return idx


def find_id(name: str, cache: dict[str, int], nospace: dict[str, int]) -> int | None:
    name = name.strip()
    if len(name) < 2:
        return None
    if name in cache:
        return cache[name]
    return nospace.get(name.replace(" ", ""))


# 구버전(블로그) 주문서 명칭 -> 신버전(KMS) 명칭 치환.
# 예) "전신 갑옷 민첩성 주문서 60%" -> "전신 갑옷 민첩 주문서 60%"
_ITEM_ALIAS_SUBS = (
    ("물리 방어력", "방어력"),
    ("물리방어력", "방어력"),
    ("민첩성", "민첩"),
    ("명중률", "명중치"),
)


def find_item_id(name: str) -> int | None:
    """아이템 ID 찾기 (정확/공백무시 매칭 실패 시 구↔신 명칭 별칭 재시도)."""
    hit = find_id(name, ITEM_CACHE, ITEM_NOSPACE)
    if hit is not None:
        return hit
    alias = name
    for old, new in _ITEM_ALIAS_SUBS:
        alias = alias.replace(old, new)
    if alias != name:
        return find_id(alias, ITEM_CACHE, ITEM_NOSPACE)
    return None


def parse_drop_rates(content: str, mob_cache: dict[str, int], mob_nospace: dict[str, int]):
    """/892 파싱. returns (drops, stats), drops = [(mob_id, mob_name, item_name, rate)].

    각 행은 몬스터명을 반복하는 구조라, 드롭률 줄을 기준으로 행 자체에서 몬스터를 읽는다:
      - 3줄 행: [몬스터명, 아이템명, 드롭률%]  -> 몬스터 = rate 2줄 전
      - 2줄 행: [몬스터명, 드롭률%] (메소/아이템 셀 공백) -> rate 1줄 전이 몬스터명
    last_mob 추적 방식과 달리 행마다 자기 몬스터로 귀속하므로 미매칭 시에도 오귀속이 없다.
    """
    lines = [l.strip() for l in content.split("\n")]
    drops: list[tuple[int, str, str, float]] = []
    stats = {
        "rate_lines": 0,
        "meso_rows": 0,
        "unmatched_mob": 0,
        "matched": 0,
        "unmatched_item": 0,
        "unmatched_mob_names": Counter(),
        "unmatched_item_names": Counter(),
    }

    stop = len(lines)
    for i, line in enumerate(lines):
        if line and any(m in line for m in FOOTER_MARKERS):
            stop = i
            break

    last_mob_id: int | None = None
    last_mob_name: str | None = None

    for i in range(stop):
        line = lines[i]
        rate_m = RATE_RE.match(line) if line else None
        if not rate_m:
            continue
        stats["rate_lines"] += 1
        rate = float(rate_m.group(1)) / 100.0

        prev = lines[i - 1] if i >= 1 else ""
        prev2 = lines[i - 2] if i >= 2 else ""

        # Case A: 메소/공백 아이템 행 "[몬스터, rate]" -> rate 바로 앞이 몬스터명
        prev_mob = find_id(prev, mob_cache, mob_nospace)
        if prev_mob is not None:
            last_mob_id, last_mob_name = prev_mob, prev
            stats["meso_rows"] += 1
            continue

        item_name = prev
        prev2_mob = find_id(prev2, mob_cache, mob_nospace)
        if prev2_mob is not None:
            # Case B: 표준 3줄 행 "[몬스터, 아이템, rate]"
            mob_id, mob_name = prev2_mob, prev2
            last_mob_id, last_mob_name = mob_id, prev2
        elif RATE_RE.match(prev2):
            # Case C1: 몬스터 셀 병합(생략) 행 "[아이템, rate]" -> 직전 몬스터로 귀속
            if last_mob_id is None:
                continue
            mob_id, mob_name = last_mob_id, last_mob_name
        else:
            # Case C2: 몬스터명은 있으나 우리 DB와 매칭 실패 -> 오귀속 방지 위해 스킵
            stats["unmatched_mob"] += 1
            if len(prev2) > 1:
                stats["unmatched_mob_names"][prev2] += 1
            continue

        item_id = find_item_id(item_name)
        if item_id is None:
            stats["unmatched_item"] += 1
            if len(item_name) > 1:
                stats["unmatched_item_names"][item_name] += 1
            continue

        drops.append((mob_id, mob_name, item_name, rate))
        stats["matched"] += 1

    return drops, stats


# 모듈 전역 (parse 내부에서 참조)
ITEM_CACHE: dict[str, int] = {}
ITEM_NOSPACE: dict[str, int] = {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="mob_drops 에 실제 반영")
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    row = conn.execute(
        "SELECT content FROM blog_posts WHERE url=?", (DROP_RATE_URL,)
    ).fetchone()
    if not row or not row["content"]:
        print(f"[ERROR] {DROP_RATE_URL} 본문이 blog_posts 에 없습니다.", file=sys.stderr)
        return 1
    content = row["content"]

    mob_cache = build_name_cache(conn, "mob", "mobs")
    augment_mob_cache(mob_cache)
    mob_nospace = make_nospace_index(mob_cache)
    global ITEM_CACHE, ITEM_NOSPACE
    ITEM_CACHE = build_name_cache(conn, "item", "items")
    ITEM_NOSPACE = make_nospace_index(ITEM_CACHE)

    drops, stats = parse_drop_rates(content, mob_cache, mob_nospace)

    distinct_mobs = len({d[0] for d in drops})
    print("=" * 60)
    print(f"퍼센트(드롭률) 줄 수      : {stats['rate_lines']}")
    print(f"메소 행(스킵)            : {stats['meso_rows']}")
    print(f"몬스터 매칭 실패(스킵)    : {stats['unmatched_mob']}")
    print(f"아이템 매칭 실패(스킵)    : {stats['unmatched_item']}")
    print(f"매칭 성공 드롭 항목       : {stats['matched']}")
    print(f"드롭 보유 몬스터 수       : {distinct_mobs}")
    print("=" * 60)
    print("\n[매칭 실패 몬스터 상위 20]")
    for name, cnt in stats["unmatched_mob_names"].most_common(20):
        print(f"  {cnt:4d}  {name}")
    print("\n[매칭 실패 아이템 상위 20]")
    for name, cnt in stats["unmatched_item_names"].most_common(20):
        print(f"  {cnt:4d}  {name}")

    if not args.apply:
        print("\n(dry-run: --apply 를 붙이면 mob_drops 에 반영됩니다)")
        conn.close()
        return 0

    # 정리: 구 파서가 출현맵(서식지)을 드롭으로 오인해 넣은 마을-토큰 가짜 드롭 제거.
    # 4001142~4001155 = 헤네시스~용의 숲 등 지역명 워프 토큰(몬스터 드롭 아님).
    # drop_rate 가 NULL 인 행만(=구 파서 기원) 삭제, 실데이터는 보존.
    removed = conn.execute(
        "DELETE FROM mob_drops WHERE item_id BETWEEN 4001142 AND 4001155 AND drop_rate IS NULL"
    ).rowcount
    print(f"\n[CLEANUP] 마을-토큰 가짜 드롭 {removed}건 삭제")

    # UPSERT: 기존 행은 drop_rate/item_name 갱신, 없으면 삽입
    applied = 0
    for mob_id, _mob_name, item_name, rate in drops:
        item_id = find_item_id(item_name)
        if item_id is None:
            continue
        conn.execute(
            """
            INSERT INTO mob_drops (mob_id, item_id, item_name, drop_rate)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(mob_id, item_id) DO UPDATE SET
                drop_rate = excluded.drop_rate,
                item_name = excluded.item_name
            """,
            (mob_id, item_id, item_name, rate),
        )
        applied += 1
    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM mob_drops").fetchone()[0]
    with_rate = conn.execute(
        "SELECT COUNT(*) FROM mob_drops WHERE drop_rate IS NOT NULL"
    ).fetchone()[0]
    mobs_with_drops = conn.execute(
        "SELECT COUNT(DISTINCT mob_id) FROM mob_drops"
    ).fetchone()[0]
    print(f"\n[APPLIED] upsert 시도 {applied}건")
    print(f"mob_drops 총 {total}건 / drop_rate 있는 행 {with_rate}건 / 드롭 보유 몹 {mobs_with_drops}")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
