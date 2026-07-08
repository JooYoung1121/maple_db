"""주간 메랜 표지·카드뉴스 합성 렌더러

Claude가 쓴 연출 JSON(scene spec)을 받아 실제 게임 스프라이트로 픽셀 콜라주를 합성한다.
- 배경: 프로시저럴 픽셀 그라디언트 (헤네시스/하늘/석양/밤/던전/신문지)
- 스프라이트: 로컬 DB의 icon_url에서 다운로드(캐시) 후 nearest-neighbor 확대
- 텍스트: Galmuri 픽셀 폰트 (제목 외곽선, 말풍선, 캡션)

scene spec 예시:
{
  "bg": "henesys",
  "title": "점검 2주 연장",
  "caption": "본 월드 재오픈 D-6",
  "sprites": [{"type": "mob", "id": 100100, "x": 0.2, "y": 0.85, "scale": 3, "flip": false}],
  "bubbles": [{"text": "2주 더?!", "x": 0.3, "y": 0.3}]
}
"""
from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

FONT_DIR = ROOT / "data" / "fonts"
SPRITE_CACHE = ROOT / "data" / "weekly_news" / "sprite_cache"

COVER_SIZE = (1200, 630)
CARD_SIZE = (800, 420)
PIXEL_SCALE = 4  # 배경은 1/4 해상도로 그린 뒤 nearest 확대 → 도트 질감

# (하늘 위, 하늘 아래, 땅 위, 땅 아래) — 메이플 감성 팔레트
BG_PALETTES = {
    "henesys": ((139, 200, 240), (196, 230, 250), (118, 192, 96), (88, 160, 72)),
    "sky":     ((96, 168, 232), (176, 216, 248), (168, 208, 240), (140, 188, 228)),
    "sunset":  ((248, 160, 96), (252, 208, 136), (152, 104, 88), (120, 80, 72)),
    "night":   ((24, 32, 72), (56, 64, 112), (40, 48, 64), (28, 36, 48)),
    "dungeon": ((56, 44, 72), (88, 72, 104), (72, 60, 68), (52, 44, 52)),
    "paper":   ((238, 228, 200), (238, 228, 200), (226, 214, 182), (226, 214, 182)),
}
DEFAULT_BG = "henesys"
INK = (40, 32, 28)
MAPLE_ORANGE = (232, 120, 32)


FONT_CDN = "https://cdn.jsdelivr.net/npm/galmuri@latest/dist"  # SIL OFL 라이선스


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "Galmuri11-Bold.ttf" if bold else "Galmuri11.ttf"
    path = FONT_DIR / name
    if not path.exists():  # 최초 실행 시 자동 다운로드 (repo에는 미포함)
        FONT_DIR.mkdir(parents=True, exist_ok=True)
        path.write_bytes(urllib.request.urlopen(f"{FONT_CDN}/{name}", timeout=30).read())
    return ImageFont.truetype(str(path), size)


def _seed(text: str) -> int:
    return int(hashlib.md5(text.encode()).hexdigest()[:8], 16)


