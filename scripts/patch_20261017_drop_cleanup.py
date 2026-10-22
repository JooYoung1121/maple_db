"""2026-10-17 — 드롭 매핑 전수 정리 (crawler/drop_cleanup.py 규칙을 시드 DB에 적용).

실행: uv run --python 3.11 --no-project python scripts/patch_20261017_drop_cleanup.py
멱등. mob_drops·mob_drop_sources 는 시드 전체 교체 테이블이라 배포 시 그대로 반영되고,
mobs 노출 정책은 기동 시 repair_field_boss_visibility 가 적용한다.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawler.db import get_connection, rebuild_search_index  # noqa: E402
from crawler.drop_cleanup import (  # noqa: E402
    delete_matip_only_level_gaps,
    delete_unsourced_junk,
    merge_duplicate_mob_drops,
    unify_rate_scale,
)
from crawler.field_bosses import enforce_field_boss_visibility  # noqa: E402

REF_PATH = ROOT / "data" / "mapleland_reference.json"


def main() -> None:
    wl = {int(r["id"]) for r in json.loads(REF_PATH.read_text(encoding="utf-8"))["entities"]["mobs"]["records"]}
    conn = get_connection()
    try:
        print("보스 노출 정책:", enforce_field_boss_visibility(conn))
        print("복제 몹 드롭 합치기:", merge_duplicate_mob_drops(conn, wl))
        # 병합이 숨긴 복제본의 무출처 행을 옮겨 오므로 삭제는 병합 뒤에 (2026-10-22 하피 → 금이 간 모래시계)
        print("무출처 잡행 삭제:", delete_unsourced_junk(conn))
        print("메팁 단독 레벨 불일치 장비 삭제:", delete_matip_only_level_gaps(conn))
        print("메이플기분→메랜DB/메팁 척도 전환:", unify_rate_scale(conn))
        rebuild_search_index(conn)
        conn.commit()
        n = conn.execute("SELECT COUNT(*) FROM mob_drops").fetchone()[0]
        u = conn.execute("SELECT COUNT(*) FROM mob_drops WHERE list_source IS NULL AND drop_rate_source IS NULL").fetchone()[0]
        print(f"mob_drops {n}행 · 무출처 잔여 {u}행")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
