#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from crawler.parsers.maple_land import local_patch_summary

DB_PATH = ROOT / "data" / "maple.db"
OUTPUT_PATH = ROOT / "data" / "local_news_summaries.json"

SKIP_PREFIXES = (
    "안녕하세요",
    "아래 내용을 확인",
    "항상 쾌적한",
    "감사합니다",
    "Mapleland 드림",
    "※",
    "주소 복사",
    "목록",
)
SUMMARY_KEYWORDS = (
    "추가",
    "변경",
    "수정",
    "개선",
    "가능",
    "진행",
    "기간",
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
    "점검",
    "이벤트",
    "보상",
    "제재",
)


def normalize_line(raw: str) -> str:
    return raw.strip().strip("-*•> ").strip()


def generic_summary(title: str, content: str, max_lines: int = 5) -> str | None:
    patch_summary = local_patch_summary(title, content, max_lines=max_lines)
    if patch_summary:
        return patch_summary

    keyword_lines: list[str] = []
    fallback_lines: list[str] = []
    for raw in content.splitlines():
        line = normalize_line(raw)
        if not line:
            continue
        if any(line.startswith(prefix) for prefix in SKIP_PREFIXES):
            continue
        if line == title or len(line) < 8:
            continue
        if len(line) > 110:
            line = line[:107].rstrip() + "..."
        target = keyword_lines if any(keyword in line for keyword in SUMMARY_KEYWORDS) else fallback_lines
        formatted = f"- {line}"
        if formatted not in keyword_lines and formatted not in fallback_lines:
            target.append(formatted)
        if len(keyword_lines) >= max_lines:
            break

    lines = keyword_lines[:max_lines]
    if len(lines) < 3:
        for line in fallback_lines:
            if line not in lines:
                lines.append(line)
            if len(lines) >= max_lines:
                break
    return "\n".join(lines) if lines else None


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate local maple.land news summaries without external APIs.")
    parser.add_argument("--db", default=str(DB_PATH), help="SQLite DB path")
    parser.add_argument("--output", default=str(OUTPUT_PATH), help="JSON output path")
    parser.add_argument("--force", action="store_true", help="Overwrite existing DB summaries")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT post_id, source, board, category, title, published_at, url, content, summary
        FROM maple_land_posts
        WHERE content IS NOT NULL AND content != ''
        ORDER BY COALESCE(published_at, created_at) DESC
        """
    ).fetchall()

    records: list[dict] = []
    changed = 0
    for row in rows:
        existing_summary = row["summary"]
        generated = None
        if args.force or not existing_summary:
            generated = generic_summary(row["title"] or "", row["content"] or "")
        summary = generated or existing_summary
        if not summary:
            continue
        records.append({
            "post_id": row["post_id"],
            "source": row["source"] or "main",
            "board": row["board"],
            "category": row["category"],
            "title": row["title"],
            "published_at": row["published_at"],
            "url": row["url"],
            "summary": summary,
        })
        if generated and (args.force or not existing_summary):
            cur = conn.execute(
                "UPDATE maple_land_posts SET summary = ? WHERE post_id = ?",
                (generated, row["post_id"]),
            )
            changed += cur.rowcount

    conn.commit()
    conn.close()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    payload_body = {
        "summary_count": len(records),
        "summaries": records,
    }
    if output.exists():
        try:
            existing = json.loads(output.read_text(encoding="utf-8"))
            existing_body = {
                "summary_count": existing.get("summary_count"),
                "summaries": existing.get("summaries", []),
            }
            if existing_body == payload_body:
                print(f"local summaries unchanged: {len(records)}")
                print(f"db summaries updated: {changed}")
                return
        except Exception:
            pass

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        **payload_body,
    }
    output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"local summaries written: {len(records)}")
    print(f"db summaries updated: {changed}")


if __name__ == "__main__":
    main()
