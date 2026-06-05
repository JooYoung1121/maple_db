from __future__ import annotations
"""maple.land 공지사항 / 이벤트 파서"""

import re
import sqlite3
from datetime import datetime, timezone

from .base import BaseParser
from .summarizer import summarize_post

SOURCES = {
    "main": {
        "label": "Mapleland",
        "base_url": "https://maple.land",
        "boards": ["notices", "events"],
    },
    "tespia": {
        "label": "Mapleland Tespia",
        "base_url": "https://tespia.maple.land",
        "boards": ["notices", "events"],
    },
}
BASE_URL = SOURCES["main"]["base_url"]
BOARDS = SOURCES["main"]["boards"]
CATEGORIES = ["업데이트", "점검", "안내", "제재", "이벤트", "진행중", "종료"]
DATE_RE = re.compile(r"\d{4}\.\d{2}\.\d{2}")
SKIP_SUMMARY_PREFIXES = (
    "안녕하세요",
    "아래 내용을 확인",
    "항상 쾌적한",
    "감사합니다",
    "Mapleland 드림",
    "※",
    "주소 복사",
)
SUMMARY_KEYWORDS = (
    "추가",
    "변경",
    "수정",
    "개선",
    "가능",
    "진행",
    "레벨",
    "보스",
    "파티퀘스트",
    "스킬",
    "아이템",
    "몬스터",
    "퀘스트",
    "드롭",
    "오류",
    "문제",
)


def local_patch_summary(title: str, content: str, max_lines: int = 6) -> str | None:
    """Generate a deterministic fallback summary from patch note bullet text."""
    if not content:
        return None
    lines: list[str] = []
    in_changes = "[변경 내용]" not in content
    for raw in content.splitlines():
        line = raw.strip().strip("-*•> ").strip()
        if not line:
            continue
        if "[변경 내용]" in line:
            in_changes = True
            continue
        if not in_changes:
            continue
        if any(line.startswith(prefix) for prefix in SKIP_SUMMARY_PREFIXES):
            continue
        if len(line) < 8:
            continue
        if not any(keyword in line for keyword in SUMMARY_KEYWORDS):
            continue
        if line in lines:
            continue
        if len(line) > 110:
            line = line[:107].rstrip() + "..."
        lines.append(f"- {line}")
        if len(lines) >= max_lines:
            break
    if lines:
        return "\n".join(lines)
    return None


