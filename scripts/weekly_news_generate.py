#!/usr/bin/env python3
"""주간 메랜 발행 도구 — 원자재 수집 → Claude Code 생성 → 발행

주 1회 로컬에서 실행한다 (launchd/cron 등록 가능, README 참고).

    python scripts/weekly_news_generate.py collect            # 원자재 번들 생성
    python scripts/weekly_news_generate.py generate           # claude -p 로 호 JSON 생성
    python scripts/weekly_news_generate.py publish --yes      # 라이브/로컬 발행
    python scripts/weekly_news_generate.py all --yes          # 위 3단계 연속 실행

환경변수:
    WEEKLY_API_BASE      라이브 API 베이스 URL (예: https://example.up.railway.app)
                         없으면 로컬 sqlite(data/maple.db)만 사용한다.
    GAME_ADMIN_PASSWORD  관리자 비밀번호 (material 조회/발행에 필요)
"""
from __future__ import annotations

import json
import hashlib
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import click

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

KST = timezone(timedelta(hours=9))
OUT_DIR = ROOT / "data" / "weekly_news"
PROMPT_FILE = ROOT / ".claude" / "commands" / "weekly-news.md"


def _load_dotenv() -> None:
    """루트 .env 를 읽어 미설정 env 에만 주입 (WEEKLY_API_BASE 등 매번 안 쳐도 되게)."""
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

REQUIRED_SECTION_IDS = {"headline", "official", "community"}
MATERIAL_SCHEMA_VERSION = 2
OFFICIAL_EXCERPT_CHARS = 5_000
MAX_CARD_COUNT = 3


def _default_week_start() -> str:
    """일요일 실행 시 이번 주(월~일), 그 외엔 지난주 월요일."""
    today = datetime.now(KST).date()
    monday = today - timedelta(days=today.weekday())
    if today.weekday() != 6:  # 일요일이 아니면 지난주
        monday -= timedelta(days=7)
    return monday.strftime("%Y-%m-%d")


def _material_path(week_start: str) -> Path:
    return OUT_DIR / f"material-{week_start}.json"


def _issue_path(week_start: str) -> Path:
    return OUT_DIR / f"issue-{week_start}.json"


