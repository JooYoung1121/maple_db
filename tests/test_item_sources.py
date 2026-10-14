import sqlite3
import unittest

from crawler.item_sources import (
    jobs_from_bits, jobs_from_text, normalize_maplelog, normalize_mapledb, normalize_matip, normalize_override, resolve,
)


MATIP_CHAOS_ZAKUM = {
    "id": 1003112, "name": "카오스 자쿰의 투구", "desc": "", "category": "equip", "category_name": "장비",
    "subcategory": "Cap", "subcategory_name": "모자",
    "equipment_info": {"reqJob": 0, "reqLevel": 100, "reqSTR": 0, "reqDEX": 0, "reqINT": 0, "reqLUK": 0,
                       "incPDD": 180, "incMDD": 180, "incACC": 35, "incEVA": 35, "tuc": 10, "price": 120000, "cash": 0,
                       "incSTR": 21, "incINT": 21, "incDEX": 21, "incLUK": 21, "incMHPr": 10, "incMMPr": 10},
}
MATIP_VALHALLA = {
    "id": 1002378, "name": "블루 니르첸 투구", "category": "equip", "category_name": "장비", "subcategory": "Cap", "subcategory_name": "모자",
    "equipment_info": {"reqJob": 1, "reqLevel": 100, "reqSTR": 270, "incPDD": 100, "incSTR": 3, "tuc": 7, "price": 230000, "cash": 0},
}
MAPLEDB_VALHALLA = {
    "item_id": 1002378, "name_kr": "블루 니르첸 투구", "level": 100, "jobs": "전사", "gender": "공용",
    "category": "방어구", "subcategory": "모자", "req_json": '{"STR": 240, "POP": 0}',
    "stats_json": '{"물리방어력": {"base": 100, "min": 95, "max": 105}, "DEX": {"base": 3, "min": 2, "max": 4}}',
    "price": 26000, "attack_speed": None, "description": None, "source_url": "https://mapledb.kr/search.php?q=1002378&t=item",
}


class JobParsingTests(unittest.TestCase):
    def test_bits(self):
        self.assertIsNone(jobs_from_bits(0))
        self.assertIsNone(jobs_from_bits(None))
        self.assertEqual(jobs_from_bits(1), ["전사"])
        self.assertEqual(jobs_from_bits(13), ["전사", "궁수", "도적"])
        self.assertEqual(jobs_from_bits(24), ["도적", "해적"])
        self.assertIsNone(jobs_from_bits(31))  # 전 직업 = 공용

    def test_text(self):
        self.assertIsNone(jobs_from_text("공용"))
        self.assertIsNone(jobs_from_text("not"))
        self.assertEqual(jobs_from_text("전사,도적"), ["전사", "도적"])
        self.assertEqual(jobs_from_text("법사/도적"), ["마법사", "도적"])


class NormalizeTests(unittest.TestCase):
    def test_matip_keeps_percent_hp(self):
        r = normalize_matip(MATIP_CHAOS_ZAKUM)
        self.assertEqual(r["stats"]["incMHPr"], 10)
        self.assertEqual(r["stats"]["incMMPr"], 10)
        self.assertEqual(r["tuc"], 10)
        self.assertIsNone(r["jobs"])
        self.assertEqual(r["req_job"], 0)
        self.assertEqual(r["subcategory"], "모자")

    def test_matip_drops_coarse_subcategory_and_cash(self):
        weapon = {"id": 1302000, "name": "검", "category": "equip", "category_name": "장비", "subcategory": "Weapon",
                  "subcategory_name": "무기", "equipment_info": {"reqJob": 1, "reqLevel": 0, "incPAD": 17, "attackSpeed": 6}}
        r = normalize_matip(weapon)
        self.assertIsNone(r["subcategory"])
        self.assertEqual(r["attack_speed"], "6")
        cash = {"id": 1000000, "name": "털모자", "category": "equip", "category_name": "장비", "subcategory": "Cash",
                "subcategory_name": "캐시 아이템", "equipment_info": {"reqJob": 0, "reqLevel": 0, "cash": 1}}
        self.assertIsNone(normalize_matip(cash))

    def test_maplelog_row(self):
        row = {"id": 1132004, "kr": "검은색 허리띠", "en": "", "lv": 75,
               "stats": {"reqLevel": 75, "incPAD": 1, "incMAD": 4, "incPDD": 50, "incMDD": 50, "incSTR": 3, "incDEX": 3, "incINT": 3, "incLUK": 3, "incEVA": 15, "tuc": 3, "reqJob": 0},
               "comment": "메랜 실측값"}
        r = normalize_maplelog(row)
        self.assertEqual(r["level"], 75)
        self.assertEqual(r["stats"]["incPAD"], 1)
        self.assertEqual(r["note"], "메랜 실측값")
        self.assertIsNone(r["jobs"])

    def test_mapledb_row_maps_labels_and_ranges(self):
        r = normalize_mapledb(MAPLEDB_VALHALLA)
        self.assertEqual(r["stats"], {"incPDD": 100, "incDEX": 3})
        self.assertEqual(r["ranges"]["incDEX"], {"min": 2, "max": 4})
        self.assertEqual(r["jobs"], ["전사"])
        self.assertEqual(r["req"]["STR"], 240)

    def test_override_requires_stats(self):
        self.assertIsNone(normalize_override(1, {"level_req": 10}))
        r = normalize_override(1003112, {"stats": {"incSTR": 21, "incMHPr": 10}, "source_note": "인게임 확인"})
        self.assertEqual(r["stats"]["incMHPr"], 10)
        self.assertEqual(r["note"], "인게임 확인")


