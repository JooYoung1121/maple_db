from __future__ import annotations
"""CLI 진입점 - 크롤링 오케스트레이터"""

import asyncio
import sqlite3
from datetime import datetime, timedelta, timezone

import click

from .client import ThrottledClient
from .config import (
    CRAWL_STALE_DAYS,
    ENTITY_TYPES,
    LIST_URLS,
    SEARCH_URL,
    TISTORY_BASE,
    TYPE_CODES,
)
from .db import init_db, rebuild_search_index
from .parsers.mapledb_items import ItemParser
from .parsers.mapledb_mobs import MobParser
from .parsers.mapledb_maps import MapParser
from .parsers.mapledb_npcs import NpcParser
from .parsers.mapledb_quests import QuestParser
from .parsers.tistory import TistoryParser

# 엔티티 타입 → (파서 인스턴스, DB 테이블명, last_crawled_at 컬럼 여부)
_PARSERS = {
    "items": ItemParser(),
    "mobs": MobParser(),
    "maps": MapParser(),
    "npcs": NpcParser(),
    "quests": QuestParser(),
}

_TABLE_MAP = {
    "items": "items",
    "mobs": "mobs",
    "maps": "maps",
    "npcs": "npcs",
    "quests": "quests",
}

# 확장된 크롤 타입 목록
ALL_CRAWL_TYPES = ENTITY_TYPES + [
    "tistory",
    "maplestory-io-kms",
    "maplestory-io",
    "quest-details",
    "hiddenstreet",
    "tistory-prebigbang",
    "match",
    # Phase 1: blog parsers
    "blog-drops",
    "blog-monsters",
    "blog-skills",
    "blog-all",
    # Phase 2: detail API crawler
    "detail-mobs",
    "detail-maps",
    "detail-npcs",
    "detail-items",
    "detail-quests",
]


def _is_stale(conn: sqlite3.Connection, table: str, entity_id: int) -> bool:
    """엔티티가 CRAWL_STALE_DAYS 이내에 크롤링됐으면 False(스킵) 반환."""
    try:
        row = conn.execute(
            f"SELECT last_crawled_at FROM {table} WHERE id = ?", (entity_id,)
        ).fetchone()
        if row is None or row["last_crawled_at"] is None:
            return True
        last = datetime.fromisoformat(row["last_crawled_at"])
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - last > timedelta(days=CRAWL_STALE_DAYS)
    except Exception:
        return True


async def _crawl_entity_type(
    entity_type: str,
    conn: sqlite3.Connection,
    force: bool,
) -> None:
    """단일 엔티티 타입의 2-phase 크롤링."""
    parser = _PARSERS[entity_type]
    table = _TABLE_MAP[entity_type]
    list_url = LIST_URLS[entity_type]
    type_code = TYPE_CODES[entity_type]

    async with ThrottledClient() as client:
        # Phase 1: 목록 페이지 수집
        print(f"[{entity_type}] 목록 페이지 수집 중: {list_url}")
        try:
            list_html = await client.get(list_url, cache_key=f"{entity_type}/list")
        except Exception as e:
            print(f"[{entity_type}] 목록 페이지 오류: {e}")
            return

        entities = parser.parse_list(list_html)
        if not entities:
            print(f"[{entity_type}] 목록에서 항목을 찾지 못했습니다.")
            return

        total = len(entities)
        print(f"[{entity_type}] {total}개 항목 발견")

        # Phase 2: 상세 페이지 크롤링
        done = 0
        skipped = 0
        for entry in entities:
            entity_id = entry["id"]

            if not force and not _is_stale(conn, table, entity_id):
                skipped += 1
                done += 1
                if done % 50 == 0:
                    print(f"[{entity_type}] {done}/{total} (스킵 {skipped}개)")
                continue

            detail_url = f"{SEARCH_URL}?q={entity_id}&t={type_code}"
            cache_key = f"{entity_type}/{entity_id}"
            try:
                detail_html = await client.get(detail_url, cache_key=cache_key)
                data = parser.parse_detail(detail_html, entity_id)
                # 이름이 파싱 안 됐으면 목록에서 가져온 이름 사용
                if not data.get("name"):
                    data["name"] = entry.get("name", "")
                data["source_url"] = detail_url
                parser.save(conn, data)
            except Exception as e:
                print(f"[{entity_type}] ID {entity_id} 오류: {e}")

            done += 1
            if done % 50 == 0 or done == total:
                print(f"[{entity_type}] {done}/{total}")

        print(f"[{entity_type}] 완료 (스킵 {skipped}/{total})")


