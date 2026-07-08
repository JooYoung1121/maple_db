from __future__ import annotations
"""디시인사이드 메이플랜드 마이너 갤러리 파서 (주간 뉴스 원자료 수집)

저작권 정책: 원문 전문을 미러하지 않는다.
목록의 제목/지표(조회·추천·댓글)/링크만 저장하고, 개념글에 한해
본문 앞 300자 발췌(excerpt)만 추가로 수집한다.
"""

import re
import sqlite3
from datetime import datetime, timezone

import httpx

from .base import BaseParser

GALLERY_ID = "mapleland"
BASE_URL = "https://gall.dcinside.com"
LIST_URL = f"{BASE_URL}/mgallery/board/lists/?id={GALLERY_ID}"
VIEW_URL = f"{BASE_URL}/mgallery/board/view/?id={GALLERY_ID}"

# 기본 UA(MapleDataCollector)는 디시에서 차단될 수 있어 브라우저 헤더를 명시적으로 전달
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Referer": f"{BASE_URL}/mgallery/board/lists/?id={GALLERY_ID}",
    "Accept-Language": "ko-KR,ko;q=0.9",
}

EXCERPT_MAX_LEN = 300
IMAGE_ROW_TYPES = {"icon_pic", "icon_recomimg", "main_img"}


class DcinsideParser(BaseParser):
    """갤러리 목록 <tr class="ub-content us-post"> 행 파서."""

    def parse_list(self, html: str) -> list[dict]:
        soup = self.make_soup(html)
        results: list[dict] = []

        for tr in soup.select("tr.ub-content.us-post"):
            row_type = tr.get("data-type", "")
            if row_type == "icon_notice":
                continue  # 갤러리 공지 제외

            post_no = str(tr.get("data-no", "")).strip()
            if not post_no.isdigit():
                continue

            tit_cell = tr.select_one("td.gall_tit")
            if not tit_cell:
                continue
            link = tit_cell.find("a", href=re.compile(r"/board/view/"))
            if not link:
                continue
            title = link.get_text(" ", strip=True)
            if not title:
                continue

            reply_el = tit_cell.select_one(".reply_num")
            comment_count = 0
            if reply_el:
                m = re.search(r"\d+", reply_el.get_text())
                comment_count = int(m.group(0)) if m else 0

            subject_el = tr.select_one("td.gall_subject")
            writer_el = tr.select_one("td.gall_writer")
            date_el = tr.select_one("td.gall_date")
            count_el = tr.select_one("td.gall_count")
            recommend_el = tr.select_one("td.gall_recommend")

            published_at = None
            if date_el:
                # title 속성에 'YYYY-MM-DD HH:MM:SS' 전체 시각이 들어있음
                published_at = str(date_el.get("title") or "").strip() or None

            results.append({
                "source_post_id": post_no,
                "board": str(subject_el.get_text(strip=True)) if subject_el else None,
                "title": title,
                "url": f"{VIEW_URL}&no={post_no}",
                "author": str(writer_el.get("data-nick") or "").strip() if writer_el else None,
                "views": self.safe_int(count_el.get_text() if count_el else 0),
                "recommends": self.safe_int(recommend_el.get_text() if recommend_el else 0),
                "comment_count": comment_count,
                "has_image": 1 if row_type in IMAGE_ROW_TYPES else 0,
                "published_at": published_at,
            })

        return results

    def parse_detail(self, html: str, entity_id: int) -> dict:
        """상세 페이지에서 본문 발췌만 추출 (전문 저장 금지)."""
        soup = self.make_soup(html)
        write_div = soup.select_one("div.write_div")
        excerpt = ""
        if write_div:
            text = write_div.get_text(" ", strip=True)
            text = re.sub(r"\s+", " ", text).strip()
            excerpt = text[:EXCERPT_MAX_LEN]
        return {"excerpt": excerpt}

    def save(self, conn: sqlite3.Connection, data: dict) -> None:
        conn.execute(
            """
            INSERT INTO community_posts
                (source, source_post_id, board, title, excerpt, url, author,
                 views, recommends, comment_count, is_recommended, has_image,
                 published_at, last_seen_at)
            VALUES
                (:source, :source_post_id, :board, :title, :excerpt, :url, :author,
                 :views, :recommends, :comment_count, :is_recommended, :has_image,
                 :published_at, :last_seen_at)
            ON CONFLICT(source, source_post_id) DO UPDATE SET
                board = COALESCE(excluded.board, community_posts.board),
                title = excluded.title,
                excerpt = COALESCE(excluded.excerpt, community_posts.excerpt),
                author = COALESCE(excluded.author, community_posts.author),
                views = MAX(excluded.views, community_posts.views),
                recommends = MAX(excluded.recommends, community_posts.recommends),
                comment_count = MAX(excluded.comment_count, community_posts.comment_count),
                is_recommended = MAX(excluded.is_recommended, community_posts.is_recommended),
                has_image = MAX(excluded.has_image, community_posts.has_image),
                published_at = COALESCE(excluded.published_at, community_posts.published_at),
                last_seen_at = excluded.last_seen_at
            """,
            data,
        )


