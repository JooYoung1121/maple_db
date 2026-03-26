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
        """
        list page: <a href="/board/{board}/{id}">제목</a>
        날짜·카테고리는 <a> 형제 요소에 있으므로 부모 row div까지 올라가서 추출.
        """
        soup = self.make_soup(html)
        results: list[dict] = []
        seen: set[str] = set()

        pattern = re.compile(rf"^/board/{board}/(\w+)$")

        for a in soup.find_all("a", href=pattern):
            href = str(a.get("href", ""))
            m = pattern.match(href)
            if not m:
                continue
            post_id = m.group(1)
            if post_id in seen:
                continue
            seen.add(post_id)

            url = f"{BASE_URL}{href}"
            title = a.get_text(strip=True)

            # 부모 row 컨테이너 탐색 (카테고리 + 날짜가 같이 있는 div)
            row = a.parent
            for _ in range(5):
                if row is None:
                    break
                row_text = row.get_text(" ", strip=True)
                if any(cat in row_text for cat in CATEGORIES) and DATE_RE.search(row_text):
                    break
                row = row.parent

            category = None
            published_at = None

            if row:
                # 카테고리 배지 span
                for span in row.find_all("span"):
                    t = span.get_text(strip=True)
                    if t in CATEGORIES:
                        category = t
                        break

                # 날짜 — 텍스트가 짧은 span/div 에서 DATE_RE 매칭
                for el in row.find_all(["span", "div"]):
                    t = el.get_text(strip=True)
                    if len(t) <= 15:
                        dm = DATE_RE.search(t)
                        if dm:
                            published_at = dm.group(0)
                            break

            results.append({
                "post_id": post_id,
                "board": board,
                "url": url,
                "title": title,
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

        # 카테고리
        category = None
        for span in soup.find_all("span"):
            t = span.get_text(strip=True)
            if t in CATEGORIES:
                category = t
                break

        # 날짜 — 짧은 span/time 에서 DATE_RE 매칭 (dm.group(0) 만 저장)
        published_at = None
        for el in soup.find_all(["span", "time"]):
            t = el.get_text(strip=True)
            if len(t) <= 20:
                dm = DATE_RE.search(t)
                if dm:
                    published_at = dm.group(0)
                    break

        # 본문 — maple.land 는 <div class="post-content"> 사용
        content_el = soup.find("div", class_="post-content")

        if not content_el:
            # fallback: main 에서 텍스트가 많은 div
            main = soup.find("main") or soup.find("body")
            if main:
                for tag in main.find_all(["nav", "header", "footer"]):
                    tag.decompose()
                best, best_len = None, 0
                for div in main.find_all("div"):
                    l = len(div.get_text(strip=True))
                    if l > best_len:
                        best_len = l
                        best = div
                content_el = best or main

        if content_el:
            for h1_tag in content_el.find_all("h1"):
                h1_tag.decompose()
            # href/src/alt/target/rel 만 유지, class/style/id 제거
            for tag in content_el.find_all(True):
                tag.attrs = {k: v for k, v in tag.attrs.items()
                             if k in ("href", "src", "alt", "target", "rel")}
            content_html = str(content_el)
            content_text = content_el.get_text(separator="\n", strip=True)
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
    """maple.land 공지사항 + 이벤트 크롤링. 신규/수정 건수 반환."""
    parser = MapleLandParser()
    new_count = 0

    # 본문 없는 기존 포스트 재크롤링 (파서 수정 후 자동 보정)
    empty_posts = conn.execute(
        "SELECT post_id, board, url FROM maple_land_posts WHERE content IS NULL OR content = ''"
    ).fetchall()
    if empty_posts:
        print(f"[maple-land] 본문 없는 포스트 {len(empty_posts)}건 재수집")
        for row in empty_posts:
            try:
                detail_html = await client.get(
                    row["url"],
                    cache_key=f"maple_land/post/{row['post_id']}",
                    use_cache=False,
                )
                detail = parser.parse_detail(detail_html, 0)
                conn.execute(
                    """UPDATE maple_land_posts
                       SET content=?, content_html=?, category=?, published_at=?, last_crawled_at=?
                       WHERE post_id=?""",
                    (
                        detail.get("content"),
                        detail.get("content_html"),
                        detail.get("category"),
                        detail.get("published_at"),
                        detail["last_crawled_at"],
                        row["post_id"],
                    ),
                )
                conn.commit()
                new_count += 1
            except Exception as e:
                print(f"[maple-land] 재수집 오류 {row['post_id']}: {e}")

    # 신규 포스트 수집
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
