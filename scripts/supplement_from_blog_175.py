#!/usr/bin/env python3
"""maplekibun 블로그 통합 글(/175)에서 출현맵(mob_spawns) + 드롭(mob_drops) 보강.

/175 는 몬스터별로 서식지(출현맵)와 드롭아이템을 명확히 분리해 나열한다:
    몬스터이름 : 목도리 프릴드
    서식지
    버닝로드 : 메마른 사막        <- "지역 : 맵명"  또는
    자쿰의제단                    <- 맵명 단독
    드롭아이템
    주황 포션
    ...
    에피소드                      <- 여기부터 설명, 블록 끝
서식지/드롭이 분리돼 있어 (구 파서가 맵을 드롭으로 오인하던) 문제 없이 안전하게 보강 가능.

- 출현맵: mob_spawns 에 INSERT OR IGNORE (mob_id, map_id, map_name)
- 드롭:   mob_drops 에 INSERT ... ON CONFLICT DO NOTHING (/892 드롭률 보존, 빠진 아이템만 추가)

사용:
  python3 scripts/supplement_from_blog_175.py            # dry-run
  python3 scripts/supplement_from_blog_175.py --apply
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
    _ITEM_ALIAS_SUBS,
)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "maple.db"
URL = "https://maplekibun.tistory.com/175"

MOB_HEADER_RE = re.compile(r"^몬스터이름\s*[:：]\s*(.+)$")
FOOTER_RE = re.compile(r"(공유하기|게시글 관리|댓글을 달아|TistoryWhaleSkin|관련 글|글 더보기)")


def find_item(name: str, cache, nospace) -> int | None:
    hit = find_id(name, cache, nospace)
    if hit is not None:
        return hit
    alias = name
    for old, new in _ITEM_ALIAS_SUBS:
        alias = alias.replace(old, new)
    if alias != name:
        return find_id(alias, cache, nospace)
    return None


def parse_175(content, mob_cache, mob_nospace, item_cache, item_nospace, map_cache, map_nospace):
    lines = [l.strip() for l in content.split("\n")]
    spawns: list[tuple[int, int, str]] = []
    drops: list[tuple[int, int, str]] = []
    stats = {
        "blocks": 0, "mob_matched": 0,
        "spawns": 0, "drops": 0,
        "unmatched_mob": Counter(), "unmatched_map": Counter(), "unmatched_item": Counter(),
    }

    mob_id: int | None = None
    mode: str | None = None  # 'spawn' | 'drop' | None

    for line in lines:
        if not line:
            continue
        if FOOTER_RE.search(line):
            break

        m = MOB_HEADER_RE.match(line)
        if m:
            stats["blocks"] += 1
            name = m.group(1).strip()
            mob_id = find_id(name, mob_cache, mob_nospace)
            if mob_id is None:
                stats["unmatched_mob"][name] += 1
            else:
                stats["mob_matched"] += 1
            mode = None
            continue

        if line == "서식지":
            mode = "spawn"
            continue
        if line in ("드롭아이템", "드롭 아이템"):
            mode = "drop"
            continue
        if line == "에피소드":
            mode = None
            continue
        if mob_id is None or mode is None:
            continue

        if mode == "spawn":
            # "지역 : 맵명" 이면 콜론 뒤, 아니면 줄 전체
            map_name = line.split(":")[-1].strip() if (":" in line or "：" in line) else line
            map_id = find_id(map_name, map_cache, map_nospace)
            if map_id is None:
                if len(map_name) > 1:
                    stats["unmatched_map"][map_name] += 1
                continue
            spawns.append((mob_id, map_id, map_name))
            stats["spawns"] += 1
        elif mode == "drop":
            item_id = find_item(line, item_cache, item_nospace)
            if item_id is None:
                if len(line) > 1:
                    stats["unmatched_item"][line] += 1
                continue
            drops.append((mob_id, item_id, line))
            stats["drops"] += 1

    return spawns, drops, stats


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT content FROM blog_posts WHERE url=?", (URL,)).fetchone()
    if not row or not row["content"]:
        print(f"[ERROR] {URL} 본문 없음")
        return 1

    mob_cache = build_name_cache(conn, "mob", "mobs")
    augment_mob_cache(mob_cache)
    mob_nospace = make_nospace_index(mob_cache)
    item_cache = build_name_cache(conn, "item", "items")
    item_nospace = make_nospace_index(item_cache)
    map_cache = build_name_cache(conn, "map", "maps")
    map_nospace = make_nospace_index(map_cache)

    spawns, drops, stats = parse_175(
        row["content"], mob_cache, mob_nospace,
        item_cache, item_nospace, map_cache, map_nospace,
    )

    print("=" * 60)
    print(f"블록 수                : {stats['blocks']}  (몹 매칭 {stats['mob_matched']})")
    print(f"출현맵 매칭            : {stats['spawns']}  (몹-맵 쌍)")
    print(f"드롭 매칭              : {stats['drops']}")
    print("=" * 60)
    print("\n[몹 미매칭 상위 12]")
    for n, c in stats["unmatched_mob"].most_common(12):
        print(f"  {c:3d}  {n}")
    print("\n[맵 미매칭 상위 12]")
    for n, c in stats["unmatched_map"].most_common(12):
        print(f"  {c:3d}  {n}")
    print("\n[아이템 미매칭 상위 12]")
    for n, c in stats["unmatched_item"].most_common(12):
        print(f"  {c:3d}  {n}")

    if not args.apply:
        print("\n(dry-run)")
        conn.close()
        return 0

    sp_before = conn.execute("SELECT COUNT(*) FROM mob_spawns").fetchone()[0]
    dr_before = conn.execute("SELECT COUNT(*) FROM mob_drops").fetchone()[0]
    for mob_id, map_id, map_name in spawns:
        conn.execute(
            "INSERT OR IGNORE INTO mob_spawns (mob_id, map_id, map_name) VALUES (?, ?, ?)",
            (mob_id, map_id, map_name),
        )
    for mob_id, item_id, item_name in drops:
        # /892 드롭률이 있는 기존 행은 보존, 없는 아이템만 추가
        conn.execute(
            "INSERT INTO mob_drops (mob_id, item_id, item_name, drop_rate) "
            "VALUES (?, ?, ?, NULL) ON CONFLICT(mob_id, item_id) DO NOTHING",
            (mob_id, item_id, item_name),
        )
    conn.commit()
    sp_after = conn.execute("SELECT COUNT(*) FROM mob_spawns").fetchone()[0]
    dr_after = conn.execute("SELECT COUNT(*) FROM mob_drops").fetchone()[0]
    print(f"\n[APPLIED] mob_spawns {sp_before} -> {sp_after} (+{sp_after - sp_before})")
    print(f"          mob_drops  {dr_before} -> {dr_after} (+{dr_after - dr_before})")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