def _material_digest(material: dict) -> str:
    """포맷팅과 무관한 원자재 내용 해시."""
    canonical = json.dumps(
        material, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _api_base() -> str | None:
    base = os.environ.get("WEEKLY_API_BASE", "").rstrip("/")
    return base or None


def _admin_password() -> str:
    return os.environ.get("GAME_ADMIN_PASSWORD", "1004")


def _collect_local(week_start: str) -> dict:
    """로컬 sqlite에서 material 번들 생성 (weekly_news.get_weekly_material과 동일 쿼리)."""
    from crawler.db import get_connection

    week_end = (
        datetime.strptime(week_start, "%Y-%m-%d") + timedelta(days=6)
    ).strftime("%Y-%m-%d")
    conn = get_connection()
    try:
        official = conn.execute(
            f"""
            SELECT post_id, source, board, category, title, url, published_at,
                   summary,
                   SUBSTR(COALESCE(content, ''), 1, {OFFICIAL_EXCERPT_CHARS}) AS content_excerpt
            FROM maple_land_posts
            WHERE REPLACE(COALESCE(published_at, SUBSTR(created_at, 1, 10)), '.', '-')
                  BETWEEN ? AND ?
            ORDER BY published_at
            """,
            (week_start, week_end),
        ).fetchall()
        community = conn.execute(
            """
            SELECT source, source_post_id, board, title, excerpt, url, author,
                   views, recommends, comment_count, is_recommended, has_image, published_at
            FROM community_posts
            WHERE SUBSTR(COALESCE(published_at, first_seen_at), 1, 10) BETWEEN ? AND ?
            ORDER BY is_recommended DESC, recommends DESC, views DESC
            LIMIT 40
            """,
            (week_start, week_end),
        ).fetchall()
        sprite_pool = []
        for ref_type, table, limit in (("mob", "mobs", 30), ("npc", "npcs", 15), ("item", "items", 15)):
            extra = "AND id < 9000000" if ref_type == "mob" else ""
            rows = conn.execute(
                f"SELECT id, name FROM {table} "
                f"WHERE icon_url IS NOT NULL AND icon_url != '' {extra} "
                f"ORDER BY RANDOM() LIMIT {limit}"
            ).fetchall()
            sprite_pool.extend({"type": ref_type, "id": r["id"], "name": r["name"]} for r in rows)
        return {
            "schema_version": MATERIAL_SCHEMA_VERSION,
            "collected_at": datetime.now(KST).isoformat(),
            "week_start": week_start,
            "week_end": week_end,
            "official_posts": [dict(r) for r in official],
            "community_posts": [dict(r) for r in community],
            "sprite_pool": sprite_pool,
        }
    finally:
        conn.close()


def _collect_remote(week_start: str, api_base: str) -> dict:
    import httpx

    resp = httpx.get(
        f"{api_base}/api/weekly-news/material",
        params={"week_start": week_start},
        headers={"X-Admin-Password": _admin_password()},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _local_issue_numbers() -> tuple[dict[str, int], int]:
    """{week_start: issue_no}, max issue_no."""
    from crawler.db import get_connection

    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT week_start, issue_no FROM weekly_news_issues ORDER BY issue_no"
        ).fetchall()
        by_week = {str(r["week_start"]): int(r["issue_no"]) for r in rows}
        max_no = max((int(r["issue_no"]) for r in rows), default=0)
        return by_week, max_no
    finally:
        conn.close()


def _resolve_issue_no(week_start: str) -> int:
    """같은 주는 기존 호수, 새 주는 다음 호수. 라이브 우선, 로컬 폴백."""
    api_base = _api_base()
    if api_base:
        try:
            import httpx

            resp = httpx.get(
                f"{api_base}/api/weekly-news",
                params={"page": 1, "per_page": 100},
                timeout=30,
            )
            resp.raise_for_status()
            issues = resp.json().get("issues", [])
            for issue in issues:
                if issue.get("week_start") == week_start:
                    return int(issue["issue_no"])
            return max((int(i["issue_no"]) for i in issues), default=0) + 1
        except Exception as e:
            click.echo(f"[issue] 라이브 호수 확인 실패, 로컬 기준 사용: {e}", err=True)

    by_week, max_no = _local_issue_numbers()
    return by_week.get(week_start, max_no + 1)


def _normalize_issue_title(title: str, issue_no: int) -> str:
    subtitle = re.sub(
        r"^주간\s*메랜(?:\s*제\d+호)?\s*(?:—|-)?\s*", "", str(title or ""),
    ).strip()
    return f"주간 메랜 제{issue_no}호 — {subtitle or '이번 주 메이플랜드 소식'}"


def _iter_sprite_refs(value, path: str = "content"):
    if isinstance(value, dict):
        if value.get("type") in ("mob", "npc", "item") and "id" in value:
            yield path, value
        for key, nested in value.items():
            yield from _iter_sprite_refs(nested, f"{path}.{key}")
    elif isinstance(value, list):
        for idx, nested in enumerate(value):
            yield from _iter_sprite_refs(nested, f"{path}[{idx}]")


def _validate_scene(scene: dict, label: str, *, cover: bool = False) -> list[str]:
    problems: list[str] = []
    title_limit = 16 if cover else 24
    caption_limit = 30 if cover else 40
    if len(str(scene.get("title", ""))) > title_limit:
        problems.append(f"{label} 제목이 {title_limit}자를 초과합니다.")
    if len(str(scene.get("caption", ""))) > caption_limit:
        problems.append(f"{label} 캡션이 {caption_limit}자를 초과합니다.")
    for bubble in scene.get("bubbles") or []:
        if len(str(bubble.get("text", ""))) > 12:
            problems.append(f"{label} 말풍선이 12자를 초과합니다: {bubble.get('text')}")
    return problems


def validate_issue(
    content: dict,
    *,
    material: dict | None = None,
    expected_week_start: str | None = None,
    expected_issue_no: int | None = None,
    require_provenance: bool = False,
) -> list[str]:
    """발행 전 검증. 문제 목록 반환 (빈 리스트면 통과)."""
    problems: list[str] = []
    sections = content.get("sections")
    if not isinstance(sections, list) or not sections:
        return ["sections 배열이 없습니다."]
    ids = {s.get("id") for s in sections if isinstance(s, dict)}
    missing = REQUIRED_SECTION_IDS - ids
    if missing:
        problems.append(f"필수 섹션 누락: {', '.join(sorted(missing))}")
    if len(content.get("tldr") or []) != 5:
        problems.append("tldr은 정확히 5줄이어야 합니다.")
    cover = content.get("cover")
    if not isinstance(cover, dict):
        problems.append("cover 연출이 없습니다.")
    else:
        problems.extend(_validate_scene(cover, "cover", cover=True))

    if expected_week_start and content.get("week_start") != expected_week_start:
        problems.append(
            f"week_start 불일치: {content.get('week_start')} != {expected_week_start}"
        )
    if expected_issue_no is not None:
        prefix = f"주간 메랜 제{expected_issue_no}호 —"
        if not str(content.get("title", "")).startswith(prefix):
            problems.append(f"호수 제목 불일치: '{prefix}'로 시작해야 합니다.")

    material_urls: set[str] = set()
    community_by_url: dict[str, dict] = {}
    sprite_pool: set[tuple[str, int]] = set()
    if material is not None:
        for post in material.get("official_posts", []):
            if post.get("url"):
                material_urls.add(post["url"])
        for post in material.get("community_posts", []):
            if post.get("url"):
                material_urls.add(post["url"])
                community_by_url[post["url"]] = post
        for ref in material.get("sprite_pool", []):
            try:
                sprite_pool.add((str(ref["type"]), int(ref["id"])))
            except (KeyError, TypeError, ValueError):
                continue

        if content.get("week_start") != material.get("week_start"):
            problems.append("발행본과 원자재의 week_start가 다릅니다.")
        if content.get("week_end") != material.get("week_end"):
            problems.append("발행본과 원자재의 week_end가 다릅니다.")

        meta = content.get("_meta") or {}
        digest = _material_digest(material)
        if meta.get("material_sha256") and meta["material_sha256"] != digest:
            problems.append("발행본 생성 후 원자재가 변경되었습니다. 다시 생성해야 합니다.")
        if require_provenance and meta.get("material_sha256") != digest:
            problems.append("원자재 해시가 없거나 일치하지 않습니다.")

    card_count = 0
    for s in sections:
        if not isinstance(s, dict) or not {"id", "heading", "articles"} <= set(s):
            problems.append(f"섹션 형식 오류: {s!r:.80}")
            continue
        section_id = str(s.get("id", ""))
        for a in s.get("articles", []):
            if not isinstance(a, dict) or not a.get("title"):
                problems.append(f"[{s['id']}] 제목 없는 기사")
                continue
            if not a.get("sources"):
                problems.append(f"[{s['id']}] 출처 없는 기사: {a['title'][:30]}")
            paragraphs = a.get("paragraphs") or []
            if not isinstance(paragraphs, list):
                problems.append(f"[{s['id']}] paragraphs 형식 오류: {a['title'][:30]}")
            else:
                for paragraph in paragraphs:
                    if len(str(paragraph)) > 250:
                        problems.append(f"[{s['id']}] 250자 초과 문단: {a['title'][:30]}")
            if section_id == "humor" and len(paragraphs) > 1:
                problems.append(f"[humor] 소개 문단은 최대 1개입니다: {a['title'][:30]}")

            article_community_sources: list[dict] = []
            for source in a.get("sources") or []:
                url = source.get("url") if isinstance(source, dict) else None
                if material is not None and url not in material_urls:
                    problems.append(f"[{s['id']}] 원자재에 없는 출처: {url}")
                if url in community_by_url:
                    post = community_by_url[url]
                    article_community_sources.append(post)
                    if section_id != "humor" and not str(post.get("excerpt") or "").strip():
                        problems.append(
                            f"[{s['id']}] 본문 발췌 없는 커뮤니티 출처 사용: {url}"
                        )

            metrics = a.get("metrics")
            if metrics:
                matches = any(
                    metrics == {
                        "recommends": post.get("recommends"),
                        "views": post.get("views"),
                        "comments": post.get("comment_count"),
                    }
                    for post in article_community_sources
                )
                if material is not None and not matches:
                    problems.append(f"[{s['id']}] 원자재와 지표 불일치: {a['title'][:30]}")
            elif section_id in ("community", "humor") and article_community_sources:
                problems.append(f"[{s['id']}] 커뮤니티 지표 누락: {a['title'][:30]}")

            for ref in a.get("sprites") or []:
                if ref.get("type") not in ("mob", "npc", "item"):
                    problems.append(f"[{s['id']}] 잘못된 스프라이트 타입: {ref}")
                elif ref["type"] == "mob" and int(ref.get("id", 0)) >= 9_000_000:
                    problems.append(f"[{s['id']}] 900만번대 특수몹 사용 금지: {ref}")
            card = a.get("card")
            if isinstance(card, dict):
                card_count += 1
                problems.extend(_validate_scene(card, f"[{s['id']}] card"))

    if card_count > MAX_CARD_COUNT:
        problems.append(f"카드 연출은 최대 {MAX_CARD_COUNT}개입니다: 현재 {card_count}개")

    if material is not None:
        for path, ref in _iter_sprite_refs(content):
            try:
                key = (str(ref["type"]), int(ref["id"]))
            except (KeyError, TypeError, ValueError):
                problems.append(f"스프라이트 형식 오류: {path}")
                continue
            if key not in sprite_pool:
                problems.append(f"원자재 후보에 없는 스프라이트: {path}={key[0]}:{key[1]}")
    return problems


def _extract_json(text: str) -> dict:
    """claude 출력에서 JSON 오브젝트 추출 (코드펜스/전후 텍스트 허용)."""
    fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    raw = fence.group(1) if fence else text
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("출력에서 JSON을 찾지 못했습니다.")
    return json.loads(raw[start:end + 1])


@click.group()
def cli():
    """주간 메랜 발행 파이프라인."""


@cli.command()
@click.option("--week-start", default=None, help="YYYY-MM-DD (기본: 발행 대상 주 월요일)")
def crawl(week_start: str | None):
    """공홈 + 디시 갤러리를 로컬에서 크롤링 (디시는 서버 IP가 차단돼 로컬 수집 필수)."""
    import asyncio

    from crawler.client import ThrottledClient
    from crawler.db import init_db
    from crawler.parsers.dcinside import backfill_weekly_excerpts, crawl_dcinside
    from crawler.parsers.maple_land import crawl_maple_land

    week_start = week_start or _default_week_start()
    week_end = (
        datetime.strptime(week_start, "%Y-%m-%d") + timedelta(days=6)
    ).strftime("%Y-%m-%d")
    conn = init_db()

    async def _run():
        async with ThrottledClient() as client:
            n1 = await crawl_maple_land(conn, client, force=False, refresh_lists=True)
            n2 = await crawl_dcinside(conn, client)
            n3 = await backfill_weekly_excerpts(
                conn, client, week_start=week_start, week_end=week_end, limit=40,
            )
            return n1, n2, n3

    n1, n2, n3 = asyncio.run(_run())
    conn.close()
    click.echo(
        f"[crawl] 공홈 {n1}건, 디시 {n2}건 수집/갱신, "
        f"주간 상위글 본문 {n3}건 보강"
    )


@cli.command()
@click.option("--week-start", default=None, help="YYYY-MM-DD (기본: 지난주 월요일)")
@click.option("--local", "use_local", is_flag=True, default=False, help="라이브 대신 로컬 DB에서 수집")
def collect(week_start: str | None, use_local: bool = False):
    """주간 원자재 번들 수집 → data/weekly_news/material-<주>.json"""
    week_start = week_start or _default_week_start()
    api_base = None if use_local else _api_base()
    if api_base:
        click.echo(f"[collect] 라이브 서버에서 수집: {api_base}")
        material = _collect_remote(week_start, api_base)
    else:
        click.echo("[collect] WEEKLY_API_BASE 미설정 — 로컬 DB에서 수집")
        material = _collect_local(week_start)

    material.setdefault("schema_version", MATERIAL_SCHEMA_VERSION)
    material.setdefault("collected_at", datetime.now(KST).isoformat())
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = _material_path(week_start)
    path.write_text(json.dumps(material, ensure_ascii=False, indent=2), encoding="utf-8")
    click.echo(
        f"[collect] 완료: {path} (공식 {len(material['official_posts'])}건, "
        f"커뮤니티 {len(material['community_posts'])}건)"
    )


@cli.command()
@click.option("--week-start", default=None)
@click.option("--model", default=None, help="claude CLI 모델 지정 (기본: CLI 기본값)")
def generate(week_start: str | None, model: str | None):
    """claude -p 로 호 JSON 생성 → data/weekly_news/issue-<주>.json"""
    week_start = week_start or _default_week_start()
    material_file = _material_path(week_start)
    if not material_file.exists():
        raise click.ClickException(f"원자재 파일이 없습니다. 먼저 collect 실행: {material_file}")
    if not PROMPT_FILE.exists():
        raise click.ClickException(f"프롬프트 파일이 없습니다: {PROMPT_FILE}")

    prompt = PROMPT_FILE.read_text(encoding="utf-8")
    material_text = material_file.read_text(encoding="utf-8")
    material = json.loads(material_text)
    issue_no = _resolve_issue_no(week_start)
    full_prompt = (
        f"{prompt}\n\n"
        f"## 이번 호 발행 정보\n\n"
        f"- 이번 호수는 제{issue_no}호입니다.\n"
        f"- title은 반드시 `주간 메랜 제{issue_no}호 — <부제>` 형식으로 작성하세요.\n\n"
        f"## 이번 주 원자재 JSON\n\n```json\n{material_text}\n```\n"
    )

    cmd = ["claude", "-p", "--output-format", "text"]
    if model:
        cmd += ["--model", model]

    feedback = ""
    for attempt in (1, 2, 3):
        click.echo(f"[generate] claude 실행 (시도 {attempt}/3)...")
        result = subprocess.run(
            cmd,
            input=full_prompt + feedback,
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode != 0:
            click.echo(f"[generate] claude 오류: {result.stderr[:500]}", err=True)
            continue
        try:
            content = _extract_json(result.stdout)
        except (ValueError, json.JSONDecodeError) as e:
            click.echo(f"[generate] JSON 파싱 실패: {e}", err=True)
            continue
        content["title"] = _normalize_issue_title(content.get("title", ""), issue_no)
        content["issue_no"] = issue_no
        content["_meta"] = {
            "material_schema_version": material.get("schema_version", 1),
            "material_sha256": _material_digest(material),
            "generated_at": datetime.now(KST).isoformat(),
            "generator": "claude-cli",
            "issue_no": issue_no,
        }
        problems = validate_issue(
            content,
            material=material,
            expected_week_start=week_start,
            expected_issue_no=issue_no,
            require_provenance=True,
        )
        if not problems:
            from weekly_news_render import validate_issue_sprite_assets

            problems.extend(validate_issue_sprite_assets(content))
        if problems:
            click.echo("[generate] 검증 실패:\n  - " + "\n  - ".join(problems), err=True)
            feedback = (
                "\n\n## 이전 시도 검증 오류\n"
                "아래 오류를 모두 고친 새로운 JSON 전체를 다시 출력하세요.\n"
                + "\n".join(f"- {p}" for p in problems)
                + "\n"
            )
            continue
        path = _issue_path(week_start)
        path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
        click.echo(f"[generate] 완료: {path}")
        click.echo("발행 전 내용을 검토하세요. 발행: publish --yes")
        return
    raise click.ClickException("생성 3회 모두 실패했습니다.")


@cli.command()
@click.option("--week-start", default=None)
def render(week_start: str | None):
    """호 JSON의 cover/card 연출을 이미지로 합성 → data/weekly_news/images-<주>/"""
    week_start = week_start or _default_week_start()
    issue_file = _issue_path(week_start)
    if not issue_file.exists():
        raise click.ClickException(f"호 파일이 없습니다. 먼저 generate 실행: {issue_file}")
    from weekly_news_render import render_issue_images, validate_issue_sprite_assets

    issue = json.loads(issue_file.read_text(encoding="utf-8"))
    sprite_problems = validate_issue_sprite_assets(issue)
    if sprite_problems:
        raise click.ClickException(
            "이미지 스프라이트 검증 실패:\n  - " + "\n  - ".join(sprite_problems)
        )
    out_dir = OUT_DIR / f"images-{week_start}"
    rendered = render_issue_images(issue, out_dir)
    # card_slot이 심어진 content를 다시 저장
    issue_file.write_text(json.dumps(issue, ensure_ascii=False, indent=2), encoding="utf-8")
    if rendered:
        click.echo(f"[render] {len(rendered)}장 합성: {', '.join(rendered)} → {out_dir}")
    else:
        click.echo("[render] cover/card 연출이 없어 합성한 이미지가 없습니다.")


def _collect_images(week_start: str, content: dict) -> list[dict]:
    """렌더된 이미지 디렉토리 → 발행 페이로드용 base64 목록."""
    import base64

    img_dir = OUT_DIR / f"images-{week_start}"
    expected_slots: list[str] = []
    if isinstance(content.get("cover"), dict):
        expected_slots.append("cover")
    for section in content.get("sections", []):
        for article in section.get("articles", []):
            slot = article.get("card_slot")
            if slot:
                expected_slots.append(str(slot))

    images = []
    missing: list[str] = []
    for slot in expected_slots:
        path = img_dir / f"{slot}.png"
        if not path.exists():
            missing.append(slot)
            continue
        images.append({
            "slot": slot,
            "mime": "image/png",
            "data_b64": base64.b64encode(path.read_bytes()).decode(),
        })
    if missing:
        raise click.ClickException(
            "렌더 이미지가 없습니다: " + ", ".join(missing) + ". render를 다시 실행하세요."
        )
    return images


@cli.command()
@click.option("--week-start", default=None)
@click.option("--yes", is_flag=True, default=False, help="확인 없이 발행")
@click.option("--dry-run", is_flag=True, default=False, help="발행 없이 페이로드만 출력")
@click.option("--issue-no", type=int, default=None, help="호수 지정 (기본: 자동 증가)")
def publish(week_start: str | None, yes: bool, dry_run: bool, issue_no: int | None):
    """생성된 호를 라이브 서버(admin API) + 로컬 DB에 발행."""
    week_start = week_start or _default_week_start()
    issue_file = _issue_path(week_start)
    if not issue_file.exists():
        raise click.ClickException(f"호 파일이 없습니다. 먼저 generate 실행: {issue_file}")
    material_file = _material_path(week_start)
    if not material_file.exists():
        raise click.ClickException(f"원자재 파일이 없습니다: {material_file}")

    content = json.loads(issue_file.read_text(encoding="utf-8"))
    material = json.loads(material_file.read_text(encoding="utf-8"))
    resolved_issue_no = issue_no or _resolve_issue_no(week_start)
    problems = validate_issue(
        content,
        material=material,
        expected_week_start=week_start,
        expected_issue_no=resolved_issue_no,
        require_provenance=True,
    )
    if problems:
        raise click.ClickException("검증 실패:\n  - " + "\n  - ".join(problems))

    week_end = content.get("week_end") or (
        datetime.strptime(week_start, "%Y-%m-%d") + timedelta(days=6)
    ).strftime("%Y-%m-%d")
    payload = {
        "issue_no": resolved_issue_no,
        "title": content.get("title") or f"주간 메랜 ({week_start}주)",
        "week_start": content.get("week_start") or week_start,
        "week_end": week_end,
        "content": content,
        "status": "published",
    }
    images = _collect_images(week_start, content)
    if images:
        payload["images"] = images
        click.echo(f"[publish] 이미지 {len(images)}장 첨부: {', '.join(i['slot'] for i in images)}")

    if dry_run:
        click.echo(json.dumps(payload, ensure_ascii=False, indent=2)[:3000])
        return
    if not yes and not click.confirm(f"'{payload['title']}' 를 발행할까요?"):
        raise click.Abort()

    api_base = _api_base()
    if api_base:
        import httpx

        resp = httpx.post(
            f"{api_base}/api/weekly-news",
            json=payload,
            headers={"X-Admin-Password": _admin_password()},
            timeout=30,
        )
        resp.raise_for_status()
        # 라이브가 부여한 호수를 로컬에도 그대로 사용 (호수 불일치/중복 방지)
        payload["issue_no"] = resp.json()["issue_no"]
        click.echo(f"[publish] 라이브 발행 완료: 제{payload['issue_no']}호")
    else:
        click.echo("[publish] WEEKLY_API_BASE 미설정 — 라이브 발행 생략")

    # 로컬 DB에도 반영 (dev 환경 동기화)
    from crawler.db import get_connection

    conn = get_connection()
    try:
        no = payload["issue_no"]
        if no is None:
            row = conn.execute(
                "SELECT COALESCE(MAX(issue_no), 0) AS m FROM weekly_news_issues"
            ).fetchone()
            no = row["m"] + 1
        now = datetime.now(KST).isoformat()
        conn.execute(
            """
            INSERT INTO weekly_news_issues
                (issue_no, title, week_start, week_end, content_json, status, published_at)
            VALUES (?, ?, ?, ?, ?, 'published', ?)
            ON CONFLICT(issue_no) DO UPDATE SET
                title=excluded.title, week_start=excluded.week_start,
                week_end=excluded.week_end, content_json=excluded.content_json,
                status='published', updated_at=?
            """,
            (
                no, payload["title"], payload["week_start"], payload["week_end"],
                json.dumps(content, ensure_ascii=False), now, now,
            ),
        )
        if images:
            import base64 as _b64

            conn.execute("DELETE FROM weekly_news_images WHERE issue_no=?", (no,))
            for img in images:
                conn.execute(
                    "INSERT INTO weekly_news_images (issue_no, slot, mime, data) VALUES (?, ?, ?, ?)",
                    (no, img["slot"], img["mime"], _b64.b64decode(img["data_b64"])),
                )
        conn.commit()
        click.echo(f"[publish] 로컬 DB 반영 완료: 제{no}호")
    finally:
        conn.close()


@cli.command()
@click.option("--week-start", default=None)
@click.option(
    "--allow-legacy",
    is_flag=True,
    default=False,
    help="원자재 해시가 없는 과거 발행본의 구조만 검사",
)
def audit(week_start: str | None, allow_legacy: bool):
    """원자재 대비 출처·지표·스프라이트·호수·이미지 발행 전 감사."""
    week_start = week_start or _default_week_start()
    material_file = _material_path(week_start)
    issue_file = _issue_path(week_start)
    if not material_file.exists() or not issue_file.exists():
        raise click.ClickException("material/issue 파일이 모두 필요합니다.")
    material = json.loads(material_file.read_text(encoding="utf-8"))
    content = json.loads(issue_file.read_text(encoding="utf-8"))
    issue_no = int(content.get("issue_no") or _resolve_issue_no(week_start))
    problems = validate_issue(
        content,
        material=material,
        expected_week_start=week_start,
        expected_issue_no=issue_no,
        require_provenance=not allow_legacy,
    )
    if not problems:
        from weekly_news_render import validate_issue_sprite_assets

        problems.extend(validate_issue_sprite_assets(content))
    if problems:
        raise click.ClickException("감사 실패:\n  - " + "\n  - ".join(problems))
    scope = (
        "출처·지표·스프라이트 구조 일치(레거시)"
        if allow_legacy
        else "출처·지표·스프라이트·원자재 해시 일치"
    )
    click.echo(f"[audit] 통과: 제{issue_no}호 — {scope}")


@cli.command(name="all")
@click.option("--week-start", default=None)
@click.option("--yes", is_flag=True, default=False)
@click.pass_context
def run_all(ctx: click.Context, week_start: str | None, yes: bool):
    """collect → generate → publish 연속 실행 (publish는 --yes 필요)."""
    week_start = week_start or _default_week_start()
    ctx.invoke(crawl, week_start=week_start)
    # 디시는 서버 IP가 차단돼 라이브 DB에 커뮤니티 글이 없다 → 로컬 크롤 후 로컬에서 수집
    ctx.invoke(collect, week_start=week_start, use_local=True)
    ctx.invoke(generate, week_start=week_start, model=None)
    ctx.invoke(render, week_start=week_start)
    if yes:
        ctx.invoke(publish, week_start=week_start, yes=True, dry_run=False, issue_no=None)
    else:
        click.echo("[all] 검토 후 발행하세요: publish --week-start "
                   f"{week_start} --yes")


if __name__ == "__main__":
    cli()
