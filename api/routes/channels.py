"""커뮤니티 채널 가이드 API — 스트리머/유튜브/블로그/커뮤니티 큐레이션.

- community_channels: 관리자가 라이브에서 편집하는 큐레이션 테이블 (시드 동기화 제외,
  비어 있을 때만 기본 큐레이션 삽입)
- channel_videos: 유튜브 RSS로 수집한 채널별 최신 영상 (파생 데이터)
- 라이브 상태: 치지직/SOOP 비공식 API, 5분 TTL 캐시, 실패 시 null(알 수 없음)
"""
import asyncio
import os
import re
import time
import xml.etree.ElementTree as ET
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from crawler.db import get_connection

router = APIRouter()

CATEGORIES = {"stream", "youtube", "blog", "community", "discord"}

# 기본 큐레이션 (테이블이 비어 있을 때 1회 삽입 — 이후 관리자 UI에서 자유롭게 수정)
DEFAULT_CHANNELS = [
    ("stream", "치지직 메이플랜드 방송", "치지직", "https://chzzk.naver.com/search?keyword=%EB%A9%94%EC%9D%B4%ED%94%8C%EB%9E%9C%EB%93%9C", None,
     "치지직에서 방송 중인 메이플랜드 스트리머 모아보기", "라이브,검색", 10),
    ("stream", "SOOP 메이플랜드 방송", "SOOP", "https://www.sooplive.co.kr/search?szKeyword=%EB%A9%94%EC%9D%B4%ED%94%8C%EB%9E%9C%EB%93%9C", None,
     "SOOP에서 방송 중인 메이플랜드 스트리머 모아보기", "라이브,검색", 20),
    ("youtube", "메이플 딘썽", "유튜브", "https://www.youtube.com/@Maple_Dinssung", None,
     "메이플 소식·콘텐츠 유튜버", "공략,소식", 10),
    ("youtube", "메이플스토리맑음", "유튜브", "https://www.youtube.com/@%EB%A9%94%EC%9D%B4%ED%94%8C%EC%8A%A4%ED%86%A0%EB%A6%AC%EB%A7%91%EC%9D%8C", None,
     "메이플 소식을 가장 빠르게 전하는 채널", "소식", 20),
    ("youtube", "메이플스토리 공식", "유튜브", "https://www.youtube.com/@MapleStoryKR", None,
     "넥슨 메이플스토리 공식 유튜브", "공식", 30),
    ("blog", "메이플기분", "티스토리", "https://maplekibun.tistory.com", None,
     "직업별 스킬·육성 공략 블로그 (본 사이트 스킬 데이터 출처)", "공략,스킬", 10),
    ("community", "디시 메이플랜드 갤러리", "디시인사이드", "https://gall.dcinside.com/mgallery/board/lists/?id=mapleland", None,
     "가장 활발한 메이플랜드 커뮤니티 — 주간 메랜 인기글 출처", "커뮤니티", 10),
    ("community", "메이플 인벤", "인벤", "https://maple.inven.co.kr/", None,
     "메이플스토리 인벤 — 방송 페이지·게시판", "커뮤니티", 20),
    ("community", "에펨코리아 메이플", "에펨코리아", "https://www.fmkorea.com/maplestory", None,
     "에펨코리아 메이플스토리 게시판", "커뮤니티", 30),
]


def _require_admin(request: Request):
    admin_pw = os.environ.get("GAME_ADMIN_PASSWORD", "1004")
    if request.headers.get("X-Admin-Password", "") != admin_pw:
        raise HTTPException(status_code=403, detail="비밀번호가 틀립니다.")


