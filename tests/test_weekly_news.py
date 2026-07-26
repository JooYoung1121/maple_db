import copy
import asyncio
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from starlette.requests import Request
from api.routes import weekly_news
from scripts.weekly_news_generate import (
    _material_digest,
    _normalize_issue_title,
    validate_issue,
)
from scripts.weekly_news_render import render_issue_images


def sample_material():
    return {
        "schema_version": 2,
        "collected_at": "2026-07-26T08:00:00+09:00",
        "week_start": "2026-07-20",
        "week_end": "2026-07-26",
        "official_posts": [
            {
                "title": "패치노트",
                "url": "https://maple.land/board/notices/official",
            }
        ],
        "community_posts": [
            {
                "title": "커뮤니티 글",
                "url": "https://gall.dcinside.com/post/1",
                "excerpt": "확인 가능한 본문",
                "recommends": 10,
                "views": 100,
                "comment_count": 5,
            }
        ],
        "sprite_pool": [{"type": "mob", "id": 100100, "name": "달팽이"}],
    }


def sample_issue(material):
    return {
        "issue_no": 4,
        "_meta": {
            "material_sha256": _material_digest(material),
            "issue_no": 4,
        },
        "title": "주간 메랜 제4호 — 테스트",
        "week_start": "2026-07-20",
        "week_end": "2026-07-26",
        "tldr": ["하나", "둘", "셋", "넷", "다섯"],
        "cover": {
            "bg": "henesys",
            "title": "테스트",
            "caption": "검증",
            "sprites": [{"type": "mob", "id": 100100}],
            "bubbles": [],
        },
        "sections": [
            {
                "id": "headline",
                "heading": "헤드라인",
                "articles": [
                    {
                        "title": "헤드라인",
                        "paragraphs": ["공식 내용을 요약했습니다."],
                        "sources": [
                            {
                                "label": "공식",
                                "url": "https://maple.land/board/notices/official",
                            }
                        ],
                    }
                ],
            },
            {
                "id": "official",
                "heading": "공식 소식",
                "articles": [
                    {
                        "title": "공식",
                        "paragraphs": ["패치가 적용됐습니다."],
                        "sources": [
                            {
                                "label": "공식",
                                "url": "https://maple.land/board/notices/official",
                            }
                        ],
                    }
                ],
            },
            {
                "id": "community",
                "heading": "커뮤니티",
                "articles": [
                    {
                        "title": "반응",
                        "paragraphs": ["이용자 반응이 이어졌습니다."],
                        "sources": [
                            {
                                "label": "커뮤니티",
                                "url": "https://gall.dcinside.com/post/1",
                            }
                        ],
                        "metrics": {"recommends": 10, "views": 100, "comments": 5},
                    }
                ],
            },
        ],
    }


class WeeklyNewsValidationTests(unittest.TestCase):
    def test_material_bound_issue_passes(self):
        material = sample_material()
        issue = sample_issue(material)
        self.assertEqual(
            validate_issue(
                issue,
                material=material,
                expected_week_start="2026-07-20",
                expected_issue_no=4,
                require_provenance=True,
            ),
            [],
        )

    def test_foreign_source_and_metric_mismatch_are_rejected(self):
        material = sample_material()
        issue = sample_issue(material)
        community = issue["sections"][2]["articles"][0]
        community["sources"][0]["url"] = "https://example.com/not-in-material"
        community["metrics"]["views"] = 999
        problems = validate_issue(issue, material=material, expected_issue_no=4)
        self.assertTrue(any("원자재에 없는 출처" in problem for problem in problems))
        self.assertTrue(any("지표 불일치" in problem for problem in problems))

    def test_unknown_sprite_is_rejected(self):
        material = sample_material()
        issue = sample_issue(material)
        issue["cover"]["sprites"][0]["id"] = 999999
        problems = validate_issue(issue, material=material, expected_issue_no=4)
        self.assertTrue(any("후보에 없는 스프라이트" in problem for problem in problems))

    def test_changed_material_requires_regeneration(self):
        material = sample_material()
        issue = sample_issue(material)
        changed = copy.deepcopy(material)
        changed["official_posts"][0]["title"] = "수정된 패치노트"
        problems = validate_issue(
            issue,
            material=changed,
            expected_issue_no=4,
            require_provenance=True,
        )
        self.assertTrue(any("원자재가 변경" in problem for problem in problems))

    def test_issue_title_is_normalized(self):
        self.assertEqual(
            _normalize_issue_title("주간 메랜 제99호 — 새 소식", 4),
            "주간 메랜 제4호 — 새 소식",
        )


class WeeklyNewsRenderTests(unittest.TestCase):
    def test_render_removes_stale_png_slots(self):
        issue = {
            "cover": {
                "bg": "paper",
                "title": "테스트",
                "caption": "렌더",
                "sprites": [],
                "bubbles": [],
            },
            "sections": [],
        }
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            stale = out_dir / "card-9.png"
            stale.write_bytes(b"stale")
            rendered = render_issue_images(issue, out_dir)
            self.assertEqual(set(rendered), {"cover"})
            self.assertFalse(stale.exists())
            self.assertTrue((out_dir / "cover.png").exists())


class WeeklyNewsPublishTests(unittest.TestCase):
    def test_same_week_reuses_existing_issue_number(self):
        material = sample_material()
        content = sample_issue(material)
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "weekly.db"
            conn = sqlite3.connect(db_path)
            conn.executescript(
                """
                CREATE TABLE weekly_news_issues (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    issue_no INTEGER NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    week_start TEXT NOT NULL UNIQUE,
                    week_end TEXT NOT NULL,
                    content_json TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'published',
                    published_at TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT
                );
                CREATE TABLE weekly_news_images (
                    issue_no INTEGER NOT NULL,
                    slot TEXT NOT NULL,
                    mime TEXT NOT NULL,
                    data BLOB NOT NULL,
                    PRIMARY KEY (issue_no, slot)
                );
                """
            )
            conn.close()

            def connection_factory():
                opened = sqlite3.connect(db_path)
                opened.row_factory = sqlite3.Row
                return opened

            request = Request({"type": "http", "headers": []})
            body = weekly_news.IssueUpsert(
                issue_no=None,
                title=content["title"],
                week_start=content["week_start"],
                week_end=content["week_end"],
                content=content,
                status="draft",
            )
            with (
                patch.object(weekly_news, "get_connection", connection_factory),
                patch.object(weekly_news, "_require_admin", lambda request: None),
            ):
                first = asyncio.run(weekly_news.create_issue(body, request))
                second = asyncio.run(weekly_news.create_issue(body, request))

            self.assertEqual(first["issue_no"], 1)
            self.assertEqual(second["issue_no"], 1)
            check = connection_factory()
            try:
                self.assertEqual(
                    check.execute("SELECT COUNT(*) FROM weekly_news_issues").fetchone()[0],
                    1,
                )
            finally:
                check.close()


if __name__ == "__main__":
    unittest.main()
