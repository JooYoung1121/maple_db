"""Catalog filter contracts with an isolated database (no production data writes)."""
import sqlite3
import tempfile
import unittest
from pathlib import Path
from contextlib import ExitStack
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from crawler.db import SCHEMA
from api.routes import items, mobs, maps, npcs


class CatalogFiltersTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "test.db"
        conn = self.connection()
        conn.executescript(SCHEMA)
        conn.executescript("""
            ALTER TABLE items ADD COLUMN is_hidden INTEGER DEFAULT 0;
            ALTER TABLE mobs ADD COLUMN is_hidden INTEGER DEFAULT 0;
            ALTER TABLE maps ADD COLUMN is_town INTEGER DEFAULT 0;
            ALTER TABLE npcs ADD COLUMN is_shop INTEGER DEFAULT 0;
            INSERT INTO items(id,name,category,subcategory,job_req,level_req) VALUES
            (1,'Mage Hat','Armor','Hat','마법사',10),
            (2,'Common Hat','Armor','Hat','',5),
            (3,'Shared Hat','Armor','Hat','마법사/도적',10),
            (4,'Warrior Hat','Armor','Hat','전사',20),
            (5,'Potion','Consumable','Potion','',0),
            (6,'Hidden Hat','Armor','Secret','마법사',1);
            UPDATE items SET is_hidden=1 WHERE id=6;
            INSERT INTO mobs(id,name,level,is_boss,is_hidden) VALUES
            (10,'Blue Snail',5,0,0),(11,'Blue Boss Snail',10,1,0),(12,'Hidden Snail',1,0,1);
            INSERT INTO entity_names_en VALUES ('mob',10,'파란 달팽이','kms',NULL,NULL);
            INSERT INTO mob_drops(mob_id,item_id) VALUES (10,1),(11,1),(12,1);
            INSERT INTO maps(id,name,area,is_town) VALUES (20,'Blue Forest','Victoria',0),(21,'Blue Town','Victoria',1);
            INSERT INTO npcs(id,name,is_shop) VALUES (30,'Blue Merchant',1),(31,'Blue Guide',0);
        """)
        conn.commit(); conn.close()
        self.stack = ExitStack()
        app = FastAPI()
        for module in (items, mobs, maps, npcs):
            app.include_router(module.router, prefix="/api")
            self.stack.enter_context(patch.object(module, "get_connection", side_effect=self.connection))
            self.stack.enter_context(patch.object(module, "id_filter_sql", return_value=None))
        self.stack.enter_context(patch.object(maps, "mapleland_name_kr_map", return_value={}))
        self.stack.enter_context(patch.object(npcs, "mapleland_name_kr_map", return_value={}))
        self.client = TestClient(app)

    def connection(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def tearDown(self):
        self.stack.close(); self.temp.cleanup()

    def get(self, path, **params):
        response = self.client.get(f"/api/{path}", params=params)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_job_includes_multi_job_and_allows_excluding_common(self):
        data = self.get("items", equipment_only=1, job="마법사", include_common=0, sort="level_asc")
        self.assertEqual([i["id"] for i in data["items"]], [1, 3])
        self.assertEqual(data["items"][0]["drop_count"], 2)
        self.assertEqual([d["mob_id"] for d in data["items"][0]["drop_sources"]], [10, 11])

    def test_common_job_included_by_default(self):
        self.assertEqual([i["id"] for i in self.get("items", equipment_only=1, job="공용")["items"]], [2])
        self.assertEqual([i["id"] for i in self.get("items", equipment_only=1, job="Magician", sort="level_asc")["items"]], [2, 1, 3])

    def test_equipment_category_level_and_stable_pagination(self):
        data = self.get("items", equipment_only=1, category="Armor", subcategory="Hat", level_min=10, level_max=20, sort="level_asc", per_page=1, page=2)
        self.assertEqual(data["total"], 3)
        self.assertEqual(data["items"][0]["id"], 3)
        self.assertEqual(self.get("items")["total"], 5)

    def test_invalid_level_range_is_reported(self):
        self.assertEqual(self.client.get("/api/items?level_min=40&level_max=10").status_code, 422)

    def test_filter_metadata_excludes_hidden_and_groups_parts(self):
        data = self.get("items/filters")
        self.assertEqual(data["subcategories_by_category"]["Armor"], ["Hat"])
        self.assertNotIn("Secret", data["subcategories"])

    def test_space_insensitive_names_and_token_search(self):
        for path, query, expected in [("mobs", "파란달팽이", 1), ("mobs", "Blue Snail", 2), ("maps", "BlueForest", 1), ("npcs", "BlueMerchant", 1)]:
            with self.subTest(path=path, query=query):
                self.assertEqual(self.get(path, q=query)["total"], expected)

    def test_false_boolean_filters_and_map_pagination(self):
        self.assertEqual(self.get("mobs", is_boss=0)["total"], 1)
        self.assertEqual(self.get("mobs", is_boss=1)["total"], 1)
        self.assertEqual(self.get("npcs", is_shop=0)["npcs"][0]["id"], 31)
        self.assertEqual(self.get("maps", is_town=0)["maps"][0]["id"], 20)
        self.assertEqual(self.get("maps", per_page=1, page=2)["maps"][0]["id"], 21)

    def test_drop_sources_obey_live_mob_scope(self):
        with patch.object(items, "id_filter_sql", side_effect=lambda column, kind: "m.id=10" if kind == "mobs" else None):
            data = self.get("items", job="마법사")
        self.assertEqual(data["items"][0]["drop_count"], 1)

    def test_current_korean_map_regions(self):
        with patch.object(maps, "mapleland_name_kr_map", return_value={20: "빅토리아로드: 파란 숲", 21: "오르비스: 파란 마을"}):
            self.assertEqual(self.get("maps/filters")["regions"], ["빅토리아로드", "오르비스"])
            data = self.get("maps", region="오르비스")
            self.assertEqual(data["total"], 1)
            self.assertEqual(data["maps"][0]["region_kr"], "오르비스")
            self.assertEqual(self.get("maps", region="없는 지역")["total"], 0)

    def test_database_error_is_not_an_empty_result(self):
        with patch.object(items, "get_connection", side_effect=sqlite3.OperationalError("offline")):
            self.assertEqual(self.client.get("/api/items").status_code, 503)