def _draw_background(size: tuple[int, int], bg: str, seed: int) -> Image.Image:
    """저해상도로 그라디언트+구름/별+땅을 그리고 nearest 확대."""
    palette = BG_PALETTES.get(bg, BG_PALETTES[DEFAULT_BG])
    sky_top, sky_bottom, ground_top, ground_bottom = palette
    w, h = size[0] // PIXEL_SCALE, size[1] // PIXEL_SCALE
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)

    ground_y = int(h * 0.78) if bg != "paper" else h
    # 하늘: 4단 밴드 그라디언트 (부드러운 그라디언트 대신 밴드 → 레트로 질감)
    bands = 4
    for i in range(bands):
        t = i / (bands - 1)
        color = tuple(int(a + (b - a) * t) for a, b in zip(sky_top, sky_bottom))
        y0, y1 = int(ground_y * i / bands), int(ground_y * (i + 1) / bands)
        draw.rectangle([0, y0, w, y1], fill=color)

    rng = seed
    def _next() -> int:
        nonlocal rng
        rng = (rng * 1103515245 + 12345) % (2 ** 31)
        return rng

    if bg == "night":
        for _ in range(40):  # 별
            x, y = _next() % w, _next() % ground_y
            draw.point((x, y), fill=(232, 232, 200))
    elif bg in ("henesys", "sky", "sunset"):
        for _ in range(4):  # 픽셀 구름
            cx, cy = _next() % w, int((_next() % (ground_y // 2)) * 0.8) + 4
            cw, ch = 14 + _next() % 12, 4 + _next() % 3
            cloud = (255, 255, 255) if bg != "sunset" else (252, 232, 200)
            draw.rectangle([cx - cw // 2, cy, cx + cw // 2, cy + ch], fill=cloud)
            draw.rectangle([cx - cw // 3, cy - 2, cx + cw // 3, cy], fill=cloud)

    if bg != "paper":
        # 땅: 2톤 + 디더링 경계
        draw.rectangle([0, ground_y, w, h], fill=ground_bottom)
        draw.rectangle([0, ground_y, w, ground_y + max(2, (h - ground_y) // 3)], fill=ground_top)
        for x in range(0, w, 2):  # 경계 디더
            draw.point((x + (ground_y % 2), ground_y), fill=ground_top)

    img = img.resize(size, Image.NEAREST)
    if bg == "paper":  # 신문지 이중 테두리
        d2 = ImageDraw.Draw(img)
        d2.rectangle([8, 8, size[0] - 9, size[1] - 9], outline=INK, width=3)
        d2.rectangle([16, 16, size[0] - 17, size[1] - 17], outline=INK, width=1)
    return img


def _icon_url_from_db(ref_type: str, entity_id: int) -> str | None:
    from crawler.db import get_connection

    table = {"mob": "mobs", "npc": "npcs", "item": "items"}.get(ref_type)
    if not table:
        return None
    conn = get_connection()
    try:
        row = conn.execute(
            f"SELECT icon_url FROM {table} WHERE id=? AND icon_url IS NOT NULL", (entity_id,)
        ).fetchone()
        return row["icon_url"] if row else None
    finally:
        conn.close()


def _load_sprite(ref_type: str, entity_id: int) -> Image.Image | None:
    SPRITE_CACHE.mkdir(parents=True, exist_ok=True)
    cache = SPRITE_CACHE / f"{ref_type}_{entity_id}.png"
    if not cache.exists():
        url = _icon_url_from_db(ref_type, entity_id)
        if not url:
            return None
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MapleDataCollector/1.0"})
            cache.write_bytes(urllib.request.urlopen(req, timeout=15).read())
        except Exception as e:
            print(f"[render] 스프라이트 다운로드 실패 {ref_type}:{entity_id} — {e}")
            return None
    try:
        img = Image.open(cache).convert("RGBA")
        return img if img.getbbox() else None  # 투명 스프라이트 제외
    except Exception:
        return None


def _paste_sprite(canvas: Image.Image, spec: dict) -> None:
    sprite = _load_sprite(spec.get("type", ""), int(spec.get("id", 0)))
    if sprite is None:
        return
    scale = max(1, min(int(spec.get("scale", 3)), 8))
    # 원본이 큰 스프라이트(보스 등)는 캔버스 높이의 55%를 넘지 않게 자동 제한
    max_h = int(canvas.height * 0.55)
    if sprite.height * scale > max_h:
        scale = max(1, max_h // sprite.height)
    sprite = sprite.resize((sprite.width * scale, sprite.height * scale), Image.NEAREST)
    if spec.get("flip"):
        sprite = sprite.transpose(Image.FLIP_LEFT_RIGHT)
    # (x, y)는 0~1 비율, 스프라이트의 바닥 중앙 기준
    x = int(float(spec.get("x", 0.5)) * canvas.width - sprite.width / 2)
    y = int(float(spec.get("y", 0.85)) * canvas.height - sprite.height)
    canvas.paste(sprite, (x, y), sprite)


def _wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    lines, current = [], ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines[:2]  # 최대 2줄


def _text_outline(draw, xy, text, font, fill, outline=INK, width=2, anchor="ma"):
    x, y = xy
    for dx in range(-width, width + 1):
        for dy in range(-width, width + 1):
            if dx or dy:
                draw.text((x + dx, y + dy), text, font=font, fill=outline, anchor=anchor)
    draw.text(xy, text, font=font, fill=fill, anchor=anchor)


def _draw_bubble(canvas: Image.Image, spec: dict) -> None:
    text = str(spec.get("text", ""))[:14]
    if not text:
        return
    draw = ImageDraw.Draw(canvas)
    font = _font(22, bold=True)
    tw = draw.textlength(text, font=font)
    pad = 12
    cx = int(float(spec.get("x", 0.5)) * canvas.width)
    cy = int(float(spec.get("y", 0.3)) * canvas.height)
    x0, y0 = cx - tw // 2 - pad, cy - 22
    x1, y1 = cx + tw // 2 + pad, cy + 22
    draw.rectangle([x0, y0, x1, y1], fill=(255, 255, 255), outline=INK, width=3)
    draw.polygon([(cx - 8, y1), (cx + 8, y1), (cx, y1 + 14)], fill=(255, 255, 255), outline=INK)
    draw.text((cx, cy), text, font=font, fill=INK, anchor="mm")


def render_scene(spec: dict, kind: str = "cover") -> Image.Image:
    """연출 JSON → 합성 이미지. kind: 'cover' | 'card'"""
    size = COVER_SIZE if kind == "cover" else CARD_SIZE
    title = str(spec.get("title", ""))[:24]
    canvas = _draw_background(size, str(spec.get("bg", DEFAULT_BG)), _seed(title or "maple"))

    for sprite_spec in (spec.get("sprites") or [])[:4]:
        _paste_sprite(canvas, sprite_spec)
    for bubble_spec in (spec.get("bubbles") or [])[:3]:
        _draw_bubble(canvas, bubble_spec)

    draw = ImageDraw.Draw(canvas)
    if title:
        font = _font(44 if kind == "cover" else 33, bold=True)
        lines = _wrap(draw, title, font, size[0] - 120) or [title]
        y = 36 if kind == "cover" else 28
        for line in lines:
            _text_outline(draw, (size[0] // 2, y), line, font,
                          fill=(255, 255, 255), outline=INK, width=3, anchor="ma")
            y += (font.size + 10)

    caption = str(spec.get("caption", ""))[:40]
    if caption:
        font = _font(22)
        band_h = 40
        draw.rectangle([0, size[1] - band_h, size[0], size[1]], fill=INK)
        draw.text((size[0] // 2, size[1] - band_h // 2), caption,
                  font=font, fill=(255, 244, 224), anchor="mm")

    # 좌하단 발행 브랜드 스탬프 (제목과 겹치지 않게 하단 배치, 캡션 띠 위에 배지처럼)
    stamp_font = _font(22, bold=True)
    y1 = size[1] - 10
    draw.rectangle([14, y1 - 34, 150, y1], fill=MAPLE_ORANGE, outline=INK, width=2)
    draw.text((82, y1 - 17), "주간 메랜", font=stamp_font, fill=(255, 255, 255), anchor="mm")
    return canvas


def render_issue_images(issue: dict, out_dir: Path) -> dict[str, Path]:
    """호 JSON의 cover/card 연출을 모두 렌더. {slot: 파일경로} 반환.

    기사에 card 연출이 있으면 content에 card_slot을 심어 프론트가 참조하게 한다.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    rendered: dict[str, Path] = {}

    cover_spec = issue.get("cover")
    if isinstance(cover_spec, dict):
        path = out_dir / "cover.png"
        render_scene(cover_spec, "cover").save(path, optimize=True)
        rendered["cover"] = path

    card_idx = 0
    for section in issue.get("sections", []):
        for article in section.get("articles", []):
            card_spec = article.get("card")
            if not isinstance(card_spec, dict):
                continue
            card_idx += 1
            slot = f"card-{card_idx}"
            if not card_spec.get("title"):
                card_spec["title"] = article.get("title", "")
            path = out_dir / f"{slot}.png"
            render_scene(card_spec, "card").save(path, optimize=True)
            article["card_slot"] = slot
            rendered[slot] = path

    return rendered
