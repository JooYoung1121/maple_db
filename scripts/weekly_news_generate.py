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
            """
            SELECT post_id, source, board, category, title, url, published_at,
                   summary, SUBSTR(COALESCE(content, ''), 1, 800) AS content_excerpt
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


def validate_issue(content: dict) -> list[str]:
    """발행 전 검증. 문제 목록 반환 (빈 리스트면 통과)."""
    problems: list[str] = []
    sections = content.get("sections")
    if not isinstance(sections, list) or not sections:
        return ["sections 배열이 없습니다."]
    ids = {s.get("id") for s in sections if isinstance(s, dict)}
    missing = REQUIRED_SECTION_IDS - ids
    if missing:
        problems.append(f"필수 섹션 누락: {', '.join(sorted(missing))}")
    for s in sections:
        if not isinstance(s, dict) or not {"id", "heading", "articles"} <= set(s):
            problems.append(f"섹션 형식 오류: {s!r:.80}")
            continue
        for a in s.get("articles", []):
            if not isinstance(a, dict) or not a.get("title"):
                problems.append(f"[{s['id']}] 제목 없는 기사")
                continue
            if not a.get("sources"):
                problems.append(f"[{s['id']}] 출처 없는 기사: {a['title'][:30]}")
            for ref in a.get("sprites") or []:
                if ref.get("type") not in ("mob", "npc", "item"):
                    problems.append(f"[{s['id']}] 잘못된 스프라이트 타입: {ref}")
                elif ref["type"] == "mob" and int(ref.get("id", 0)) >= 9_000_000:
                    problems.append(f"[{s['id']}] 900만번대 특수몹 사용 금지: {ref}")
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
def crawl():
    """공홈 + 디시 갤러리를 로컬에서 크롤링 (디시는 서버 IP가 차단돼 로컬 수집 필수)."""
    import asyncio

    from crawler.client import ThrottledClient
    from crawler.db import init_db
    from crawler.parsers.dcinside import crawl_dcinside
    from crawler.parsers.maple_land import crawl_maple_land

    conn = init_db()

    async def _run():
        async with ThrottledClient() as client:
            n1 = await crawl_maple_land(conn, client, force=False, refresh_lists=True)
            n2 = await crawl_dcinside(conn, client)
            return n1, n2

    n1, n2 = asyncio.run(_run())
    conn.close()
    click.echo(f"[crawl] 공홈 {n1}건, 디시 {n2}건 수집/갱신")


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
    material = material_file.read_text(encoding="utf-8")
    full_prompt = f"{prompt}\n\n## 이번 주 원자재 JSON\n\n```json\n{material}\n```\n"

    cmd = ["claude", "-p", "--output-format", "text"]
    if model:
        cmd += ["--model", model]

    for attempt in (1, 2):
        click.echo(f"[generate] claude 실행 (시도 {attempt}/2)...")
        result = subprocess.run(
            cmd, input=full_prompt, capture_output=True, text=True, timeout=600,
        )
        if result.returncode != 0:
            click.echo(f"[generate] claude 오류: {result.stderr[:500]}", err=True)
            continue
        try:
            content = _extract_json(result.stdout)
        except (ValueError, json.JSONDecodeError) as e:
            click.echo(f"[generate] JSON 파싱 실패: {e}", err=True)
            continue
        problems = validate_issue(content)
        if problems:
            click.echo("[generate] 검증 실패:\n  - " + "\n  - ".join(problems), err=True)
            continue
        path = _issue_path(week_start)
        path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
        click.echo(f"[generate] 완료: {path}")
        click.echo("발행 전 내용을 검토하세요. 발행: publish --yes")
        return
    raise click.ClickException("생성 2회 모두 실패했습니다.")


@cli.command()
@click.option("--week-start", default=None)
def render(week_start: str | None):
    """호 JSON의 cover/card 연출을 이미지로 합성 → data/weekly_news/images-<주>/"""
    week_start = week_start or _default_week_start()
    issue_file = _issue_path(week_start)
    if not issue_file.exists():
        raise click.ClickException(f"호 파일이 없습니다. 먼저 generate 실행: {issue_file}")
    from weekly_news_render import render_issue_images  # scripts/ 내 모듈

    issue = json.loads(issue_file.read_text(encoding="utf-8"))
    out_dir = OUT_DIR / f"images-{week_start}"
    rendered = render_issue_images(issue, out_dir)
    # card_slot이 심어진 content를 다시 저장
    issue_file.write_text(json.dumps(issue, ensure_ascii=False, indent=2), encoding="utf-8")
    if rendered:
        click.echo(f"[render] {len(rendered)}장 합성: {', '.join(rendered)} → {out_dir}")
    else:
        click.echo("[render] cover/card 연출이 없어 합성한 이미지가 없습니다.")


def _collect_images(week_start: str) -> list[dict]:
    """렌더된 이미지 디렉토리 → 발행 페이로드용 base64 목록."""
    import base64

    img_dir = OUT_DIR / f"images-{week_start}"
    images = []
    if img_dir.is_dir():
        for path in sorted(img_dir.glob("*.png")):
            images.append({
                "slot": path.stem,
                "mime": "image/png",
                "data_b64": base64.b64encode(path.read_bytes()).decode(),
            })
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

    content = json.loads(issue_file.read_text(encoding="utf-8"))
    problems = validate_issue(content)
    if problems:
        raise click.ClickException("검증 실패:\n  - " + "\n  - ".join(problems))

    week_end = content.get("week_end") or (
        datetime.strptime(week_start, "%Y-%m-%d") + timedelta(days=6)
    ).strftime("%Y-%m-%d")
    payload = {
        "issue_no": issue_no,
        "title": content.get("title") or f"주간 메랜 ({week_start}주)",
        "week_start": content.get("week_start") or week_start,
        "week_end": week_end,
        "content": content,
        "status": "published",
    }
    images = _collect_images(week_start)
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


@cli.command(name="all")
@click.option("--week-start", default=None)
@click.option("--yes", is_flag=True, default=False)
@click.pass_context
def run_all(ctx: click.Context, week_start: str | None, yes: bool):
    """collect → generate → publish 연속 실행 (publish는 --yes 필요)."""
    week_start = week_start or _default_week_start()
    ctx.invoke(crawl)
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