async def _crawl_tistory(conn: sqlite3.Connection, force: bool) -> None:
    """Tistory 블로그 크롤링."""
    parser = TistoryParser()
    category_url = f"{TISTORY_BASE}/category"

    async with ThrottledClient() as client:
        # 모든 포스트 URL 수집 (페이지네이션)
        post_entries: list[dict] = []
        current_url: str | None = category_url
        page = 1

        print(f"[tistory] 카테고리 목록 수집 중...")
        while current_url:
            try:
                html = await client.get(
                    current_url, cache_key=f"tistory/category/page{page}"
                )
                entries = parser.parse_list(html)
                post_entries.extend(entries)
                next_url = parser.parse_next_page_url(html, current_url)
                if next_url == current_url:
                    break
                current_url = next_url
                page += 1
            except Exception as e:
                print(f"[tistory] 페이지 {page} 오류: {e}")
                break

        # 중복 제거 (URL 기준)
        seen: set[str] = set()
        unique_entries = []
        for e in post_entries:
            if e["id"] not in seen:
                seen.add(e["id"])
                unique_entries.append(e)

        total = len(unique_entries)
        print(f"[tistory] {total}개 포스트 발견")

        done = 0
        skipped = 0
        for entry in unique_entries:
            post_url = entry["id"]

            # 스킵 체크 (URL로 조회)
            if not force:
                try:
                    row = conn.execute(
                        "SELECT last_crawled_at FROM blog_posts WHERE url = ?",
                        (post_url,),
                    ).fetchone()
                    if row and row["last_crawled_at"]:
                        last = datetime.fromisoformat(row["last_crawled_at"])
                        if last.tzinfo is None:
                            last = last.replace(tzinfo=timezone.utc)
                        if datetime.now(timezone.utc) - last <= timedelta(days=CRAWL_STALE_DAYS):
                            skipped += 1
                            done += 1
                            continue
                except Exception:
                    pass

            cache_key = f"tistory/post/{abs(hash(post_url))}"
            try:
                html = await client.get(post_url, cache_key=cache_key)
                data = parser.parse_detail(html, 0)
                if not data.get("title"):
                    data["title"] = entry.get("name", "")
                data["source_url"] = post_url
                parser.save(conn, data)
            except Exception as e:
                print(f"[tistory] {post_url} 오류: {e}")

            done += 1
            if done % 20 == 0 or done == total:
                print(f"[tistory] {done}/{total}")

        print(f"[tistory] 완료 (스킵 {skipped}/{total})")


async def _crawl_maplestory_io_kms(conn: sqlite3.Connection, force: bool) -> None:
    """maplestory.io KMS 284에서 한국어 이름 매칭."""
    from .parsers.maplestory_io import crawl_korean_names

    async with ThrottledClient() as client:
        await crawl_korean_names(conn, client, force=force)


async def _crawl_quest_details(conn: sqlite3.Connection, force: bool) -> None:
    """퀘스트 상세 정보 개별 수집."""
    from .parsers.maplestory_io import crawl_quest_details

    async with ThrottledClient() as client:
        await crawl_quest_details(conn, client, force=force)


async def _crawl_maplestory_io(conn: sqlite3.Connection, force: bool) -> None:
    """maplestory.io GMS 92 벌크 데이터 수집 → 메인 테이블."""
    from .parsers.maplestory_io import crawl_gms_data

    async with ThrottledClient() as client:
        await crawl_gms_data(conn, client, force=force)


async def _crawl_hidden_street(conn: sqlite3.Connection, force: bool) -> None:
    """Hidden Street 크롤링."""
    from .parsers.hidden_street import crawl_hidden_street

    async with ThrottledClient() as client:
        await crawl_hidden_street(conn, client, force=force)


