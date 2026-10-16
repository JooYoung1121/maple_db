#!/usr/bin/env python3
"""2026-10-16 메이플 건 3종(35·43·64제) 원작 수치 보강 — 3주년 대비 데이터 준비.

items 의 1492020~1492022 행은 GMS v92 덤프에 메타가 없어 레벨 0 · 스탯 공백이었다
(maplestory.io 도 metaInfo 없음). 메팁(item_source_stats.matip) 값으로 채운다.
  · Hidden-Street · AyumiLove · MapleLegends(빅뱅 전 데이터)와 교차 확인 — 공격력·DEX·회피·HP 일치
  · 메이플 너클 3종(같은 5주년 계열)과 판매가·업횟·공속 체계 동일

화이트리스트(mapleland_reference.json)에는 넣지 않는다 — mapledb.kr 2024 스냅샷·로그지지 메랜 전용
목록 어디에도 없어 메랜 미출시로 본다. 출시가 확인되면 data/equipment_notes.json 에 publish 항목만 추가.
items 는 start.sh SEED_TABLES 대상이라 라이브 볼륨까지 반영된다.

사용:
  python3 scripts/patch_20261016_maple_guns.py            # dry-run
  python3 scripts/patch_20261016_maple_guns.py --apply
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maple.db"

GUN_IDS = (1492020, 1492021, 1492022)


def main(apply: bool) -> None:
    conn = sqlite3.connect(DB_PATH)
    for item_id in GUN_IDS:
        src = conn.execute(
            "SELECT level, jobs, stats_json, price, attack_speed, tuc FROM item_source_stats "
            "WHERE item_id = ? AND source = 'matip'",
            (item_id,),
        ).fetchone()
        if src is None:
            raise SystemExit(f"{item_id}: item_source_stats.matip 행 없음")
        level, jobs, stats_json, price, attack_speed, tuc = src
        stats = json.dumps(json.loads(stats_json), ensure_ascii=False)
        before = conn.execute(
            "SELECT level_req, job_req, stats, attack_speed, price, upgrade_slots FROM items WHERE id = ?",
            (item_id,),
        ).fetchone()
        after = (level, jobs, stats, attack_speed, price, tuc)
        print(f"{item_id}: {before} -> {after}")
        if apply and tuple(before) != after:
            conn.execute(
                "UPDATE items SET level_req=?, job_req=?, stats=?, attack_speed=?, price=?, upgrade_slots=? WHERE id=?",
                (*after, item_id),
            )
    if apply:
        conn.commit()
    conn.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    main(ap.parse_args().apply)
