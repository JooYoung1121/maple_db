import sqlite3
import unittest

from api.routes.field_boss import BOSSES
from crawler.field_bosses import FIELD_BOSS_IDS, FIELD_BOSSES, enforce_field_boss_visibility


class FieldBossVisibilityTests(unittest.TestCase):
    def _db(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE mobs (id INTEGER PRIMARY KEY, name TEXT, level INTEGER, hp INTEGER,
                               is_boss INTEGER DEFAULT 0, is_hidden INTEGER DEFAULT 0);
            CREATE TABLE mob_spawns (mob_id INTEGER, map_id INTEGER, PRIMARY KEY (mob_id, map_id));
            -- 실제 필드 개체: cleanup 이 숨겨 둔 상태
            INSERT INTO mobs VALUES (4220000, 'Seruf', 45, 7800, 0, 1);
            INSERT INTO mob_spawns VALUES (4220000, 230020100);
            -- 무릉도장 복제본: is_boss=1 로 노출돼 있던 것
            INSERT INTO mobs VALUES (9303014, 'Seruf', 81, 10000, 1, 0);
            -- 스폰 없는 하위 id 변형
            INSERT INTO mobs VALUES (4220001, 'Seruf', 45, 2550, 0, 0);
            -- 피아누스 좌/우는 둘 다 정본
            INSERT INTO mobs VALUES (8510000, 'Pianus', 110, 30000000, 1, 0);
            INSERT INTO mobs VALUES (8520000, 'Pianus', 110, 24000000, 0, 1);
            INSERT INTO mob_spawns VALUES (8510000, 230040420), (8520000, 230040420);
            -- 무관한 몹은 그대로
            INSERT INTO mobs VALUES (100100, 'Snail', 1, 8, 0, 0);
            """
        )
        return conn

    def test_canonical_shown_and_copies_hidden(self):
        conn = self._db()
        result = enforce_field_boss_visibility(conn)
        self.assertEqual(result, {"shown": 2, "hidden_copies": 2})
        rows = {r[0]: (r[1], r[2]) for r in conn.execute("SELECT id, is_boss, is_hidden FROM mobs")}
        self.assertEqual(rows[4220000], (1, 0))
        self.assertEqual(rows[8520000], (1, 0))
        self.assertEqual(rows[8510000], (1, 0))
        self.assertEqual(rows[9303014][1], 1)
        self.assertEqual(rows[4220001][1], 1)
        self.assertEqual(rows[100100], (0, 0))
        # 멱등
        self.assertEqual(enforce_field_boss_visibility(conn), {"shown": 0, "hidden_copies": 0})

    def test_tracker_list_is_the_shared_list(self):
        self.assertIs(BOSSES, FIELD_BOSSES)
        self.assertEqual(len(FIELD_BOSS_IDS), len(FIELD_BOSSES))
        self.assertIn(8150000, FIELD_BOSS_IDS)  # 크림슨 발록
        levels = [b["level"] for b in FIELD_BOSSES]
        self.assertEqual(levels, sorted(levels))


if __name__ == "__main__":
    unittest.main()
