import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes import hunt_market

NAME = "시간의 신전: 추억의 길5"
NOW = datetime(2026, 11, 20, 9, 40, tzinfo=timezone.utc)


def post(id, price, stamp, **overrides):
    return {
        "userMapId": id, "mapName": NAME, "serverType": "MAIN", "tradeType": "SELL",
        "price": price, "isCompleted": False, "createTime": stamp, **overrides,
    }


class HuntMarketTests(unittest.TestCase):
    def test_uses_utc_and_keeps_asks_separate_from_completed_posts(self):
        rows = [
            post(1, 500_000, "2026-11-20T09:38:00", tradeType="BUY"),
            post(2, 700_000, "2026-11-20T09:35:00"),
            post(3, 900_000, "2026-11-20T09:30:00"),
            post(4, 600_000, "2026-11-19T09:00:00", isCompleted=True, updateTime="2026-11-20T09:39:15"),
            post(5, 10, "2026-11-20T09:39:55", mapName="시간의 신전: 추억의 길1"),
            post(6, 100, "2026-11-20T08:39:55"),
            post(7, 0, "2026-11-20T09:10:00"),
        ]
        result = hunt_market.summarize(rows + [rows[0]], NAME, NOW)
        self.assertEqual(result["buy"], {"median": 500_000, "count": 1})
        self.assertEqual(result["sell"], {"median": 800_000, "count": 2})
        self.assertEqual(result["completed"], {"median": 600_000, "count": 1})
        self.assertEqual(result["recentCount"], 2)
        self.assertEqual(result["lastActivityAt"], "2026-11-20T09:39:15+00:00")

    def test_empty_is_not_recent_or_free(self):
        result = hunt_market.summarize([], NAME, NOW)
        self.assertIsNone(result["lastActivityAt"])
        self.assertIsNone(result["sell"]["median"])
        self.assertEqual(result["recentCount"], 0)

    def test_rejects_unknown_map_before_querying_board(self):
        app = FastAPI()
        app.include_router(hunt_market.router, prefix="/api")
        with patch.object(hunt_market, "_public_rows", AsyncMock(return_value=[NAME])) as fetch:
            with TestClient(app) as client:
                response = client.get("/api/hunt-market/summary", params={"name": "다른 지도"})
            self.assertEqual(response.status_code, 404)
            fetch.assert_awaited_once_with("/api/maps/all", 3600)
