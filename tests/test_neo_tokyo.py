import copy
import importlib.util
import json
from pathlib import Path
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('neo_patch', ROOT/'scripts/patch_20261127_neo_tokyo.py')
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)


class NeoTokyoTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT/'data/neo_tokyo.json').read_text())

    def test_official_scope_and_unknown_values(self):
        self.assertEqual(self.data['min_level'], 121)
        self.assertEqual(len(self.data['monsters']), 12)
        self.assertEqual(sum(not m['boss'] for m in self.data['monsters']), 8)
        self.assertEqual(len([m for a in self.data['areas'] for m in a['maps']]), 19)
        self.assertFalse(any('シブヤ' in a['name'] or '시부야' in a['name'] for a in self.data['areas']))
        for m in self.data['monsters']:
            if m['boss']:
                self.assertIsNone(m['level'])
                self.assertIsNone(m['reference_stats'])
                self.assertEqual(m['reference_drops'], [])
            for d in m['reference_drops']:
                self.assertNotIn('drop_rate', d)
        self.assertEqual(self.data['crystal_ilbi']['manual_cost'], 2500)

    def test_patch_is_idempotent_and_preserves_live_data(self):
        with sqlite3.connect(':memory:') as conn, sqlite3.connect(f'file:{ROOT}/data/maple.db?mode=ro', uri=True) as source:
            source.backup(conn)
            ref=json.loads((ROOT/'data/mapleland_reference.json').read_text())
            notes=json.loads((ROOT/'data/equipment_notes.json').read_text())
            tables=[r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'") if not r[0].startswith('search_index') and r[0] not in {'items','mobs','maps','entity_names_en'}]
            before={t:conn.execute(f'SELECT * FROM "{t}"').fetchall() for t in tables}
            conn.execute('UPDATE mobs SET hp=123456 WHERE id=9400253')
            patch.apply_patch(conn,self.data,ref,notes)
            once=copy.deepcopy((ref,notes))
            patch.apply_patch(conn,self.data,ref,notes)
            self.assertEqual(once,(ref,notes))
            self.assertEqual(conn.execute('SELECT hp FROM mobs WHERE id=9400253').fetchone()[0],123456)
            self.assertEqual(before,{t:conn.execute(f'SELECT * FROM "{t}"').fetchall() for t in tables})
            for m in self.data['monsters']:
                self.assertEqual(conn.execute('SELECT level FROM mobs WHERE id=?',(m['id'],)).fetchone()[0],m['level'])
                self.assertTrue(conn.execute("SELECT 1 FROM search_index WHERE entity_type='mob' AND entity_id=? AND content LIKE ?",(m['id'],'%'+m['name']+'%')).fetchone())
            self.assertEqual(conn.execute("SELECT name_en FROM entity_names_en WHERE entity_type='item' AND entity_id=1092050 AND source='mapleland-current'").fetchone()[0],'칸쟈르')

    def test_public_routes_and_deployment_assets(self):
        from api.routes.neo_tokyo import get_neo_tokyo
        from api.routes.maker import get_reverse_weapons
        self.assertEqual(get_neo_tokyo()['min_level'],121)
        weapons=get_reverse_weapons()['weapons']
        ref=json.loads((ROOT/'data/mapleland_reference.json').read_text())
        expected={r['id'] for r in ref['entities']['items']['records'] if r['name_kr'].startswith('리버스 ') and 1300000<=r['id']<1500000}
        self.assertEqual({w['itemId'] for w in weapons},expected)
        self.assertEqual(len(weapons),18)
        docker=(ROOT/'Dockerfile.railway').read_text()
        for f in ['neo_tokyo','reverse_weapons']:
            self.assertIn(f'COPY data/{f}.json data/{f}.json',docker)


if __name__=='__main__':
    unittest.main()
