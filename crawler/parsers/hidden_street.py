from __future__ import annotations
"""bbb.hidden-street.net 크롤러 — 빅뱅 이전 영문 데이터 수집"""

import json
import re
import sqlite3
from datetime import datetime, timezone

from bs4 import BeautifulSoup

from ..config import HIDDEN_STREET_BASE

# 엔티티 타입별 리스트 URL 패턴
_LIST_URLS = {
    "mob": f"{HIDDEN_STREET_BASE}/monster/list",
    "item": f"{HIDDEN_STREET_BASE}/eq",
    "map": f"{HIDDEN_STREET_BASE}/map",
}


def _make_soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def _text(tag) -> str:
    if tag is None:
        return ""
    return tag.get_text(strip=True)


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(str(value).replace(",", "").strip())
    except (ValueError, TypeError):
        return default


# ------------------------------------------------------------------
# 몬스터 파싱
# ------------------------------------------------------------------

def parse_monster_list(html: str) -> list[dict]:
    """몬스터 리스트 페이지에서 slug + name 추출."""
    soup = _make_soup(html)
    results: list[dict] = []
    seen: set[str] = set()

    for a in soup.find_all("a", href=True):
        href = str(a["href"])
        # /monster/{slug} 패턴
        match = re.search(r"/monster/([^/?#]+)$", href)
        if not match:
            continue
        slug = match.group(1)
        if slug in ("list",) or slug in seen:
            continue
        seen.add(slug)
        name = _text(a)
        if name:
            results.append({"slug": slug, "name_en": name, "url": href})

    return results


def parse_monster_detail(html: str, slug: str) -> dict:
    """몬스터 상세 페이지 파싱."""
    soup = _make_soup(html)
    data: dict = {"slug": slug, "entity_type": "mob"}

    # 이름
    h1 = soup.find("h1") or soup.find("h2")
    data["name_en"] = _text(h1) if h1 else slug

    info: dict = {}

    # 정보 테이블 파싱
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all(["th", "td"])
            for i in range(0, len(cells) - 1, 2):
                key = _text(cells[i]).lower()
                val = _text(cells[i + 1])
                info[key] = val

    # 주요 필드 추출
    data["level"] = _safe_int(info.get("level", ""))
    data["hp"] = _safe_int(info.get("hp", ""))
    data["exp"] = _safe_int(info.get("exp", info.get("experience", "")))

    # 드롭 아이템
    drops: list[str] = []
    for section in soup.find_all(["div", "table"]):
        text = _text(section)
        if "drop" in text.lower():
            for li in section.find_all("li"):
                drop_name = _text(li)
                if drop_name:
                    drops.append(drop_name)
            for a in section.find_all("a"):
                drop_name = _text(a)
                if drop_name and drop_name not in drops:
                    drops.append(drop_name)

    # 출현 맵
    spawn_maps: list[str] = []
    for section in soup.find_all(["div", "table"]):
        text = _text(section)
        if "found" in text.lower() or "location" in text.lower() or "map" in text.lower():
            for a in section.find_all("a", href=re.compile(r"/map/")):
                map_name = _text(a)
                if map_name and map_name not in spawn_maps:
                    spawn_maps.append(map_name)

    data["drops"] = drops
    data["spawn_maps"] = spawn_maps

    return data


# ------------------------------------------------------------------
# 장비 파싱
# ------------------------------------------------------------------

def parse_equipment_list(html: str) -> list[dict]:
    """장비 카테고리 페이지에서 slug + name 추출."""
    soup = _make_soup(html)
    results: list[dict] = []
    seen: set[str] = set()

    for a in soup.find_all("a", href=True):
        href = str(a["href"])
        match = re.search(r"/eq/([^/?#]+)/([^/?#]+)$", href)
        if not match:
            # 개별 장비 링크 패턴도 체크
            match = re.search(r"/eq/[^/]+/([^/?#]+)$", href)
            if not match:
                continue
        slug = href.split("/")[-1]
        if slug in seen:
            continue
        seen.add(slug)
        name = _text(a)
        if name:
            results.append({"slug": slug, "name_en": name, "url": href})

    return results


# ------------------------------------------------------------------
# 맵 파싱
# ------------------------------------------------------------------