async def _crawl_tistory_prebigbang(conn: sqlite3.Connection, force: bool) -> None:
    """티스토리 빅뱅 이전 포스트만 크롤링."""
    from .parsers.tistory_index import (
        INDEX_URL,
        get_pre_bigbang_urls,
        mark_crawled,
        parse_index_page,
        save_index_links,
    )

    parser = TistoryParser()

    async with ThrottledClient() as client:
        # 1. 인덱스 페이지 파싱
        print("[tistory-prebigbang] 인덱스 페이지 수집 중...")
        try:
            html = await client.get(INDEX_URL, cache_key="tistory/index_105", use_cache=not force)
            links = parse_index_page(html)
            pre_count = sum(1 for l in links if l["section"] == "pre_bigbang")
            post_count = sum(1 for l in links if l["section"] == "post_bigbang")
            print(f"[tistory-prebigbang] 빅뱅 이전: {pre_count}개, 이후: {post_count}개")
            save_index_links(conn, links)
        except Exception as e:
            print(f"[tistory-prebigbang] 인덱스 페이지 오류: {e}")
            return

        # 2. 빅뱅 이전 URL만 크롤링
        urls = get_pre_bigbang_urls(conn, only_uncrawled=not force)
        total = len(urls)
        print(f"[tistory-prebigbang] {total}개 빅뱅 이전 포스트 크롤링 시작")

        done = 0
        for url in urls:
            cache_key = f"tistory/prebigbang/{abs(hash(url))}"
            try:
                html = await client.get(url, cache_key=cache_key)
                data = parser.parse_detail(html, 0)
                data["source_url"] = url
                parser.save(conn, data)
                mark_crawled(conn, url)
            except Exception as e:
                print(f"[tistory-prebigbang] {url} 오류: {e}")

            done += 1
            if done % 10 == 0 or done == total:
                print(f"[tistory-prebigbang] {done}/{total}")

        print(f"[tistory-prebigbang] 완료")


def _run_matching(conn: sqlite3.Connection) -> None:
    """한영 매칭 실행."""
    from .matching import run_matching
    run_matching(conn)


async def _crawl_entity_detail(conn: sqlite3.Connection, force: bool, entity_type: str) -> None:
    """개별 상세 API 크롤링 헬퍼."""
    from .parsers.maplestory_io import crawl_entity_details

    async with ThrottledClient() as client:
        await crawl_entity_details(conn, client, entity_type, force=force)


# ------------------------------------------------------------------
# Click CLI
# ------------------------------------------------------------------

@click.group()
def cli():
    """MapleStory Land 데이터 크롤러"""
    pass


@cli.command()
@click.option("--type", "entity_type", type=click.Choice(ALL_CRAWL_TYPES), default=None, help="크롤링할 엔티티 타입")
@click.option("--all", "crawl_all", is_flag=True, default=False, help="모든 타입 크롤링")
@click.option("--force", is_flag=True, default=False, help=f"최근 {CRAWL_STALE_DAYS}일 이내 크롤링된 항목도 재수집")
def crawl(entity_type: str | None, crawl_all: bool, force: bool):
    """데이터 크롤링 실행."""
    if not entity_type and not crawl_all:
        raise click.UsageError("--type 또는 --all 중 하나를 지정하세요.")

    conn = init_db()

    if crawl_all:
        types_to_crawl = ENTITY_TYPES + ["tistory"]
    else:
        types_to_crawl = [entity_type]

    for t in types_to_crawl:
        if t == "tistory":
            asyncio.run(_crawl_tistory(conn, force))
        elif t == "maplestory-io-kms":
            asyncio.run(_crawl_maplestory_io_kms(conn, force))
        elif t == "maplestory-io":
            asyncio.run(_crawl_maplestory_io(conn, force))
        elif t == "quest-details":
            asyncio.run(_crawl_quest_details(conn, force))
        elif t == "hiddenstreet":
            asyncio.run(_crawl_hidden_street(conn, force))
        elif t == "tistory-prebigbang":
            asyncio.run(_crawl_tistory_prebigbang(conn, force))
        elif t == "match":
            _run_matching(conn)
        elif t == "blog-drops":
            from .parsers.blog_drops import parse_blog_drops
            print("[blog-drops] 블로그 드롭 데이터 파싱 중...")
            result = parse_blog_drops(conn)
            print(f"[blog-drops] 완료: 드롭 {result['drops_added']}건, 스폰 {result['spawns_added']}건, 보스 {result['bosses_updated']}건")
            if result.get("unmatched_mobs"):
                unique_mobs = list(set(result["unmatched_mobs"]))[:20]
                print(f"[blog-drops] 미매칭 몬스터 (상위 {len(unique_mobs)}): {', '.join(unique_mobs)}")
            if result.get("unmatched_items"):
                unique_items = list(set(result["unmatched_items"]))[:20]
                print(f"[blog-drops] 미매칭 아이템 (상위 {len(unique_items)}): {', '.join(unique_items)}")
        elif t == "blog-monsters":
            from .parsers.blog_monsters import parse_blog_monsters
            print("[blog-monsters] 블로그 몬스터 정보 파싱 중...")
            result = parse_blog_monsters(conn)
            print(f"[blog-monsters] 완료: 스폰 {result['spawns_added']}건, 드롭 {result['drops_added']}건, 포스트 {result['posts_parsed']}건")
        elif t == "blog-skills":
            from .parsers.blog_skills import parse_blog_skills
            print("[blog-skills] 블로그 스킬 데이터 파싱 중...")
            result = parse_blog_skills(conn)
            print(f"[blog-skills] 완료: 스킬 {result['skills_added']}건, 포스트 {result['posts_parsed']}건")
        elif t == "blog-all":
            from .parsers.blog_drops import parse_blog_drops
            from .parsers.blog_monsters import parse_blog_monsters
            from .parsers.blog_skills import parse_blog_skills
            print("[blog-all] 블로그 드롭 데이터 파싱 중...")
            r = parse_blog_drops(conn)
            print(f"[blog-all] 드롭: {r['drops_added']}건, 스폰: {r['spawns_added']}건, 보스: {r['bosses_updated']}건")
            print("[blog-all] 블로그 몬스터 정보 파싱 중...")
            r = parse_blog_monsters(conn)
            print(f"[blog-all] 몬스터: 스폰 {r['spawns_added']}건, 드롭 {r['drops_added']}건")
            print("[blog-all] 블로그 스킬 데이터 파싱 중...")
            r = parse_blog_skills(conn)
            print(f"[blog-all] 스킬: {r['skills_added']}건, 포스트 {r['posts_parsed']}건")
        elif t.startswith("detail-"):
            entity_map = {
                "detail-mobs": "mob",
                "detail-maps": "map",
                "detail-npcs": "npc",
                "detail-items": "item",
                "detail-quests": "quest",
            }
            etype = entity_map.get(t)
            if etype:
                asyncio.run(_crawl_entity_detail(conn, force, etype))
        else:
            asyncio.run(_crawl_entity_type(t, conn, force))

    print("모든 크롤링 완료.")


