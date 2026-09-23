"""mapledb.kr 드랍률 파서·출처 필드 계약 테스트."""
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from sync_drop_rates_from_mapledb import parse_drops  # noqa: E402
from api.routes import mobs  # noqa: E402

FIXTURE = """
<a class="search-page-add-content-box" href="https://mapledb.kr/search.php?q=4000019&t=item">
  <img alt="달팽이의 껍질 이미지" src="x">
  <div>드랍율</div><div>40%</div>
</a>
<a class="search-page-add-content-box" href="https://mapledb.kr/search.php?q=2040002&t=item">
  <img alt="투구 방어력 주문서 10% 이미지" src="x">
  <div>드랍율</div><div>0.006%</div>
</a>
<a class="search-page-add-content-box" href="https://mapledb.kr/search.php?q=9999999&t=item">
  <img alt="드랍율 없는 항목 이미지" src="x">
</a>
"""


class DropRateParserTests(unittest.TestCase):
    def test_parse_item_id_name_and_rate(self):
        drops = parse_drops(FIXTURE)
        self.assertEqual(drops, [
            (4000019, "달팽이의 껍질", 40.0),
            (2040002, "투구 방어력 주문서 10%", 0.006),
        ])


class DropRateSourceApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "test.db"
        conn = self.connection()
        from crawler.db import SCHEMA

        conn.executescript(SCHEMA)
        conn.executescript(
            """
            ALTER TABLE mobs ADD COLUMN is_hidden INTEGER DEFAULT 0;
            ALTER TABLE items ADD COLUMN is_hidden INTEGER DEFAULT 0;
            ALTER TABLE mob_spawns ADD COLUMN spawn_count INTEGER;
            INSERT INTO mobs (id, name) VALUES (100100, 'Snail');
            INSERT INTO items (id, name) VALUES (4000019, 'Snail Shell');
            INSERT INTO mob_drops (mob_id, item_id, item_name, drop_rate, drop_rate_source)
                VALUES (100100, 4000019, '달팽이의 껍질', 0.4, 'mapledb');
            """
        )
        conn.commit()
        conn.close()
        app = FastAPI()
        app.include_router(mobs.router, prefix="/api")
        self.patcher = patch("api.routes.mobs.get_connection", self.connection)
        # mapleland 필터가 테스트 몹을 걸러내지 않도록 통과 처리
        self.id_patch = patch("api.routes.mobs.id_filter_sql", lambda col, kind: "")
        self.req_patch = patch("api.routes.mobs.require_mapleland_id", lambda *a, **k: True)
        self.patcher.start()
        self.id_patch.start()
        self.req_patch.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.patcher.stop()
        self.id_patch.stop()
        self.req_patch.stop()
        self.temp.cleanup()

    def connection(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def test_mob_detail_returns_drop_rate_source(self):
        res = self.client.get("/api/mobs/100100")
        self.assertEqual(res.status_code, 200)
        drops = res.json().get("drops", [])
        self.assertEqual(len(drops), 1)
        self.assertEqual(drops[0]["drop_rate"], 0.4)
        self.assertEqual(drops[0]["drop_rate_source"], "mapledb")


if __name__ == "__main__":
    unittest.main()
