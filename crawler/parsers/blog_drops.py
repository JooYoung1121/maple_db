from __future__ import annotations
"""블로그 포스트에서 드롭/스폰 데이터 추출"""
import re
import sqlite3
from datetime import datetime, timezone


def parse_blog_drops(conn: sqlite3.Connection) -> dict:
    """blog_posts에서 드롭 관련 포스트를 찾아 mob_drops/mob_spawns에 데이터 삽입."""
    stats = {
        "drops_added": 0,
        "spawns_added": 0,
        "bosses_updated": 0,
        "unmatched_mobs": [],
        "unmatched_items": [],
    }

    rows = conn.execute(
        "SELECT id, title, url, content FROM blog_posts WHERE content IS NOT NULL"
    ).fetchall()

    mob_cache = _build_name_cache(conn, "mob", "mobs")
    item_cache = _build_name_cache(conn, "item", "items")
    map_cache = _build_name_cache(conn, "map", "maps")

    for row in rows:
        content = row["content"]
        title = row["title"] or ""
        url = row["url"] or ""

        drops, spawns, bosses = _parse_content(
            content, title, mob_cache, item_cache, map_cache, stats
        )

        for mob_id, item_id, item_name, drop_rate in drops:
            try:
                conn.execute(
                    "INSERT OR IGNORE INTO mob_drops (mob_id, item_id, item_name, drop_rate) VALUES (?, ?, ?, ?)",
                    (mob_id, item_id, item_name, drop_rate),
                )
                stats["drops_added"] += 1
            except Exception:
                pass

        for mob_id, map_id, map_name in spawns:
            try:
                conn.execute(
                    "INSERT OR IGNORE INTO mob_spawns (mob_id, map_id, map_name) VALUES (?, ?, ?)",
                    (mob_id, map_id, map_name),
                )
                stats["spawns_added"] += 1
            except Exception:
                pass

        for mob_id, spawn_time in bosses:
            try:
                conn.execute(
                    "UPDATE mobs SET is_boss = 1, spawn_time = ? WHERE id = ?",
                    (spawn_time, mob_id),
                )
                stats["bosses_updated"] += 1
            except Exception:
                pass

        conn.commit()

    return stats


def _build_name_cache(conn: sqlite3.Connection, entity_type: str, table: str) -> dict:
    """Build Korean name -> entity ID cache from entity_names_en (source='kms') and main table name."""
    cache = {}

    rows = conn.execute(
        "SELECT entity_id, name_en FROM entity_names_en WHERE entity_type = ? AND source = 'kms'",
        (entity_type,),
    ).fetchall()
    for r in rows:
        name = r["name_en"].strip()
        if name:
            cache[name] = r["entity_id"]

    rows = conn.execute(f"SELECT id, name FROM {table}").fetchall()
    for r in rows:
        name = r["name"].strip()
        if name:
            cache[name] = r["id"]

    return cache


def _find_entity_id(name: str, cache: dict) -> int | None:
    """Try exact match first, then partial match."""
    name = name.strip()
    if not name:
        return None
    if name in cache:
        return cache[name]
    clean = re.sub(r'\s*\(.*?\)\s*$', '', name).strip()
    if clean and clean in cache:
        return cache[clean]
    return None


def _parse_content(
    content: str,
    title: str,
    mob_cache: dict,
    item_cache: dict,
    map_cache: dict,
    stats: dict,
):
    """Parse blog content and extract drops, spawns, boss info."""
    drops = []   # [(mob_id, item_id, item_name, drop_rate)]
    spawns = []  # [(mob_id, map_id, map_name)]
    bosses = []  # [(mob_id, spawn_time)]

    lines = content.split('\n')

    # Format A: Drop rate table lines
    # Pattern: "몬스터 / 아이템 / NN%" or "몬스터\t아이템\tNN%"
    for line in lines:
        line = line.strip()
        if not line:
            continue

        parts = re.split(r'\s*[/|]\s*|\t+', line)
        if len(parts) >= 3:
            pct_match = re.search(r'([\d.]+)\s*%', parts[-1])
            if pct_match:
                mob_name = parts[0].strip()
                item_name = parts[1].strip()
                drop_rate = float(pct_match.group(1)) / 100.0

                mob_id = _find_entity_id(mob_name, mob_cache)
                item_id = _find_entity_id(item_name, item_cache)

                if mob_id and item_id:
                    drops.append((mob_id, item_id, item_name, drop_rate))
                else:
                    if not mob_id and mob_name and len(mob_name) > 1:
                        stats["unmatched_mobs"].append(mob_name)
                    if not item_id and item_name and len(item_name) > 1:
                        stats["unmatched_items"].append(item_name)

    # Format B: Boss drops
    boss_pattern = re.compile(
        r'^(.+?)\s*[\(（]\s*(?:Lv\.?|레벨\s*:?\s*)(\d+)\s*[\)）]'
    )
    spawn_pattern = re.compile(
        r'(?:젠타임|리젠|스폰|출현\s*시간)\s*[:\s]*(\d+\s*(?:시간|분|초)(?:\s*\d+\s*(?:시간|분|초))*)',
        re.IGNORECASE,
    )
    map_pattern = re.compile(
        r'(?:출현\s*(?:맵|장소|위치)|맵)\s*[:\s]*(.+?)(?:\n|$)'
    )

    current_boss = None
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            current_boss = None
            continue

        boss_match = boss_pattern.match(line)
        if boss_match:
            boss_name = boss_match.group(1).strip()
            mob_id = _find_entity_id(boss_name, mob_cache)
            if mob_id:
                current_boss = mob_id
                context = '\n'.join(lines[max(0, i):min(len(lines), i + 5)])
                spawn_match = spawn_pattern.search(context)
                spawn_time = spawn_match.group(1) if spawn_match else None
                bosses.append((mob_id, spawn_time))

                map_match = map_pattern.search(context)
                if map_match:
                    map_name = map_match.group(1).strip()
                    map_id = _find_entity_id(map_name, map_cache)
                    if map_id:
                        spawns.append((mob_id, map_id, map_name))
            continue

        if current_boss:
            potential_items = re.split(r'[,，、]\s*', line)
            for item_name in potential_items:
                item_name = item_name.strip()
                if not item_name or len(item_name) < 2:
                    continue
                item_id = _find_entity_id(item_name, item_cache)
                if item_id:
                    drops.append((current_boss, item_id, item_name, None))

    # Format C: Scroll drops - "아이템명 : 몬스터1, 몬스터2, 몬스터3"
    scroll_pattern = re.compile(r'^(.+?)\s*[:：]\s*(.+)$')
    for line in lines:
        line = line.strip()
        if not line:
            continue
        scroll_match = scroll_pattern.match(line)
        if scroll_match:
            item_name = scroll_match.group(1).strip()
            mob_names_str = scroll_match.group(2).strip()
            item_id = _find_entity_id(item_name, item_cache)
            if item_id and ',' in mob_names_str:
                mob_names = [m.strip() for m in re.split(r'[,，]\s*', mob_names_str)]
                for mn in mob_names:
                    mob_id = _find_entity_id(mn, mob_cache)
                    if mob_id:
                        drops.append((mob_id, item_id, item_name, None))

    return drops, spawns, bosses
