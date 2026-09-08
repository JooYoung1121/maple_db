import asyncio
import copy
import json
import sqlite3
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from crawler.audit_repairs import repair_skill_classes, repair_quest_conditions
from crawler.data_quality import annotate_quest, mob_evidence, MAYA_CONDITIONS
from crawler.observability import observed_crawl, crawl_status
from crawler.parsers.blog_skills import _detect_job_class
from crawler.parsers.maple_land import crawl_maple_land, content_hash, MapleLandParser
from crawler.weekly_material import updated_official_posts
from api.routes.daily_mob import ensure_tables, frozen_answer, region_of_map
from api.routes.events import ensure_tables as ensure_events, effective_event


def connection():
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    return conn


class SkillRepairTests(unittest.TestCase):
    def test_job_titles(self):
        for title, expected in [('나이트로드 스킬', '도적'), ('나이트 스킬', '전사'),
                                ('다크나이트 스킬', '전사'), ('배틀메이지 스킬', '배틀메이지')]:
            self.assertEqual(_detect_job_class(title), expected)

    def test_source_scoped_and_idempotent_aliases(self):
        with connection() as conn:
            conn.execute('CREATE TABLE skills(id INTEGER PRIMARY KEY, job_class TEXT, skill_name TEXT, source_post_url TEXT, UNIQUE(job_class, skill_name))')
            conn.executemany('INSERT INTO skills VALUES (?, ?, ?, ?)', [
                (91, '전사', '더블 스탭', 'https://maplekibun.tistory.com/895'),
                (92, '전사', '트리플 스로우', 'https://maplekibun.tistory.com/895'),
                (200, '도적', '더블 스탭', 'https://maplekibun.tistory.com/896'),
                (300, '전사', '파워 스트라이크', 'other'),
            ])
            self.assertEqual(repair_skill_classes(conn), 2)
            self.assertEqual(repair_skill_classes(conn), 0)
            self.assertEqual(conn.execute('SELECT job_class FROM skills WHERE id=92').fetchone()[0], '도적')
            self.assertEqual(conn.execute('SELECT job_class FROM skills WHERE id=300').fetchone()[0], '전사')
            alias = conn.execute('SELECT * FROM skill_aliases WHERE old_id=91').fetchone()
            self.assertEqual(alias['canonical_id'], 200)
            self.assertEqual(json.loads(alias['original_json'])['skill_name'], '더블 스탭')


class QuestQualityTests(unittest.TestCase):
    def test_unknown_is_not_zero_and_known_rewards_survive(self):
        result = annotate_quest({'id': 426, 'note': '[배틀메이지 9/7 리서치]', 'exp_reward': 0, 'meso_reward': 200})
        self.assertIsNone(result['exp_reward'])
        self.assertEqual(result['meso_reward'], 200)
        self.assertEqual(annotate_quest({'id': 2, 'exp_reward': 0})['exp_reward'], 0)

    def test_missing_names_are_quarantined(self):
        result = annotate_quest({'quest_conditions': ['다크스텀프 드롭 아이템 50개']})
        self.assertEqual(result['quest_conditions'], [])
        self.assertTrue(result['unverified_conditions'])
        self.assertEqual(annotate_quest({'quest_conditions': 'null'})['data_warnings'], [])

    def test_maya_repair_preserves_original_and_other_data(self):
        with connection() as conn:
            conn.execute('CREATE TABLE quests(id INTEGER PRIMARY KEY, name TEXT, quest_conditions TEXT, exp_reward INTEGER)')
            conn.execute('INSERT INTO quests VALUES (9, ?, ?, 2000)', ('마야와 이상한 약', '["다크스텀프 드롭 아이템 50개"]'))
            self.assertEqual(repair_quest_conditions(conn), 1)
            self.assertEqual(repair_quest_conditions(conn), 0)
            row = dict(conn.execute('SELECT * FROM quests').fetchone())
            self.assertEqual(json.loads(row['quest_conditions']), MAYA_CONDITIONS)
            self.assertEqual(row['exp_reward'], 2000)
            self.assertEqual(len(annotate_quest(row)['data_sources']), 2)
            self.assertIn('드롭 아이템', conn.execute('SELECT original_json FROM quest_audit_backups').fetchone()[0])

    def test_mob_provenance_distinguishes_conversion(self):
        result = mob_evidence({'id': 8105005, 'hp': 57000, 'mp': 250, 'exp': 3050}, [])
        self.assertTrue(any(e['field'] == 'EXP' and '환산' in e['note'] for e in result))
        self.assertTrue(any(e['field'] == '출현 맵' and e['status'] == 'unknown' for e in result))
        newer = mob_evidence({'id': 8105005, 'hp': 58000, 'exp': 4000}, [])
        self.assertFalse(any(e['field'] in ('HP', 'EXP') for e in newer))


class DailyPuzzleTests(unittest.TestCase):
    def test_answer_and_hints_survive_pool_change(self):
        with connection() as conn:
            ensure_tables(conn)
            pool = [{'id': i, 'name': f'mob{i}', 'hp': i * 100} for i in range(1, 8)]
            first = copy.deepcopy(frozen_answer(conn, pool, '2026-09-08'))
            changed = [{'id': i, 'name': f'mob{i}', 'hp': 999} for i in range(1, 18)]
            self.assertEqual(frozen_answer(conn, changed, '2026-09-08'), first)
            self.assertEqual([p['id'] for p in changed], sorted(p['id'] for p in changed))
            self.assertEqual(next(p for p in changed if p['id'] == first['id'])['hp'], first['hp'])
            empty = []
            self.assertEqual(frozen_answer(conn, empty, '2026-09-08'), first)
            self.assertEqual(empty, [first])
            frozen_answer(conn, changed, '2026-09-09')
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM daily_mob_answers').fetchone()[0], 2)

    def test_edelstein_region(self):
        self.assertEqual(region_of_map(310000000), '에델슈타인')


