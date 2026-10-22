"""2026-10-22 — 말레이시아 · 시간의 신전 드롭 점검 결과 반영.

실행: uv run --python 3.11 --no-project python scripts/patch_20261022_malaysia_tot_drops.py
멱등. mob_drops·mob_drop_sources 는 시드 전체 교체 테이블이라 배포 시 그대로 반영된다.

1. 10/17 패치가 무출처 삭제 → 복제 병합 순서로 돌아 숨긴 복제본의 무출처 행이 정본으로 다시 들어옴
   (하피 → 금이 간 모래시계·호문스큘러의 흙 등 7행). 삭제를 다시 돌린다. 퀘스트 아이템(장난감 칼)은 보존.
2. 타르가·스칼리온의 메랜 미출시 투구 2종(1003024 LUK · 1003026 STR) 삭제 — 메랜 레퍼런스에 없음.
3. 추억의 사제 '흑견랑포' 중복 — 블로그 이름 매칭(1050095)과 메팁(1051097)이 같은 항목.
   1051097 을 확인됨으로 올리고 블로그 값은 참고 출처 행으로 보존, 1050095 삭제.
4. 핑크빈 정본 8820014 에 폴암 2종(타임리스·리버스)만 빠짐 — 숨긴 8820000(레벨 다름)에서 미확인으로 복사.
5. 아란 마스터리북(2290126~2290139) 중 메팁 임시 데이터(cosmic_temp_data) 단독인데 미확인 표시가 빠진 행 → 미확인.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawler.db import get_connection  # noqa: E402
from crawler.drop_cleanup import delete_unsourced_junk  # noqa: E402


def main() -> None:
    conn = get_connection()
    try:
        before = conn.execute("SELECT COUNT(*) FROM mob_drops").fetchone()[0]
        print("무출처 잡행 재삭제:", delete_unsourced_junk(conn))
        cur = conn.execute("DELETE FROM mob_drops WHERE (mob_id, item_id) IN (VALUES (9420544, 1003024), (9420549, 1003026))")
        print("미출시 투구 삭제:", cur.rowcount)
        conn.execute(
            """INSERT OR IGNORE INTO mob_drop_sources (mob_id, item_id, source, rate, drop_source, fetched_at)
               SELECT 8200001, 1051097, 'maplekibun', drop_rate, 'maplekibun.tistory.com/892', datetime('now')
               FROM mob_drops WHERE mob_id = 8200001 AND item_id = 1050095 AND drop_rate_source = 'maplekibun'"""
        )
        conn.execute("UPDATE mob_drops SET list_source = NULL WHERE mob_id = 8200001 AND item_id = 1051097 AND list_source = 'matip'")
        cur = conn.execute("DELETE FROM mob_drops WHERE mob_id = 8200001 AND item_id = 1050095 AND drop_rate_source = 'maplekibun'")
        print("흑견랑포 중복 정리:", cur.rowcount)
        cur = conn.execute(
            """INSERT OR IGNORE INTO mob_drops (mob_id, item_id, item_name, drop_rate, drop_rate_source, list_source)
               SELECT 8820014, item_id, item_name, drop_rate, drop_rate_source, 'matip'
               FROM mob_drops WHERE mob_id = 8820000 AND item_id IN (1442063, 1442067)"""
        )
        print("핑크빈 폴암 복사:", cur.rowcount)
        conn.execute(
            """INSERT OR IGNORE INTO mob_drop_sources
               (mob_id, item_id, source, rate, chance, chance_denominator, min_qty, max_qty, drop_source, fetched_at)
               SELECT 8820014, item_id, source, rate, chance, chance_denominator, min_qty, max_qty, drop_source, fetched_at
               FROM mob_drop_sources WHERE mob_id = 8820000 AND item_id IN (1442063, 1442067)"""
        )
        cur = conn.execute(
            """UPDATE mob_drops SET list_source = 'matip'
               WHERE item_id BETWEEN 2290126 AND 2290139 AND list_source IS NULL
                 AND NOT EXISTS (SELECT 1 FROM mob_drop_sources s WHERE s.mob_id = mob_drops.mob_id
                                 AND s.item_id = mob_drops.item_id AND s.source <> 'matip')"""
        )
        print("아란 북 미확인 처리:", cur.rowcount)
        conn.commit()
        after = conn.execute("SELECT COUNT(*) FROM mob_drops").fetchone()[0]
        print(f"mob_drops {before} → {after}행")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
