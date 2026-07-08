"""FastAPI application entry point"""
import asyncio
import os
import sys
from pathlib import Path

# Ensure project root is on sys.path so crawler package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from crawler.db import init_db, get_connection
from api.routes import search, items, mobs, maps, npcs, quests, export, skills, admin, bimae, scroll_rankings, community
from api.routes import maple_land
from api.routes import matip
from api.routes import game_results
from api.routes import guild
from api.routes import guild_members
from api.routes import guild_boss
from api.routes import fee_records
from api.routes import discord_admin
from api.routes import free_board
from api.routes import info_board
from api.routes import fortune
from api.routes import maker
from api.routes import quiz
from api.routes import weekly_news
from api.discord_bot import start_bot, get_bot


def _env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _crawl_interval_seconds() -> int:
    raw = os.environ.get("MAPLE_LAND_CRAWL_INTERVAL_MINUTES", "30")
    try:
        minutes = int(raw)
    except ValueError:
        minutes = 30
    return max(minutes, 5) * 60


async def _maple_land_crawl_job():
    """Periodically check MapleLand/Tespia notice boards."""
    interval = _crawl_interval_seconds()
    while True:
        try:
            from crawler.parsers.maple_land import crawl_maple_land
            from crawler.client import ThrottledClient
            conn = get_connection()
            # 크롤링 전 기존 post_id 목록 스냅샷
            existing_ids = {
                r[0] for r in conn.execute("SELECT post_id FROM maple_land_posts").fetchall()
            }
            async with ThrottledClient() as client:
                n = await crawl_maple_land(conn, client, force=False, refresh_lists=True)
                if n:
                    print(f"[scheduler] maple-land 신규 {n}건 저장")
                    # 신규 포스트에 대해 디스코드 알림
                    bot = get_bot()
                    if bot and bot.is_ready():
                        new_posts = conn.execute(
                            "SELECT title, url, category, board FROM maple_land_posts WHERE post_id NOT IN ({})".format(
                                ",".join("?" for _ in existing_ids)
                            ) if existing_ids else "SELECT title, url, category, board FROM maple_land_posts",
                            list(existing_ids) if existing_ids else [],
                        ).fetchall()
                        for post in new_posts:
                            try:
                                await bot.send_maple_land_embed(
                                    post["title"], post["url"],
                                    post["category"], post["board"],
                                )
                            except Exception as be:
                                print(f"[discord] 알림 오류: {be}")
            conn.close()
        except Exception as e:
            print(f"[scheduler] maple-land 크롤링 오류: {e}")
        await asyncio.sleep(interval)


def _community_interval_seconds() -> int:
    raw = os.environ.get("COMMUNITY_CRAWL_INTERVAL_MINUTES", "360")
    try:
        minutes = int(raw)
    except ValueError:
        minutes = 360
    return max(minutes, 30) * 60


async def _maybe_send_weekly_news_reminder(conn):
    """일요일 18시(KST) 이후 첫 수집 사이클에서 주간 메랜 발행 리마인더를 1회 전송."""
    from datetime import datetime, timedelta, timezone

    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    if now.weekday() != 6 or now.hour < 18:
        return
    week_start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
    week_end = now.strftime("%Y-%m-%d")

    row = conn.execute(
        "SELECT value FROM bot_settings WHERE key='weekly_news_reminder_sent_week'"
    ).fetchone()
    if row and row[0] == week_start:
        return  # 이번 주 이미 전송

    bot = get_bot()
    if not bot or not bot.is_ready():
        return

    official = conn.execute(
        "SELECT COUNT(*) FROM maple_land_posts "
        "WHERE REPLACE(COALESCE(published_at, SUBSTR(created_at, 1, 10)), '.', '-') BETWEEN ? AND ?",
        (week_start, week_end),
    ).fetchone()[0]
    community = conn.execute(
        "SELECT COUNT(*) FROM community_posts "
        "WHERE SUBSTR(COALESCE(published_at, first_seen_at), 1, 10) BETWEEN ? AND ?",
        (week_start, week_end),
    ).fetchone()[0]
    if official == 0 and community == 0:
        print("[scheduler] 주간 메랜 리마인더 스킵 — 이번 주 원자재 없음")
        return

    top_titles = [
        r[0] for r in conn.execute(
            "SELECT title FROM community_posts "
            "WHERE SUBSTR(COALESCE(published_at, first_seen_at), 1, 10) BETWEEN ? AND ? "
            "ORDER BY recommends DESC, views DESC LIMIT 3",
            (week_start, week_end),
        ).fetchall()
    ]

    await bot.send_weekly_news_reminder(week_start, week_end, official, community, top_titles)
    conn.execute(
        "INSERT INTO bot_settings (key, value) VALUES ('weekly_news_reminder_sent_week', ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (week_start,),
    )
    conn.commit()
    print(f"[scheduler] 주간 메랜 리마인더 전송 (공식 {official}건, 커뮤니티 {community}건)")


