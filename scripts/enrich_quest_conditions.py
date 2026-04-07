#!/usr/bin/env python3
"""
퀘스트 조건 데이터 보강 스크립트

숫자만 있는 quest_conditions를 "몹이름 N마리" / "아이템이름 N개" 형태로 변환.

데이터 소스:
1. kms_quest_cache (DB) — WZ quest ID -> 완료 조건 (mob/item IDs + counts)
2. entity_names_en (DB, source='kms') — mob/item ID -> 한국어 이름
3. Quest_Check.json (WZ) — 추가 mob/item 정보 (fallback)
4. TIP 필드 — 몹 이름 힌트 (최후 수단)
"""

import json
import os
import re
import sqlite3
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "maple.db")
DB_PATH = os.path.abspath(DB_PATH)
WZ_DIR = os.path.join(os.path.dirname(__file__), "..", "wz_data_v62")


def load_json(filename):
    p = os.path.join(WZ_DIR, filename)
    if not os.path.exists(p):
        return {}
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_name(name):
    if not name:
        return ""
    s = name.strip()
    s = re.sub(r"\(~?Lv\.?\d+\)\s*", "", s)
    s = re.sub(r"\s*\([^)]+\)\s*$", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def build_kms_name_index(conn):
    """kms_quest_cache에서 name_kr -> quest_id 인덱스"""
    rows = conn.execute(
        "SELECT quest_id, name_kr FROM kms_quest_cache WHERE name_kr IS NOT NULL"
    ).fetchall()
    exact = {}
    normalized = {}
    for quest_id, name_kr in rows:
        if name_kr:
            exact[name_kr] = quest_id
            norm = normalize_name(name_kr)
            if norm:
                normalized[norm] = quest_id
    return exact, normalized


def match_db_quest_to_wz(db_name, exact_idx, norm_idx, kms_names_list):
    if db_name in exact_idx:
        return exact_idx[db_name]
    norm = normalize_name(db_name)
    if norm in norm_idx:
        return norm_idx[norm]
    for kms_name, qid in kms_names_list:
        kms_norm = normalize_name(kms_name)
        if not kms_norm or not norm:
            continue
        if norm in kms_norm or kms_norm in norm:
            return qid
        if kms_norm.startswith(norm + " ") and kms_norm[len(norm) + 1:].isdigit():
            return qid
        if norm.startswith(kms_norm + " ") and norm[len(kms_norm) + 1:].isdigit():
            return qid
    return None


def get_mob_item_names(conn):
    mob_names = {}
    item_names = {}
    rows = conn.execute(
        "SELECT entity_type, entity_id, name_en FROM entity_names_en WHERE source='kms'"
    ).fetchall()
    for etype, eid, name in rows:
        if etype == "mob":
            mob_names[eid] = name
        elif etype == "item":
            item_names[eid] = name
    return mob_names, item_names


def extract_requirements_from_kms_cache(conn, wz_quest_id):
    row = conn.execute(
        "SELECT raw_json FROM kms_quest_cache WHERE quest_id = ? AND raw_json IS NOT NULL",
        (wz_quest_id,),
    ).fetchone()
    if not row:
        return [], []
    try:
        raw = json.loads(row[0])
    except (json.JSONDecodeError, TypeError):
        return [], []
    req = raw.get("requirementToComplete", {})
    mobs = [(m["id"], m["count"]) for m in req.get("mobs", []) if m.get("id") and m.get("count", 0) > 0]
    items = [(it["id"], it["count"]) for it in req.get("items", []) if it.get("id") and it.get("count", 0) > 0]
    return mobs, items


def extract_requirements_from_wz_check(quest_check, wz_quest_id):
    qid_str = str(wz_quest_id)
    if qid_str not in quest_check:
        return [], []
    phases = quest_check[qid_str]
    if not isinstance(phases, dict):
        return [], []
    phase = phases.get("1", {})
    if not isinstance(phase, dict):
        return [], []
    mobs = []
    items = []
    if "mob" in phase and isinstance(phase["mob"], dict):
        for key, m in phase["mob"].items():
            if isinstance(m, dict) and m.get("id") and m.get("count", 0) > 0:
                mobs.append((m["id"], m["count"]))
    if "item" in phase and isinstance(phase["item"], dict):
        for key, it in phase["item"].items():
            if isinstance(it, dict) and it.get("id") and it.get("count", 0) > 0:
                items.append((it["id"], it["count"]))
    return mobs, items


def extract_mob_name_from_tip(tip):
    if not tip:
        return []
    mob_names = []
    patterns = [
        r"([가-힣a-zA-Z]+(?:\s?[가-힣a-zA-Z]+)?)\s*젠\s*[:\s]",
        r"([가-힣a-zA-Z]+(?:\s?[가-힣a-zA-Z]+)?)\s*젠$",
    ]
    for pat in patterns:
        for m in re.findall(pat, tip):
            name = m.strip()
            if name and len(name) >= 2:
                mob_names.append(name)
    return mob_names


def build_enriched_conditions(
    original_conditions, mobs, items, mob_names_dict, item_names_dict, tip_mob_hints
):
    if not original_conditions:
        return original_conditions

    all_numeric = all(c.isdigit() for c in original_conditions)
    if not all_numeric:
        return original_conditions

    cond_counts = [int(c) for c in original_conditions]
    num_conds = len(cond_counts)

    # Build requirement list: mobs first, then items
    requirements = []
    for mob_id, count in mobs:
        name = mob_names_dict.get(mob_id, f"몹#{mob_id}")
        requirements.append({"name": name, "count": count, "unit": "마리", "type": "mob"})
    for item_id, count in items:
        name = item_names_dict.get(item_id, f"아이템#{item_id}")
        requirements.append({"name": name, "count": count, "unit": "개", "type": "item"})

    # Case 1: Perfect count match
    if len(requirements) == num_conds:
        return [f"{r['name']} {c}{r['unit']}" for r, c in zip(requirements, cond_counts)]

    # Case 2: Try count-value matching
    if requirements:
        enriched = [None] * num_conds
        used = set()

        # Pass 1: exact count match
        for i, count in enumerate(cond_counts):
            for j, req in enumerate(requirements):
                if j not in used and req["count"] == count:
                    enriched[i] = f"{req['name']} {count}{req['unit']}"
                    used.add(j)
                    break

        # Pass 2: assign remaining requirements sequentially to unmatched conditions
        remaining = [j for j in range(len(requirements)) if j not in used]
        remaining_iter = iter(remaining)
        for i in range(num_conds):
            if enriched[i] is None:
                try:
                    j = next(remaining_iter)
                    req = requirements[j]
                    enriched[i] = f"{req['name']} {cond_counts[i]}{req['unit']}"
                except StopIteration:
                    pass

        # Pass 3: fill remaining with TIP hints
        for i in range(num_conds):
            if enriched[i] is None:
                if tip_mob_hints:
                    hint = tip_mob_hints[0]
                    enriched[i] = f"{hint} 드롭 아이템 {cond_counts[i]}개"
                else:
                    enriched[i] = str(cond_counts[i])

        if any(e != str(c) for e, c in zip(enriched, cond_counts)):
            return enriched

    # Case 3: Only TIP hints available
    if tip_mob_hints:
        enriched = []
        for i, count in enumerate(cond_counts):
            hint = tip_mob_hints[0] if tip_mob_hints else None
            if hint:
                if num_conds == 1:
                    enriched.append(f"{hint} {count}마리")
                elif i == 0:
                    enriched.append(f"{hint} {count}마리")
                else:
                    enriched.append(f"{hint} 드롭 아이템 {count}개")
            else:
                enriched.append(str(count))
        return enriched

    return original_conditions


def main():
    print("=" * 60)
    print("퀘스트 조건 보강 스크립트")
    print("=" * 60)

    if not os.path.exists(DB_PATH):
        print(f"ERROR: DB not found: {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Load data
    print("\n[1] 데이터 로드...")
    exact_idx, norm_idx = build_kms_name_index(conn)
    kms_names_list = list(exact_idx.items())
    print(f"  KMS quest cache: {len(exact_idx)}건")

    mob_names_dict, item_names_dict = get_mob_item_names(conn)
    print(f"  한국어 몹 이름: {len(mob_names_dict)}건")
    print(f"  한국어 아이템 이름: {len(item_names_dict)}건")

    quest_check = load_json("Quest_Check.json")
    print(f"  Quest_Check.json: {len(quest_check)}건")

    # Enrich
    print("\n[2] 퀘스트 조건 보강...")

    all_quests = conn.execute(
        "SELECT id, name, quest_conditions, tip FROM quests WHERE quest_conditions IS NOT NULL"
    ).fetchall()

    stats = {
        "total": len(all_quests), "already_text": 0, "numeric_only": 0,
        "enriched_kms": 0, "enriched_wz": 0, "enriched_tip": 0, "unchanged": 0,
    }
    updates = []

    for quest in all_quests:
        db_id, db_name = quest["id"], quest["name"]
        tip = quest["tip"] or ""

        try:
            conditions = json.loads(quest["quest_conditions"])
        except (json.JSONDecodeError, TypeError):
            continue
        if not conditions:
            continue

        all_numeric = all(c.isdigit() for c in conditions)
        if not all_numeric:
            stats["already_text"] += 1
            continue

        stats["numeric_only"] += 1

        wz_id = match_db_quest_to_wz(db_name, exact_idx, norm_idx, kms_names_list)
        mobs, items = [], []
        source = None

        if wz_id:
            mobs, items = extract_requirements_from_kms_cache(conn, wz_id)
            if mobs or items:
                source = "kms"
            else:
                mobs, items = extract_requirements_from_wz_check(quest_check, wz_id)
                if mobs or items:
                    source = "wz"

        tip_mob_hints = extract_mob_name_from_tip(tip)

        enriched = build_enriched_conditions(
            conditions, mobs, items, mob_names_dict, item_names_dict, tip_mob_hints
        )

        if enriched != conditions:
            updates.append((json.dumps(enriched, ensure_ascii=False), db_id))
            if source == "kms":
                stats["enriched_kms"] += 1
            elif source == "wz":
                stats["enriched_wz"] += 1
            else:
                stats["enriched_tip"] += 1
        else:
            stats["unchanged"] += 1

    # Update DB
    print(f"\n[3] DB 업데이트: {len(updates)}건...")
    conn.executescript("BEGIN;")
    for new_conds, db_id in updates:
        conn.execute("UPDATE quests SET quest_conditions = ? WHERE id = ?", (new_conds, db_id))
    conn.commit()

    # Stats
    print("\n" + "=" * 60)
    print("통계")
    print("=" * 60)
    print(f"  전체 조건 있는 퀘스트: {stats['total']}건")
    print(f"  이미 텍스트 조건: {stats['already_text']}건")
    print(f"  숫자만 있는 조건: {stats['numeric_only']}건")
    print(f"  -- KMS 캐시로 보강: {stats['enriched_kms']}건")
    print(f"  -- WZ Check로 보강: {stats['enriched_wz']}건")
    print(f"  -- TIP 힌트로 보강: {stats['enriched_tip']}건")
    print(f"  -- 보강 실패 (유지): {stats['unchanged']}건")
    print(f"  총 업데이트: {len(updates)}건")

    # Remaining numeric analysis
    remaining = conn.execute(
        "SELECT id, name, quest_conditions, tip FROM quests WHERE quest_conditions IS NOT NULL"
    ).fetchall()
    still_numeric = 0
    partial = 0
    for r in remaining:
        conds = json.loads(r["quest_conditions"])
        if not conds:
            continue
        nums = sum(1 for c in conds if c.isdigit())
        if nums == len(conds):
            still_numeric += 1
        elif nums > 0:
            partial += 1
    print(f"\n  [결과] 완전 보강: {len(remaining) - still_numeric - partial}건")
    print(f"  [결과] 부분 보강: {partial}건")
    print(f"  [결과] 미보강 (숫자): {still_numeric}건")

    # Samples
    print("\n[샘플 - 보강된 퀘스트]")
    samples = conn.execute(
        "SELECT id, name, quest_conditions FROM quests WHERE quest_conditions IS NOT NULL ORDER BY id LIMIT 30"
    ).fetchall()
    for s in samples:
        conds = json.loads(s["quest_conditions"])
        has_num = any(c.isdigit() for c in conds)
        marker = "  " if not has_num else "!!"
        print(f"  {marker} #{s['id']} {s['name']}: {s['quest_conditions']}")

    conn.close()
    print("\n완료!")


if __name__ == "__main__":
    main()
