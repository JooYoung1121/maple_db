#!/usr/bin/env python3
"""중복 보스 엔티티의 드롭/출현맵을 대표 엔티티로 통합.

문제: maplestory.io GMS92 는 보스마다 여러 폼/소환 엔티티를 두는데(같은 KMS 이름),
블로그 드롭이 이름 매칭으로 임의의 한 엔티티에 붙어 드롭이 분산된다. 보스 페이지는
is_boss=1 엔티티만 보여주므로, is_boss=1 이 아닌 엔티티에 붙은 드롭은 화면에서 누락된다.
  예) 핑크빈 8820000(is_boss=0) 드롭 86 vs 8820014(is_boss=1) 드롭 7

해결: 같은 KMS 이름 그룹에서 is_boss=1 엔티티(여럿이면 최고 HP)를 대표로,
같은 이름 형제 엔티티의 드롭/출현맵을 대표로 이전(드롭률 보존: 둘 다 있으면 NULL 아닌 값 우선),
형제의 해당 행은 삭제. 일반 몹(is_boss=1 없는 그룹)은 건드리지 않는다.

사용:
  python3 scripts/consolidate_boss_drops.py            # dry-run
  python3 scripts/consolidate_boss_drops.py --apply
"""
from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "maple.db"


def build_groups(conn):
    """KMS 이름 -> [(entity_id, is_boss, hp)] (같은 이름 2개 이상 그룹만)."""
    rows = conn.execute(
        """
        SELECT e.name_en, e.entity_id, COALESCE(m.is_boss,0) is_boss, COALESCE(m.hp,0) hp
        FROM entity_names_en e JOIN mobs m ON m.id = e.entity_id
        WHERE e.entity_type='mob' AND e.source='kms'
        """
    ).fetchall()
    groups: dict[str, list] = {}
    for r in rows:
        groups.setdefault(r["name_en"], []).append((r["entity_id"], r["is_boss"], r["hp"]))
    return {k: v for k, v in groups.items() if len(v) > 1}


def drops_of(conn, mob_id):
    return conn.execute(
        "SELECT item_id, item_name, drop_rate FROM mob_drops WHERE mob_id=?", (mob_id,)
    ).fetchall()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    groups = build_groups(conn)
    plans = []  # (name, canonical_id, sibling_ids)
    for name, ents in groups.items():
        bosses = [e for e in ents if e[1] == 1]
        if not bosses:
            continue  # is_boss=1 없는 그룹은 스킵 (일반 몹/플래그없는 보스)
        # 대표: is_boss=1 중 최고 HP, 동률이면 작은 id
        canonical = sorted(bosses, key=lambda e: (-e[2], e[0]))[0][0]
        siblings = [e[0] for e in ents if e[0] != canonical]
        # 드롭/출현맵이 형제에 실제로 있는 경우만 대상
        has_data = any(
            conn.execute("SELECT 1 FROM mob_drops WHERE mob_id=? LIMIT 1", (s,)).fetchone()
            or conn.execute("SELECT 1 FROM mob_spawns WHERE mob_id=? LIMIT 1", (s,)).fetchone()
            for s in siblings
        )
        if has_data:
            plans.append((name, canonical, siblings))

    print("=" * 64)
    print(f"통합 대상 보스 그룹: {len(plans)}")
    print("=" * 64)
    total_moved_drops = total_moved_spawns = 0
    for name, canon, sibs in sorted(plans):
        c_before = conn.execute("SELECT COUNT(*) FROM mob_drops WHERE mob_id=?", (canon,)).fetchone()[0]
        sib_drops = sum(conn.execute("SELECT COUNT(*) FROM mob_drops WHERE mob_id=?", (s,)).fetchone()[0] for s in sibs)
        sib_spawns = sum(conn.execute("SELECT COUNT(*) FROM mob_spawns WHERE mob_id=?", (s,)).fetchone()[0] for s in sibs)
        print(f"  {name:14s} 대표={canon}  형제={sibs}  드롭(대표 {c_before} + 형제 {sib_drops})  출현맵형제 {sib_spawns}")
        total_moved_drops += sib_drops
        total_moved_spawns += sib_spawns

    if not args.apply:
        print(f"\n형제→대표 이전 예정 드롭 {total_moved_drops}, 출현맵 {total_moved_spawns}")
        print("(dry-run)")
        conn.close()
        return 0

    for name, canon, sibs in plans:
        for s in sibs:
            # 드롭 이전: 드롭률 보존 (대표가 NULL이고 형제가 값이면 채움)
            for d in drops_of(conn, s):
                conn.execute(
                    """
                    INSERT INTO mob_drops (mob_id, item_id, item_name, drop_rate)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(mob_id, item_id) DO UPDATE SET
                        drop_rate = COALESCE(mob_drops.drop_rate, excluded.drop_rate),
                        item_name = COALESCE(mob_drops.item_name, excluded.item_name)
                    """,
                    (canon, d["item_id"], d["item_name"], d["drop_rate"]),
                )
            conn.execute("DELETE FROM mob_drops WHERE mob_id=?", (s,))
            # 출현맵 이전
            for sp in conn.execute("SELECT map_id, map_name FROM mob_spawns WHERE mob_id=?", (s,)).fetchall():
                conn.execute(
                    "INSERT OR IGNORE INTO mob_spawns (mob_id, map_id, map_name) VALUES (?, ?, ?)",
                    (canon, sp["map_id"], sp["map_name"]),
                )
            conn.execute("DELETE FROM mob_spawns WHERE mob_id=?", (s,))
    conn.commit()
    print(f"\n[APPLIED] {len(plans)}개 보스 그룹 통합 완료")

    # 플래그 누락 보스 보정: HP>=1000만 + 드롭 보유 + 같은이름 is_boss=1 형제 없음 -> is_boss=1
    # (피아누스/카오스 자쿰/드래고니카 등 명백한 보스인데 is_boss=0 인 케이스)
    flagged = conn.execute(
        """
        UPDATE mobs SET is_boss=1
        WHERE COALESCE(is_boss,0)=0
          AND COALESCE(hp,0) >= 10000000
          AND EXISTS (SELECT 1 FROM mob_drops d WHERE d.mob_id = mobs.id)
          -- 한글(KMS) 이름이 있는 보스만 (이름 없는 이벤트 몹 제외)
          AND EXISTS (SELECT 1 FROM entity_names_en e3
                      WHERE e3.entity_type='mob' AND e3.source='kms' AND e3.entity_id=mobs.id)
          AND NOT EXISTS (
            SELECT 1 FROM entity_names_en e2 JOIN mobs m2 ON m2.id=e2.entity_id
            WHERE e2.entity_type='mob' AND e2.source='kms' AND m2.is_boss=1
              AND e2.name_en IN (
                SELECT name_en FROM entity_names_en
                WHERE entity_type='mob' AND source='kms' AND entity_id=mobs.id
              )
          )
        """
    ).rowcount
    conn.commit()
    print(f"[APPLIED] 플래그 누락 보스 {flagged}종 is_boss=1 보정")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