def ensure_tables(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS community_channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            name TEXT NOT NULL,
            platform TEXT,
            url TEXT NOT NULL,
            channel_key TEXT,
            description TEXT,
            tags TEXT,
            sort_order INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );
        CREATE TABLE IF NOT EXISTS channel_videos (
            channel_id INTEGER NOT NULL,
            video_id TEXT NOT NULL,
            title TEXT,
            url TEXT,
            thumbnail TEXT,
            published_at TEXT,
            fetched_at TEXT,
            PRIMARY KEY (channel_id, video_id)
        );
    """)
    empty = conn.execute("SELECT COUNT(*) FROM community_channels").fetchone()[0] == 0
    if empty:
        conn.executemany(
            """INSERT INTO community_channels
               (category, name, platform, url, channel_key, description, tags, sort_order)
               VALUES (?,?,?,?,?,?,?,?)""",
            DEFAULT_CHANNELS,
        )
    conn.commit()


# ── 라이브 상태 (5분 TTL 캐시) ──────────────────────────
_live_cache: dict[int, tuple[float, Optional[bool]]] = {}
LIVE_TTL = 300

_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


async def _check_live(client: httpx.AsyncClient, platform: str, key: str) -> Optional[bool]:
    """치지직/SOOP 라이브 여부. 실패/미지원 시 None (알 수 없음)."""
    try:
        if platform == "치지직":
            r = await client.get(
                f"https://api.chzzk.naver.com/service/v1/channels/{key}",
                headers={"User-Agent": _BROWSER_UA},
            )
            if r.status_code != 200:
                return None
            return bool((r.json().get("content") or {}).get("openLive"))
        if platform == "SOOP":
            r = await client.get(
                f"https://chapi.sooplive.co.kr/api/{key}/station",
                headers={"User-Agent": _BROWSER_UA},
            )
            if r.status_code != 200:
                return None
            return r.json().get("broad") is not None
    except Exception:
        return None
    return None


@router.get("/channels/live")
async def channels_live():
    """channel_key가 등록된 방송 채널의 라이브 상태 조회 (TTL 캐시)."""
    conn = get_connection()
    try:
        ensure_tables(conn)
        rows = conn.execute(
            """SELECT id, platform, channel_key FROM community_channels
               WHERE category='stream' AND is_active=1
                 AND channel_key IS NOT NULL AND channel_key != ''"""
        ).fetchall()
    finally:
        conn.close()

    now = time.time()
    to_check = [r for r in rows if r["id"] not in _live_cache or now - _live_cache[r["id"]][0] > LIVE_TTL]
    if to_check:
        async with httpx.AsyncClient(timeout=6) as client:
            results = await asyncio.gather(
                *[_check_live(client, r["platform"] or "", r["channel_key"]) for r in to_check]
            )
        for r, live in zip(to_check, results):
            _live_cache[r["id"]] = (now, live)

    return {"live": {str(r["id"]): _live_cache.get(r["id"], (0, None))[1] for r in rows}}


# ── 유튜브 RSS 영상 수집 ──────────────────────────────
_ATOM = "{http://www.w3.org/2005/Atom}"
_YT = "{http://www.youtube.com/xml/schemas/2015}"
_MEDIA = "{http://search.yahoo.com/mrss/}"


async def _resolve_youtube_channel_id(client: httpx.AsyncClient, url: str) -> Optional[str]:
    """유튜브 @핸들 URL에서 UC 채널 ID를 해석."""
    try:
        r = await client.get(url, headers={"User-Agent": _BROWSER_UA})
        m = re.search(r'"(?:channelId|externalId)":"(UC[\w-]{22})"', r.text)
        return m.group(1) if m else None
    except Exception:
        return None


async def refresh_channel_videos() -> int:
    """유튜브 채널의 최신 영상을 RSS로 수집. 반환: 갱신된 채널 수."""
    conn = get_connection()
    try:
        ensure_tables(conn)
        rows = conn.execute(
            """SELECT id, url, channel_key FROM community_channels
               WHERE category='youtube' AND is_active=1"""
        ).fetchall()
        updated = 0
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            for r in rows:
                key = r["channel_key"]
                if not key and "youtube.com/" in (r["url"] or ""):
                    key = await _resolve_youtube_channel_id(client, r["url"])
                    if key:
                        conn.execute(
                            "UPDATE community_channels SET channel_key=? WHERE id=?", (key, r["id"])
                        )
                if not key or not key.startswith("UC"):
                    continue
                try:
                    feed = await client.get(
                        f"https://www.youtube.com/feeds/videos.xml?channel_id={key}"
                    )
                    if feed.status_code != 200:
                        continue
                    root = ET.fromstring(feed.text)
                    for entry in root.findall(f"{_ATOM}entry")[:5]:
                        vid = entry.findtext(f"{_YT}videoId")
                        if not vid:
                            continue
                        title = entry.findtext(f"{_ATOM}title")
                        published = entry.findtext(f"{_ATOM}published")
                        thumb_el = entry.find(f"{_MEDIA}group/{_MEDIA}thumbnail")
                        thumb = thumb_el.get("url") if thumb_el is not None else None
                        conn.execute(
                            """INSERT INTO channel_videos
                               (channel_id, video_id, title, url, thumbnail, published_at, fetched_at)
                               VALUES (?,?,?,?,?,?,datetime('now','localtime'))
                               ON CONFLICT(channel_id, video_id) DO UPDATE SET
                                 title=excluded.title, thumbnail=excluded.thumbnail,
                                 published_at=excluded.published_at, fetched_at=excluded.fetched_at""",
                            (r["id"], vid, title, f"https://www.youtube.com/watch?v={vid}", thumb, published),
                        )
                    updated += 1
                except Exception as e:
                    print(f"[channels] 영상 수집 실패 (channel {r['id']}): {e}")
        conn.commit()
        return updated
    finally:
        conn.close()


# ── 조회 ─────────────────────────────────────────────
@router.get("/channels")
def list_channels():
    conn = get_connection()
    try:
        ensure_tables(conn)
        channels = [
            dict(r) for r in conn.execute(
                """SELECT id, category, name, platform, url, channel_key, description, tags, sort_order, is_active
                   FROM community_channels WHERE is_active=1
                   ORDER BY category, sort_order, id"""
            ).fetchall()
        ]
        videos: dict[str, list] = {}
        for r in conn.execute(
            """SELECT channel_id, video_id, title, url, thumbnail, published_at
               FROM channel_videos ORDER BY published_at DESC"""
        ).fetchall():
            bucket = videos.setdefault(str(r["channel_id"]), [])
            if len(bucket) < 3:
                bucket.append(dict(r))
        return {"channels": channels, "videos": videos}
    finally:
        conn.close()


@router.get("/channels/community-hot")
def community_hot(days: int = 7, limit: int = 8):
    """디시 메랜갤 인기글 위젯용 — 최근 N일 추천/조회 상위."""
    days = min(max(days, 1), 30)
    limit = min(max(limit, 1), 20)
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT title, url, author, views, recommends, comment_count, is_recommended,
                      COALESCE(published_at, first_seen_at) AS published_at
               FROM community_posts
               WHERE COALESCE(published_at, first_seen_at) >= datetime('now', ?)
               ORDER BY is_recommended DESC, recommends DESC, views DESC
               LIMIT ?""",
            (f"-{days} days", limit),
        ).fetchall()
        return {"posts": [dict(r) for r in rows]}
    finally:
        conn.close()


