import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from api.routes.search import search, search_suggest
from crawler.db import FTS_SCHEMA, ensure_search_index, rebuild_search_index


TEST_SCHEMA = """
CREATE TABLE items (
    id INTEGER PRIMARY KEY, name TEXT, category TEXT, subcategory TEXT,
    description TEXT, icon_url TEXT
);
CREATE TABLE mobs (
    id INTEGER PRIMARY KEY, name TEXT, icon_url TEXT, is_hidden INTEGER DEFAULT 0
);
CREATE TABLE maps (
    id INTEGER PRIMARY KEY, name TEXT, street_name TEXT, area TEXT
);
CREATE TABLE npcs (
    id INTEGER PRIMARY KEY, name TEXT, description TEXT, icon_url TEXT
);
-- 운영 중인 레거시 퀘스트 스키마처럼 description 컬럼이 없어도 동작해야 한다.
CREATE TABLE quests (
    id INTEGER PRIMARY KEY, name TEXT, area TEXT, start_location TEXT
);
CREATE TABLE skills (
    id INTEGER PRIMARY KEY, skill_name TEXT, job_class TEXT,
    job_branch TEXT, description TEXT
);
CREATE TABLE entity_names_en (
    entity_type TEXT, entity_id INTEGER, name_en TEXT, source TEXT
);
"""


class SearchIndexTests(unittest.TestCase):
    def setUp(self):
        handle = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        handle.close()
        self.db_path = Path(handle.name)
        conn = self.connection()
        conn.executescript(TEST_SCHEMA)
        conn.executescript(FTS_SCHEMA)
        conn.executemany(
            "INSERT INTO quests(id, name, area, start_location) VALUES (?, ?, ?, ?)",
            [
                (1, "A Rainy Day", "Ellinia", "Forest"),
                (2, "Rainy Day Repeat", "Ellinia", "Town"),
            ],
        )
        conn.executemany(
            "INSERT INTO entity_names_en(entity_type, entity_id, name_en, source) VALUES ('quest', ?, ?, 'kms')",
            [(1, "비 오는 날"), (2, "비 오는 날")],
        )
        conn.commit()
        rebuild_search_index(conn)
        conn.close()

    def tearDown(self):
        self.db_path.unlink(missing_ok=True)

    def connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def test_rebuild_supports_legacy_quest_schema_and_groups_variants(self):
        with (
            patch("api.routes.search.get_connection", side_effect=self.connection),
            patch("api.routes.search.search_entity_filter_sql", return_value=None),
        ):
            response = search(q="Rain", type="quest", page=1, per_page=20)
            self.assertEqual(response["total"], 1)
            self.assertEqual(response["results"][0]["entity_id"], 1)
            self.assertEqual(response["results"][0]["variant_count"], 2)

    def test_like_fallback_uses_valid_representative_id(self):
        with (
            patch("api.routes.search.get_connection", side_effect=self.connection),
            patch("api.routes.search.search_entity_filter_sql", return_value=None),
        ):
            response = search_suggest(q="오는", limit=10, type="quest")
            self.assertEqual(len(response["suggestions"]), 1)
            self.assertIn(response["suggestions"][0]["entity_id"], {1, 2})
            self.assertEqual(response["suggestions"][0]["variant_count"], 2)

    def test_ensure_rebuilds_equal_count_but_stale_ids(self):
        conn = self.connection()
        conn.execute("DELETE FROM search_index")
        conn.executemany(
            "INSERT INTO search_index(entity_type, entity_id, name, content) VALUES ('quest', ?, ?, ?)",
            [(900, "old", "old"), (901, "old2", "old2")],
        )
        conn.commit()
        self.assertTrue(ensure_search_index(conn))
        ids = [
            row[0]
            for row in conn.execute(
                "SELECT entity_id FROM search_index WHERE entity_type='quest' ORDER BY entity_id"
            )
        ]
        self.assertEqual(ids, [1, 2])
        self.assertFalse(ensure_search_index(conn))
        conn.close()


if __name__ == "__main__":
    unittest.main()
