from __future__ import annotations
"""블로그 몬스터 정보 포스트에서 스폰/드롭 추출"""
import re
import sqlite3


def parse_blog_monsters(conn: sqlite3.Connection) -> dict:
    """blog_posts에서 몬스터 정보 포스트를 파싱하여 mob_spawns + mob_drops 보강."""
    stats = {"spawns_added": 0, "drops_added": 0, "posts_parsed": 0}

    rows = conn.execute(
        """SELECT id, title, url, content FROM blog_posts
           WHERE content IS NOT NULL
           AND (title LIKE '%몬스터%' OR title LIKE '%레벨%' OR title LIKE '%Lv%')"""
    ).fetchall()

    mob_cache = _build_name_cache(conn, "mob", "mobs")
    item_cache = _build_name_cache(conn, "item", "items")
    map_cache = _build_name_cache(conn, "map", "maps")

    for row in rows:
        content = row["content"]
        lines = content.split('\n')

        current_mob_id = None
        for line in lines:
            line = line.strip()
            if not line:
                current_mob_id = None
                continue

            mob_match = re.match(
                r'^(.+?)\s*[\(（]\s*(?:레벨|Lv\.?)\s*:?\s*(\d+)\s*[\)）]', line
            )
            if mob_match:
                mob_name = mob_match.group(1).strip()
                mob_id = _find_entity_id(mob_name, mob_cache)
                if mob_id:
                    current_mob_id = mob_id
                    stats["posts_parsed"] += 1

                    rest = line[mob_match.end():]
                    parts = re.split(r'\s*[/|]\s*', rest)

                    for part in parts:
                        part = part.strip()
                        map_id = _find_entity_id(part, map_cache)
                        if map_id:
                            try:
                                conn.execute(
                                    "INSERT OR IGNORE INTO mob_spawns (mob_id, map_id, map_name) VALUES (?, ?, ?)",
                                    (mob_id, map_id, part),
                                )
                                stats["spawns_added"] += 1
                            except Exception:
                                pass
                continue

            if current_mob_id:
                item_names = re.split(r'[,，/|]\s*', line)
                for item_name in item_names:
                    item_name = item_name.strip()
                    if not item_name or len(item_name) < 2:
                        continue
                    item_id = _find_entity_id(item_name, item_cache)
                    if item_id:
                        try:
                            conn.execute(
                                "INSERT OR IGNORE INTO mob_drops (mob_id, item_id, item_name, drop_rate) VALUES (?, ?, ?, NULL)",
                                (current_mob_id, item_id, item_name),
                            )
                            stats["drops_added"] += 1
                        except Exception:
                            pass

        conn.commit()

    return stats


def _build_name_cache(conn: sqlite3.Connection, entity_type: str, table: str) -> dict:
    """Build name -> entity ID cache from entity_names_en (source='kms') and main table."""
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
    name = name.strip()
    if not name:
        return None
    if name in cache:
        return cache[name]
    clean = re.sub(r'\s*\(.*?\)\s*$', '', name).strip()
    if clean and clean in cache:
        return cache[clean]
    return None
