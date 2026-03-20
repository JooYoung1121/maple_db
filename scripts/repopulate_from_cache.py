"""Re-populate mob/item stats from maplestory_io_cache using fixed detail savers."""
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from crawler.db import get_connection
from crawler.parsers.maplestory_io import _save_mob_detail, _save_item_detail
from datetime import datetime, timezone


def main():
    conn = get_connection()
    now = datetime.now(timezone.utc).isoformat()

    # Re-process mobs from cache
    rows = conn.execute(
        "SELECT entity_id, data_json FROM maplestory_io_cache WHERE entity_type='mob'"
    ).fetchall()
    print(f"[repopulate] mob 캐시: {len(rows)}건")

    mob_updated = 0
    for row in rows:
        try:
            data = json.loads(row["data_json"])
            _save_mob_detail(conn, row["entity_id"], data, now)
            mob_updated += 1
        except Exception as e:
            pass
        if mob_updated % 200 == 0 and mob_updated > 0:
            conn.commit()
            print(f"[repopulate] mob: {mob_updated}건 처리")
    conn.commit()
    print(f"[repopulate] mob 완료: {mob_updated}건 업데이트")

    # Verify
    sample = conn.execute("SELECT id, name, level, hp, exp FROM mobs WHERE hp > 0 LIMIT 5").fetchall()
    print(f"[repopulate] HP > 0인 몬스터 샘플:")
    for s in sample:
        print(f"  {s['name']}: Lv.{s['level']} HP={s['hp']} EXP={s['exp']}")

    total_with_hp = conn.execute("SELECT COUNT(*) FROM mobs WHERE hp > 0").fetchone()[0]
    total_mobs = conn.execute("SELECT COUNT(*) FROM mobs").fetchone()[0]
    print(f"[repopulate] 몬스터: {total_with_hp}/{total_mobs} HP 데이터 있음")

    conn.close()


if __name__ == "__main__":
    main()
