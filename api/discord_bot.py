"""디스코드 봇 — maple.land 알림 / 길드 게시판 알림 / 수동 알림"""
import os
import discord
from crawler.db import get_connection

bot_instance: discord.Client | None = None


class MapleBot(discord.Client):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._invalid_channel_ids: set[int] = set()

    async def on_ready(self):
        print(f"[discord] 로그인: {self.user}")

    def get_channel_id(self) -> int | None:
        conn = get_connection()
        row = conn.execute(
            "SELECT value FROM bot_settings WHERE key='channel_id'"
        ).fetchone()
        conn.close()
        value = str(row[0]).strip() if row else ""
        return int(value) if value.isdigit() else None

    def clear_channel_errors(self) -> None:
        self._invalid_channel_ids.clear()

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
        if ch_id in self._invalid_channel_ids:
            msg = f"채널 조회 실패 ({ch_id}): 이전 조회에서 채널을 찾을 수 없어 알림 생략"
            if raise_on_error:
                raise RuntimeError(msg)
            return None
        try:
            return await self.fetch_channel(ch_id)
        except discord.NotFound as e:
            self._invalid_channel_ids.add(ch_id)
            msg = f"채널 조회 실패 ({ch_id}): {e}"
            print(f"[discord] {msg}")
            if raise_on_error:
                raise RuntimeError(msg)
            return None
        except Exception as e:
            msg = f"채널 조회 실패 ({ch_id}): {e}"
            print(f"[discord] {msg}")
            if raise_on_error:
                raise RuntimeError(msg)
            return None

    async def send_maple_land_embed(
        self, title: str, url: str, category: str | None, board: str,
        post_id: str | None = None,
    ):
        """maple.land 신규 포스트 알림 — 공홈 원문 + 우리 사이트 링크 함께 전송"""
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
        site_base = os.environ.get("PUBLIC_SITE_URL", "https://memorymapledb.up.railway.app").rstrip("/")
        if post_id and site_base.startswith("http"):
            embed.add_field(
                name="바로가기",
                value=f"[공홈 원문]({url}) · [추억길드 공홈]({site_base}/news?post={post_id})",
                inline=False,
            )
        await ch.send(content=self.get_mention_text(), embed=embed)

    def get_weekly_reminder_channel_id(self) -> int | None:
        """주간 메랜 리마인더 전용 채널 (미설정 시 None → 기본 알림 채널 사용)."""
        conn = get_connection()
        row = conn.execute(
            "SELECT value FROM bot_settings WHERE key='weekly_reminder_channel_id'"
        ).fetchone()
        conn.close()
        value = str(row[0]).strip() if row and row[0] else ""
        return int(value) if value.isdigit() else None

    async def send_weekly_news_reminder(
        self,
        week_start: str,
        week_end: str,
        official_count: int,
        community_count: int,
        top_titles: list[str],
    ):
        """주간 메랜 발행 리마인더 — 일요일 저녁, 이번 주 원자재 현황 알림.

        발행 완료 알림(길드 공지 채널)과 달리, 별도 리마인더 채널이 설정돼 있으면
        그쪽으로만 보낸다 (작성자 개인용 알림).
        """
        if not self.is_enabled("notify_weekly_news"):
            return
        ch = None
        reminder_ch_id = self.get_weekly_reminder_channel_id()
        if reminder_ch_id:
            try:
                ch = await self.fetch_channel(reminder_ch_id)
            except Exception as e:
                print(f"[discord] 리마인더 채널 조회 실패 ({reminder_ch_id}): {e} — 기본 채널로 대체")
        if not ch:
            ch = await self._get_channel()
        if not ch:
            return
        desc_lines = [f"**이번 주** {week_start} ~ {week_end}"]
        if community_count > 0:
            desc_lines.append(
                f"공식 소식 **{official_count}건** · 커뮤니티 인기글 **{community_count}건** 쌓였습니다."
            )
        else:
            # 디시는 서버 IP가 차단돼 커뮤니티 글은 발행 시 로컬에서 수집된다
            desc_lines.append(
                f"공식 소식 **{official_count}건** 쌓였습니다. (커뮤니티 글은 실행 시 로컬에서 수집)"
            )
        if top_titles:
            desc_lines.append("")
            desc_lines.append("이번 주 커뮤니티 화제글:")
            desc_lines.extend(f"- {t}" for t in top_titles)
        desc_lines.append("")
        desc_lines.append("로컬에서 발행을 실행하세요:")
        desc_lines.append("```\n.venv/bin/python scripts/weekly_news_generate.py all\n```")
        embed = discord.Embed(
            title="📰 주간 메랜 발행 시간!",
            description="\n".join(desc_lines),
            color=0xF39C12,
        )
        await ch.send(content=self.get_mention_text(), embed=embed)

    async def send_weekly_news_published(self, issue_no: int, title: str, url: str | None):
        """주간 메랜 새 호 발행 알림."""
        if not self.is_enabled("notify_weekly_news"):
            return
        ch = await self._get_channel()
        if not ch:
            return
        embed = discord.Embed(
            title=f"🗞️ 주간 메랜 제{issue_no}호 발행!",
            description=title,
            url=url or None,
            color=0xE67E22,
        )
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