class MapleLandParser(BaseParser):
    def __init__(self, source: str = "main"):
        super().__init__()
        self.source = source
        self.base_url = SOURCES.get(source, SOURCES["main"])["base_url"]

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

            url = f"{self.base_url}{href}"
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
                "source": self.source,
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
                (post_id, source, board, category, title, content, content_html, url, published_at, last_crawled_at, summary)
            VALUES
                (:post_id, :source, :board, :category, :title, :content, :content_html, :url, :published_at, :last_crawled_at, :summary)
            ON CONFLICT(post_id) DO UPDATE SET
                source = excluded.source,
                category = excluded.category,
                title = excluded.title,
                content = excluded.content,
                content_html = excluded.content_html,
                published_at = excluded.published_at,
                last_crawled_at = excluded.last_crawled_at,
                summary = COALESCE(excluded.summary, maple_land_posts.summary)
            """,
            {
                "post_id": data.get("post_id"),
                "source": data.get("source", "main"),
                "board": data.get("board"),
                "category": data.get("category"),
                "title": data.get("title", ""),
                "content": data.get("content"),
                "content_html": data.get("content_html"),
                "url": data.get("url"),
                "published_at": data.get("published_at"),
                "last_crawled_at": data.get("last_crawled_at"),
                "summary": data.get("summary"),
            },
        )
        conn.commit()


SUMMARY_CATEGORIES = {"업데이트", "이벤트", "진행중", "종료", "안내"}


async def crawl_maple_land(conn: sqlite3.Connection, client, force: bool = False) -> int:
    """maple.land + Tespia notices/events crawler. Returns new/updated count."""
    new_count = 0

    # 기존 게시글 중 summary가 없는 업데이트/이벤트 백필
    backfill_rows = conn.execute(
        "SELECT post_id, source, title, content FROM maple_land_posts "
        "WHERE summary IS NULL AND category IN ('업데이트','이벤트','진행중','종료','안내') AND content IS NOT NULL AND content != ''"
    ).fetchall()
    if backfill_rows:
        print(f"[maple-land] AI 요약 백필 대상 {len(backfill_rows)}건")
        for row in backfill_rows:
            try:
                summary = None
                if row["source"] == "tespia":
                    summary = local_patch_summary(row["title"], row["content"])
                if not summary:
                    summary = await summarize_post(row["title"], row["content"])
                if summary:
                    conn.execute(
                        "UPDATE maple_land_posts SET summary = ? WHERE post_id = ?",
                        (summary, row["post_id"]),
                    )
                    conn.commit()
                    print(f"[maple-land] 요약 백필: {row['title'][:40]}")
            except Exception as e:
                print(f"[maple-land] 요약 백필 오류 {row['post_id']}: {e}")

    # 본문 없는 기존 포스트 재크롤링 (파서 수정 후 자동 보정)
    empty_posts = conn.execute(
        "SELECT post_id, source, board, url FROM maple_land_posts WHERE content IS NULL OR content = ''"
    ).fetchall()
    if empty_posts:
        print(f"[maple-land] 본문 없는 포스트 {len(empty_posts)}건 재수집")
        for row in empty_posts:
            try:
                parser = MapleLandParser(row["source"] or "main")
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
    for source, source_info in SOURCES.items():
        parser = MapleLandParser(source)
        for board in source_info["boards"]:
            print(f"[maple-land] {source}/{board} 크롤링 시작")
            for page in range(1, 50):
                url = f"{source_info['base_url']}/board/{board}?page={page}"
                try:
                    html = await client.get(
                        url,
                        cache_key=f"maple_land/{source}/{board}/p{page}",
                        use_cache=not force,
                    )
                except Exception as e:
                    print(f"[maple-land] {source}/{board} p{page} 오류: {e}")
                    break

                entries = parser.parse_board_list(html, board)
                if not entries:
                    print(f"[maple-land] {source}/{board} p{page}: 항목 없음, 중단")
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
                            cache_key=f"maple_land/{source}/post/{entry['post_id']}",
                            use_cache=not force,
                        )
                        detail = parser.parse_detail(detail_html, 0)
                        cat = entry.get("category") or detail.get("category")
                        title = entry.get("title") or detail.get("title", "")
                        content = detail.get("content", "")

                        # 업데이트/이벤트 카테고리만 요약 생성
                        summary = None
                        if cat in SUMMARY_CATEGORIES and content:
                            if source == "tespia":
                                summary = local_patch_summary(title, content)
                            if not summary:
                                summary = await summarize_post(title, content)

                        merged = {
                            "post_id": entry["post_id"],
                            "source": source,
                            "board": board,
                            "url": entry["url"],
                            "title": title,
                            "category": cat,
                            "published_at": entry.get("published_at") or detail.get("published_at"),
                            "content": content,
                            "content_html": detail.get("content_html", ""),
                            "last_crawled_at": detail["last_crawled_at"],
                            "summary": summary,
                        }
                        parser.save(conn, merged)
                        new_count += 1
                        print(f"[maple-land] 저장: {source}/{entry['title'][:40]}")
                    except Exception as e:
                        print(f"[maple-land] {entry['url']} 상세 오류: {e}")

                if all_known and not force:
                    print(f"[maple-land] {source}/{board} p{page}: 기존 항목만 있어 중단")
                    break

            print(f"[maple-land] {source}/{board} 완료")

    return new_count
