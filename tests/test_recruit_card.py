"""구인구직 카드 AI 일러스트 엔드포인트 — 격리 DB 계약 테스트."""
import base64
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes import recruit_card

PNG_B64 = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 200).decode()
DATA_URL = f"data:image/png;base64,{PNG_B64}"


class RecruitCardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "test.db"
        app = FastAPI()
        app.include_router(recruit_card.router, prefix="/api")
        self.conn_patch = patch("api.routes.recruit_card.get_connection", self.connection)
        self.key_patch = patch("api.routes.recruit_card.GEMINI_API_KEY", "test-key")
        self.conn_patch.start()
        self.key_patch.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.conn_patch.stop()
        self.key_patch.stop()
        self.temp.cleanup()

    def connection(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def test_quota_reports_limit(self):
        res = self.client.get("/api/recruit-card/quota")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["remaining"], 3)
        self.assertTrue(body["enabled"])

    def test_rejects_bad_image(self):
        res = self.client.post("/api/recruit-card/illustration",
                               json={"image_base64": "data:text/plain;base64,aGk=", "job": "신궁"})
        self.assertEqual(res.status_code, 400)

    def test_generates_and_counts_down_then_limits(self):
        async def fake_gemini(mime, image_b64, job):
            return "data:image/png;base64,ZmFrZQ=="

        with patch("api.routes.recruit_card._call_gemini", fake_gemini), \
             patch("api.routes.recruit_card.COOLDOWN_SEC", 0):
            for expected_remaining in (2, 1, 0):
                res = self.client.post("/api/recruit-card/illustration",
                                       json={"image_base64": DATA_URL, "job": "신궁"})
                self.assertEqual(res.status_code, 200, res.text)
                self.assertEqual(res.json()["remaining"], expected_remaining)
                self.assertTrue(res.json()["image"].startswith("data:image/png"))
            res = self.client.post("/api/recruit-card/illustration",
                                   json={"image_base64": DATA_URL, "job": "신궁"})
            self.assertEqual(res.status_code, 429)  # 일 3회 초과

    def test_disabled_without_key(self):
        with patch("api.routes.recruit_card.GEMINI_API_KEY", ""):
            res = self.client.post("/api/recruit-card/illustration",
                                   json={"image_base64": DATA_URL, "job": ""})
            self.assertEqual(res.status_code, 503)


if __name__ == "__main__":
    unittest.main()
