#!/usr/bin/env python3
"""데이터 품질 패치 — 2026-09-29 전수 감사에서 확인된 결손 보수.

감사 근거 (data/maple.db 읽기 전용 사본에서 SELECT로 확인):
1. 레퍼런스 노출 장비 30종의 overall_category 가 NULL — category/subcategory 는
   정상('Armor', 'Two-Handed Weapon')인데 상위 분류만 비어 있어, overall_category='Equip'
   으로 거르는 장비 목록/검색에서 통째로 누락된다. 타임리스/리버스 콘라드 헨켈(1002780/1002794),
   카티나스·카테 계열 등 실사용 장비 포함.
2. 레퍼런스 노출 엔티티의 한글 표시명(entity_names_en, source='kms') 누락 —
   몹 18·맵 43·NPC 18 건이 사이트에서 영문(GMS)으로 노출된다. 전부 닌자성/지하 감옥
   계열 등으로, data/mapleland_reference.json 에 한글명이 이미 있어 기계적 백필이 가능.
   source='kms' 슬롯은 관리자 이름 수정 경로(api/routes/admin.py)도 쓰는 "표시명 정본"
   슬롯이며, start.sh 가 INSERT OR IGNORE 로 라이브에 추가 동기화한다.

사용:
  python3 scripts/patch_20260930_data_quality.py            # dry-run
  python3 scripts/patch_20260930_data_quality.py --apply
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"

# 장비로 판정하는 category 값 (items 테이블 실측 기준)
EQUIP_CATEGORIES = ("Armor", "One-Handed Weapon", "Two-Handed Weapon", "Accessory", "Mount")

# mapleland_reference.py INVALID_DISPLAY_NAMES 와 동일 규칙
INVALID_DISPLAY_NAMES = {"스트링 없음", "string not found", "null", "none"}

# (reference kind, entity_names_en entity_type, DB 테이블)
NAME_KINDS = [("mobs", "mob", "mobs"), ("maps", "map", "maps"), ("npcs", "npc", "npcs")]


def valid_name(value: object) -> bool:
    name = str(value or "").strip()
    return bool(name) and name.lower() not in INVALID_DISPLAY_NAMES


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))["entities"]
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # ── 1. overall_category 백필 ──
    item_ids = {int(r["id"]) for r in ref["items"]["records"]}
    ph = ",".join("?" * len(EQUIP_CATEGORIES))
    rows = conn.execute(
        f"SELECT id, name, category, subcategory FROM items "
        f"WHERE overall_category IS NULL AND category IN ({ph})",
        EQUIP_CATEGORIES,
    ).fetchall()
    targets = [r for r in rows if r["id"] in item_ids]
    print(f"[1] overall_category NULL 노출 장비: {len(targets)}건")
    for r in targets:
        print(f"    {r['id']} {r['name']} ({r['category']}/{r['subcategory']}) → Equip")
    if args.apply and targets:
        conn.executemany(
            "UPDATE items SET overall_category='Equip' WHERE id=?",
            [(r["id"],) for r in targets],
        )

    # ── 2. 한글 표시명(kms 슬롯) 백필 ──
    total_added = 0
    for kind, entity_type, table in NAME_KINDS:
        records = {
            int(r["id"]): str(r["name_kr"]).strip()
            for r in ref[kind]["records"]
            if valid_name(r.get("name_kr"))
        }
        have = {
            r["entity_id"]
            for r in conn.execute(
                "SELECT entity_id FROM entity_names_en WHERE entity_type=? AND source='kms'",
                (entity_type,),
            )
        }
        exists_in_db = {
            r["id"] for r in conn.execute(f"SELECT id FROM {table}")
        }
        missing = sorted(set(records) & exists_in_db - have)
        print(f"[2] {entity_type} 한글명 누락(노출·레퍼런스 보유): {len(missing)}건")
        for eid in missing:
            print(f"    {eid} → {records[eid]}")
        if args.apply and missing:
            conn.executemany(
                "INSERT OR IGNORE INTO entity_names_en "
                "(entity_type, entity_id, name_en, source, source_url) "
                "VALUES (?, ?, ?, 'kms', 'data/mapleland_reference.json')",
                [(entity_type, eid, records[eid]) for eid in missing],
            )
            total_added += len(missing)

    if args.apply:
        conn.commit()
        print(f"\nAPPLIED — overall_category {len(targets)}건, 한글명 {total_added}건")
    else:
        print("\nDRY-RUN — 반영하려면 --apply")
    conn.close()


if __name__ == "__main__":
    main()
