import os
import sqlite3
import tempfile
import unittest
from datetime import date
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
            CREATE TABLE discord_ai_usage (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                usage_date TEXT NOT NULL,
                request_count INTEGER NOT NULL DEFAULT 0,
                search_count INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT,
                PRIMARY KEY (guild_id, user_id, usage_date)
            );
            CREATE TABLE discord_bot_memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                memory_key TEXT NOT NULL,
                normalized_key TEXT NOT NULL,
                content TEXT NOT NULL,
                author_id TEXT NOT NULL,
                author_name TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(guild_id, normalized_key)
            );
            """
        )
        conn.execute(
            "INSERT INTO mobs VALUES (8190004, 'Skelosaurus', 113, 85000, 4750, 0, 0)"
        )
        conn.execute(
            """
            INSERT INTO maple_land_posts
              (id, post_id, board, title, content, summary, category,
               published_at, created_at)
            VALUES
              (2, 'patch-0731', 'notices',
               '2026년 7월 31일(금) 패치노트 (16:00 수정)',
               '키 입력 처리 방식을 변경합니다.',
               '장기 점검 보상 아이템 기간을 연장하고 키 입력 처리 방식을 개선합니다.',
               '업데이트', '2026.07.30', '2026-07-31')
            """
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

    @staticmethod
    def _actor(
        *,
        guild_id="guild-1",
        user_id="user-1",
        user_name="감튀",
        is_admin=False,
        user_limit=30,
        server_limit=100,
    ):
        return chatbot_service.ChatActor(
            guild_id=guild_id,
            user_id=user_id,
            user_name=user_name,
            is_admin=is_admin,
            ai_user_daily_limit=user_limit,
            ai_server_daily_limit=server_limit,
        )

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

    async def test_screenshot_patch_question_uses_site_patch_data(self):
        with (
            patch(
                "api.chatbot_service._today_kst",
                return_value=date(2026, 7, 31),
            ),
            patch(
                "api.chatbot_service._ask_gemini",
                new=AsyncMock(return_value="LLM으로 가면 안 됨"),
            ) as ask,
        ):
            reply = await chatbot_service.handle_chat_message(
                "discord:test:patch",
                "오늘 패치내용 알려줘",
            )
        self.assertIn("2026년 7월 31일(금) 패치노트", reply)
        self.assertIn("키 입력 처리 방식을 개선", reply)
        self.assertIn("/news?post=patch-0731", reply)
        ask.assert_not_awaited()

    async def test_screenshot_official_news_page_question_returns_site_link(self):
        with patch(
            "api.chatbot_service._ask_gemini",
            new=AsyncMock(return_value="LLM으로 가면 안 됨"),
        ) as ask:
            reply = await chatbot_service.handle_chat_message(
                "discord:test:news-page",
                "아니 우리 사이트 공홈소식 페이지 주면되잖아",
            )
        self.assertIn("메이플랜드 공홈 소식", reply)
        self.assertTrue(reply.endswith("/news"))
        ask.assert_not_awaited()

    async def test_patch_followup_can_return_specific_link_and_content(self):
        with patch(
            "api.chatbot_service._today_kst",
            return_value=date(2026, 7, 31),
        ):
            await chatbot_service.handle_chat_message(
                "discord:test:patch-followup",
                "오늘 패치노트 알려줘",
            )
            link_reply = await chatbot_service.handle_chat_message(
                "discord:test:patch-followup",
                "그거 링크 줘",
            )
            detail_reply = await chatbot_service.handle_chat_message(
                "discord:test:patch-followup",
                "그거 내용 다시 알려줘",
            )
        self.assertIn("/news?post=patch-0731", link_reply)
        self.assertIn("키 입력 처리 방식을 개선", detail_reply)

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

    async def test_info_lists_skills_and_current_usage_without_charging(self):
        reply = await chatbot_service.handle_chat_message(
            "discord:test:info", "!인포", actor=self._actor()
        )
        self.assertIn("푸확 봇 인포", reply)
        self.assertIn("!저장 이름 = 내용", reply)
        self.assertIn("오늘 AI 요청 0/100", reply)
        conn = self._connection()
        try:
            self.assertEqual(
                conn.execute("SELECT COUNT(*) FROM discord_ai_usage").fetchone()[0],
                0,
            )
        finally:
            conn.close()

    async def test_guild_memory_save_and_natural_recall_do_not_use_llm(self):
        actor = self._actor()
        saved = await chatbot_service.handle_chat_message(
            "discord:test:memory", "!저장 감튀살 = 감튀는 최고야", actor=actor
        )
        self.assertIn("저장했어요", saved)

        with patch(
            "api.chatbot_service._ask_gemini",
            new=AsyncMock(return_value="LLM으로 가면 안 됨"),
        ) as ask:
            recalled = await chatbot_service.handle_chat_message(
                "discord:test:memory", "감튀살이 누구야?", actor=actor
            )
        self.assertIn("서버 구성원이 저장한 메모", recalled)
        self.assertIn("감튀는 최고야", recalled)
        self.assertIn("공식 정보가 아닌", recalled)
        ask.assert_not_awaited()

        with patch(
            "api.chatbot_service._ask_gemini",
            new=AsyncMock(return_value="일반 대화"),
        ) as ask_after_memory:
            await chatbot_service.handle_chat_message(
                "discord:test:memory", "오늘 기분은 어때?", actor=actor
            )
        gemini_session = ask_after_memory.await_args.args[0]
        self.assertNotIn(
            "감튀는 최고야",
            " ".join(message for _, message in gemini_session.history),
        )

        duplicate = await chatbot_service.handle_chat_message(
            "discord:test:memory", "!저장 감튀살 = 다른 내용", actor=actor
        )
        self.assertIn("이미 있어요", duplicate)
        self.assertIn("!수정", duplicate)

    async def test_memory_is_scoped_and_edit_delete_are_permission_checked(self):
        owner = self._actor()
        stranger = self._actor(user_id="user-2", user_name="다른사람")
        admin = self._actor(user_id="admin", user_name="관리자", is_admin=True)
        other_guild = self._actor(guild_id="guild-2", user_id="user-3")
        await chatbot_service.handle_chat_message(
            "discord:test:owner", "!저장 길드비밀 = 7시에 모여요", actor=owner
        )

        denied = await chatbot_service.handle_chat_message(
            "discord:test:stranger", "!수정 길드비밀 = 8시", actor=stranger
        )
        self.assertIn("작성자 또는 서버 관리자만", denied)

        with patch(
            "api.chatbot_service._ask_gemini",
            new=AsyncMock(return_value="다른 서버에는 없음"),
        ) as ask:
            reply = await chatbot_service.handle_chat_message(
                "discord:test:other", "길드비밀 알려줘", actor=other_guild
            )
        self.assertEqual(reply, "다른 서버에는 없음")
        ask.assert_awaited_once()

        deleted = await chatbot_service.handle_chat_message(
            "discord:test:admin", "!삭제 길드비밀", actor=admin
        )
        self.assertIn("삭제했어요", deleted)

    async def test_dm_memory_save_is_rejected(self):
        reply = await chatbot_service.handle_chat_message(
            "discord:dm:user",
            "!저장 개인 = 저장 안 됨",
            actor=self._actor(guild_id=None),
        )
        self.assertIn("서버 안에서", reply)

    async def test_ai_usage_enforces_user_and_server_limits_with_footer(self):
        actor_one = self._actor(user_limit=2, server_limit=3)
        actor_two = self._actor(
            user_id="user-2", user_name="두번째", user_limit=2, server_limit=3
        )
        with (
            patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}),
            patch(
                "api.chatbot_service._ask_gemini",
                new=AsyncMock(return_value="AI 답변"),
            ) as ask,
        ):
            first = await chatbot_service.handle_chat_message(
                "discord:test:q1", "안녕 푸확아", actor=actor_one
            )
            second = await chatbot_service.handle_chat_message(
                "discord:test:q1", "오늘 기분 어때?", actor=actor_one
            )
            user_blocked = await chatbot_service.handle_chat_message(
                "discord:test:q1", "또 이야기해줘", actor=actor_one
            )
            third = await chatbot_service.handle_chat_message(
                "discord:test:q2", "반가워", actor=actor_two
            )
            server_blocked = await chatbot_service.handle_chat_message(
                "discord:test:q2", "하나 더", actor=actor_two
            )

        self.assertIn("오늘 AI 요청 1/3 · 내 요청 1/2", first)
        self.assertIn("오늘 AI 요청 2/3 · 내 요청 2/2", second)
        self.assertIn("개인 AI 요청 한도", user_blocked)
        self.assertIn("오늘 AI 요청 3/3 · 내 요청 1/2", third)
        self.assertIn("서버의 AI 요청 한도", server_blocked)
        self.assertEqual(ask.await_count, 3)

    async def test_site_database_answers_do_not_charge_ai_usage(self):
        actor = self._actor(user_limit=1, server_limit=1)
        with (
            patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}),
            patch(
                "api.chatbot_service._ask_gemini",
                new=AsyncMock(return_value="LLM으로 가면 안 됨"),
            ) as ask,
        ):
            reply = await chatbot_service.handle_chat_message(
                "discord:test:free", "스켈로스 드랍템", actor=actor
            )
        self.assertIn("오래된 뼈", reply)
        self.assertNotIn("오늘 AI 요청", reply)
        ask.assert_not_awaited()
        conn = self._connection()
        try:
            self.assertEqual(
                conn.execute("SELECT COUNT(*) FROM discord_ai_usage").fetchone()[0],
                0,
            )
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
