"""FastAPI application entry point"""
import sys
from pathlib import Path

# Ensure project root is on sys.path so crawler package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from crawler.db import init_db
from api.routes import search, items, mobs, maps, npcs, quests, export, skills, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure DB and tables exist
    try:
        init_db()
    except Exception as e:
        print(f"[startup] DB init warning: {e}")
    yield


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


@app.get("/api/health")
def health():
    return {"status": "ok"}