# ── 관리자 CRUD ──────────────────────────────────────
class ChannelPayload(BaseModel):
    category: str
    name: str
    url: str
    platform: Optional[str] = None
    channel_key: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[str] = None
    sort_order: int = 0
    is_active: int = 1


def _validate(payload: ChannelPayload):
    if payload.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category는 {sorted(CATEGORIES)} 중 하나여야 합니다")
    if not payload.name.strip() or not payload.url.strip():
        raise HTTPException(status_code=400, detail="이름과 URL은 필수입니다")


@router.get("/channels/all")
def list_channels_admin(request: Request):
    """관리자용 — 비활성 포함 전체 목록."""
    _require_admin(request)
    conn = get_connection()
    try:
        ensure_tables(conn)
        rows = conn.execute(
            "SELECT * FROM community_channels ORDER BY category, sort_order, id"
        ).fetchall()
        return {"channels": [dict(r) for r in rows]}
    finally:
        conn.close()


@router.post("/channels")
def create_channel(payload: ChannelPayload, request: Request):
    _require_admin(request)
    _validate(payload)
    conn = get_connection()
    try:
        ensure_tables(conn)
        cur = conn.execute(
            """INSERT INTO community_channels
               (category, name, platform, url, channel_key, description, tags, sort_order, is_active)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (payload.category, payload.name.strip(), payload.platform, payload.url.strip(),
             payload.channel_key, payload.description, payload.tags, payload.sort_order, payload.is_active),
        )
        conn.commit()
        return {"id": cur.lastrowid, "ok": True}
    finally:
        conn.close()


@router.put("/channels/{channel_id}")
def update_channel(channel_id: int, payload: ChannelPayload, request: Request):
    _require_admin(request)
    _validate(payload)
    conn = get_connection()
    try:
        ensure_tables(conn)
        cur = conn.execute(
            """UPDATE community_channels SET category=?, name=?, platform=?, url=?, channel_key=?,
               description=?, tags=?, sort_order=?, is_active=? WHERE id=?""",
            (payload.category, payload.name.strip(), payload.platform, payload.url.strip(),
             payload.channel_key, payload.description, payload.tags, payload.sort_order,
             payload.is_active, channel_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="채널을 찾을 수 없습니다")
        conn.commit()
        _live_cache.pop(channel_id, None)
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/channels/{channel_id}")
def delete_channel(channel_id: int, request: Request):
    _require_admin(request)
    conn = get_connection()
    try:
        ensure_tables(conn)
        cur = conn.execute("DELETE FROM community_channels WHERE id=?", (channel_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="채널을 찾을 수 없습니다")
        conn.execute("DELETE FROM channel_videos WHERE channel_id=?", (channel_id,))
        conn.commit()
        _live_cache.pop(channel_id, None)
        return {"ok": True}
    finally:
        conn.close()


@router.post("/channels/refresh-videos")
async def refresh_videos_endpoint(request: Request):
    """관리자용 — 유튜브 영상 수집 즉시 실행."""
    _require_admin(request)
    updated = await refresh_channel_videos()
    return {"ok": True, "updated_channels": updated}