def parse_map_list(html: str) -> list[dict]:
    """맵 리스트 페이지에서 slug + name 추출."""
    soup = _make_soup(html)
    results: list[dict] = []
    seen: set[str] = set()

    for a in soup.find_all("a", href=True):
        href = str(a["href"])
        match = re.search(r"/map/([^/?#]+)$", href)
        if not match:
            continue
        slug = match.group(1)
        if slug in ("list",) or slug in seen:
            continue
        seen.add(slug)
        name = _text(a)
        if name:
            results.append({"slug": slug, "name_en": name, "url": href})

    return results


# ------------------------------------------------------------------
# DB 저장
# ------------------------------------------------------------------

def save_entity(conn: sqlite3.Connection, entity_type: str, slug: str,
                name_en: str, data: dict, source_url: str) -> None:
    """Hidden Street 엔티티를 DB에 저장."""
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT OR REPLACE INTO hidden_street_entities
           (entity_type, slug, name_en, data_json, source_url, last_crawled_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (entity_type, slug, name_en, json.dumps(data, ensure_ascii=False), source_url, now),
    )
    conn.commit()


async def crawl_hidden_street(conn: sqlite3.Connection, client, force: bool = False) -> None:
    """Hidden Street 전체 크롤링."""
    # 1. 몬스터
    print("[hidden-street] 몬스터 목록 수집 중...")
    try:
        html = await client.get(
            _LIST_URLS["mob"],
            cache_key="hidden_street/mob_list",
            use_cache=not force,
        )
        monsters = parse_monster_list(html)
        print(f"[hidden-street] 몬스터 {len(monsters)}개 발견")

        for i, mon in enumerate(monsters):
            detail_url = f"{HIDDEN_STREET_BASE}/monster/{mon['slug']}"
            cache_key = f"hidden_street/mob/{mon['slug']}"
            try:
                detail_html = await client.get(detail_url, cache_key=cache_key, use_cache=not force)
                data = parse_monster_detail(detail_html, mon["slug"])
                save_entity(conn, "mob", mon["slug"], data["name_en"], data, detail_url)
            except Exception as e:
                print(f"[hidden-street] 몬스터 {mon['slug']} 오류: {e}")

            if (i + 1) % 50 == 0:
                print(f"[hidden-street] 몬스터 {i + 1}/{len(monsters)}")

        print(f"[hidden-street] 몬스터 완료")
    except Exception as e:
        print(f"[hidden-street] 몬스터 목록 오류: {e}")

    # 2. 장비
    print("[hidden-street] 장비 목록 수집 중...")
    try:
        html = await client.get(
            _LIST_URLS["item"],
            cache_key="hidden_street/item_list",
            use_cache=not force,
        )
        items = parse_equipment_list(html)
        print(f"[hidden-street] 장비 {len(items)}개 발견")

        for i, item in enumerate(items):
            item_url = f"{HIDDEN_STREET_BASE}{item['url']}" if item["url"].startswith("/") else item["url"]
            save_entity(conn, "item", item["slug"], item["name_en"], {"name_en": item["name_en"]}, item_url)

            if (i + 1) % 50 == 0:
                print(f"[hidden-street] 장비 {i + 1}/{len(items)}")

        print(f"[hidden-street] 장비 완료")
    except Exception as e:
        print(f"[hidden-street] 장비 목록 오류: {e}")

    # 3. 맵
    print("[hidden-street] 맵 목록 수집 중...")
    try:
        html = await client.get(
            _LIST_URLS["map"],
            cache_key="hidden_street/map_list",
            use_cache=not force,
        )
        maps = parse_map_list(html)
        print(f"[hidden-street] 맵 {len(maps)}개 발견")

        for i, m in enumerate(maps):
            map_url = f"{HIDDEN_STREET_BASE}{m['url']}" if m["url"].startswith("/") else m["url"]
            save_entity(conn, "map", m["slug"], m["name_en"], {"name_en": m["name_en"]}, map_url)

            if (i + 1) % 50 == 0:
                print(f"[hidden-street] 맵 {i + 1}/{len(maps)}")

        print(f"[hidden-street] 맵 완료")
    except Exception as e:
        print(f"[hidden-street] 맵 목록 오류: {e}")
