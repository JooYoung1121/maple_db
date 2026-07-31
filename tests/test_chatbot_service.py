import os
import sqlite3
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from api import chatbot_service


class ChatbotServiceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        chatbot_service.reset_conversations()
        handle = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db_path = handle.name
        handle.close()
        conn = self._connection()
        conn.executescript(
            """
            CREATE TABLE mobs (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                level INTEGER,
                hp INTEGER,
                exp INTEGER,
                is_boss INTEGER DEFAULT 0,
                is_hidden INTEGER DEFAULT 0
            );
            CREATE TABLE items (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT,
                is_hidden INTEGER DEFAULT 0
            );
            CREATE TABLE entity_names_en (
                entity_type TEXT NOT NULL,
                entity_id INTEGER NOT NULL,
                name_en TEXT NOT NULL,
                source TEXT NOT NULL
            );
            CREATE TABLE mob_drops (
                mob_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                item_name TEXT,
                drop_rate REAL
            );
            CREATE TABLE maple_land_posts (
                id INTEGER PRIMARY KEY,
                post_id TEXT,
                board TEXT,
                title TEXT,
                content TEXT,
                summary TEXT,
                category TEXT,
                published_at TEXT,
                url TEXT,
                created_at TEXT
            );
            CREATE TABLE guild_posts (
                id INTEGER PRIMARY KEY,
                post_type TEXT,
                title TEXT,
                content TEXT,
                author TEXT,
                created_at TEXT
            );
            """
        )
        conn.execute(
            "INSERT INTO mobs VALUES (8190004, 'Skelosaurus', 113, 85000, 4750, 0, 0)"
        )
        conn.execute(
            "INSERT INTO entity_names_en VALUES ('mob', 8190004, '스켈로스', 'kms')"
        )
        conn.executemany(
            "INSERT INTO items VALUES (?, ?, ?, 0)",
            [
                (4000273, "Old Neck Bone", "Other"),
                (1040121, "Blue Neos", "Armor"),
            ],
        )
        conn.executemany(
            "INSERT INTO entity_names_en VALUES ('item', ?, ?, 'kms')",
            [(4000273, "오래된 뼈"), (1040121, "블루 네오스")],
        )
        conn.executemany(
            "INSERT INTO mob_drops VALUES (8190004, ?, NULL, ?)",
            [(4000273, 0.9234), (1040121, 0.003)],
        )
        conn.execute(
            """
            INSERT INTO maple_land_posts
              (id, post_id, board, title, content, summary, published_at, created_at)
            VALUES
              (1, 'notice-1', 'notices', '최신 점검 안내',
               '오전 7시부터 점검합니다.', NULL, '2026.07.31', '2026-07-31')
            """
        )
        conn.commit()
        conn.close()
        self.connection_patch = patch(
            "api.chatbot_service.get_connection", side_effect=self._connection
        )
        self.connection_patch.start()

    def tearDown(self):
        self.connection_patch.stop()
        os.unlink(self.db_path)
        chatbot_service.reset_conversations()

    def _connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    async def test_drop_query_uses_database_and_remembers_mob(self):
        reply = await chatbot_service.handle_chat_message(
            "discord:test:user", "스켈로스 드랍템"
        )
        self.assertIn("스켈로스", reply)
        self.assertIn("오래된 뼈 — 92.34%", reply)
        self.assertIn("/mobs/8190004", reply)

        followup = await chatbot_service.handle_chat_message(
            "discord:test:user", "그중 장비만 보여줘"
        )
        self.assertIn("장비 드랍 **1종**", followup)
        self.assertIn("블루 네오스", followup)
        self.assertNotIn("오래된 뼈", followup)

    async def test_notice_content_returns_latest_verified_post(self):
        reply = await chatbot_service.handle_chat_message(
            "discord:test:notice", "공지 내용은?"
        )
        self.assertIn("최신 점검 안내", reply)
        self.assertIn("오전 7시부터 점검합니다.", reply)
        self.assertIn("/news?post=notice-1", reply)

    async def test_weather_asks_location_then_uses_followup(self):
        fake_weather = "🌤️ **서울특별시 오늘 날씨**\n맑음 · 현재 25.0℃"
        with patch(
            "api.chatbot_service._fetch_weather",
            new=AsyncMock(return_value=fake_weather),
        ) as weather:
            prompt = await chatbot_service.handle_chat_message(
                "discord:test:weather", "오늘 날씨는?"
            )
            self.assertIn("어느 지역", prompt)

            reply = await chatbot_service.handle_chat_message(
                "discord:test:weather", "서울"
            )
            self.assertEqual(reply, fake_weather)
            weather.assert_awaited_once_with("서울", 0)

    async def test_site_feature_question_routes_without_llm(self):
        reply = await chatbot_service.handle_chat_message(
            "discord:test:site", "수수료 계산 어디서 해?"
        )
        self.assertIn("수수료 계산기", reply)
        self.assertTrue(reply.endswith("/fee"))

    async def test_explicit_web_query_uses_grounded_gemini(self):
        with patch(
            "api.chatbot_service._ask_gemini",
            new=AsyncMock(return_value="검색 답변"),
        ) as ask:
            reply = await chatbot_service.handle_chat_message(
                "discord:test:web", "요즘 AI 소식 검색해줘"
            )
        self.assertEqual(reply, "검색 답변")
        ask.assert_awaited_once()
        self.assertTrue(ask.await_args.kwargs["use_web_search"])

    async def test_web_search_can_be_disabled(self):
        with patch(
            "api.chatbot_service._ask_gemini",
            new=AsyncMock(return_value="일반 답변"),
        ) as ask:
            await chatbot_service.handle_chat_message(
                "discord:test:web-off",
                "인터넷에서 최신 소식 검색해줘",
                allow_web_search=False,
            )
        self.assertFalse(ask.await_args.kwargs["use_web_search"])

    def test_grounding_sources_are_deduplicated_and_clickable(self):
        answer = chatbot_service._append_grounding_sources(
            "확인된 답변입니다.",
            {
                "groundingChunks": [
                    {"web": {"title": "공식 자료", "uri": "https://example.com/a"}},
                    {"web": {"title": "중복", "uri": "https://example.com/a"}},
                    {"web": {"title": "두 번째", "uri": "https://example.org/b"}},
                    {"web": {"title": "잘못된 링크", "uri": "javascript:alert(1)"}},
                ]
            },
        )
        self.assertIn("[공식 자료](https://example.com/a)", answer)
        self.assertIn("[두 번째](https://example.org/b)", answer)
        self.assertEqual(answer.count("https://example.com/a"), 1)
        self.assertNotIn("javascript:", answer)


if __name__ == "__main__":
    unittest.main()
