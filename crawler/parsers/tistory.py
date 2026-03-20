from __future__ import annotations
"""maplekibun.tistory.com 블로그 파서"""

import re
import sqlite3
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

from .base import BaseParser


class TistoryParser(BaseParser):
    """
    목록: /category 페이지네이션으로 모든 포스트 URL 수집
    상세: 개별 포스트 URL에서 제목, 본문, 카테고리, 게시일 추출
    """

    BASE_URL = "https://maplekibun.tistory.com"

    # ------------------------------------------------------------------
    # parse_list: 카테고리 목록 페이지에서 포스트 URL 추출
    # ------------------------------------------------------------------
    def parse_list(self, html: str) -> list[dict]:
        """
        반환값: [{"id": url, "name": title}, ...]
        여기서 id는 포스트 URL (정수 ID 대신 URL을 고유 키로 사용).
        """
        soup = self.make_soup(html)
        results: list[dict] = []

        # Tistory 카테고리 페이지의 포스트 링크 패턴
        # 보통 <a href="/entry/..."> 또는 <a href="/{숫자}">
        seen: set[str] = set()
        for a in soup.find_all("a", href=True):
            href = str(a["href"])
            # 상대 URL → 절대 URL
            if href.startswith("/"):
                href = urljoin(self.BASE_URL, href)
            parsed = urlparse(href)
            # tistory 도메인 포스트 링크만
            if "tistory.com" not in parsed.netloc:
                continue
            path = parsed.path
            # /entry/... 또는 /숫자 형태
            if not (path.startswith("/entry/") or re.match(r"^/\d+$", path)):
                continue
            if href in seen:
                continue
            seen.add(href)
            title = self.text(a) or ""
            results.append({"id": href, "name": title})

        return results

    def parse_next_page_url(self, html: str, current_url: str) -> str | None:
        """다음 페이지 URL 반환. 없으면 None."""
        soup = self.make_soup(html)
        # 페이지네이션: "다음", "next", 또는 페이지 번호 링크
        for a in soup.find_all("a", href=True):
            text = self.text(a).lower()
            if text in ("다음", "next", ">", "»"):
                href = str(a["href"])
                if href.startswith("/"):
                    href = urljoin(self.BASE_URL, href)
                return href
        return None

    # ------------------------------------------------------------------
    # parse_detail: 개별 포스트 파싱
    # ------------------------------------------------------------------
    def parse_detail(self, html: str, entity_id: int) -> dict:
        """
        entity_id는 여기서 실제로 사용되지 않음 (URL이 고유 키).
        호출자가 source_url을 data["source_url"]로 주입.
        """
        soup = self.make_soup(html)
        data: dict = {}

        try:
            # 제목
            title_tag = (
                soup.find("h1", class_=re.compile(r"(title|subject|tit)", re.I))
                or soup.find("h2", class_=re.compile(r"(title|subject|tit)", re.I))
                or soup.find("h1")
                or soup.find("h2")
            )
            data["title"] = self.text(title_tag) if title_tag else ""

            # 카테고리
            cat_tag = (
                soup.find(class_=re.compile(r"category", re.I))
                or soup.find("a", href=re.compile(r"/category/"))
            )
            data["category"] = self.text(cat_tag) if cat_tag else ""

            # 게시일
            data["published_at"] = self._extract_published_at(soup)

            # 본문 텍스트
            content_tag = (
                soup.find("div", id="content")
                or soup.find("div", class_=re.compile(r"(entry-content|post-content|article-content|tt_article_useless_p_margin)", re.I))
                or soup.find("article")
            )
            if content_tag:
                # 스크립트, 스타일 제거
                for tag in content_tag.find_all(["script", "style", "nav", "aside"]):
                    tag.decompose()
                data["content"] = content_tag.get_text(separator="\n", strip=True)
            else:
                data["content"] = ""

        except Exception:
            data.setdefault("title", "")
            data.setdefault("category", "")
            data.setdefault("published_at", None)
            data.setdefault("content", "")

        data["last_crawled_at"] = datetime.now(timezone.utc).isoformat()
        return data

    def _extract_published_at(self, soup) -> str | None:
        """게시일 추출: <time>, meta, 또는 텍스트 패턴."""
        # <time datetime="...">
        time_tag = soup.find("time", datetime=True)
        if time_tag:
            return str(time_tag["datetime"])

        # <meta property="article:published_time">
        meta = soup.find("meta", property="article:published_time")
        if meta and meta.get("content"):
            return str(meta["content"])

        # 텍스트에서 날짜 패턴 검색 (YYYY.MM.DD, YYYY-MM-DD)
        date_pattern = re.compile(r"\d{4}[.\-]\d{2}[.\-]\d{2}")
        for tag in soup.find_all(class_=re.compile(r"(date|time|published|created)", re.I)):
            text = self.text(tag)
            m = date_pattern.search(text)
            if m:
                return m.group(0).replace(".", "-")

        return None

    # ------------------------------------------------------------------
    # save
    # ------------------------------------------------------------------
    def save(self, conn: sqlite3.Connection, data: dict) -> None:
        conn.execute(
            """
            INSERT OR REPLACE INTO blog_posts
                (title, url, category, content, published_at, last_crawled_at)
            VALUES
                (:title, :url, :category, :content, :published_at, :last_crawled_at)
            """,
            {
                "title": data.get("title", ""),
                "url": data.get("source_url") or data.get("url"),
                "category": data.get("category"),
                "content": data.get("content"),
                "published_at": data.get("published_at"),
                "last_crawled_at": data.get("last_crawled_at"),
            },
        )
        conn.commit()
