"""디스코드 봇 — maple.land 알림 / 길드 게시판 알림 / 수동 알림"""
import os
import discord
from crawler.db import get_connection

bot_instance: discord.Client | None = None


class MapleBot(discord.Client):
    async def on_ready(self):
        print(f"[discord] 로그인: {self.user}")

    def get_channel_id(self) -> int | None:
        conn = get_connection()
        row = conn.execute(
            "SELECT value FROM bot_settings WHERE key='channel_id'"
        ).fetchone()
        conn.close()
        return int(row[0]) if row else None

    def is_enabled(self, key: str) -> bool:
        conn = get_connection()
        row = conn.execute(
            "SELECT value FROM bot_settings WHERE key=?", [key]
        ).fetchone()
        conn.close()
        return row[0] == "true" if row else False

    def get_mention_text(self) -> str | None:
        """bot_settings에서 mention_type을 읽어 멘션 텍스트 반환."""
        conn = get_connection()
        row = conn.execute(
            "SELECT value FROM bot_settings WHERE key='mention_type'"
        ).fetchone()
        mention_type = row[0] if row else "none"
        if mention_type == "everyone":
            conn.close()
            return "@everyone"
        if mention_type == "here":
            conn.close()
            return "@here"
        if mention_type == "role":
            role_row = conn.execute(
                "SELECT value FROM bot_settings WHERE key='mention_role_id'"
            ).fetchone()
            conn.close()
            return f"<@&{role_row[0]}>" if role_row and role_row[0] else None
        conn.close()
        return None

    async def _get_channel(self, raise_on_error: bool = False):
        """fetch_channel로 채널 조회 (캐시 미스 방지)."""
        ch_id = self.get_channel_id()
        if not ch_id:
            msg = "channel_id 미설정"
            print(f"[discord] {msg}")
            if raise_on_error:
                raise RuntimeError(msg)
            return None
        try:
            return await self.fetch_channel(ch_id)
        except Exception as e:
            msg = f"채널 조회 실패 ({ch_id}): {e}"
            print(f"[discord] {msg}")
            if raise_on_error:
                raise RuntimeError(msg)
            return None

    async def send_maple_land_embed(self, title: str, url: str, category: str | None, board: str):
        """maple.land 신규 포스트 알림"""
        if not self.is_enabled("notify_maple_land"):
            return
        ch = await self._get_channel()
        if not ch:
            return
        color = 0x2ECC71 if board == "events" else 0x3498DB
        embed = discord.Embed(title=title, url=url, color=color)
        embed.set_author(name=f"메랜 공홈 {'이벤트' if board == 'events' else '공지'}")
        if category:
            embed.add_field(name="카테고리", value=category)
        await ch.send(content=self.get_mention_text(), embed=embed)

    async def send_guild_post_embed(self, post_type: str, title: str, author: str):
        """길드 게시판 작성 알림"""
        if not self.is_enabled("notify_guild_post"):
            return
        ch = await self._get_channel()
        if not ch:
            return
        color = 0xE67E22 if post_type == "announcement" else 0x9B59B6
        label = "공지" if post_type == "announcement" else "이벤트"
        embed = discord.Embed(title=f"[길드 {label}] {title}", color=color)
        embed.add_field(name="작성자", value=author)
        await ch.send(content=self.get_mention_text(), embed=embed)

    async def send_manual(self, message: str):
        """관리자 수동 알림 — 에러 시 예외 발생."""
        ch = await self._get_channel(raise_on_error=True)
        embed = discord.Embed(
            title="추억길드 공지", description=message, color=0xF39C12
        )
        await ch.send(content=self.get_mention_text(), embed=embed)

    async def send_guild_post_detail(self, post_type: str, title: str, content: str | None, author: str, url: str | None = None):
        """길드 게시판 글 상세 전송 — 에러 시 예외 발생."""
        ch = await self._get_channel(raise_on_error=True)
        color = 0xE67E22 if post_type == "announcement" else 0x9B59B6
        label = "공지" if post_type == "announcement" else "이벤트"
        desc = f"**제목** : {title}\n**내용** : {content or '(내용 없음)'}"
        embed = discord.Embed(
            title=f"[길드 {label}]",
            url=url or None,
            description=desc,
            color=color,
        )
        embed.set_footer(text=f"작성자: {author}")
        await ch.send(content=self.get_mention_text(), embed=embed)



async def start_bot():
    global bot_instance
    token = os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        print("[discord] DISCORD_BOT_TOKEN 미설정, 봇 비활성화")
        return
    intents = discord.Intents.default()
    intents.message_content = True
    bot_instance = MapleBot(intents=intents)
    try:
        await bot_instance.start(token)
    except Exception as e:
        print(f"[discord] 봇 오류: {e}")


def get_bot() -> MapleBot | None:
    return bot_instance
