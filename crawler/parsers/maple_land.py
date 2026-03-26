from __future__ import annotations
"""maple.land 공지사항 / 이벤트 파서"""

import re
import sqlite3
from datetime import datetime, timezone

from .base import BaseParser

BASE_URL = "https://maple.land"
BOARDS = ["notices", "events"]
CATEGORIES = ["업데이트", "점검", "안내", "제재", "이벤트", "진행중", "종료"]
DATE_RE = re.compile(r"\d{4}\.\d{2}\.\d{2}")


class MapleLandParser(BaseParser):

    def parse_list(self, html: str) -> list[dict]:
        return self.parse_board_list(html, "notices")

    def parse_board_list(self, html: str, board: str) -> list[dict]:
        soup = self.make_soup(html)
        results: list[dict] = []
        seen: set[str] = set()

        pattern = re.compile(rf"^/board/{board}/(\w+)$")

        for a in soup.find_all("a", href=True):
            href = str(a.get("href", ""))
            m = pattern.match(href)
            if not m:
                continue
            post_id = m.group(1)
            if post_id in seen:
                continue
            seen.add(post_id)

            url = f"{BASE_URL}{href}"
            text_lines = [ln.strip() for ln in a.get_text(separator="\n").split("\n") if ln.strip()]

            title = ""
            category = None
            published_at = None

            for line in text_lines:
                dm = DATE_RE.search(line)
                if dm and not published_at:
                    published_at = dm.group(0)
                elif line in CATEGORIES:
                    category = line
                elif not title:
                    title = line

            results.append({
                "post_id": post_id,
                "board": board,
                "url": url,
                "title": title or (text_lines[0] if text_lines else post_id),
                "category": category,
                "published_at": published_at,
            })

        return results

    def parse_detail(self, html: str, entity_id: int) -> dict:
        soup = self.make_soup(html)

        for tag in soup.find_all(["script", "style"]):
            tag.decompose()

        # 제목
        h1 = soup.find("h1")
        title = self.text(h1) if h1 else ""

        # 카테고리 & 날짜
        category = None
        published_at = None
        for el in soup.find_all(["span", "time", "div", "p"]):
            t = el.get_text(strip=True)
            if t in CATEGORIES and not category:
                category = t
            dm = DATE_RE.match(t)
            if dm and not published_at:
                published_at = t

        # 본문 - main 태그에서 찾기
        main = soup.find("main") or soup.find("body")
        content_div = None

        if main:
            for tag in main.find_all(["nav", "header", "footer"]):
                tag.decompose()
            # h2 섹션을 포함하는 가장 큰 div 찾기
            for div in main.find_all("div", recursive=True):
                if div.find("h2") and len(div.get_text(strip=True)) > 300:
                    content_div = div
                    break
            if not content_div:
                content_div = main

        if content_div:
            # 제목 h1 제거 (별도 저장)
            for h1_tag in content_div.find_all("h1"):
                h1_tag.decompose()
            # class/style/id 제거, href/src/alt는 유지
            for tag in content_div.find_all(True):
                tag.attrs = {k: v for k, v in tag.attrs.items() if k in ("href", "src", "alt")}
            content_html = str(content_div)
            content_text = content_div.get_text(separator="\n", strip=True)
        else:
            content_html = ""
            content_text = ""

        return {
            "title": title,
            "category": category,
            "published_at": published_at,
            "content": content_text,
            "content_html": content_html,
            "last_crawled_at": datetime.now(timezone.utc).isoformat(),
        }

    def save(self, conn: sqlite3.Connection, data: dict) -> None:
        conn.execute(
            """
            INSERT INTO maple_land_posts
                (post_id, board, category, title, content, content_html, url, published_at, last_crawled_at)
            VALUES
                (:post_id, :board, :category, :title, :content, :content_html, :url, :published_at, :last_crawled_at)
            ON CONFLICT(post_id) DO UPDATE SET
                category = excluded.category,
                title = excluded.title,
                content = excluded.content,
                content_html = excluded.content_html,
                published_at = excluded.published_at,
                last_crawled_at = excluded.last_crawled_at
            """,
            {
                "post_id": data.get("post_id"),
                "board": data.get("board"),
                "category": data.get("category"),
                "title": data.get("title", ""),
                "content": data.get("content"),
                "content_html": data.get("content_html"),
                "url": data.get("url"),
                "published_at": data.get("published_at"),
                "last_crawled_at": data.get("last_crawled_at"),
            },
        )
        conn.commit()


async def crawl_maple_land(conn: sqlite3.Connection, client, force: bool = False) -> int:
    """maple.land 공지사항 + 이벤트 크롤링. 신규 저장 건수 반환."""
    parser = MapleLandParser()
    new_count = 0

    for board in BOARDS:
        print(f"[maple-land] {board} 크롤링 시작")
        for page in range(1, 50):
            url = f"{BASE_URL}/board/{board}?page={page}"
            try:
                html = await client.get(
                    url,
                    cache_key=f"maple_land/{board}/p{page}",
                    use_cache=not force,
                )
            except Exception as e:
                print(f"[maple-land] {board} p{page} 오류: {e}")
                break

            entries = parser.parse_board_list(html, board)
            if not entries:
                print(f"[maple-land] {board} p{page}: 항목 없음, 중단")
                break

            all_known = True
            for entry in entries:
                existing = conn.execute(
                    "SELECT id FROM maple_land_posts WHERE post_id = ?",
                    (entry["post_id"],),
                ).fetchone()

                if existing and not force:
                    continue

                all_known = False
                try:
                    detail_html = await client.get(
                        entry["url"],
                        cache_key=f"maple_land/post/{entry['post_id']}",
                        use_cache=not force,
                    )
                    detail = parser.parse_detail(detail_html, 0)
                    merged = {
                        "post_id": entry["post_id"],
                        "board": board,
                        "url": entry["url"],
                        "title": entry.get("title") or detail.get("title", ""),
                        "category": entry.get("category") or detail.get("category"),
                        "published_at": entry.get("published_at") or detail.get("published_at"),
                        "content": detail.get("content", ""),
                        "content_html": detail.get("content_html", ""),
                        "last_crawled_at": detail["last_crawled_at"],
                    }
                    parser.save(conn, merged)
                    new_count += 1
                    print(f"[maple-land] 저장: {entry['title'][:40]}")
                except Exception as e:
                    print(f"[maple-land] {entry['url']} 상세 오류: {e}")

            if all_known and not force:
                print(f"[maple-land] {board} p{page}: 기존 항목만 있어 중단")
                break

        print(f"[maple-land] {board} 완료")

    return new_count
