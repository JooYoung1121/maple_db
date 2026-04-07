#!/usr/bin/env python3
"""
퀘스트 조건 & 보상 데이터 보강 스크립트 v2

숫자만 있는 quest_conditions를 "몹이름 N마리" / "아이템이름 N개" 형태로 변환.
item_reward 필드도 WZ/KMS 데이터 기반으로 보강.

데이터 소스:
1. kms_quest_cache (DB) — quest_id -> name_kr, requirementToComplete, rewardOnComplete
2. entity_names_en (DB, source='kms') — mob/item ID -> 한국어 이름
3. Quest_Check.json (WZ) — mob/item 완료 조건
4. Quest_Act.json (WZ) — 보상 아이템
5. TIP 필드 — 몹 이름 힌트 (최후 수단)

v2 개선:
- 더 정교한 퀘스트 이름 매칭 (접두사, 괄호 제거, 번호 매칭 등)
- 부분 매칭 지원 (일부만 숫자인 경우도 처리)
- item_reward 보강 추가
- WZ Quest_Act.json에서 보상 정보 추출
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
    """퀘스트 이름 정규화: 레벨 제한, 괄호 접두사 등 제거"""
    if not name:
        return ""
    s = name.strip()
    # (~Lv.29) 만지와 비밀조직 -> 만지와 비밀조직
    s = re.sub(r"^\(~?Lv\.?\d+\)\s*", "", s)
    # [끈기의숲] 존의 분홍색 꽃 바구니 -> 존의 분홍색 꽃 바구니
    s = re.sub(r"^\[[^\]]+\]\s*", "", s)
    # 신기한 고양이 펜시 (넬라의 꿈) -> 넬라의 꿈 도 시도
    s = re.sub(r"\s+", " ", s).strip()
    return s


def extract_parenthetical(name):
    """괄호 안 내용 추출: '신기한 고양이 펜시 (넬라의 꿈)' -> '넬라의 꿈'"""
    m = re.search(r"\(([^)]+)\)\s*$", name)
    return m.group(1).strip() if m else None


ROMAN_TO_ARABIC = {"Ⅰ": "1", "Ⅱ": "2", "Ⅲ": "3", "Ⅳ": "4", "Ⅴ": "5",
                    "Ⅵ": "6", "Ⅶ": "7", "Ⅷ": "8", "Ⅸ": "9", "Ⅹ": "10"}
ARABIC_TO_ROMAN = {v: k for k, v in ROMAN_TO_ARABIC.items()}


def strip_trailing_number(name):
    """끝의 숫자 제거: '메이플 고서를 되찾아라 1' -> '메이플 고서를 되찾아라'"""
    return re.sub(r"\s*\d+\s*$", "", name).strip()


def normalize_number_suffix(name):
    """아라비아 숫자 ↔ 로마 숫자 변환 버전 생성"""
    variants = [name]
    # Arabic -> Roman: '플로리나비치의 별미 2' -> '플로리나비치의 별미 Ⅱ'
    m = re.match(r"^(.+?)\s*(\d+)$", name)
    if m and m.group(2) in ARABIC_TO_ROMAN:
        variants.append(f"{m.group(1).strip()} {ARABIC_TO_ROMAN[m.group(2)]}")
    # Roman -> Arabic: '플로리나비치의 별미 Ⅱ' -> '플로리나비치의 별미 2'
    for roman, arabic in ROMAN_TO_ARABIC.items():
        if name.endswith(f" {roman}"):
            base = name[: -len(roman) - 1].strip()
            variants.append(f"{base} {arabic}")
    return variants


def build_kms_name_index(conn):
    """kms_quest_cache에서 다양한 형태의 이름 -> quest_id 인덱스 구축"""
    rows = conn.execute(
        "SELECT quest_id, name_kr FROM kms_quest_cache WHERE name_kr IS NOT NULL"
    ).fetchall()

    exact = {}           # 정확한 이름 매칭
    normalized = {}      # 정규화된 이름 매칭
    stripped_bracket = {} # [지역] 접두사 제거
    stripped_num = {}     # 끝 번호 제거

    for quest_id, name_kr in rows:
        name = name_kr.strip()
        if not name:
            continue
        exact[name] = quest_id

        norm = normalize_name(name)
        if norm and norm != name:
            normalized[norm] = quest_id

        # [xxx] 접두사 제거 버전
        bracket_stripped = re.sub(r"^\[[^\]]+\]\s*", "", name).strip()
        if bracket_stripped and bracket_stripped != name:
            stripped_bracket[bracket_stripped] = quest_id

        # 끝 번호 제거
        no_num = strip_trailing_number(name)
        if no_num and no_num != name:
            if no_num not in stripped_num:
                stripped_num[no_num] = quest_id

    return exact, normalized, stripped_bracket, stripped_num, rows


def match_db_quest_to_wz_all(db_name, exact_idx, norm_idx, bracket_idx, num_idx, kms_rows):
    """DB 퀘스트 이름으로 가능한 WZ 퀘스트 ID 모두 찾기 (우선순위 순서대로)"""
    name = db_name.strip()
    candidates = []
    seen = set()

    def add(qid):
        if qid not in seen:
            seen.add(qid)
            candidates.append(qid)

    norm = normalize_name(name)

    # Generate all name variants (Arabic/Roman numeral conversion)
    all_names = set()
    for n in [name, norm]:
        all_names.update(normalize_number_suffix(n))
    all_names.add(name)
    all_names.add(norm)

    # Strategy 1-3: 정확/정규화/접두사 매칭 (모든 변형 시도)
    for variant in all_names:
        if variant in exact_idx:
            add(exact_idx[variant])
        if variant in norm_idx:
            add(norm_idx[variant])
        if variant in bracket_idx:
            add(bracket_idx[variant])

    # Strategy 4: 괄호 안 내용으로 매칭
    paren = extract_parenthetical(name)
    if paren:
        if paren in exact_idx:
            add(exact_idx[paren])
        if paren in norm_idx:
            add(norm_idx[paren])

    # Strategy 5: 끝 번호 제거 후 매칭
    no_num = strip_trailing_number(norm)
    if no_num and no_num != norm:
        if no_num in exact_idx:
            add(exact_idx[no_num])
        if no_num in norm_idx:
            add(norm_idx[no_num])
        if no_num in bracket_idx:
            add(bracket_idx[no_num])
        if no_num in num_idx:
            add(num_idx[no_num])

    # Strategy 6: substring match — collect ALL matches
    for quest_id, kms_name in kms_rows:
        kms_name = kms_name.strip()
        kms_norm = normalize_name(kms_name)
        if not kms_norm or not norm:
            continue
        if norm == kms_norm:
            add(quest_id)
        elif len(norm) >= 4 and norm in kms_norm:
            add(quest_id)
        elif len(kms_norm) >= 4 and kms_norm in norm:
            add(quest_id)

    # Strategy 7: 괄호 안 내용으로 substring
    if paren:
        for quest_id, kms_name in kms_rows:
            kms_norm = normalize_name(kms_name.strip())
            if paren == kms_norm:
                add(quest_id)

    # Strategy 8: 키워드 기반 매칭 (한국어 단어 전부 시도)
    if not candidates:
        korean_words = re.findall(r"[가-힣]{2,}", norm)
        if korean_words:
            # 모든 키워드로 검색 (긴 것 우선이지만 전부 시도)
            for keyword in sorted(korean_words, key=len, reverse=True):
                for quest_id, kms_name in kms_rows:
                    kms_stripped = kms_name.strip()
                    if keyword in kms_stripped:
                        add(quest_id)

    return candidates


def pick_best_wz_id(candidates, conditions, conn, quest_check):
    """
    여러 후보 WZ ID 중 conditions에 가장 잘 맞는 것 선택.
    숫자 조건의 개수/값이 일치하는 후보를 우선.
    """
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]

    numeric_counts = []
    for c in conditions:
        try:
            numeric_counts.append(int(c.strip()))
        except ValueError:
            pass
    num_conds = len(numeric_counts)

    if num_conds == 0:
        return candidates[0]

    best_id = candidates[0]
    best_score = -1

    for wz_id in candidates:
        mobs, items = extract_requirements_from_kms_cache(conn, wz_id)
        if not mobs and not items:
            mobs, items = extract_requirements_from_wz_check(quest_check, wz_id)

        total_reqs = len(mobs) + len(items)
        if total_reqs == 0:
            continue

        score = 0
        # 개수 일치 보너스
        if total_reqs == num_conds:
            score += 100
        # count 값 일치 보너스
        req_counts = [c for _, c in mobs] + [c for _, c in items]
        for nc in numeric_counts:
            if nc in req_counts:
                score += 10
                req_counts.remove(nc)  # 한 번만 매칭

        if score > best_score:
            best_score = score
            best_id = wz_id

    return best_id


def get_entity_names_kr(conn):
    """entity_names_en에서 한국어 이름 사전 구축 + items/mobs 테이블 영문 이름 fallback"""
    mob_names = {}
    item_names = {}
    npc_names = {}

    # Primary: KMS 한국어 이름
    rows = conn.execute(
        "SELECT entity_type, entity_id, name_en FROM entity_names_en WHERE source='kms'"
    ).fetchall()
    for etype, eid, name in rows:
        if etype == "mob":
            mob_names[eid] = name
        elif etype == "item":
            item_names[eid] = name
        elif etype == "npc":
            npc_names[eid] = name

    # Fallback: mobs/items 테이블 (영문)
    for mid, mname in conn.execute("SELECT id, name FROM mobs").fetchall():
        if mid not in mob_names:
            mob_names[mid] = mname  # English name as fallback
    for iid, iname in conn.execute("SELECT id, name FROM items").fetchall():
        if iid not in item_names:
            item_names[iid] = iname  # English name as fallback

    return mob_names, item_names, npc_names


def extract_requirements_from_kms_cache(conn, wz_quest_id):
    """KMS 캐시에서 퀘스트 완료 조건 추출"""
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
    if not isinstance(req, dict):
        return [], []
    mobs = [
        (m["id"], m["count"])
        for m in req.get("mobs", [])
        if isinstance(m, dict) and m.get("id") and m.get("count", 0) > 0
    ]
    items = [
        (it["id"], it["count"])
        for it in req.get("items", [])
        if isinstance(it, dict) and it.get("id") and it.get("count", 0) > 0
    ]
    return mobs, items


def extract_requirements_from_wz_check(quest_check, wz_quest_id):
    """WZ Quest_Check.json에서 퀘스트 완료 조건 추출 (phase "1" = 완료 단계)"""
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
        for key in sorted(phase["mob"].keys(), key=lambda x: int(x) if x.isdigit() else 999):
            m = phase["mob"][key]
            if isinstance(m, dict) and m.get("id") and m.get("count", 0) > 0:
                mobs.append((m["id"], m["count"]))
    if "item" in phase and isinstance(phase["item"], dict):
        for key in sorted(phase["item"].keys(), key=lambda x: int(x) if x.isdigit() else 999):
            it = phase["item"][key]
            if isinstance(it, dict) and it.get("id") and it.get("count", 0) > 0:
                items.append((it["id"], it["count"]))
    return mobs, items


def extract_rewards_from_kms_cache(conn, wz_quest_id):
    """KMS 캐시에서 보상 아이템 추출"""
    row = conn.execute(
        "SELECT raw_json FROM kms_quest_cache WHERE quest_id = ? AND raw_json IS NOT NULL",
        (wz_quest_id,),
    ).fetchone()
    if not row:
        return []
    try:
        raw = json.loads(row[0])
    except (json.JSONDecodeError, TypeError):
        return []
    roc = raw.get("rewardOnComplete", {})
    if not isinstance(roc, dict):
        return []
    items = []
    for it in roc.get("items", []):
        if isinstance(it, dict) and it.get("id") and it.get("count", 0) > 0:
            items.append((it["id"], it["count"]))
    return items


def extract_rewards_from_wz_act(quest_act, wz_quest_id):
    """WZ Quest_Act.json에서 보상 아이템 추출 (phase "1" = 완료 보상)"""
    qid_str = str(wz_quest_id)
    if qid_str not in quest_act:
        return []
    phases = quest_act[qid_str]
    if not isinstance(phases, dict):
        return []
    phase = phases.get("1", {})
    if not isinstance(phase, dict):
        return []
    items = []
    if "item" in phase and isinstance(phase["item"], dict):
        for key in sorted(phase["item"].keys(), key=lambda x: int(x) if x.isdigit() else 999):
            it = phase["item"][key]
            if isinstance(it, dict) and it.get("id") and it.get("count", 0) > 0:
                items.append((it["id"], it["count"]))
    return items


def extract_mob_name_from_tip(tip):
    """TIP 필드에서 몹 이름 힌트 추출"""
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
    """숫자 조건을 한국어 이름으로 변환"""
    if not original_conditions:
        return original_conditions, False

    # 어떤 조건이 숫자인지 체크
    numeric_indices = [i for i, c in enumerate(original_conditions) if c.strip().isdigit()]
    if not numeric_indices:
        return original_conditions, False

    cond_counts = []
    for c in original_conditions:
        try:
            cond_counts.append(int(c.strip()))
        except ValueError:
            cond_counts.append(None)

    # Build requirement list: mobs first, then items (엑셀 순서와 일치)
    requirements = []
    for mob_id, count in mobs:
        name = mob_names_dict.get(mob_id, f"몹#{mob_id}")
        requirements.append({"name": name, "count": count, "unit": "마리", "type": "mob", "id": mob_id})
    for item_id, count in items:
        name = item_names_dict.get(item_id, f"아이템#{item_id}")
        requirements.append({"name": name, "count": count, "unit": "개", "type": "item", "id": item_id})

    result = list(original_conditions)
    changed = False

    if not requirements:
        # TIP 힌트만으로 시도
        if tip_mob_hints and numeric_indices:
            hint = tip_mob_hints[0]
            for idx in numeric_indices:
                count = cond_counts[idx]
                if count is not None:
                    if len(numeric_indices) == 1:
                        result[idx] = f"{hint} {count}마리"
                    elif idx == numeric_indices[0]:
                        result[idx] = f"{hint} {count}마리"
                    else:
                        result[idx] = f"{hint} 드롭 아이템 {count}개"
                    changed = True
        return result, changed

    num_count = len(numeric_indices)
    num_reqs = len(requirements)

    # Case 1: 숫자 조건 수 == 요구 조건 수 (순서대로 매칭)
    if num_count == num_reqs:
        for i, idx in enumerate(numeric_indices):
            req = requirements[i]
            count = cond_counts[idx]
            if count is not None:
                result[idx] = f"{req['name']} {count}{req['unit']}"
                changed = True
        return result, changed

    # Case 2: count 값으로 매칭 시도
    used_reqs = set()
    matched = {}

    # Pass 1: 정확한 count 매칭
    for idx in numeric_indices:
        count = cond_counts[idx]
        if count is None:
            continue
        for j, req in enumerate(requirements):
            if j not in used_reqs and req["count"] == count:
                matched[idx] = j
                used_reqs.add(j)
                break

    # Pass 2: 남은 것들 순차 할당
    remaining_reqs = [j for j in range(num_reqs) if j not in used_reqs]
    remaining_indices = [idx for idx in numeric_indices if idx not in matched]
    for idx, j in zip(remaining_indices, remaining_reqs):
        matched[idx] = j

    # 적용
    for idx, j in matched.items():
        req = requirements[j]
        count = cond_counts[idx]
        if count is not None:
            result[idx] = f"{req['name']} {count}{req['unit']}"
            changed = True

    # 아직 남은 숫자 조건에 TIP 힌트 적용
    still_numeric = [idx for idx in numeric_indices if idx not in matched]
    if still_numeric and tip_mob_hints:
        hint = tip_mob_hints[0]
        for idx in still_numeric:
            count = cond_counts[idx]
            if count is not None:
                result[idx] = f"{hint} 드롭 아이템 {count}개"
                changed = True

    # 남은 건에 대해: 몹 조건이 있으면 "X 드롭 아이템"으로 추정
    still_numeric2 = [idx for idx in numeric_indices if result[idx].strip().isdigit()]
    if still_numeric2 and mobs and mob_names_dict:
        # 첫 번째 몹의 드롭 아이템으로 추정
        first_mob_name = mob_names_dict.get(mobs[0][0], "")
        if first_mob_name:
            for idx in still_numeric2:
                count = cond_counts[idx]
                if count is not None:
                    result[idx] = f"{first_mob_name} 드롭 아이템 {count}개"
                    changed = True

    return result, changed


def build_enriched_item_reward(
    current_reward, reward_items, item_names_dict
):
    """item_reward 필드 보강"""
    if not reward_items:
        return current_reward, False

    # 이미 잘 되어있는 경우 건드리지 않음
    if current_reward and current_reward not in ("or", "and", ""):
        # 숫자만 있는지 체크
        if not current_reward.strip().isdigit():
            return current_reward, False

    # 보상 아이템 이름 생성
    reward_names = []
    for item_id, count in reward_items:
        name = item_names_dict.get(item_id, "")
        if not name:
            name = f"아이템#{item_id}"
        if count > 1:
            reward_names.append(f"{name} {count}개")
        else:
            reward_names.append(name)

    if not reward_names:
        return current_reward, False

    # "or" / "and" 상태이면 보상 아이템 이름으로 교체
    if current_reward in ("or", "and"):
        separator = " | " if current_reward == "or" else " + "
        new_reward = separator.join(reward_names)
        if current_reward == "or":
            new_reward += " 중 1개 랜덤"
        return new_reward, True

    # 빈 값이면 보상 설정
    if not current_reward or current_reward.strip() == "":
        new_reward = " | ".join(reward_names) if len(reward_names) > 1 else reward_names[0]
        return new_reward, True

    return current_reward, False


def main():
    print("=" * 60)
    print("퀘스트 조건 & 보상 보강 스크립트 v2")
    print("=" * 60)

    if not os.path.exists(DB_PATH):
        print(f"ERROR: DB not found: {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # ── Step 1: 데이터 로드 ──
    print("\n[1] 데이터 로드...")

    exact_idx, norm_idx, bracket_idx, num_idx, kms_rows = build_kms_name_index(conn)
    kms_rows_list = [(qid, name) for qid, name in kms_rows if name]
    print(f"  KMS quest cache: {len(exact_idx)}건")

    mob_names_dict, item_names_dict, npc_names_dict = get_entity_names_kr(conn)
    print(f"  한국어 몹 이름: {len(mob_names_dict)}건")
    print(f"  한국어 아이템 이름: {len(item_names_dict)}건")
    print(f"  한국어 NPC 이름: {len(npc_names_dict)}건")

    quest_check = load_json("Quest_Check.json")
    quest_act = load_json("Quest_Act.json")
    print(f"  Quest_Check.json: {len(quest_check)}건")
    print(f"  Quest_Act.json: {len(quest_act)}건")

    # ── Step 2: 퀘스트 이름 → WZ ID 매핑 ──
    print("\n[2] 퀘스트 이름 → WZ ID 매핑...")

    all_quests = conn.execute(
        "SELECT id, name, quest_conditions, item_reward, tip FROM quests"
    ).fetchall()

    name_to_wz_candidates = {}
    matched_count = 0
    for quest in all_quests:
        db_name = quest["name"]
        candidates = match_db_quest_to_wz_all(
            db_name, exact_idx, norm_idx, bracket_idx, num_idx, kms_rows_list
        )
        if candidates:
            name_to_wz_candidates[db_name] = candidates
            matched_count += 1

    print(f"  전체 퀘스트: {len(all_quests)}건")
    print(f"  WZ ID 후보 매칭: {matched_count}건 ({matched_count*100//len(all_quests)}%)")
    print(f"  매칭 실패: {len(all_quests) - matched_count}건")

    # ── Step 3: 조건 보강 ──
    print("\n[3] 퀘스트 조건 보강...")

    cond_stats = {
        "total_with_conds": 0,
        "already_text": 0,
        "all_numeric": 0,
        "partial_numeric": 0,
        "enriched_kms": 0,
        "enriched_wz": 0,
        "enriched_tip": 0,
        "unchanged": 0,
    }
    cond_updates = []

    for quest in all_quests:
        db_id = quest["id"]
        db_name = quest["name"]
        tip = quest["tip"] or ""
        cond_str = quest["quest_conditions"]

        if not cond_str:
            continue

        try:
            conditions = json.loads(cond_str)
        except (json.JSONDecodeError, TypeError):
            continue
        if not conditions:
            continue

        cond_stats["total_with_conds"] += 1

        # 숫자 포함 여부 체크
        numeric_indices = [i for i, c in enumerate(conditions) if c.strip().isdigit()]
        if not numeric_indices:
            cond_stats["already_text"] += 1
            continue

        if len(numeric_indices) == len(conditions):
            cond_stats["all_numeric"] += 1
        else:
            cond_stats["partial_numeric"] += 1

        # WZ ID로 조건 추출 (여러 후보 중 최적 선택)
        candidates = name_to_wz_candidates.get(db_name, [])
        wz_id = pick_best_wz_id(candidates, conditions, conn, quest_check)
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

        enriched, changed = build_enriched_conditions(
            conditions, mobs, items, mob_names_dict, item_names_dict, tip_mob_hints
        )

        if changed:
            cond_updates.append((json.dumps(enriched, ensure_ascii=False), db_id))
            if source == "kms":
                cond_stats["enriched_kms"] += 1
            elif source == "wz":
                cond_stats["enriched_wz"] += 1
            else:
                cond_stats["enriched_tip"] += 1
        else:
            cond_stats["unchanged"] += 1

    # ── Step 4: 보상 보강 ──
    print("\n[4] 보상 아이템 보강...")

    reward_stats = {
        "total_or_and": 0,
        "enriched": 0,
        "unchanged": 0,
    }
    reward_updates = []

    for quest in all_quests:
        db_id = quest["id"]
        db_name = quest["name"]
        current_reward = quest["item_reward"] or ""

        # "or", "and", 또는 비어있는 보상만 대상
        if current_reward not in ("or", "and", ""):
            continue

        if current_reward in ("or", "and"):
            reward_stats["total_or_and"] += 1

        candidates = name_to_wz_candidates.get(db_name, [])
        wz_id = candidates[0] if candidates else None
        if not wz_id:
            if current_reward in ("or", "and"):
                reward_stats["unchanged"] += 1
            continue

        reward_items = extract_rewards_from_kms_cache(conn, wz_id)
        if not reward_items:
            reward_items = extract_rewards_from_wz_act(quest_act, wz_id)

        new_reward, changed = build_enriched_item_reward(
            current_reward, reward_items, item_names_dict
        )

        if changed:
            reward_updates.append((new_reward, db_id))
            reward_stats["enriched"] += 1
        elif current_reward in ("or", "and"):
            reward_stats["unchanged"] += 1

    # ── Step 5: DB 업데이트 ──
    print(f"\n[5] DB 업데이트...")
    print(f"  조건 업데이트: {len(cond_updates)}건")
    print(f"  보상 업데이트: {len(reward_updates)}건")

    conn.execute("BEGIN")
    for new_conds, db_id in cond_updates:
        conn.execute("UPDATE quests SET quest_conditions = ? WHERE id = ?", (new_conds, db_id))
    for new_reward, db_id in reward_updates:
        conn.execute("UPDATE quests SET item_reward = ? WHERE id = ?", (new_reward, db_id))
    conn.commit()

    # ── 통계 ──
    print("\n" + "=" * 60)
    print("조건 보강 통계")
    print("=" * 60)
    print(f"  전체 조건 있는 퀘스트: {cond_stats['total_with_conds']}건")
    print(f"  이미 텍스트 조건:      {cond_stats['already_text']}건")
    print(f"  전부 숫자 조건:        {cond_stats['all_numeric']}건")
    print(f"  부분 숫자 조건:        {cond_stats['partial_numeric']}건")
    print(f"  ── KMS 캐시로 보강:   {cond_stats['enriched_kms']}건")
    print(f"  ── WZ Check로 보강:   {cond_stats['enriched_wz']}건")
    print(f"  ── TIP 힌트로 보강:   {cond_stats['enriched_tip']}건")
    print(f"  ── 보강 실패 (유지):  {cond_stats['unchanged']}건")
    print(f"  총 조건 업데이트:      {len(cond_updates)}건")

    print(f"\n보상 보강 통계")
    print(f"  'or'/'and' 보상:      {reward_stats['total_or_and']}건")
    print(f"  ── 보강 성공:         {reward_stats['enriched']}건")
    print(f"  ── 보강 실패:         {reward_stats['unchanged']}건")
    print(f"  총 보상 업데이트:      {len(reward_updates)}건")

    # ── 최종 결과 분석 ──
    print("\n" + "=" * 60)
    print("최종 결과 분석")
    print("=" * 60)

    remaining = conn.execute(
        "SELECT id, name, quest_conditions FROM quests WHERE quest_conditions IS NOT NULL"
    ).fetchall()

    fully_text = 0
    still_numeric = 0
    partial = 0
    empty = 0
    still_numeric_list = []

    for r in remaining:
        try:
            conds = json.loads(r["quest_conditions"])
        except:
            continue
        if not conds:
            empty += 1
            continue
        nums = sum(1 for c in conds if c.strip().isdigit())
        if nums == 0:
            fully_text += 1
        elif nums == len(conds):
            still_numeric += 1
            still_numeric_list.append((r["name"], r["quest_conditions"]))
        else:
            partial += 1

    total_with_conds = fully_text + still_numeric + partial
    print(f"  완전 텍스트 (100%):   {fully_text}건 ({fully_text*100//max(total_with_conds,1)}%)")
    print(f"  부분 텍스트:          {partial}건")
    print(f"  숫자만 남음:          {still_numeric}건")
    print(f"  빈 조건:              {empty}건")

    if total_with_conds > 0:
        enriched_pct = (fully_text + partial) * 100 // total_with_conds
        print(f"\n  보강률: {enriched_pct}% ({fully_text + partial}/{total_with_conds})")

    # 남은 숫자 퀘스트 목록
    if still_numeric_list:
        print(f"\n[미보강 퀘스트 - 숫자만 남은 {len(still_numeric_list)}건]")
        for name, conds in still_numeric_list[:30]:
            print(f"  - {name}: {conds}")
        if len(still_numeric_list) > 30:
            print(f"  ... 외 {len(still_numeric_list) - 30}건")

    # 샘플 출력
    print(f"\n[보강 결과 샘플 (최근 업데이트)]")
    if cond_updates:
        for new_conds, db_id in cond_updates[:20]:
            name = conn.execute("SELECT name FROM quests WHERE id = ?", (db_id,)).fetchone()["name"]
            print(f"  ✓ {name}: {new_conds}")

    if reward_updates:
        print(f"\n[보상 보강 샘플]")
        for new_reward, db_id in reward_updates[:15]:
            name = conn.execute("SELECT name FROM quests WHERE id = ?", (db_id,)).fetchone()["name"]
            print(f"  ✓ {name}: {new_reward}")

    conn.close()
    print("\n완료!")


if __name__ == "__main__":
    main()
