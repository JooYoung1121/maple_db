import unittest

from scripts.expand_item_whitelist_from_sources import allowed_id
from scripts.import_matip_drops import rows_from_details


class MatipDropRowTests(unittest.TestCase):
    def test_rate_uses_row_specific_denominator(self):
        details = {100100: {"combined_drops": [
            {"item_id": 4000019, "chance": 400000000, "chance_denominator": 1000000000, "minimum_quantity": 0, "maximum_quantity": 0, "drop_source": "monster_drops.sql", "quest_id": 0},
            {"item_id": 2000000, "chance": 20000, "chance_denominator": 1000000, "drop_source": "drop(1).sql", "quest_id": 0},
            {"item_id": 0, "chance": 650000000, "chance_denominator": 1000000000},  # 메소 → 제외
            {"item_id": 4031000, "chance": 1, "chance_denominator": 0},  # 분모 0 → 제외
        ]}}
        rows = rows_from_details(details)
        self.assertEqual([(r["item_id"], round(r["rate"], 6)) for r in rows], [(4000019, 0.4), (2000000, 0.02)])
        self.assertEqual(rows[0]["mob_id"], 100100)


class WhitelistIdFilterTests(unittest.TestCase):
    def test_ranges_and_virtual_codes(self):
        self.assertTrue(allowed_id(1132004))   # 허리띠
        self.assertTrue(allowed_id(2040212))   # 주문서
        self.assertTrue(allowed_id(4000896))   # 몬스터 드롭
        self.assertFalse(allowed_id(1019901))  # 로그지지 가상 코드
        self.assertFalse(allowed_id(5680440))  # 캐시
        self.assertFalse(allowed_id(3993000))  # 설치
        self.assertFalse(allowed_id(4031440))  # 퀘스트 전용


if __name__ == "__main__":
    unittest.main()
