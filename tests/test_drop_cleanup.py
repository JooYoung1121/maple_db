import sqlite3
import unittest

from crawler.drop_cleanup import (
    delete_matip_only_level_gaps,
    delete_unsourced_junk,
    merge_duplicate_mob_drops,
    unify_rate_scale,
)


def _db():
    conn = sqlite3.connect(":memory:")
    conn.executescript(
        """
        CREATE TABLE mobs (id INTEGER PRIMARY KEY, name TEXT, level INTEGER, is_hidden INTEGER DEFAULT 0);
        CREATE TABLE items (id INTEGER PRIMARY KEY, level_req INTEGER);
        CREATE TABLE mob_drops (mob_id INTEGER, item_id INTEGER, item_name TEXT, drop_rate REAL,
                                drop_rate_source TEXT, list_source TEXT, PRIMARY KEY (mob_id, item_id));
        CREATE TABLE mob_drop_sources (mob_id INTEGER, item_id INTEGER, source TEXT, rate REAL, chance INTEGER,
                                       chance_denominator INTEGER, min_qty INTEGER, max_qty INTEGER, drop_source TEXT,
                                       fetched_at TEXT, PRIMARY KEY (mob_id, item_id, source));
        INSERT INTO mobs VALUES (8200001, 'Memory Monk', 91, 0), (3000004, 'Fairy', 30, 0),
                                (8220007, 'Blue Mushmom', 90, 0), (9400205, 'Blue Mushmom', 90, 1),
                                (9500328, 'Crimson Balrog', 35, 1), (8150000, 'Crimson Balrog', 100, 0),
                                (5220003, 'Timer', 59, 0);
        INSERT INTO items VALUES (4000245, 0), (4021001, 0), (4000446, 0), (4000999, 0), (2040008, 0), (1402011, 100), (2000006, 0);
        -- 추억의 사제: 출처 있는 목록 + 무출처 잡행(드래곤의 비늘·자수정)
        INSERT INTO mob_drops VALUES (8200001, 4000446, '웃는 가면', 0.2842, 'maplekibun', NULL);
        INSERT INTO mob_drops VALUES (8200001, 4000245, '드래곤의 비늘', NULL, NULL, NULL);
        INSERT INTO mob_drops VALUES (8200001, 4021001, '자수정', NULL, NULL, NULL);
        -- 페어리: 출처 있는 목록이 없음 → 고유 잡템은 남기고 완제만 삭제
        INSERT INTO mob_drops VALUES (3000004, 4000999, '페어리의 더듬이', NULL, NULL, NULL);
        INSERT INTO mob_drops VALUES (3000004, 4021001, '자수정', NULL, NULL, NULL);
        -- 블루 머쉬맘 복제본(숨김·같은 레벨)에만 있는 드롭
        INSERT INTO mob_drops VALUES (9400205, 2040008, '투구 방어력 주문서 70%', 0.01, 'mapledb', NULL);
        INSERT INTO mob_drop_sources (mob_id, item_id, source, rate) VALUES (9400205, 2040008, 'matip', 0.01);
        -- 카니발 크림슨발록(레벨 다름) 드롭은 합치지 않는다
        INSERT INTO mob_drops VALUES (9500328, 2000006, '마나 엘릭서', 0.04, 'mapledb', NULL);
        -- 타이머 → 스파타 (메팁 단독, 레벨 41 차이)
        INSERT INTO mob_drops VALUES (5220003, 1402011, '스파타', 0.04, 'matip', 'matip');
        -- 척도 통일 대상
        INSERT INTO mob_drop_sources (mob_id, item_id, source, rate) VALUES (8200001, 4000446, 'matip', 0.08);
        """
    )
    return conn


class DropCleanupTests(unittest.TestCase):
    def test_unsourced_junk(self):
        conn = _db()
        self.assertEqual(delete_unsourced_junk(conn), 3)
        left = {(r[0], r[1]) for r in conn.execute("SELECT mob_id, item_id FROM mob_drops WHERE drop_rate_source IS NULL AND list_source IS NULL")}
        self.assertEqual(left, {(3000004, 4000999)})
        self.assertEqual(delete_unsourced_junk(conn), 0)

    def test_merge_same_level_copies_only(self):
        conn = _db()
        self.assertEqual(merge_duplicate_mob_drops(conn, {8220007, 8150000}), 1)
        row = conn.execute("SELECT drop_rate, drop_rate_source FROM mob_drops WHERE mob_id=8220007 AND item_id=2040008").fetchone()
        self.assertEqual(row, (0.01, 'mapledb'))
        self.assertEqual(conn.execute("SELECT rate FROM mob_drop_sources WHERE mob_id=8220007 AND source='matip'").fetchone()[0], 0.01)
        self.assertIsNone(conn.execute("SELECT 1 FROM mob_drops WHERE mob_id=8150000").fetchone())
        self.assertEqual(merge_duplicate_mob_drops(conn, {8220007, 8150000}), 0)

    def test_level_gap_and_rate_scale(self):
        conn = _db()
        self.assertEqual(delete_matip_only_level_gaps(conn), 1)
        self.assertIsNone(conn.execute("SELECT 1 FROM mob_drops WHERE mob_id=5220003").fetchone())
        self.assertEqual(unify_rate_scale(conn), 1)
        row = conn.execute("SELECT drop_rate, drop_rate_source FROM mob_drops WHERE mob_id=8200001 AND item_id=4000446").fetchone()
        self.assertEqual(row, (0.08, 'matip'))
        self.assertEqual(conn.execute("SELECT rate FROM mob_drop_sources WHERE mob_id=8200001 AND item_id=4000446 AND source='maplekibun'").fetchone()[0], 0.2842)
        self.assertEqual(unify_rate_scale(conn), 0)


if __name__ == "__main__":
    unittest.main()
