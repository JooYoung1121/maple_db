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


async def _maple_land_crawl_job():
    """30분마다 maple.land 신규 공지 크롤링."""
    # 첫 실행은 앱 시작 직후 (DB가 비어 있을 경우 초기 수집)
    while True:
        try:
            from crawler.parsers.maple_land import crawl_maple_land
            from crawler.client import ThrottledClient
            conn = get_connection()
            async with ThrottledClient() as client:
                n = await crawl_maple_land(conn, client, force=False)
                if n:
                    print(f"[scheduler] maple-land 신규 {n}건 저장")
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
    task = asyncio.create_task(_maple_land_crawl_job())
    yield
    task.cancel()


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


@app.get("/api/health")
def health():
    return {"status": "ok"}