async def crawl_dcinside(
    conn: sqlite3.Connection,
    client,
    pages: int = 3,
    recommend_pages: int = 2,
) -> int:
    """디시 메이플랜드 갤러리 목록/개념글 수집. 저장·갱신 건수 반환.

    차단(403/429) 등 오류 시 크래시 없이 수집분까지만 저장하고 반환한다
    (주간호는 공식 소식만으로도 발행 가능해야 함).
    """
    parser = DcinsideParser()
    now = datetime.now(timezone.utc).isoformat()
    saved = 0

    # (url, 개념글 여부) 목록 — 일반 목록 pages장 + 개념글 목록 recommend_pages장
    targets = [(f"{LIST_URL}&page={p}", False) for p in range(1, pages + 1)]
    targets += [
        (f"{LIST_URL}&exception_mode=recommend&page={p}", True)
        for p in range(1, recommend_pages + 1)
    ]

    recommended_entries: list[dict] = []

    for url, is_recommend in targets:
        try:
            html = await client.get(url, use_cache=False, headers=BROWSER_HEADERS)
        except httpx.HTTPStatusError as e:
            print(f"[dcinside] 목록 차단/오류({e.response.status_code}): {url} — 중단")
            break
        except Exception as e:
            print(f"[dcinside] 목록 오류: {url} — {e}")
            continue

        entries = parser.parse_list(html)
        if not entries:
            print(f"[dcinside] 항목 없음(구조 변경?): {url}")
            continue

        for entry in entries:
            entry["source"] = "dcinside"
            entry["is_recommended"] = 1 if is_recommend else 0
            entry["excerpt"] = None
            entry["last_seen_at"] = now
            parser.save(conn, entry)
            saved += 1
            if is_recommend:
                recommended_entries.append(entry)
        conn.commit()

    # 개념글만 상세 진입해 발췌 수집 (이미 발췌가 있으면 스킵)
    for entry in recommended_entries:
        row = conn.execute(
            "SELECT excerpt FROM community_posts WHERE source='dcinside' AND source_post_id=?",
            (entry["source_post_id"],),
        ).fetchone()
        if row and row["excerpt"]:
            continue
        try:
            html = await client.get(
                entry["url"],
                cache_key=f"dcinside/view/{entry['source_post_id']}",
                headers=BROWSER_HEADERS,
            )
        except httpx.HTTPStatusError as e:
            print(f"[dcinside] 상세 차단/오류({e.response.status_code}) — 발췌 수집 중단")
            break
        except Exception as e:
            print(f"[dcinside] 상세 오류 {entry['source_post_id']}: {e}")
            continue

        detail = parser.parse_detail(html, 0)
        if detail.get("excerpt"):
            conn.execute(
                "UPDATE community_posts SET excerpt=? WHERE source='dcinside' AND source_post_id=?",
                (detail["excerpt"], entry["source_post_id"]),
            )
    conn.commit()

    print(f"[dcinside] 완료: 저장/갱신 {saved}건 (개념글 {len(recommended_entries)}건)")
    return saved
