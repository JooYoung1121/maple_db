"""장비 아이템만 우선 크롤링 — maplestory.io detail API에서 스탯 가져오기"""
import sys
import json
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import datetime, timezone
from crawler.db import get_connection
from crawler.client import ThrottledClient
from crawler.config import MAPLESTORY_IO_BASE, MAPLESTORY_IO_VERSION_GMS
from crawler.parsers.maplestory_io import _save_item_detail, _job_code_to_name


async def main():
    conn = get_connection()
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")

    # 장비 카테고리만 가져오기
    equip_categories = [
        "Armor", "One-Handed Weapon", "Two-Handed Weapon", "Accessory",
        "Weapon", "Projectile",
    ]
    placeholders = ",".join("?" * len(equip_categories))
    rows = conn.execute(
        f"SELECT id, name, category FROM items WHERE category IN ({placeholders}) ORDER BY id",
        equip_categories,
    ).fetchall()

    total = len(rows)
    print(f"[equip-crawl] 장비 아이템 {total}건 크롤링 시작")

    now = datetime.now(timezone.utc).isoformat()
    updated = 0
    errors = 0

    async with ThrottledClient() as client:
        for i, row in enumerate(rows):
            eid = row["id"]

            # 캐시 확인
            cached = conn.execute(
                "SELECT data_json FROM maplestory_io_cache WHERE entity_type='item' AND entity_id=?",
                (eid,),
            ).fetchone()

            if cached and cached["data_json"]:
                try:
                    data = json.loads(cached["data_json"])
                    _save_item_detail(conn, eid, data, now)
                    updated += 1
                except Exception:
                    pass
                continue

            # API 호출
            url = f"{MAPLESTORY_IO_BASE}/gms/{MAPLESTORY_IO_VERSION_GMS}/item/{eid}"
            cache_key = f"maplestory_io/gms92_item_{eid}"
            try:
                raw = await client.get(url, cache_key=cache_key, use_cache=True)
                data = json.loads(raw)
                if data is None:
                    continue
            except Exception:
                errors += 1
                continue

            # 캐시 저장
            conn.execute(
                """INSERT OR REPLACE INTO maplestory_io_cache
                   (entity_type, entity_id, name_en, data_json, last_crawled_at)
                   VALUES (?, ?, ?, ?, ?)""",
                ("item", eid, data.get("name", ""), json.dumps(data, ensure_ascii=False), now),
            )

            try:
                _save_item_detail(conn, eid, data, now)
                updated += 1
            except Exception as e:
                errors += 1

            if (i + 1) % 100 == 0:
                conn.commit()
                print(f"[equip-crawl] {i+1}/{total} ({updated}건 업데이트, {errors}건 에러)")

    conn.commit()
    print(f"[equip-crawl] 완료: {updated}건 업데이트, {errors}건 에러")

    # 확인
    with_stats = conn.execute(
        "SELECT COUNT(*) FROM items WHERE level_req > 0 OR (stats IS NOT NULL AND stats <> '{}')"
    ).fetchone()[0]
    print(f"[equip-crawl] 스탯 있는 아이템: {with_stats}건")

    sample = conn.execute(
        "SELECT name, category, level_req, job_req, stats FROM items WHERE level_req > 0 LIMIT 5"
    ).fetchall()
    for s in sample:
        print(f"  {s['name']} ({s['category']}): Lv.{s['level_req']} {s['job_req']} {s['stats']}")

    conn.close()


if __name__ == "__main__":
    asyncio.run(main())
