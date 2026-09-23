#!/usr/bin/env python3
"""자쿰 드랍률 대표 파츠 병합 (v4.4.0 동기화 후속).

배경: 사이트의 자쿰 대표 몹은 8800002(Zakum3, is_boss=1)로 통합돼 있는데
(scripts/consolidate_boss_drops.py), 메랜DB는 자쿰 드랍을 8800000(Zakum1)
페이지에만 싣는다. v4.4.0 동기화가 mapledb 39건을 8800000에 신규 추가하면서
대표(8800002)에는 옛메 참고값만 남는 어긋남이 생겼다.

처리: 8800000의 mapledb 행을 8800002로 병합한다.
  - 같은 아이템이 대표에 있으면 rate/출처를 mapledb 값으로 갱신
  - 없으면 대표에 삽입
  - 병합 후 8800000 행 삭제 (consolidate 정책 유지)

피아누스(8510000/8520000)는 원작·메랜DB 모두 좌우 개체의 드랍이 실제로
달라(샤프 아이즈 확률 등) 분리 유지가 정확하므로 건드리지 않는다.
파풀라투스는 메랜DB와 대표(8500002)가 일치해 해당 없음.

사용: python3 scripts/patch_20260923_zakum_canon_rates.py [--apply]
"""
from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "maple.db"
SRC, CANON = 8800000, 8800002


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT item_id, item_name, drop_rate FROM mob_drops "
        "WHERE mob_id=? AND drop_rate_source='mapledb'",
        (SRC,),
    ).fetchall()
    print(f"이동 대상(8800000 mapledb): {len(rows)}건")

    updated = inserted = 0
    for item_id, item_name, rate in rows:
        cur = conn.execute(
            "UPDATE mob_drops SET drop_rate=?, drop_rate_source='mapledb' "
            "WHERE mob_id=? AND item_id=?",
            (rate, CANON, item_id),
        )
        if cur.rowcount:
            updated += 1
        else:
            conn.execute(
                "INSERT INTO mob_drops (mob_id, item_id, item_name, drop_rate, drop_rate_source) "
                "VALUES (?,?,?,?, 'mapledb')",
                (CANON, item_id, item_name, rate),
            )
            inserted += 1
    conn.execute("DELETE FROM mob_drops WHERE mob_id=?", (SRC,))

    after = conn.execute(
        "SELECT drop_rate_source, COUNT(*) FROM mob_drops WHERE mob_id=? GROUP BY drop_rate_source",
        (CANON,),
    ).fetchall()
    print(f"대표(8800002) 갱신 {updated}건 · 삽입 {inserted}건 → 병합 후 출처 분포: {after}")

    if args.apply:
        conn.commit()
        print("[apply] 커밋 완료")
    else:
        conn.rollback()
        print("[dry-run] 반영 안 함 (--apply)")
    conn.close()


if __name__ == "__main__":
    main()
