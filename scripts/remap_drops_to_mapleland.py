#!/usr/bin/env python3
"""mob_drops/mob_spawns 를 메이플랜드 레퍼런스 ID로 재매핑.

문제: 드롭 매칭이 maplestory.io 엔티티 ID(KMS 이름)에 붙었는데, 사이트는 메이플랜드
레퍼런스(mapleland_reference.json, name_kr) ID 집합으로만 몹을 노출한다. 결과적으로
드롭이 ML 에 없는 ID에 붙어 사이트에서 안 보인다(일비 표창 → 바이킹 9300324 등).

해결: ML 에 없는 mob 의 드롭/출현맵을, 같은 (정규화된) 이름 + 가장 가까운 레벨의
ML mob_id 로 이전. 같은 이름 ML mob 이 없으면(혼테일/핑크빈 등) 그대로 둔다(ML 미수록).

사용:
  python3 scripts/remap_drops_to_mapleland.py            # dry-run
  python3 scripts/remap_drops_to_mapleland.py --apply
"""
from __future__ import annotations

import argparse
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "api"))
from routes.mapleland_reference import _reference  # noqa: E402

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "maple.db"


def norm(name: str) -> str:
    return re.sub(r"\[[^\]]*\]", "", name or "").replace(" ", "").strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    recs = _reference()["entities"]["mobs"]["records"]
    ml_ids = {int(r["id"]) for r in recs}
    # 정규화 name_kr -> [(id, level)] (ML 레퍼런스 기준)
    ml_by_name: dict[str, list[tuple[int, int]]] = defaultdict(list)
    for r in recs:
        nm = norm(r.get("name_kr", ""))
        if nm:
            ml_by_name[nm].append((int(r["id"]), int(r.get("level") or 0)))

    # 우리 mobs 의 레벨(레벨 근접 매칭용) + KMS 이름
    mob_level = {r["id"]: (r["level"] or 0) for r in conn.execute("SELECT id, level FROM mobs")}
    kms_name = {}
    for r in conn.execute(
        "SELECT entity_id, name_en FROM entity_names_en WHERE entity_type='mob' AND source='kms'"
    ):
        kms_name.setdefault(r["entity_id"], r["name_en"])

    def pick_ml_target(src_id: int) -> int | None:
        nm = norm(kms_name.get(src_id, ""))
        cands = ml_by_name.get(nm)
        if not cands:
            return None
        if len(cands) == 1:
            return cands[0][0]
        # 레벨 가장 가까운 ML id
        lv = mob_level.get(src_id, 0)
        return min(cands, key=lambda c: (abs(c[1] - lv), c[0]))[0]

    # 재매핑 대상: ML 에 없는 mob_id 에 붙은 드롭/출현맵
    drop_mobs = [r[0] for r in conn.execute("SELECT DISTINCT mob_id FROM mob_drops")]
    spawn_mobs = [r[0] for r in conn.execute("SELECT DISTINCT mob_id FROM mob_spawns")]
    src_mobs = sorted(set(drop_mobs + spawn_mobs) - ml_ids)

    remap_plan = {}   # src_id -> dst_id
    orphans = []      # ML 동명 없음
    for s in src_mobs:
        dst = pick_ml_target(s)
        if dst is None:
            orphans.append(s)
        else:
            remap_plan[s] = dst

    moved_drops = sum(
        conn.execute("SELECT COUNT(*) FROM mob_drops WHERE mob_id=?", (s,)).fetchone()[0]
        for s in remap_plan
    )
    moved_spawns = sum(
        conn.execute("SELECT COUNT(*) FROM mob_spawns WHERE mob_id=?", (s,)).fetchone()[0]
        for s in remap_plan
    )
    orphan_drops = sum(
        conn.execute("SELECT COUNT(*) FROM mob_drops WHERE mob_id=?", (s,)).fetchone()[0]
        for s in orphans
    )

    print("=" * 64)
    print(f"ML 미수록 드롭/스폰 보유 몹: {len(src_mobs)}")
    print(f"  재매핑 가능(ML 동명 존재): {len(remap_plan)}  (드롭 {moved_drops}, 출현맵 {moved_spawns})")
    print(f"  고아(ML 동명 없음)        : {len(orphans)}  (드롭 {orphan_drops})")
    print("=" * 64)
    print("\n[재매핑 예시 20]")
    for s in list(remap_plan)[:20]:
        d = remap_plan[s]
        print(f"  {s}({kms_name.get(s,'?')}) -> {d}  (드롭 {conn.execute('SELECT COUNT(*) FROM mob_drops WHERE mob_id=?', (s,)).fetchone()[0]})")
    print("\n[고아 상위 — ML 미수록 보스/몹]")
    orphan_named = Counter()
    for s in orphans:
        orphan_named[kms_name.get(s, str(s))] += conn.execute("SELECT COUNT(*) FROM mob_drops WHERE mob_id=?", (s,)).fetchone()[0]
    for nm, c in orphan_named.most_common(15):
        print(f"  {c:3d}  {nm}")

    if not args.apply:
        print("\n(dry-run)")
        conn.close()
        return 0

    for src, dst in remap_plan.items():
        for d in conn.execute("SELECT item_id, item_name, drop_rate FROM mob_drops WHERE mob_id=?", (src,)).fetchall():
            conn.execute(
                """
                INSERT INTO mob_drops (mob_id, item_id, item_name, drop_rate)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(mob_id, item_id) DO UPDATE SET
                    drop_rate = COALESCE(mob_drops.drop_rate, excluded.drop_rate),
                    item_name = COALESCE(mob_drops.item_name, excluded.item_name)
                """,
                (dst, d["item_id"], d["item_name"], d["drop_rate"]),
            )
        conn.execute("DELETE FROM mob_drops WHERE mob_id=?", (src,))
        for sp in conn.execute("SELECT map_id, map_name FROM mob_spawns WHERE mob_id=?", (src,)).fetchall():
            conn.execute(
                "INSERT OR IGNORE INTO mob_spawns (mob_id, map_id, map_name) VALUES (?, ?, ?)",
                (dst, sp["map_id"], sp["map_name"]),
            )
        conn.execute("DELETE FROM mob_spawns WHERE mob_id=?", (src,))
    conn.commit()
    print(f"\n[APPLIED] {len(remap_plan)}개 몹 드롭/출현맵을 메이플랜드 ID로 재매핑")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
