from __future__ import annotations
"""maplestory.io API 파서 — GMS 92 메인 + KMS 284 한국어 매칭"""

import json
import sqlite3
from datetime import datetime, timezone

from ..config import MAPLESTORY_IO_BASE, MAPLESTORY_IO_VERSION_GMS, MAPLESTORY_IO_VERSION_KMS

# 엔티티 타입 → API path
_API_PATHS = {
    "item": "item",
    "mob": "mob",
    "map": "map",
    "npc": "npc",
    "quest": "quest",
}


def _bulk_url(region: str, version: str, entity_type: str) -> str:
    path = _API_PATHS[entity_type]
    return f"{MAPLESTORY_IO_BASE}/{region}/{version}/{path}"


def _detail_url(region: str, version: str, entity_type: str, entity_id: int) -> str:
    path = _API_PATHS[entity_type]
    return f"{MAPLESTORY_IO_BASE}/{region}/{version}/{path}/{entity_id}"


# ------------------------------------------------------------------
# GMS 92 → 메인 테이블 (빅뱅 이전 데이터)
# ------------------------------------------------------------------

def _save_item_gms(conn: sqlite3.Connection, entry: dict, now: str) -> None:
    eid = entry.get("id")
    name = entry.get("name", "")
    if not eid or not name:
        return

    desc = entry.get("description", "")
    category = ""
    subcategory = ""
    type_info = entry.get("typeInfo", {})
    if isinstance(type_info, dict):
        category = type_info.get("category", "") or ""
        subcategory = type_info.get("subCategory", "") or ""

    stats = {}
    meta_info = entry.get("metaInfo", {})
    if isinstance(meta_info, dict):
        for key in ["incSTR", "incDEX", "incINT", "incLUK", "incPAD", "incMAD",
                     "incPDD", "incMDD", "incACC", "incEVA", "incSpeed", "incJump",
                     "incMHP", "incMMP"]:
            val = meta_info.get(key, 0)
            if val:
                stats[key] = val
        req_level = meta_info.get("reqLevel", 0) or 0
        req_job = meta_info.get("reqJob", 0)
    else:
        req_level = 0
        req_job = 0

    job_name = _job_code_to_name(req_job) if req_job else ""
    icon_url = f"{MAPLESTORY_IO_BASE}/gms/{MAPLESTORY_IO_VERSION_GMS}/item/{eid}/icon"

    conn.execute(
        """INSERT OR REPLACE INTO items
           (id, name, category, subcategory, level_req, job_req,
            stats, description, icon_url, source_url, last_crawled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (eid, name, category, subcategory, req_level, job_name,
         json.dumps(stats, ensure_ascii=False) if stats else None,
         desc, icon_url,
         _detail_url("gms", MAPLESTORY_IO_VERSION_GMS, "item", eid), now),
    )


def _save_mob_gms(conn: sqlite3.Connection, entry: dict, now: str) -> None:
    eid = entry.get("id")
    name = entry.get("name", "")
    if not eid or not name:
        return

    meta = entry.get("metaInfo", {}) if isinstance(entry.get("metaInfo"), dict) else {}

    conn.execute(
        """INSERT OR REPLACE INTO mobs
           (id, name, level, hp, mp, exp, defense, accuracy, evasion,
            is_boss, icon_url, source_url, last_crawled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            eid, name,
            meta.get("level", 0) or 0,
            meta.get("maxHP", 0) or 0,
            meta.get("maxMP", 0) or 0,
            meta.get("exp", 0) or 0,
            meta.get("PDDamage", 0) or 0,
            meta.get("acc", 0) or 0,
            meta.get("eva", 0) or 0,
            1 if meta.get("boss") else 0,
            f"{MAPLESTORY_IO_BASE}/gms/{MAPLESTORY_IO_VERSION_GMS}/mob/{eid}/icon",
            _detail_url("gms", MAPLESTORY_IO_VERSION_GMS, "mob", eid),
            now,
        ),
    )


