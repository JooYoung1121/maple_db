#!/usr/bin/env python3
from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "maple.db"
BASE_URL = "https://tespia.maple.land"
CATEGORIES = {"업데이트", "점검", "안내", "제재", "이벤트", "진행중", "종료"}
DATE_RE = re.compile(r"\d{4}\.\d{2}\.\d{2}")
POST_RE = re.compile(r"^/board/notices/(\w+)$")
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
SKIP_PREFIXES = (
    "안녕하세요",
    "아래 내용을 확인",
    "항상 쾌적한",
    "감사합니다",
    "Mapleland 드림",
    "※",
    "주소 복사",
)


def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": "maple-db-tespia-sync/1.0"})
    with urlopen(req, timeout=20) as res:
        return res.read().decode("utf-8", errors="replace")


def text(tag) -> str:
    return tag.get_text(strip=True) if tag else ""


def normalize_content_html(content_el) -> str:
    if not content_el:
        return ""
    for h1_tag in content_el.find_all("h1"):
        h1_tag.decompose()
    for tag in content_el.find_all(True):
        tag.attrs = {
            k: v
            for k, v in tag.attrs.items()
            if k in ("href", "src", "alt", "target", "rel")
        }
    return str(content_el)


def local_patch_summary(title: str, content: str, max_lines: int = 6) -> str | None:
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
        if any(line.startswith(prefix) for prefix in SKIP_PREFIXES):
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
    return "\n".join(lines) if lines else None


def parse_list(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    entries: list[dict] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=POST_RE):
        href = str(a.get("href", ""))
        match = POST_RE.match(href)
        if not match:
            continue
        post_id = match.group(1)
        if post_id in seen:
            continue
        seen.add(post_id)

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
            for span in row.find_all("span"):
                candidate = span.get_text(strip=True)
                if candidate in CATEGORIES:
                    category = candidate
                    break
            for el in row.find_all(["span", "div"]):
                candidate = el.get_text(strip=True)
                if len(candidate) <= 15:
                    date_match = DATE_RE.search(candidate)
                    if date_match:
                        published_at = date_match.group(0)
                        break

        entries.append(
            {
                "post_id": post_id,
                "source": "tespia",
                "board": "notices",
                "url": f"{BASE_URL}{href}",
                "title": a.get_text(strip=True),
                "category": category,
                "published_at": published_at,
            }
        )
    return entries


def parse_detail(html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup.find_all(["script", "style"]):
        tag.decompose()

    title = text(soup.find("h1"))
    category = None
    for span in soup.find_all("span"):
        candidate = span.get_text(strip=True)
        if candidate in CATEGORIES:
            category = candidate
            break

    published_at = None
    for el in soup.find_all(["span", "time"]):
        candidate = el.get_text(strip=True)
        if len(candidate) <= 20:
            match = DATE_RE.search(candidate)
            if match:
                published_at = match.group(0)
                break

    content_el = soup.find("div", class_="post-content")
    if not content_el:
        main = soup.find("main") or soup.find("body")
        if main:
            for tag in main.find_all(["nav", "header", "footer"]):
                tag.decompose()
            content_el = max(main.find_all("div"), key=lambda div: len(div.get_text(strip=True)), default=main)

    content = content_el.get_text(separator="\n", strip=True) if content_el else ""
    return {
        "title": title,
        "category": category,
        "published_at": published_at,
        "content": content,
        "content_html": normalize_content_html(content_el),
        "last_crawled_at": datetime.now(timezone.utc).isoformat(),
    }


def ensure_schema(conn: sqlite3.Connection) -> None:
    try:
        conn.execute("ALTER TABLE maple_land_posts ADD COLUMN source TEXT DEFAULT 'main'")
    except Exception:
        pass
    conn.execute("UPDATE maple_land_posts SET source = 'main' WHERE source IS NULL OR source = ''")
    conn.commit()


def save(conn: sqlite3.Connection, data: dict) -> None:
    conn.execute(
        """
        INSERT INTO maple_land_posts
            (post_id, source, board, category, title, content, content_html, url, published_at, last_crawled_at, summary)
        VALUES
            (:post_id, :source, :board, :category, :title, :content, :content_html, :url, :published_at, :last_crawled_at, :summary)
        ON CONFLICT(post_id) DO UPDATE SET
            source = excluded.source,
            board = excluded.board,
            category = excluded.category,
            title = excluded.title,
            content = excluded.content,
            content_html = excluded.content_html,
            url = excluded.url,
            published_at = excluded.published_at,
            last_crawled_at = excluded.last_crawled_at,
            summary = COALESCE(excluded.summary, maple_land_posts.summary)
        """,
        data,
    )


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ensure_schema(conn)

    saved = 0
    seen: set[str] = set()
    for page in range(1, 20):
        entries = parse_list(fetch(f"{BASE_URL}/board/notices?page={page}"))
        if not entries:
            break
        new_on_page = 0
        for entry in entries:
            if entry["post_id"] in seen:
                continue
            seen.add(entry["post_id"])
            detail = parse_detail(fetch(entry["url"]))
            title = entry["title"] or detail["title"]
            content = detail["content"]
            merged = {
                **entry,
                "title": title,
                "category": entry["category"] or detail["category"],
                "published_at": entry["published_at"] or detail["published_at"],
                "content": content,
                "content_html": detail["content_html"],
                "last_crawled_at": detail["last_crawled_at"],
                "summary": local_patch_summary(title, content),
            }
            save(conn, merged)
            saved += 1
            new_on_page += 1
        conn.commit()
        print(f"page {page}: {new_on_page} posts")
    conn.close()
    print(f"tespia posts synced: {saved}")


if __name__ == "__main__":
    main()
