"""Contracts for public search parsing, gem arithmetic and request-only fetching."""
import asyncio
import json
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.itemchart_service import ItemchartFormatError, decode_options, extract_rows, normalize_row
from api.routes import itemchart


def page(rows, kind="active", split=False):
    props = {"kind": "active", "rows": rows, "now": 1795059381960} if kind == "active" else {
        "initialRows": rows, "initialNow": 1795059381960, "query": "/mapleland/sold?q=test"}
    record = 'a:' + json.dumps(["$", "div", None, props], ensure_ascii=False) + '\n'
    parts = [record[:17], record[17:]] if split else [record]
    return "<html>" + "".join("<script>self.__next_f.push(" + json.dumps([1, part]) + ")</script>" for part in parts) + "</html>"


def raw_options(codes=()):
    raw = [0] * 30
    raw[0], raw[1], raw[8], raw[5] = 2, 5, 65, 7
    raw[27:27+len(codes)] = codes
    return {"raw": raw, "rawAdditional": [0, list(codes) if codes else 0, 0]}


def listing(options=None):
    return {"id": "example", "itemId": 1472052, "unitPrice": "9007199254740993", "quantity": "1",
            "item": {"name": "드래곤 퍼플 슬레브", "categoryVerified": True, "itemCategory": {"top": "무기"}},
            "displayOptions": options or raw_options(), "options": options or raw_options(),
            "soldAt": "2026-11-19T03:00:00Z", "expiresAt": "2026-11-20T03:00:00Z"}


class ParserTests(unittest.TestCase):
    def test_split_flight_stream(self):
        rows, now = extract_rows(page([listing()], split=True), "active")
        self.assertEqual(rows[0]["itemId"], 1472052)
        self.assertEqual(now, 1795059381960)

    def test_empty_and_missing_are_different(self):
        self.assertEqual(extract_rows(page([]), "active")[0], [])
        self.assertEqual(extract_rows(page([], "sold"), "sold")[0], [])
        with self.assertRaises(ItemchartFormatError):
            extract_rows("<html>Challenge</html>", "active")
        with self.assertRaises(ItemchartFormatError):
            extract_rows(page([listing()]), "sold")

    def test_no_script_execution(self):
        with self.assertRaises(ItemchartFormatError):
            extract_rows('<script>self.__next_f.push(eval("bad"))</script>', "active")

    def test_raw_gems_added_once(self):
        value = decode_options(raw_options([26000, 26010]), True)
        self.assertEqual(value["stats"]["attack"], 68)
        self.assertEqual(value["stats"]["luck"], 12)
        self.assertTrue(value["gemApplied"])
        self.assertTrue(value["complete"])
        self.assertEqual(value["remainingUpgrades"], 2)

    def test_normalized_gems_not_added_again(self):
        options = raw_options([26000])
        options["normalized"] = {"attack": 68, "gemCodes": [26000], "gemApplied": True,
                                 "verification": "inferred", "remainingUpgrades": 0, "upgradeCount": 5}
        value = decode_options(options, True)
        self.assertEqual(value["stats"]["attack"], 68)
        self.assertEqual(value["remainingUpgrades"], 0)

    def test_unknown_and_conflicting_gems_hide_final_stats(self):
        for options in (raw_options([99999]), raw_options([26000])):
            if options["raw"][27] == 26000:
                options["rawAdditional"][1] = [26010]
            value = decode_options(options, True)
            self.assertTrue(value["gemApplied"])
            self.assertFalse(value["complete"])
            self.assertEqual(value["stats"], {})

    def test_missing_options_not_treated_as_no_gem(self):
        self.assertIsNone(decode_options(None, True)["gemApplied"])
        self.assertFalse(decode_options(raw_options(), True)["gemApplied"])
        self.assertFalse(decode_options({"raw": [0]}, True)["complete"])

    def test_non_equipment_is_not_decoded(self):
        value = decode_options(raw_options(), False)
        self.assertEqual(value["status"], "not_equipment")
        self.assertEqual(value["stats"], {})

    def test_required_level_gem_and_zero_slots(self):
        options = raw_options([26012])
        options["raw"][0] = 0
        value = decode_options(options, True)
        self.assertEqual(value["requiredLevelAdjustment"], -3)
        self.assertEqual(value["remainingUpgrades"], 0)

    def test_money_is_lossless_and_only_public_fields_returned(self):
        row = listing()
        row["seller"] = "not-needed"
        normalized = normalize_row(row, "active")
        self.assertEqual(normalized["unitPrice"], "9007199254740993")
        self.assertNotIn("seller", normalized)
        self.assertIsNone(normalized["soldAt"])
        row["unitPrice"] = "not-a-price"
        with self.assertRaises(ItemchartFormatError):
            normalize_row(row, "active")

    def test_recorded_active_and_sold_gem_samples(self):
        samples = json.loads((Path(__file__).parent / "fixtures/itemchart_rows.json").read_text())
        for sample in samples:
            with self.subTest(kind=sample["kind"], name=sample["row"]["item"]["name"]):
                row = normalize_row(deepcopy(sample["row"]), sample["kind"])
                self.assertEqual(row["options"]["stats"]["attack"], sample["attack"])
                self.assertEqual(row["options"]["gemApplied"], sample["gemApplied"])
                self.assertTrue(row["options"]["complete"])


