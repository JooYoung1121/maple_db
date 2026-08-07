import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from crawler.db import apply_mapleland_overrides, apply_mapleland_reference_names


class MaplelandOverrideTests(unittest.TestCase):
    def test_updates_only_whitelisted_fields(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE mobs (id INTEGER PRIMARY KEY, name TEXT, level INTEGER, hp INTEGER);
            CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, level_req INTEGER, job_req TEXT);
            INSERT INTO mobs VALUES (130100, 'Stump', 4, 40);
            INSERT INTO items VALUES (1032031, 'Timeless Earrings', 120, '');
            """
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            override_path = Path(temp_dir) / "overrides.json"
            override_path.write_text(
                json.dumps(
                    {
                        "mobs": {"130100": {"level": 4, "hp": 45, "name": "변경 금지"}},
                        "items": {"1032031": {"level_req": 100, "unknown": 1}},
                    }
                ),
                encoding="utf-8",
            )
            applied = apply_mapleland_overrides(conn, override_path)

        self.assertEqual(applied, {"mobs": 1, "items": 1, "quests": 0})
        self.assertEqual(
            conn.execute("SELECT name, level, hp FROM mobs WHERE id=130100").fetchone(),
            ("Stump", 4, 45),
        )
        self.assertEqual(conn.execute("SELECT level_req FROM items WHERE id=1032031").fetchone()[0], 100)

    def test_invalid_or_missing_file_is_safe(self):
        conn = sqlite3.connect(":memory:")
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            invalid_path = temp_path / "invalid.json"
            invalid_path.write_text("not-json", encoding="utf-8")
            self.assertEqual(
                apply_mapleland_overrides(conn, invalid_path),
                {"mobs": 0, "items": 0, "quests": 0},
            )
            self.assertEqual(
                apply_mapleland_overrides(conn, temp_path / "missing.json"),
                {"mobs": 0, "items": 0, "quests": 0},
            )

    def test_reference_names_are_stored_as_separate_current_source(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE entity_names_en (
                entity_type TEXT, entity_id INTEGER, name_en TEXT, source TEXT,
                source_url TEXT, last_crawled_at TEXT,
                PRIMARY KEY (entity_type, entity_id, source)
            );
            INSERT INTO entity_names_en (entity_type, entity_id, name_en, source)
            VALUES ('npc', 9110100, 'String not found', 'kms');
            """
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            reference_path = Path(temp_dir) / "reference.json"
            reference_path.write_text(
                json.dumps(
                    {
                        "entities": {
                            "npcs": {"records": [
                                {"id": 9110100, "name_kr": "욧코라"},
                                {"id": 9999999, "name_kr": "스트링 없음"},
                            ]}
                        }
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            changed = apply_mapleland_reference_names(conn, reference_path)

        self.assertEqual(changed, 1)
        self.assertEqual(
            conn.execute(
                "SELECT name_en FROM entity_names_en WHERE entity_type='npc' AND entity_id=9110100 AND source='mapleland-current'"
            ).fetchone()[0],
            "욧코라",
        )
        self.assertEqual(
            conn.execute("SELECT COUNT(*) FROM entity_names_en WHERE entity_id=9999999").fetchone()[0],
            0,
        )


if __name__ == "__main__":
    unittest.main()
