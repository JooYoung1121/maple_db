import os
import sqlite3
import tempfile
import time
import unittest
from unittest import mock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes import boss_timer


class BossTimerPinTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.path = self.tmp.name

        def conn():
            c = sqlite3.connect(self.path)
            c.row_factory = sqlite3.Row
            return c

        self.patch_conn = mock.patch.object(boss_timer, "_conn", conn)
        self.patch_get = mock.patch.object(boss_timer, "get_connection", conn)
        self.patch_conn.start()
        self.patch_get.start()
        boss_timer._ensure_tables()
        self.patch_env = mock.patch.dict(os.environ, {"GAME_ADMIN_PASSWORD": "pw"})
        self.patch_env.start()
        app = FastAPI()
        app.include_router(boss_timer.router, prefix="/api")
        self.client = TestClient(app)

    def tearDown(self):
        self.patch_env.stop()
        self.patch_get.stop()
        self.patch_conn.stop()
        os.unlink(self.path)

    def _create(self):
        res = self.client.post("/api/boss-timer/rooms", json={"state": [], "nickname": "t", "client_id": "c"})
        self.assertEqual(res.status_code, 200)
        return res.json()["code"]

    def _age(self, code, hours):
        c = sqlite3.connect(self.path)
        c.execute("UPDATE boss_timer_rooms SET updated_at=? WHERE code=?", (time.time() - hours * 3600, code))
        c.commit()
        c.close()

    def test_pin_requires_admin_password(self):
        code = self._create()
        res = self.client.post(f"/api/boss-timer/rooms/{code}/pin", json={"pinned": True})
        self.assertEqual(res.status_code, 403)
        res = self.client.post(
            f"/api/boss-timer/rooms/{code}/pin", json={"pinned": True}, headers={"X-Admin-Password": "nope"}
        )
        self.assertEqual(res.status_code, 403)

    def test_pinned_room_survives_purge_and_unpinned_does_not(self):
        pinned, normal = self._create(), self._create()
        res = self.client.post(
            f"/api/boss-timer/rooms/{pinned}/pin", json={"pinned": True}, headers={"X-Admin-Password": "pw"}
        )
        self.assertEqual(res.status_code, 200)
        self._age(pinned, 24 * 30)
        self._age(normal, 49)
        self._create()  # 방 생성 시 만료 정리가 돈다
        poll = self.client.get(f"/api/boss-timer/rooms/{pinned}")
        self.assertEqual(poll.status_code, 200)
        self.assertTrue(poll.json()["pinned"])
        self.assertEqual(self.client.get(f"/api/boss-timer/rooms/{normal}").status_code, 404)

    def test_unpin_restores_expiry(self):
        code = self._create()
        hdr = {"X-Admin-Password": "pw"}
        self.client.post(f"/api/boss-timer/rooms/{code}/pin", json={"pinned": True}, headers=hdr)
        self.client.post(f"/api/boss-timer/rooms/{code}/pin", json={"pinned": False}, headers=hdr)
        self._age(code, 49)
        self._create()
        self.assertEqual(self.client.get(f"/api/boss-timer/rooms/{code}").status_code, 404)

    def test_pin_unknown_room_404(self):
        res = self.client.post(
            "/api/boss-timer/rooms/ZZZZZZ/pin", json={"pinned": True}, headers={"X-Admin-Password": "pw"}
        )
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
