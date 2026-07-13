#!/usr/bin/env python3
"""mob_drops의 아이템 축을 메이플랜드 레퍼런스 ID로 재매핑.

문제: remap_drops_to_mapleland.py(몹 축)와 동일한 문제의 아이템 축 버전. 드롭 매칭이
GMS 변형 아이템 ID(예: 다크 아룬드 1452042)에 붙었는데, 메이플랜드 레퍼런스에는 같은
이름이 정규 ID(1452015)로 있다. 사이트는 레퍼런스 ID만 노출하므로 몹 상세의 드롭이
비거나 링크가 깨진다.

해결: 레퍼런스에 없는 item_id 의 드롭을, 같은 (정규화된) KMS 한글명 + 레벨이 가장
가까운 레퍼런스 item_id 로 이전한다. 같은 이름이 레퍼런스에 없으면 그대로 둔다.

사용:
  python3 scripts/remap_drop_items_to_mapleland.py            # dry-run
  python3 scripts/remap_drop_items_to_mapleland.py --apply
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"
REF_PATH = ROOT / "data" / "mapleland_reference.json"


def norm(name: str) -> str:
    return re.sub(r"\[[^\]]*\]", "", name or "").replace(" ", "").strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    ref = json.loads(REF_PATH.read_text(encoding="utf-8"))
    ref_records = ref["entities"]["items"]["records"]
    ref_ids = {int(r["id"]) for r in ref_records}
    by_name: dict[str, list[dict]] = defaultdict(list)
    for r in ref_records:
        by_name[norm(r["name_kr"])].append(r)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # 레퍼런스에 없는 item_id 로 붙은 드롭 + KMS 한글명
    rows = conn.execute(
        """SELECT DISTINCT d.item_id AS id,
                  (SELECT name_en FROM entity_names_en
                   WHERE entity_type='item' AND entity_id=d.item_id AND source='kms') AS kr,
                  i.level_req
           FROM mob_drops d LEFT JOIN items i ON i.id = d.item_id"""
    ).fetchall()

    moves = []       # (old_id, new_id, name)
    unmatched = 0
    for r in rows:
        if r["id"] in ref_ids or not r["kr"]:
            if r["id"] not in ref_ids:
                unmatched += 1
            continue
        cands = by_name.get(norm(r["kr"]))
        if not cands:
            unmatched += 1
            continue
        lvl = r["level_req"] or 0
        best = min(cands, key=lambda c: (abs((c.get("level") or 0) - lvl), int(c["id"])))
        moves.append((r["id"], int(best["id"]), r["kr"]))

    print(f"재매핑 대상: {len(moves)}개 아이템 (매칭 불가 잔여 {unmatched}개는 유지)")
    for old, new, name in sorted(moves):
        n = conn.execute("SELECT COUNT(*) FROM mob_drops WHERE item_id=?", (old,)).fetchone()[0]
        print(f"  {name}: {old} → {new} (드롭 {n}건)")

    if not args.apply:
        print("\n(dry-run — 적용하려면 --apply)")
        return 0

    moved = removed = 0
    for old, new, _ in moves:
        for row in conn.execute("SELECT mob_id FROM mob_drops WHERE item_id=?", (old,)).fetchall():
            dup = conn.execute(
                "SELECT 1 FROM mob_drops WHERE mob_id=? AND item_id=?", (row["mob_id"], new)
            ).fetchone()
            if dup:
                conn.execute(
                    "DELETE FROM mob_drops WHERE mob_id=? AND item_id=?", (row["mob_id"], old)
                )
                removed += 1
            else:
                conn.execute(
                    "UPDATE mob_drops SET item_id=? WHERE mob_id=? AND item_id=?",
                    (new, row["mob_id"], old),
                )
                moved += 1
    conn.commit()
    print(f"적용 완료: 이전 {moved}건, 중복 제거 {removed}건")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
