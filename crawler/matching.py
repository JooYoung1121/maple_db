from __future__ import annotations
"""한영 데이터 매칭 — Hidden Street ↔ maplestory.io ↔ mapledb.kr"""

import re
import sqlite3
from difflib import SequenceMatcher
from datetime import datetime, timezone


def run_matching(conn: sqlite3.Connection) -> None:
    """
    Hidden Street 엔티티를 maplestory.io 영문명 경유로 maple_id에 매칭.

    3단계:
    1. Tier 1 (정확): hidden_street.name_en == entity_names_en.name_en
    2. Tier 2 (정규화): 소문자 + 특수문자 제거 후 비교
    3. Tier 3 (퍼지): SequenceMatcher >= 0.85
    """
    now = datetime.now(timezone.utc).isoformat()

    # 미매칭 Hidden Street 엔티티 가져오기
    hs_rows = conn.execute(
        "SELECT id, entity_type, slug, name_en FROM hidden_street_entities WHERE maple_id IS NULL"
    ).fetchall()

    if not hs_rows:
        print("[match] 매칭할 Hidden Street 엔티티 없음")
        return

    # maplestory.io 영문명 인덱스 구축
    en_rows = conn.execute(
        "SELECT entity_type, entity_id, name_en FROM entity_names_en WHERE source = 'maplestory_io'"
    ).fetchall()

    # entity_type → {name_en: entity_id}  (정확 매칭용)
    exact_index: dict[str, dict[str, int]] = {}
    # entity_type → {normalized_name: entity_id}  (정규화 매칭용)
    norm_index: dict[str, dict[str, int]] = {}
    # entity_type → [(name_en, entity_id)]  (퍼지 매칭용)
    fuzzy_list: dict[str, list[tuple[str, int]]] = {}

    for row in en_rows:
        etype = row["entity_type"]
        eid = row["entity_id"]
        name = row["name_en"]

        exact_index.setdefault(etype, {})[name] = eid
        norm_index.setdefault(etype, {})[_normalize(name)] = eid
        fuzzy_list.setdefault(etype, []).append((name, eid))

    tier1 = tier2 = tier3 = 0
    total = len(hs_rows)

    for hs in hs_rows:
        hs_id = hs["id"]
        etype = hs["entity_type"]
        hs_name = hs["name_en"]

        maple_id: int | None = None
        match_source = ""

        # Tier 1: 정확 매칭
        if etype in exact_index and hs_name in exact_index[etype]:
            maple_id = exact_index[etype][hs_name]
            match_source = "exact_match"
            tier1 += 1

        # Tier 2: 정규화 매칭
        if maple_id is None:
            norm_name = _normalize(hs_name)
            if etype in norm_index and norm_name in norm_index[etype]:
                maple_id = norm_index[etype][norm_name]
                match_source = "normalized_match"
                tier2 += 1

        # Tier 3: 퍼지 매칭 (SequenceMatcher >= 0.85)
        if maple_id is None and etype in fuzzy_list:
            best_ratio = 0.0
            best_id = None
            norm_hs = _normalize(hs_name)
            for en_name, eid in fuzzy_list[etype]:
                ratio = SequenceMatcher(None, norm_hs, _normalize(en_name)).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_id = eid
            if best_ratio >= 0.85 and best_id is not None:
                maple_id = best_id
                match_source = "fuzzy_match"
                tier3 += 1

        if maple_id is not None:
            # hidden_street_entities에 maple_id 설정
            conn.execute(
                "UPDATE hidden_street_entities SET maple_id = ? WHERE id = ?",
                (maple_id, hs_id),
            )

            # entity_names_en에도 Hidden Street 소스로 추가
            conn.execute(
                """INSERT OR REPLACE INTO entity_names_en
                   (entity_type, entity_id, name_en, source, source_url, last_crawled_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    etype, maple_id, hs_name,
                    f"hidden_street_{match_source}",
                    f"https://bbb.hidden-street.net/monster/{hs['slug']}" if etype == "mob" else None,
                    now,
                ),
            )

    conn.commit()
    matched = tier1 + tier2 + tier3
    print(f"[match] 완료: {matched}/{total} 매칭")
    print(f"  Tier 1 (정확): {tier1}")
    print(f"  Tier 2 (정규화): {tier2}")
    print(f"  Tier 3 (퍼지): {tier3}")
    print(f"  미매칭: {total - matched}")


def _normalize(name: str) -> str:
    """이름 정규화: 소문자 + 특수문자/공백 제거."""
    return re.sub(r"[^a-z0-9]", "", name.lower())
