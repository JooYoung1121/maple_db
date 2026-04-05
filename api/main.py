"""FastAPI application entry point"""
import asyncio
import sys
from pathlib import Path

# Ensure project root is on sys.path so crawler package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
from api.discord_bot import start_bot, get_bot


async def _maple_land_crawl_job():
    """30분마다 maple.land 신규 공지 크롤링."""
    # 첫 실행은 앱 시작 직후 (DB가 비어 있을 경우 초기 수집)
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
                n = await crawl_maple_land(conn, client, force=False)
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
        await asyncio.sleep(30 * 60)  # 30분 대기


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
    # v2.6.1 — AI 요약 프롬프트 변경으로 기존 요약 재생성 (1회성, 다음 배포 시 제거)
    try:
        conn = get_connection()
        cleared = conn.execute(
            "UPDATE maple_land_posts SET summary = NULL WHERE summary IS NOT NULL"
        ).rowcount
        conn.commit()
        conn.close()
        if cleared:
            print(f"[startup] AI 요약 초기화 {cleared}건 — 백필에서 재생성 예정")
    except Exception as e:
        print(f"[startup] summary reset warning: {e}")
    crawl_task = asyncio.create_task(_maple_land_crawl_job())
    bot_task = asyncio.create_task(start_bot())
    yield
    crawl_task.cancel()
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
app.include_router(matip.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
