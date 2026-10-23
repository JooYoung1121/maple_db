#!/usr/bin/env python3
"""2026-10-23 3주년 대비 — 원작 후기 메이플 장비(77제 파이롭 · 79제 이올렛 등) 아이템 행 미리 생성 (미노출).

배경: 1·2주년 보상은 35·43·64제 메이플 무기까지였지만, 3주년에 파이롭(77제) 등 다음 단계가 나올 수 있다.
이 장비들은 GMS v92 덤프에 없어 items 행 자체가 없고, 수치는 item_source_stats(메팁 · 로그지지 KMS 수집분)에만 있다.

준비(prepare, 기본): 대상 아이템을 출처 병합값(crawler/item_sources.resolve)으로 items 에 만들고 한글명을 붙인다.
  · 화이트리스트(mapleland_reference.json · equipment_notes publish)에는 넣지 않는다 → 사이트·검색 미노출
  · 우리 DB 에 없던 장비 분류(케인 · 듀얼 보우건 · 핸드캐논 = 메랜에 없는 직업 무기)는 건너뛴다
  · items 는 start.sh SEED_TABLES 대상이라 라이브 볼륨까지 동기화된다
공개(publish): 공지로 출시가 확인되면 그룹 단위로 equipment_notes 에 publish 항목을 추가한다.
  · 획득처·출처 URL 은 공지를 보고 직접 넘긴다 (지어내지 않도록 필수 인자)

사용:
  python3 scripts/patch_20261023_anniversary_items_prep.py                 # dry-run
  python3 scripts/patch_20261023_anniversary_items_prep.py --apply
  python3 scripts/patch_20261023_anniversary_items_prep.py publish pyrope \\
      --acquisition "3주년 이벤트 단풍잎 상점 교환" --source-url https://maple.land/board/events/... [--apply]
"""
from __future__ import annotations

import argparse
import collections
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from crawler.item_sources import load_source_records, resolve  # noqa: E402

DB_PATH = ROOT / "data" / "maple.db"
NOTES_PATH = ROOT / "data" / "equipment_notes.json"
NAME_SOURCE = "anniversary-prep"  # entity_names_en.source — 메팁·로그지지 표기의 KMS 한글명

# 그룹 → item_source_stats.name_kr LIKE 패턴 (공백 두 칸 표기 '메이플  파이롭' 도 잡히게 %)
GROUPS = {
    "pyrope": ["메이플%파이롭%"],          # 77제 파이롭 무기 17종 + 파이롭 펜던트 2종
    "pendant": ["메이플 펜던트"],           # 77제 메이플 펜던트
    "iolet": ["메이플 이올렛%"],           # 79제 이올렛 무기·방어구
}


def prefix_category_map(conn) -> dict[int, tuple[str, str | None, str]]:
    by: dict[int, collections.Counter] = collections.defaultdict(collections.Counter)
    for iid, c, s, o in conn.execute("SELECT id, category, subcategory, overall_category FROM items WHERE category IS NOT NULL"):
        by[iid // 10000][(c, s, o)] += 1
    return {p: cnt.most_common(1)[0][0] for p, cnt in by.items()}


def group_targets(conn, group: str) -> list[tuple[int, str]]:
    seen: dict[int, str] = {}
    for pattern in GROUPS[group]:
        for iid, name in conn.execute(
            "SELECT item_id, name_kr FROM item_source_stats WHERE name_kr LIKE ? AND item_id < 2000000 ORDER BY item_id",
            (pattern,),
        ):
            seen.setdefault(int(iid), " ".join(str(name).split()))
    return sorted(seen.items())


def prepare(apply: bool) -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cat_map = prefix_category_map(conn)
    existing = {r[0] for r in conn.execute("SELECT id FROM items")}
    created = named = 0
    for group in GROUPS:
        for iid, name in group_targets(conn, group):
            if iid // 10000 not in cat_map:
                print(f"  skip {iid} {name} — 메랜에 없는 장비 분류")
                continue
            res = resolve(load_source_records(conn, iid), {}) or {}
            level = res.get("level") or 0
            jobs = res.get("jobs")
            if iid not in existing:
                cat, sub, overall = cat_map[iid // 10000]
                stats = {s["key"]: s["value"] for s in res.get("stats") or []}
                for k, v in (res.get("req") or {}).items():
                    if v:
                        stats[f"req{k}"] = v
                print(f"  [{group}] {iid} {name} Lv.{level} {sub} {stats}")
                if apply:
                    conn.execute(
                        """INSERT INTO items (id, name, category, subcategory, level_req, job_req, stats, description,
                                              source_url, attack_speed, price, upgrade_slots, overall_category, is_hidden)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)""",
                        (iid, name, cat, sub, level, "/".join(jobs) if jobs else "",
                         json.dumps(stats, ensure_ascii=False), res.get("description"),
                         (res.get("source_meta") or {}).get(res.get("primary") or "", {}).get("url"),
                         res.get("attack_speed"), res.get("price"), res.get("tuc"), overall),
                    )
                created += 1
            if apply:
                cur = conn.execute(
                    """INSERT INTO entity_names_en (entity_type, entity_id, name_en, source, source_url)
                       VALUES ('item', ?, ?, ?, ?)
                       ON CONFLICT(entity_type, entity_id, source) DO UPDATE SET name_en=excluded.name_en
                       WHERE entity_names_en.name_en != excluded.name_en""",
                    (iid, name, NAME_SOURCE, f"https://matip.kr/com/db?item={iid}"),
                )
                named += max(cur.rowcount, 0)
    if apply:
        conn.commit()
    conn.close()
    print(f"items 신규 {created}건, 한글명 {named}건 {'적용' if apply else '(dry-run)'}")


def publish(group: str, acquisition: str, source_url: str, apply: bool) -> None:
    conn = sqlite3.connect(DB_PATH)
    raw = NOTES_PATH.read_text(encoding="utf-8")
    notes = json.loads(raw)
    rows = {r[0]: r[1] for r in conn.execute("SELECT id, level_req FROM items")}
    added = 0
    for iid, name in group_targets(conn, group):
        if iid not in rows or str(iid) in notes["items"]:
            continue
        notes["items"][str(iid)] = {
            "name_kr": name, "level": rows[iid] or 0, "publish": True,
            "acquisition": acquisition,
            "note": "수치는 원작 KMS 값(메팁·로그지지)입니다. 메이플랜드 실측과 다를 수 있습니다.",
            "sources": [{"label": "메이플랜드 공식 공지", "url": source_url},
                        {"label": "메팁 DB · 원작 수치", "url": f"https://matip.kr/com/db?item={iid}"}],
        }
        added += 1
        print(f"  publish {iid} {name}")
    conn.close()
    if apply and added:
        NOTES_PATH.write_text(json.dumps(notes, ensure_ascii=False, indent=2) + ("\n" if raw.endswith("\n") else ""), encoding="utf-8")
    print(f"equipment_notes publish {added}건 {'적용' if apply else '(dry-run)'}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("command", nargs="?", default="prepare", choices=["prepare", "publish"])
    ap.add_argument("group", nargs="?", choices=sorted(GROUPS))
    ap.add_argument("--acquisition")
    ap.add_argument("--source-url")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    if args.command == "publish":
        if not (args.group and args.acquisition and args.source_url):
            ap.error("publish 는 group · --acquisition · --source-url 이 필요합니다")
        publish(args.group, args.acquisition, args.source_url, args.apply)
    else:
        prepare(args.apply)