@cli.command()
def migrate():
    """DB 스키마 마이그레이션 실행."""
    from .db import migrate_db
    conn = init_db()
    migrate_db(conn)
    print("마이그레이션 완료.")


@cli.command("cross-check")
def cross_check():
    """블로그 데이터 ↔ DB 매칭률 크로스체크."""
    conn = init_db()

    mob_kr_rows = conn.execute(
        "SELECT name_en FROM entity_names_en WHERE entity_type='mob' AND source='kms'"
    ).fetchall()
    mob_kr_names = {r["name_en"] for r in mob_kr_rows}

    blog_rows = conn.execute(
        "SELECT content FROM blog_posts WHERE content IS NOT NULL"
    ).fetchall()

    print(f"한국어 몬스터명: {len(mob_kr_names)}개")
    print(f"블로그 포스트: {len(blog_rows)}개")
    print(f"mob_drops: {conn.execute('SELECT COUNT(*) FROM mob_drops').fetchone()[0]}건")
    print(f"mob_spawns: {conn.execute('SELECT COUNT(*) FROM mob_spawns').fetchone()[0]}건")
    try:
        print(f"skills: {conn.execute('SELECT COUNT(*) FROM skills').fetchone()[0]}건")
    except Exception:
        print("skills: (테이블 없음)")


@cli.command()
def reindex():
    """FTS5 전문검색 인덱스 재구축."""
    conn = init_db()
    print("검색 인덱스 재구축 중...")
    rebuild_search_index(conn)
    print("완료.")


@cli.command()
def stats():
    """DB 테이블별 행 수 출력."""
    conn = init_db()
    tables = [
        "items", "mobs", "maps", "npcs", "quests", "blog_posts",
        "mob_drops", "mob_spawns", "skills",
        "entity_names_en", "maplestory_io_cache",
        "hidden_street_entities", "tistory_index_links",
    ]
    print(f"{'테이블':<25} {'행 수':>10}")
    print("-" * 37)
    for table in tables:
        try:
            row = conn.execute(f"SELECT COUNT(*) as cnt FROM {table}").fetchone()
            count = row["cnt"] if row else 0
        except Exception:
            count = 0
        print(f"{table:<25} {count:>10,}")
