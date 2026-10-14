import sqlite3
import tempfile
import unittest
from pathlib import Path

from crawler.audit_repairs import repair_empty_reference_tables


class ReferenceSelfHealTests(unittest.TestCase):
    def test_fills_missing_and_empty_tables_only(self):
        with tempfile.TemporaryDirectory() as d:
            seed = Path(d) / "seed.db"
            s = sqlite3.connect(seed)
            s.executescript(
                """
                CREATE TABLE item_source_stats (item_id INTEGER, source TEXT, stats_json TEXT, PRIMARY KEY(item_id, source));
                INSERT INTO item_source_stats VALUES (1, 'matip', '{}'), (2, 'maplelog', '{}');
                CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);
                INSERT INTO items VALUES (1, 'seed-name');
                CREATE TABLE skills (id INTEGER PRIMARY KEY);
                """
            )
            s.commit(); s.close()
            vol = sqlite3.connect(":memory:")
            vol.executescript(
                """
                CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);
                INSERT INTO items VALUES (1, 'volume-name');
                CREATE TABLE maps (id INTEGER PRIMARY KEY);
                CREATE TABLE free_board_posts (id INTEGER PRIMARY KEY, body TEXT);
                INSERT INTO free_board_posts VALUES (1, 'user data');
                """
            )
            healed = repair_empty_reference_tables(vol, seed_path=seed, tables=("item_source_stats", "items", "maps", "skills", "free_board_posts"))
            # 없던 테이블은 만들어서 채우고, 행이 있는 테이블(items)은 건드리지 않고, 시드가 비어 있으면(skills) 넘어간다
            self.assertEqual(healed, {"item_source_stats": 2})
            self.assertEqual(vol.execute("SELECT COUNT(*) FROM item_source_stats").fetchone()[0], 2)
            self.assertEqual(vol.execute("SELECT name FROM items WHERE id=1").fetchone()[0], "volume-name")
            self.assertEqual(vol.execute("SELECT body FROM free_board_posts").fetchone()[0], "user data")
            self.assertEqual(vol.execute("SELECT status FROM seed_sync_log WHERE tbl='item_source_stats'").fetchone()[0], "healed")
            # 두 번째 실행은 아무것도 하지 않는다
            self.assertEqual(repair_empty_reference_tables(vol, seed_path=seed, tables=("item_source_stats",)), {})

    def test_missing_seed_is_noop(self):
        vol = sqlite3.connect(":memory:")
        self.assertEqual(repair_empty_reference_tables(vol, seed_path="/nonexistent/seed.db"), {})


if __name__ == "__main__":
    unittest.main()