class ResolveTests(unittest.TestCase):
    def test_priority_and_conflicts(self):
        recs = {"matip": normalize_matip(MATIP_VALHALLA), "mapledb": normalize_mapledb(MAPLEDB_VALHALLA)}
        res = resolve(recs, {"incSTR": 3, "incPDD": 100, "reqSTR": 270})
        self.assertEqual(res["primary"], "matip")
        lines = {s["key"]: s for s in res["stats"]}
        self.assertEqual(lines["incSTR"]["value"], 3)
        self.assertEqual(lines["incSTR"]["source"], "matip")
        self.assertTrue(lines["incSTR"]["conflict"])
        self.assertNotIn("incDEX", lines)  # 1순위(메팁)엔 DEX 가 없다
        keys = {c["key"]: c["values"] for c in res["conflicts"]}
        self.assertEqual(keys["incSTR"], {"matip": 3, "mapledb": 0})
        self.assertEqual(keys["incDEX"], {"matip": 0, "mapledb": 3})
        self.assertNotIn("incPDD", keys)
        self.assertFalse(lines["incPDD"]["conflict"])
        self.assertEqual(lines["incPDD"]["min"], 95)  # 값이 같은 mapledb 의 범위를 붙인다
        self.assertEqual(res["diff"], [])  # 병합값 == 원작
        self.assertEqual(res["level_conflict"], None)
        self.assertEqual(res["req"]["STR"], 270)  # 1순위 요구 스탯

    def test_override_wins_and_uncovered_key_falls_back_to_original(self):
        recs = {
            "override": normalize_override(1003112, {"stats": {"incSTR": 21, "incMHPr": 10}, "source_note": "인게임"}),
            "mapledb": normalize_mapledb({"item_id": 1003112, "name_kr": "카오스 자쿰의 투구", "level": 100, "jobs": "공용",
                                          "stats_json": '{"STR": {"base": 20}}', "req_json": "{}"}),
        }
        res = resolve(recs, {"incSTR": 21, "incMHPr": 10, "incJump": 2})
        lines = {s["key"]: s for s in res["stats"]}
        self.assertEqual(lines["incSTR"]["source"], "override")
        self.assertEqual(lines["incMHPr"]["value"], 10)
        self.assertTrue(lines["incSTR"]["conflict"])  # mapledb 는 20 이라고 한다
        self.assertNotIn("incJump", lines)  # override 는 전 키를 다루므로 원작에만 있는 점프력은 줄이 사라진다
        self.assertIn({"key": "incJump", "mapleland": 0, "original": 2}, res["diff"])

    def test_only_mapledb_uses_original_for_uncovered_keys(self):
        recs = {"mapledb": normalize_mapledb(MAPLEDB_VALHALLA)}
        res = resolve(recs, {"incDEX": 3, "incPDD": 100, "incMHPr": 5})
        lines = {s["key"]: s for s in res["stats"]}
        self.assertEqual(lines["incMHPr"]["source"], "gms92")  # mapledb 가 다루지 않는 키는 원작 값
        self.assertEqual(res["conflicts"], [])

    def test_source_without_stat_data_does_not_count_as_zero(self):
        # 주문서: 메팁은 이름·가격만 주고 옵션은 없다 → mapledb 의 옵션이 그대로 살고 충돌로 세지 않는다
        matip = normalize_matip({"id": 2040002, "name": "투구 방어력 주문서 10%", "category": "consume", "category_name": "소비",
                                 "subcategory": "scroll", "subcategory_name": "주문서", "equipment_info": {"price": 1}})
        mapledb = normalize_mapledb({"item_id": 2040002, "name_kr": "투구 방어력 주문서 10%", "jobs": "not",
                                     "stats_json": '{"물리방어력": {"base": 5}, "마법방어력": {"base": 3}}', "req_json": "{}"})
        res = resolve({"matip": matip, "mapledb": mapledb}, {"incPDD": 5, "incMDD": 3, "incACC": 1})
        lines = {s["key"]: s for s in res["stats"]}
        self.assertEqual(lines["incPDD"]["source"], "mapledb")
        self.assertNotIn("incACC", lines)  # 명중률은 mapledb 가 다루는 키인데 mapledb 에 없음 → 줄 없음, 원작과의 차이로만 남는다
        self.assertIn({"key": "incACC", "mapleland": 0, "original": 1}, res["diff"])
        self.assertEqual(res["conflicts"], [])
        self.assertEqual(res["price"], 1)

    def test_no_records(self):
        self.assertIsNone(resolve({}, {"incSTR": 1}))


if __name__ == "__main__":
    unittest.main()