def news_schema(conn):
    conn.execute('''CREATE TABLE maple_land_posts(id INTEGER PRIMARY KEY, post_id TEXT UNIQUE,
        source TEXT, board TEXT, category TEXT, title TEXT, content TEXT, content_html TEXT,
        url TEXT, published_at TEXT, last_crawled_at TEXT, summary TEXT, content_hash TEXT,
        updated_at TEXT, created_at TEXT)''')


class CrawlTests(unittest.TestCase):
    def test_media_only_posts_and_semantic_changes(self):
        detail = MapleLandParser().parse_detail('<h1>개발일지</h1><div class="post-content"><iframe src="https://www.youtube-nocookie.com/embed/test"></iframe></div>', 0)
        self.assertIn('미디어', detail['content'])
        self.assertNotEqual(content_hash('title', 'same', '<s>issue</s>'), content_hash('title', 'same', '<p>issue</p>'))
        self.assertNotEqual(content_hash('title', '', '<img src="a">'), content_hash('title', '', '<img src="b">'))

    def test_unchanged_post_updates_checked_time_but_not_edited_time(self):
        with connection() as conn:
            news_schema(conn)
            conn.execute('''INSERT INTO maple_land_posts(post_id, source, board, title, content, summary, content_hash)
                VALUES ('pinned', 'main', 'notices', '알려진 이슈 (9/8)', '문제 안내 본문', 'summary', ?)''',
                (content_hash('알려진 이슈 (9/8)', '문제 안내 본문'),))
            class Client:
                async def get(self, url, **kwargs):
                    if '?page=' in url:
                        return '<div><span>안내</span><span>2026.07.30</span><a href="/board/notices/pinned">이전 목록 제목</a></div>'
                    return '<h1>알려진 이슈 (9/8)</h1><div class="post-content">문제 안내 본문</div>'
            sources = {'main': {'base_url': 'https://maple.land', 'boards': ['notices']}}
            with patch('crawler.parsers.maple_land.SOURCES', sources):
                self.assertEqual(asyncio.run(crawl_maple_land(conn, Client())), 0)
                conn.execute("UPDATE maple_land_posts SET content_hash=?", ('0' * 64,))
                self.assertEqual(asyncio.run(crawl_maple_land(conn, Client())), 0)
            row = conn.execute('SELECT * FROM maple_land_posts').fetchone()
            self.assertIsNotNone(row['last_crawled_at'])
            self.assertIsNone(row['updated_at'])
            self.assertEqual(crawl_status(conn)[0]['latest_run']['status'], 'ok')

    def test_empty_collection_and_errors_are_visible(self):
        with connection() as conn:
            @observed_crawl('dcinside')
            async def empty(conn, stats):
                return 0
            asyncio.run(empty(conn))
            self.assertEqual(crawl_status(conn)[1]['latest_run']['status'], 'warning')
            @observed_crawl('dcinside')
            async def broken(conn, stats):
                raise ValueError('secret must not be stored')
            with self.assertRaises(ValueError):
                asyncio.run(broken(conn))
            result = crawl_status(conn)[1]
            self.assertEqual(result['latest_run']['error_kind'], 'ValueError')
            self.assertNotIn('secret', json.dumps(result))
            self.assertTrue(result['needs_attention'])

    def test_updated_pinned_notice_is_in_kst_week(self):
        with connection() as conn:
            news_schema(conn)
            conn.execute('''INSERT INTO maple_land_posts(post_id, title, published_at, updated_at)
                VALUES ('pinned', '알려진 이슈', '2026.07.30', '2026-09-06T15:00:00+00:00')''')
            conn.execute('''INSERT INTO maple_land_posts(post_id, title, published_at, updated_at)
                VALUES ('new', '신규 공지', '2026.09.07', '2026-09-07T00:00:00+00:00')''')
            rows = updated_official_posts(conn, '2026-09-07', '2026-09-13')
            self.assertEqual([r['post_id'] for r in rows], ['pinned'])
            self.assertEqual(rows[0]['change_kind'], 'updated')


class EventTests(unittest.TestCase):
    def test_new_event_added_without_overwriting_admin(self):
        with connection() as conn:
            ensure_events(conn)
            conn.execute("UPDATE event_guides SET title='관리자 수정' WHERE slug='sogong-successor-2026'")
            ensure_events(conn)
            self.assertEqual(conn.execute("SELECT title FROM event_guides WHERE slug='sogong-successor-2026'").fetchone()[0], '관리자 수정')
            conn.execute("DELETE FROM event_guides WHERE slug='sogong-successor-2026'")
            ensure_events(conn)
            self.assertIsNone(conn.execute("SELECT title FROM event_guides WHERE slug='sogong-successor-2026'").fetchone())

    def test_midnight_deadline_and_manual_ended(self):
        row = {'status': 'active', 'period_end': '2026-09-11T00:00:00+09:00'}
        self.assertEqual(effective_event(row, datetime(2026, 9, 10, 14, 59, tzinfo=timezone.utc))['status'], 'active')
        self.assertEqual(effective_event(row, datetime(2026, 9, 10, 15, tzinfo=timezone.utc))['status'], 'ended')
        self.assertEqual(row['status'], 'active')  # derived, not a destructive admin update
        self.assertEqual(effective_event({'status': 'ended', 'period_end': '2099-01-01'})['status'], 'ended')


if __name__ == '__main__':
    unittest.main()
