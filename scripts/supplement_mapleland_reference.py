#!/usr/bin/env python3
"""메이플랜드 레퍼런스(mapleland_reference.json)에 드롭 보유 고아 몹 보강.

문제: 레퍼런스(mapledb.kr 크롤, 749몹)가 불완전해 혼테일·핑크빈·시간의 신전·쇼와타운
등이 빠져 있다. 사이트는 이 레퍼런스 ID로만 몹을 노출하므로, 드롭이 있어도 해당 몹이
레퍼런스에 없으면 안 보인다.

해결: mob_drops 가 있는데 레퍼런스에 없는 몹(고아) 중 KMS 한글명이 있는 것을 레퍼런스
records 에 추가한다. ID는 표준 구메이플 ID(메이플랜드도 동일)라 그대로 사용.

주의: sync_mapleland_reference.js 가 이 파일을 재생성하면 보강분이 사라지므로, 재싱크 후
이 스크립트를 다시 실행하면 된다(멱등 — 이미 있는 id 는 건너뜀).

사용:
  python3 scripts/supplement_mapleland_reference.py            # dry-run
  python3 scripts/supplement_mapleland_reference.py --apply
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    mobs_node = ref["entities"]["mobs"]
    existing_ids = {int(r["id"]) for r in mobs_node["records"]}

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # 드롭 보유 + 레퍼런스 미수록 + KMS 한글명 존재 몹
    rows = conn.execute(
        """
        SELECT DISTINCT d.mob_id AS id, m.level, m.hp,
               (SELECT name_en FROM entity_names_en
                WHERE entity_type='mob' AND entity_id=d.mob_id AND source='kms') AS name_kr
        FROM mob_drops d JOIN mobs m ON m.id = d.mob_id
        """
    ).fetchall()

    to_add = []
    skipped_named = 0
    for r in rows:
        mid = r["id"]
        if mid in existing_ids:
            continue
        name = (r["name_kr"] or "").strip()
        if not name:
            skipped_named += 1
            continue
        # 보스 마커 [★] 등 대괄호 접두어 제거 (레퍼런스 명명 관례에 맞춤)
        clean = re.sub(r"^\s*\[[^\]]*\]\s*", "", name).strip()
        to_add.append({
            "id": mid,
            "name_kr": clean or name,
            "level": r["level"] or 0,
            "hp": r["hp"] or 0,
        })

    to_add.sort(key=lambda x: (x["level"], x["id"]))
    print(f"레퍼런스 현재 몹: {len(existing_ids)}")
    print(f"추가 대상(드롭 보유·미수록·이름 있음): {len(to_add)}")
    print(f"이름 없어 제외: {skipped_named}")
    print("\n[추가 예시]")
    for x in to_add[:12]:
        print(f"  {x['id']} {x['name_kr']} (Lv.{x['level']})")
    if len(to_add) > 12:
        print(f"  ... 외 {len(to_add)-12}")

    if not args.apply:
        print("\n(dry-run)")
        return 0

    mobs_node["records"].extend(to_add)
    mobs_node["total"] = len(mobs_node["records"])
    REF_PATH.write_text(json.dumps(ref, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[APPLIED] {len(to_add)}마리 추가 → 레퍼런스 몹 {mobs_node['total']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
