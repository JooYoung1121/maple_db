from __future__ import annotations
"""티스토리 /105 인덱스 페이지 파서 — 빅뱅 이전 링크만 추출"""

import re
import sqlite3
from urllib.parse import urljoin

from bs4 import BeautifulSoup


TISTORY_BASE = "https://maplekibun.tistory.com"
INDEX_URL = f"{TISTORY_BASE}/105"


def parse_index_page(html: str) -> list[dict]:
    """
    /105 인덱스 페이지에서 빅뱅 이전/이후 링크를 분류.

    빅뱅 이전: "빅뱅 이전 정보" ~ "빅뱅 패치 이후 정보" 사이의 링크
    빅뱅 이후: "빅뱅 패치 이후 정보" 이후의 링크

    Returns: [{"url": str, "section": "pre_bigbang"|"post_bigbang", "title": str}, ...]
    """
    soup = BeautifulSoup(html, "lxml")
    results: list[dict] = []

    # 본문 영역 찾기
    content = (
        soup.find("div", class_=re.compile(r"(entry-content|post-content|article-content|tt_article)", re.I))
        or soup.find("article")
        or soup.find("div", id="content")
        or soup
    )

    full_text = content.get_text()

    # 빅뱅 이전/이후 경계 마커
    pre_marker = re.compile(r"빅뱅\s*(이전|전)\s*정보", re.I)
    post_marker = re.compile(r"빅뱅\s*(패치\s*)?(이후|후)\s*정보", re.I)

    # 텍스트에서 마커 위치 찾기
    pre_match = pre_marker.search(full_text)
    post_match = post_marker.search(full_text)

    if not pre_match:
        # 마커가 없으면 모든 링크를 pre_bigbang으로 처리
        section = "pre_bigbang"
        for a in content.find_all("a", href=True):
            href = _normalize_url(str(a["href"]))
            if href and _is_post_url(href):
                results.append({
                    "url": href,
                    "section": section,
                    "title": a.get_text(strip=True),
                })
        return results

    # 마커 위치 기반으로 각 링크의 섹션 결정
    # HTML 순서대로 순회하며 현재 섹션 추적
    current_section: str | None = None

    for element in content.descendants:
        if hasattr(element, "get_text"):
            text = element.get_text(strip=True)
            if pre_marker.search(text):
                current_section = "pre_bigbang"
            elif post_marker.search(text):
                current_section = "post_bigbang"

        if hasattr(element, "name") and element.name == "a":
            href_val = element.get("href", "")
            href = _normalize_url(str(href_val))
            if href and _is_post_url(href) and current_section:
                results.append({
                    "url": href,
                    "section": current_section,
                    "title": element.get_text(strip=True),
                })

    return results


def save_index_links(conn: sqlite3.Connection, links: list[dict]) -> int:
    """인덱스 링크를 DB에 저장. 저장된 수 반환."""
    count = 0
    for link in links:
        conn.execute(
            """INSERT OR IGNORE INTO tistory_index_links (url, section, title, crawled)
               VALUES (?, ?, ?, 0)""",
            (link["url"], link["section"], link["title"]),
        )
        count += 1
    conn.commit()
    return count


def get_pre_bigbang_urls(conn: sqlite3.Connection, only_uncrawled: bool = True) -> list[str]:
    """빅뱅 이전 URL만 반환."""
    sql = "SELECT url FROM tistory_index_links WHERE section = 'pre_bigbang'"
    if only_uncrawled:
        sql += " AND crawled = 0"
    rows = conn.execute(sql).fetchall()
    return [row["url"] for row in rows]


def mark_crawled(conn: sqlite3.Connection, url: str) -> None:
    """크롤링 완료 표시."""
    conn.execute("UPDATE tistory_index_links SET crawled = 1 WHERE url = ?", (url,))
    conn.commit()


def _normalize_url(href: str) -> str:
    """상대 URL을 절대 URL로 변환."""
    if href.startswith("/"):
        return urljoin(TISTORY_BASE, href)
    if href.startswith("http"):
        return href
    return ""


def _is_post_url(url: str) -> bool:
    """티스토리 포스트 URL인지 확인."""
    if "tistory.com" not in url:
        return False
    # /entry/... 또는 /숫자 형태
    from urllib.parse import urlparse
    path = urlparse(url).path
    return bool(path.startswith("/entry/") or re.match(r"^/\d+$", path))
