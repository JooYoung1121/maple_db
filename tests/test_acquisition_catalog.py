"""Regression coverage for current item data and job-specific acquisition guides."""
import json
import sqlite3
import unittest
from unittest.mock import patch

from api.skill_acquisition import enriched_guides, guide_catalog
from api.routes.mapleland_reference import mapleland_ids, mapleland_name_kr_map
from crawler.catalog_data import equipment_notes
from crawler.db import SCHEMA, apply_mapleland_overrides, apply_mapleland_reference_names


class AcquisitionCatalogTests(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self.conn.executescript("""
          ALTER TABLE items ADD COLUMN is_hidden INTEGER DEFAULT 0;
          ALTER TABLE mobs ADD COLUMN is_hidden INTEGER DEFAULT 0;
          INSERT INTO items (id,name,stats) VALUES
            (1122059,'Mark of Naricain','{"PAD":10,"MAD":10,"ACC":15,"MHP":300,"MMP":300}'),
            (1122014,'Silver Deputy Star','{}'),
            (4031461,'Root of Life','{}'), (4000150,'Ice Piece','{}');
          INSERT INTO skills (id,skill_name,job_class) VALUES
            (199,'제네시스','마법사'), (385,'다크 제네시스','배틀메이지');
          CREATE TABLE mapledb_quests(quest_id INTEGER,name TEXT,start_npc TEXT,requirements_json TEXT);
          INSERT INTO mapledb_quests VALUES (6169,'제네시스','샤모스',
            '[{"type":"item","id":4031461,"name":"생명의 뿌리","raw":"생명의 뿌리 1개 전달"}]');
        """)

    def tearDown(self):
        self.conn.close()

    def test_naricain_uses_official_stats_and_replaces_accuracy(self):
        apply_mapleland_overrides(self.conn)
        stats = json.loads(self.conn.execute("SELECT stats FROM items WHERE id=1122059").fetchone()[0])
        self.assertEqual({k: stats[k] for k in ['incPAD','incMAD','incMHP','incMMP','incEVA']},
                         {'incPAD':4,'incMAD':8,'incMHP':150,'incMMP':150,'incEVA':15})
        self.assertNotIn('ACC', stats)
        self.assertNotIn('incACC', stats)
        self.assertEqual(stats['incSTR'], 5)
        apply_mapleland_overrides(self.conn)
        self.assertEqual(stats, json.loads(self.conn.execute("SELECT stats FROM items WHERE id=1122059").fetchone()[0]))

    def test_missing_equipment_and_badges_are_public(self):
        for item_id in [1122014,1122059,4032006,4032007,4032008,4032009]:
            self.assertIn(item_id, mapleland_ids('items'))
            self.assertTrue(mapleland_name_kr_map('items')[item_id])

    def test_korean_names_aliases_and_provenance_survive_reapply(self):
        self.assertGreater(apply_mapleland_reference_names(self.conn), 0)
        names = [row[0] for row in self.conn.execute("SELECT name_en FROM entity_names_en WHERE entity_type='item' AND entity_id=1122059")]
        self.assertIn('나리케인의 목걸이', names)
        self.assertIn('나리케인의 징표', names)
        self.assertEqual(apply_mapleland_reference_names(self.conn), 0)
        source = self.conn.execute("SELECT source_url FROM entity_names_en WHERE entity_id=1122059 AND source='mapleland-current'").fetchone()[0]
        self.assertIn('maple.land/board/notices/', source)

    def test_unverified_chaos_variation_is_not_presented_as_a_range(self):
        notes = equipment_notes()['1003112']
        self.assertEqual(notes['variation_status'], 'unverified')
        self.assertEqual(notes['stat_ranges'], {})

    def test_quest_requirements_link_to_visible_real_items_not_legacy_quests(self):
        catalog = enriched_guides(self.conn)
        genesis = next(g for g in catalog['guides'] if g['id']=='genesis')
        self.assertEqual([s['id'] for s in genesis['skills']], [199])
        quest = genesis['db_quests'][0]
        self.assertEqual(quest['requirements'][0]['href'], '/items/4031461')
        self.assertNotIn('href', quest)
        self.conn.execute('UPDATE items SET is_hidden=1 WHERE id=4031461')
        genesis = next(g for g in enriched_guides(self.conn)['guides'] if g['id']=='genesis')
        self.assertIsNone(genesis['db_quests'][0]['requirements'][0]['href'])

    def test_incomplete_optional_quest_database_keeps_curated_guide(self):
        self.conn.execute('DROP TABLE mapledb_quests')
        catalog = enriched_guides(self.conn)
        self.assertFalse(catalog['quest_database_available'])
        self.assertTrue(catalog['guides'][0]['steps'])

    def test_correct_jobs_prerequisites_and_quest_material_chains(self):
        guides = {g['id']: g for g in guide_catalog()['guides']}
        self.assertEqual(guides['ninja-storm']['jobs'], ['나이트로드'])
        self.assertEqual(guides['holy-charge']['jobs'], ['팔라딘'])
        self.assertEqual(guides['genesis']['prerequisites'], ['shammos'])
        self.assertEqual(guides['demolition']['quest_ids'], [6350])
        self.assertEqual(guides['snatch']['quest_ids'], [6340])
        self.assertIn('배틀메이지', guides['heros-will']['jobs'])
        for guide in guides.values():
            self.assertTrue(guide['sources'])
            for predecessor in guide['prerequisites']:
                self.assertIn(predecessor, guides)
        # A novice guide cannot accidentally gain a circular prerequisite chain.
        def visit(key, path):
            self.assertNotIn(key, path)
            for predecessor in guides[key]['prerequisites']:
                visit(predecessor, path + [key])
        for key in guides:
            visit(key, [])

    def test_route_is_registered_before_numeric_skill_detail(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from api.routes import skills
        app = FastAPI()
        app.include_router(skills.router, prefix='/api')
        with patch.object(skills, 'get_connection', side_effect=sqlite3.OperationalError('offline')):
            self.assertEqual(TestClient(app).get('/api/skills/acquisition').status_code, 503)