def _save_map_gms(conn: sqlite3.Connection, entry: dict, now: str) -> None:
    eid = entry.get("id")
    name = entry.get("name", "")
    if not eid or not name:
        return

    street_name = entry.get("streetName", "") or ""
    return_map = entry.get("returnMap", None)

    conn.execute(
        """INSERT OR REPLACE INTO maps
           (id, name, street_name, area, return_map_id, source_url, last_crawled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (eid, name, street_name, "",
         return_map if return_map and return_map != 999999999 else None,
         _detail_url("gms", MAPLESTORY_IO_VERSION_GMS, "map", eid), now),
    )


def _save_npc_gms(conn: sqlite3.Connection, entry: dict, now: str) -> None:
    eid = entry.get("id")
    name = entry.get("name", "")
    if not eid or not name:
        return

    conn.execute(
        """INSERT OR REPLACE INTO npcs
           (id, name, map_id, map_name, description, icon_url, source_url, last_crawled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (eid, name, None, "", "",
         f"{MAPLESTORY_IO_BASE}/gms/{MAPLESTORY_IO_VERSION_GMS}/npc/{eid}/icon",
         _detail_url("gms", MAPLESTORY_IO_VERSION_GMS, "npc", eid), now),
    )


def _save_quest_gms(conn: sqlite3.Connection, entry: dict, now: str) -> None:
    eid = entry.get("id")
    name = entry.get("name", "")
    if not eid or not name:
        return

    conn.execute(
        """INSERT OR IGNORE INTO quests
           (id, name, level_req, npc_start, npc_end, rewards, description, source_url, last_crawled_at)
           VALUES (?, ?, 0, '', '', '', '', ?, ?)""",
        (eid, name,
         _detail_url("gms", MAPLESTORY_IO_VERSION_GMS, "quest", eid), now),
    )


_GMS_SAVERS = {
    "item": _save_item_gms,
    "mob": _save_mob_gms,
    "map": _save_map_gms,
    "npc": _save_npc_gms,
    "quest": _save_quest_gms,
}


def _job_code_to_name(code) -> str:
    if not code:
        return "공용"
    try:
        code = int(code)
    except (ValueError, TypeError):
        return str(code)
    mapping = {
        0: "공용", 1: "전사", 2: "마법사", 4: "궁수", 8: "도적", 16: "해적",
        3: "전사/마법사", 5: "전사/궁수", 9: "전사/도적",
        6: "마법사/궁수", 10: "마법사/도적", 12: "궁수/도적",
    }
    return mapping.get(code, "공용")


# ------------------------------------------------------------------
# Phase 1: GMS 92 벌크 → 메인 테이블
# ------------------------------------------------------------------

async def crawl_gms_data(conn: sqlite3.Connection, client, force: bool = False) -> None:
    """GMS 92 벌크 API로 빅뱅 이전 데이터를 메인 테이블에 저장."""
    for etype, saver in _GMS_SAVERS.items():
        print(f"[maplestory.io:gms92] {etype} 데이터 수집 중...")

        bulk_url = _bulk_url("gms", MAPLESTORY_IO_VERSION_GMS, etype)
        cache_key = f"maplestory_io/gms92_{etype}_bulk"

        try:
            raw = await client.get(bulk_url, cache_key=cache_key, use_cache=not force)
            bulk_data = json.loads(raw)
        except Exception as e:
            print(f"[maplestory.io:gms92] {etype} 벌크 API 오류: {e}")
            continue

        if not isinstance(bulk_data, list):
            print(f"[maplestory.io:gms92] {etype} 응답이 리스트가 아님, 스킵")
            continue

        count = 0
        now = datetime.now(timezone.utc).isoformat()

        for entry in bulk_data:
            try:
                saver(conn, entry, now)
                count += 1
            except Exception:
                continue

            if count % 500 == 0:
                conn.commit()
                print(f"[maplestory.io:gms92] {etype}: {count}개 처리 중...")

        conn.commit()
        print(f"[maplestory.io:gms92] {etype}: {count}개 저장 완료")


# ------------------------------------------------------------------
# Phase 2: KMS 284 → 한국어 이름 매칭 (GMS 92에 있는 ID만)
# ------------------------------------------------------------------

async def crawl_korean_names(conn: sqlite3.Connection, client, force: bool = False) -> None:
    """KMS 284 벌크에서 한국어 이름을 가져와 entity_names_en 테이블에 저장 (한국어가 '추가 이름')."""
    entity_type_to_table = {
        "item": "items",
        "mob": "mobs",
        "map": "maps",
        "npc": "npcs",
        "quest": "quests",
    }

    for etype, table in entity_type_to_table.items():
        print(f"[maplestory.io:kms] {etype} 한국어 이름 매칭 중...")

        rows = conn.execute(f"SELECT id FROM {table}").fetchall()
        known_ids = {row["id"] for row in rows}
        if not known_ids:
            print(f"[maplestory.io:kms] {etype}: DB에 데이터 없음, 스킵")
            continue

        bulk_url = _bulk_url("kms", MAPLESTORY_IO_VERSION_KMS, etype)
        cache_key = f"maplestory_io/kms_{etype}_bulk"

        try:
            raw = await client.get(bulk_url, cache_key=cache_key, use_cache=not force)
            bulk_data = json.loads(raw)
        except Exception as e:
            print(f"[maplestory.io:kms] {etype} 벌크 API 오류: {e}")
            continue

        if not isinstance(bulk_data, list):
            continue

        matched = 0
        now = datetime.now(timezone.utc).isoformat()

        for entry in bulk_data:
            eid = entry.get("id")
            name_kr = entry.get("name", "")
            if eid is None or not name_kr:
                continue
            if eid not in known_ids:
                continue

            # 한국어 이름을 entity_names_en에 source='kms' 로 저장
            conn.execute(
                """INSERT OR REPLACE INTO entity_names_en
                   (entity_type, entity_id, name_en, source, source_url, last_crawled_at)
                   VALUES (?, ?, ?, 'kms', ?, ?)""",
                (etype, eid, name_kr,
                 _detail_url("kms", MAPLESTORY_IO_VERSION_KMS, etype, eid), now),
            )
            matched += 1

        conn.commit()
        print(f"[maplestory.io:kms] {etype}: {matched}/{len(known_ids)} 한국어 이름 매칭")


# ------------------------------------------------------------------
# Phase 3: 퀘스트 상세
# ------------------------------------------------------------------

async def crawl_quest_details(conn: sqlite3.Connection, client, force: bool = False) -> None:
    """퀘스트 상세 정보를 GMS 92 개별 API로 수집."""
    rows = conn.execute("SELECT id FROM quests").fetchall()
    quest_ids = [r["id"] for r in rows]
    if not quest_ids:
        print("[maplestory.io] 퀘스트 상세: DB에 퀘스트 없음")
        return

    total = len(quest_ids)
    updated = 0
    now = datetime.now(timezone.utc).isoformat()
    print(f"[maplestory.io:gms92] 퀘스트 상세 {total}개 수집 시작...")

    for i, qid in enumerate(quest_ids):
        if not force:
            row = conn.execute("SELECT description FROM quests WHERE id = ?", (qid,)).fetchone()
            if row and row["description"]:
                continue

        detail_url = _detail_url("gms", MAPLESTORY_IO_VERSION_GMS, "quest", qid)
        cache_key = f"maplestory_io/gms92_quest_{qid}"
        try:
            raw = await client.get(detail_url, cache_key=cache_key, use_cache=not force)
            data = json.loads(raw)
        except Exception:
            continue

        req_start = data.get("requirementToStart", {})
        npc_start_id = req_start.get("npcId") if isinstance(req_start, dict) else None
        npc_start = ""
        if npc_start_id:
            npc_row = conn.execute("SELECT name FROM npcs WHERE id = ?", (npc_start_id,)).fetchone()
            npc_start = npc_row["name"] if npc_row else str(npc_start_id)

        level_req = 0
        if isinstance(req_start, dict):
            level_req = req_start.get("levelMin", 0) or 0

        req_complete = data.get("requirementToComplete", {})
        npc_end_id = req_complete.get("npcId") if isinstance(req_complete, dict) else None
        npc_end = ""
        if npc_end_id:
            npc_row = conn.execute("SELECT name FROM npcs WHERE id = ?", (npc_end_id,)).fetchone()
            npc_end = npc_row["name"] if npc_row else str(npc_end_id)

        messages = data.get("messages", [])
        description = "\n".join(messages) if isinstance(messages, list) else ""
        area_name = data.get("areaName", "")

        rewards_data = data.get("rewardOnComplete", {})
        rewards = json.dumps(rewards_data, ensure_ascii=False) if rewards_data else ""

        conn.execute(
            """UPDATE quests SET level_req=?, npc_start=?, npc_end=?,
               rewards=?, description=?, last_crawled_at=?
               WHERE id=?""",
            (level_req, npc_start, npc_end, rewards, description, now, qid),
        )
        updated += 1

        if (i + 1) % 100 == 0:
            conn.commit()
            print(f"[maplestory.io:gms92] 퀘스트 상세 {i + 1}/{total} ({updated}개 업데이트)")

    conn.commit()
    print(f"[maplestory.io:gms92] 퀘스트 상세 완료: {updated}개 업데이트")


# ------------------------------------------------------------------
# Phase 4: 개별 상세 API → 확장 컬럼 + mob_spawns
# ------------------------------------------------------------------

async def crawl_entity_details(
    conn: sqlite3.Connection, client, entity_type: str, force: bool = False
) -> None:
    """개별 상세 API에서 풍부한 데이터 수집 → 확장 컬럼에 저장."""
    table_map = {
        "mob": "mobs",
        "map": "maps",
        "npc": "npcs",
        "item": "items",
        "quest": "quests",
    }
    table = table_map.get(entity_type)
    if not table:
        print(f"[detail] 알 수 없는 타입: {entity_type}")
        return

    rows = conn.execute(f"SELECT id FROM {table}").fetchall()
    ids = [r["id"] for r in rows]
    if not ids:
        print(f"[detail:{entity_type}] DB에 데이터 없음")
        return

    total = len(ids)
    updated = 0
    now = datetime.now(timezone.utc).isoformat()
    print(f"[detail:{entity_type}] {total}개 상세 수집 시작...")

    _detail_savers = {
        "mob": _save_mob_detail,
        "map": _save_map_detail,
        "npc": _save_npc_detail,
        "item": _save_item_detail,
        "quest": _save_quest_detail_v2,
    }
    saver = _detail_savers[entity_type]

    for i, eid in enumerate(ids):
        if not force:
            cached = conn.execute(
                "SELECT data_json FROM maplestory_io_cache WHERE entity_type=? AND entity_id=?",
                (entity_type, eid),
            ).fetchone()
            if cached and cached["data_json"]:
                try:
                    data = json.loads(cached["data_json"])
                    saver(conn, eid, data, now)
                    updated += 1
                except Exception:
                    pass
                if (i + 1) % 200 == 0:
                    conn.commit()
                    print(f"[detail:{entity_type}] {i+1}/{total} (캐시)")
                continue

        url = _detail_url("gms", MAPLESTORY_IO_VERSION_GMS, entity_type, eid)
        cache_key = f"maplestory_io/gms92_{entity_type}_{eid}"
        try:
            raw = await client.get(url, cache_key=cache_key, use_cache=not force)
            data = json.loads(raw)
        except Exception:
            continue

        conn.execute(
            """INSERT OR REPLACE INTO maplestory_io_cache
               (entity_type, entity_id, name_en, data_json, last_crawled_at)
               VALUES (?, ?, ?, ?, ?)""",
            (entity_type, eid, data.get("name", ""), json.dumps(data, ensure_ascii=False), now),
        )

        try:
            saver(conn, eid, data, now)
            updated += 1
        except Exception:
            pass

        if (i + 1) % 100 == 0:
            conn.commit()
            print(f"[detail:{entity_type}] {i+1}/{total} ({updated}개 업데이트)")

    conn.commit()
    print(f"[detail:{entity_type}] 완료: {updated}개 업데이트")


def _save_mob_detail(conn: sqlite3.Connection, eid: int, data: dict, now: str) -> None:
    # API returns "meta" in detail, "metaInfo" in bulk — check both
    raw_meta = data.get("meta") or data.get("metaInfo") or {}
    meta = raw_meta if isinstance(raw_meta, dict) else {}

    # Core stats (from detail "meta" keys)
    level = meta.get("level", 0) or 0
    hp = meta.get("maxHP", 0) or 0
    mp = meta.get("maxMP", 0) or 0
    exp = meta.get("exp", 0) or 0
    defense = meta.get("physicalDefense") or meta.get("PDDamage", 0) or 0
    accuracy = meta.get("accuracy") or meta.get("acc", 0) or 0
    evasion = meta.get("evasion") or meta.get("eva", 0) or 0

    # Extended stats
    physical_damage = meta.get("physicalDamage") or meta.get("PADamage", 0) or 0
    magic_damage = meta.get("magicDamage") or meta.get("MADamage", 0) or 0
    magic_defense = meta.get("magicDefense") or meta.get("MDDamage", 0) or 0
    speed = meta.get("speed", 0) or 0
    is_undead = 1 if meta.get("isUndead") or meta.get("undead") else 0
    is_boss = 1 if meta.get("boss") else 0

    conn.execute(
        """UPDATE mobs SET level=?, hp=?, mp=?, exp=?, defense=?, accuracy=?, evasion=?,
           physical_damage=?, magic_damage=?, magic_defense=?,
           speed=?, is_undead=?, is_boss=?, last_crawled_at=? WHERE id=?""",
        (level, hp, mp, exp, defense, accuracy, evasion,
         physical_damage, magic_damage, magic_defense, speed, is_undead, is_boss, now, eid),
    )

    found_at = data.get("foundAt", [])
    if isinstance(found_at, list):
        for loc in found_at:
            if isinstance(loc, dict):
                map_id = loc.get("mapId") or loc.get("id")
                map_name = loc.get("mapName") or loc.get("name", "")
                if map_id:
                    conn.execute(
                        "INSERT OR IGNORE INTO mob_spawns (mob_id, map_id, map_name) VALUES (?, ?, ?)",
                        (eid, map_id, map_name),
                    )


def _save_map_detail(conn: sqlite3.Connection, eid: int, data: dict, now: str) -> None:
    is_town = 1 if data.get("isTown") else 0
    mob_rate = data.get("mobRate", None)

    portals = data.get("portals", [])
    portals_json = json.dumps(portals, ensure_ascii=False) if portals else None

    conn.execute(
        """UPDATE maps SET is_town=?, mob_rate=?, portals_json=?, last_crawled_at=? WHERE id=?""",
        (is_town, mob_rate, portals_json, now, eid),
    )


def _save_npc_detail(conn: sqlite3.Connection, eid: int, data: dict, now: str) -> None:
    is_shop = 1 if data.get("isShop") or data.get("shop") else 0

    found_at = data.get("foundAt", [])
    found_at_str = ""
    if isinstance(found_at, list) and found_at:
        first = found_at[0]
        if isinstance(first, dict):
            map_id = first.get("mapId") or first.get("id")
            map_name = first.get("mapName") or first.get("name", "")
            found_at_str = f"{map_name} ({map_id})" if map_id else map_name
            if map_id:
                conn.execute(
                    "UPDATE npcs SET map_id=?, map_name=? WHERE id=? AND (map_id IS NULL OR map_id=0)",
                    (map_id, map_name, eid),
                )

    dialogue_list = data.get("dialogue", []) or data.get("messages", [])
    dialogue = "\n".join(dialogue_list) if isinstance(dialogue_list, list) else ""

    related_quests = data.get("relatedQuests", [])
    related_quests_str = json.dumps(related_quests, ensure_ascii=False) if related_quests else ""

    conn.execute(
        """UPDATE npcs SET is_shop=?, dialogue=?, related_quests=?, found_at=?, last_crawled_at=? WHERE id=?""",
        (is_shop, dialogue, related_quests_str, found_at_str, now, eid),
    )


def _save_item_detail(conn: sqlite3.Connection, eid: int, data: dict, now: str) -> None:
    raw_meta = data.get("meta") or data.get("metaInfo") or {}
    meta = raw_meta if isinstance(raw_meta, dict) else {}
    type_info = data.get("typeInfo", {}) if isinstance(data.get("typeInfo"), dict) else {}

    attack_speed = str(meta.get("attackSpeed", "")) if meta.get("attackSpeed") else None
    price = meta.get("price", 0) or 0
    tuc = meta.get("tuc", 0) or 0
    overall_category = type_info.get("overallCategory", "") or ""

    # Core stats from detail API
    req_level = meta.get("reqLevel", 0) or 0
    req_job = meta.get("reqJob", 0)
    job_name = _job_code_to_name(req_job) if req_job else ""

    stats = {}
    for key in ["incSTR", "incDEX", "incINT", "incLUK", "incPAD", "incMAD",
                 "incPDD", "incMDD", "incACC", "incEVA", "incSpeed", "incJump",
                 "incMHP", "incMMP"]:
        val = meta.get(key, 0)
        if val:
            stats[key] = val
    # Also check reqSTR/DEX/INT/LUK
    for key in ["reqSTR", "reqDEX", "reqINT", "reqLUK"]:
        val = meta.get(key, 0)
        if val:
            stats[key] = val

    stats_json = json.dumps(stats, ensure_ascii=False) if stats else None

    conn.execute(
        """UPDATE items SET attack_speed=?, price=?, upgrade_slots=?, overall_category=?,
           level_req=?, job_req=?, stats=?, last_crawled_at=? WHERE id=?""",
        (attack_speed, price, tuc, overall_category, req_level, job_name, stats_json, now, eid),
    )


def _save_quest_detail_v2(conn: sqlite3.Connection, eid: int, data: dict, now: str) -> None:
    """Extended quest detail saver (v2) - supplements existing quest detail data."""
    row = conn.execute("SELECT description FROM quests WHERE id=?", (eid,)).fetchone()
    if row and row["description"]:
        return

    req_start = data.get("requirementToStart", {})
    level_req = req_start.get("levelMin", 0) if isinstance(req_start, dict) else 0

    messages = data.get("messages", [])
    description = "\n".join(messages) if isinstance(messages, list) else ""

    rewards = data.get("rewardOnComplete", {})
    rewards_str = json.dumps(rewards, ensure_ascii=False) if rewards else ""

    conn.execute(
        """UPDATE quests SET level_req=?, rewards=?, description=?, last_crawled_at=? WHERE id=?""",
        (level_req or 0, rewards_str, description, now, eid),
    )