class SearchTests(unittest.TestCase):
    def setUp(self):
        enabled = patch.object(itemchart, "SEARCH_ENABLED", True)
        enabled.start()
        self.addCleanup(enabled.stop)
        itemchart._cache.clear()
        itemchart._fetch_lock = asyncio.Lock()
        app = FastAPI()
        app.include_router(itemchart.router, prefix="/api")
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        itemchart._cache.clear()

    def test_disabled_search_does_not_fetch(self):
        with patch.object(itemchart, "SEARCH_ENABLED", False), patch.object(itemchart, "_fetch_page", AsyncMock()) as fake:
            response = self.client.get("/api/itemchart/search?q=드래곤")
            self.assertEqual(response.status_code, 410)
            fake.assert_not_awaited()

    def test_gem_catalog_uses_refined_ids_without_market_request(self):
        with patch.object(itemchart, "_fetch_page", AsyncMock()) as fake:
            response = self.client.get("/api/itemchart/gems")
            self.assertEqual(response.status_code, 200)
            gems = response.json()["gems"]
            self.assertEqual(len(gems), 39)
            self.assertEqual(len({gem["itemId"] for gem in gems}), 39)
            by_code = {gem["code"]: gem for gem in gems}
            for code, item_id, name, amount in (
                (6008, 4250800, "하급 힘의 크리스탈", 1),
                (16011, 4251101, "중급 민첩성의 크리스탈", 3),
                (26002, 4250202, "상급 가넷", 5),
                (26012, 4251202, "상급 비밀의 크리스탈", -3),
            ):
                self.assertEqual(by_code[code]["itemId"], item_id)
                self.assertEqual(by_code[code]["name"], name)
                self.assertEqual(by_code[code]["amount"], amount)
            self.assertTrue(by_code[26000]["weaponOnly"])
            self.assertFalse(by_code[26008]["weaponOnly"])
            fake.assert_not_awaited()

    def test_name_option_and_gem_parameters_and_demand_cache(self):
        fake = AsyncMock(return_value=page([listing()]))
        with patch.object(itemchart, "_fetch_page", fake):
            self.assertEqual(fake.await_count, 0)
            params = {"q": "드래곤", "stat": "attack", "stat_min": 60, "stat_max": 90,
                      "gem": "applied", "min_price": 0, "sort": "time-desc"}
            first = self.client.get("/api/itemchart/search", params=params)
            self.assertEqual(first.status_code, 200, first.text)
            self.assertFalse(first.json()["cached"])
            second = self.client.get("/api/itemchart/search", params=params)
            self.assertTrue(second.json()["cached"])
            self.assertEqual(fake.await_count, 1)
            url = fake.call_args.args[0]
            self.assertIn("marketOption=attack", url)
            self.assertIn("marketOption2=gem", url)
            self.assertIn("marketMin2=applied", url)
            self.assertIn("sort=collected-desc", url)
            self.assertIn("min=0", url)
            self.assertNotIn("itemId=", url)
            self.assertEqual(second.headers["cache-control"], "no-store")

    def test_modes_do_not_share_cache(self):
        with patch.object(itemchart, "_fetch_page", AsyncMock(side_effect=[page([listing()]), page([listing()], "sold")])) as fake:
            self.client.get("/api/itemchart/search?q=드래곤")
            sold = self.client.get("/api/itemchart/search?q=드래곤&kind=sold&sort=time-desc")
            self.assertEqual(sold.status_code, 200, sold.text)
            self.assertEqual(fake.await_count, 2)
            self.assertIsNotNone(sold.json()["rows"][0]["soldAt"])

    def test_invalid_inputs_never_request_upstream(self):
        with patch.object(itemchart, "_fetch_page", AsyncMock()) as fake:
            for params in ({"q": " "}, {"q": "x", "kind": "bad"}, {"q": "x", "stat_min": 5},
                           {"q": "x", "min_price": 10, "max_price": 2},
                           {"q": "x", "stat": "attack", "stat_min": 4, "stat_max": 3},
                           {"q": "x", "gem": "invalid"}, {"q": "x", "max_price": -1},
                           {"q": "x", "kind": "active", "sort": "time-asc"}):
                self.assertEqual(self.client.get("/api/itemchart/search", params=params).status_code, 422)
            fake.assert_not_awaited()

    def test_reverse_sort_preserves_filters_and_requeries_upstream(self):
        with patch.object(itemchart, "_fetch_page", AsyncMock(return_value=page([listing()], "sold"))) as fake:
            params = {"q": "크리센트", "kind": "sold", "sort": "time-desc", "gem": "applied", "stat": "DEX", "stat_min": 9}
            self.client.get("/api/itemchart/search", params=params)
            params["sort"] = "time-asc"
            result = self.client.get("/api/itemchart/search", params=params)
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(fake.await_count, 2)
            self.assertIn("sort=time-asc", fake.call_args.args[0])
            self.assertEqual(result.json()["filters"]["gem"], "applied")
            self.assertEqual(result.json()["filters"]["statMin"], 9)

    def test_upstream_errors_are_not_empty_results_or_cached(self):
        request = httpx.Request("GET", "https://itemchart.net/mapleland/market")
        for error, status in [(httpx.ReadTimeout("late"), 504),
                              (httpx.HTTPStatusError("forbidden", request=request, response=httpx.Response(403)), 502),
                              (httpx.ConnectError("offline"), 502), (ItemchartFormatError("changed"), 502)]:
            with patch.object(itemchart, "_fetch_page", AsyncMock(side_effect=error)):
                response = self.client.get("/api/itemchart/search?q=드래곤")
                self.assertEqual(response.status_code, status)
                self.assertFalse(itemchart._cache)
                self.assertFalse(itemchart._fetch_lock.locked())


if __name__ == "__main__":
    unittest.main()