async def _community_crawl_job():
    """주간 뉴스 원자료 수집 — 디시 메이플랜드 갤러리 (하루 4회 기본)."""
    interval = _community_interval_seconds()
    while True:
        try:
            from crawler.parsers.dcinside import crawl_dcinside
            from crawler.client import ThrottledClient
            conn = get_connection()
            async with ThrottledClient() as client:
                n = await crawl_dcinside(conn, client)
                if n:
                    print(f"[scheduler] community(dcinside) {n}건 수집")
            try:
                await _maybe_send_weekly_news_reminder(conn)
            except Exception as re:
                print(f"[scheduler] 주간 메랜 리마인더 오류: {re}")
            conn.close()
        except Exception as e:
            print(f"[scheduler] community 크롤링 오류: {e}")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure DB and tables exist
    try:
        init_db()
    except Exception as e:
        print(f"[startup] DB init warning: {e}")
    # 날짜 형식 정규화 (구 파서 버그: YYYY.MM.DDN,NNN 형식 수정)
    try:
        conn = get_connection()
        conn.execute("""
            UPDATE maple_land_posts
            SET published_at = SUBSTR(published_at, 1, 10)
            WHERE published_at IS NOT NULL AND LENGTH(published_at) > 10
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[startup] date normalize warning: {e}")
    crawl_task = None
    if _env_bool("MAPLE_LAND_CRAWLER_ENABLED", True):
        crawl_task = asyncio.create_task(_maple_land_crawl_job())
    else:
        print("[scheduler] maple-land crawler disabled")
    community_task = None
    if _env_bool("COMMUNITY_CRAWLER_ENABLED", True):
        community_task = asyncio.create_task(_community_crawl_job())
    else:
        print("[scheduler] community crawler disabled")
    bot_task = asyncio.create_task(start_bot())
    yield
    if crawl_task:
        crawl_task.cancel()
    if community_task:
        community_task.cancel()
    bot_task.cancel()


app = FastAPI(
    title="MapleStory Land API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.include_router(search.router, prefix="/api")
app.include_router(items.router, prefix="/api")
app.include_router(mobs.router, prefix="/api")
app.include_router(maps.router, prefix="/api")
app.include_router(npcs.router, prefix="/api")
app.include_router(quests.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(skills.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(bimae.router, prefix="/api")
app.include_router(scroll_rankings.router, prefix="/api")
app.include_router(community.router, prefix="/api")
app.include_router(maple_land.router, prefix="/api")
app.include_router(game_results.router, prefix="/api")
app.include_router(guild.router, prefix="/api")
app.include_router(guild_members.router, prefix="/api")
app.include_router(guild_boss.router, prefix="/api")
app.include_router(fee_records.router, prefix="/api")
app.include_router(discord_admin.router, prefix="/api")
app.include_router(free_board.router, prefix="/api")
app.include_router(info_board.router, prefix="/api")
app.include_router(matip.router, prefix="/api")
app.include_router(fortune.router, prefix="/api")
app.include_router(maker.router, prefix="/api")
app.include_router(quiz.router, prefix="/api")
app.include_router(weekly_news.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
