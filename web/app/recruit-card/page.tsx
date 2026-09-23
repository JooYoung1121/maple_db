"use client";

/**
 * 구인·구직 카드 메이커.
 * 합성은 전부 브라우저 캔버스에서 처리한다 — 업로드 이미지는 서버로 전송되지 않는다.
 * 서버 기능은 선택형 "AI 일러스트 변환"(Gemini 무료 티어, 디스코드 로그인 유저 월 2회)뿐이다.
 *
 * 템플릿: 모티프(번개·단풍·픽셀 밤하늘 등)를 직접 그리는 프로시저럴 8종.
 * 사전 생성 아트(web/public/recruit-card/tpl-*.png)가 존재하면 해당 템플릿의
 * 배경을 아트로 대체한다. 직업 프리셋 캐릭터(char-*.png)도 같은 방식 — 파일이
 * 있으면 선택지에 자동 노출되므로 아트 추가가 코드 배포와 분리된다.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const SIZE = 1080;

type TemplateKey =
  | "storm" | "darkknight" | "maple" | "pastel"
  | "aqua" | "snow" | "gold" | "cherry";

interface TemplateDef {
  label: string;
  base: [string, string];
  glow: string;
  accent: string;
  motif: (ctx: CanvasRenderingContext2D) => void;
  bgImage?: string; // 사전 생성 아트 (있으면 프로시저럴 배경 대신 사용)
}

// ── 모티프 드로잉 ─────────────────────────────────────────

function jaggedBolt(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, color: string, width: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "miter";
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  let cx = x, cy = y;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const steps = 6 + Math.floor(len / 140);
  for (let i = 0; i < steps; i++) {
    cx += (Math.sin(i * 2.7 + x) * 0.5 + (i % 2 === 0 ? 0.5 : -0.4)) * 70;
    cy += len / steps;
    ctx.lineTo(cx, cy);
    if (i === Math.floor(steps / 2)) {
      // 가지치기
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (x % 2 === 0 ? 90 : -90), cy + 70);
      ctx.moveTo(cx, cy);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function motifLightning(color: string) {
  return (ctx: CanvasRenderingContext2D) => {
    jaggedBolt(ctx, SIZE * 0.68, -20, 620, color, 7);
    jaggedBolt(ctx, SIZE * 0.86, -40, 540, color, 5);
    jaggedBolt(ctx, SIZE * 0.55, -30, 400, color, 3);
    jaggedBolt(ctx, SIZE * 0.12, SIZE * 0.55, 500, color, 3);
  };
}

function mapleLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  // 단순화한 5갈래 단풍잎
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
    ctx.lineTo(Math.cos(a + Math.PI / 5) * size * 0.42, Math.sin(a + Math.PI / 5) * size * 0.42);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-size * 0.06, 0, size * 0.12, size * 1.15); // 잎자루
  ctx.restore();
}

function motifMaple(ctx: CanvasRenderingContext2D) {
  const colors = ["rgba(230,90,30,0.85)", "rgba(250,150,40,0.8)", "rgba(200,60,20,0.75)", "rgba(255,190,80,0.7)"];
  const spots: [number, number, number, number][] = [
    [90, 140, 34, 0.4], [220, 90, 22, 1.2], [860, 120, 40, 2.1], [990, 260, 26, 0.8],
    [70, 460, 24, 2.6], [1000, 540, 30, 1.7], [150, 760, 20, 0.3], [940, 860, 34, 2.9],
    [620, 60, 18, 1.9], [420, 120, 24, 2.4], [560, 980, 26, 1.1], [340, 1010, 18, 0.6],
  ];
  spots.forEach(([x, y, s, r], i) => mapleLeaf(ctx, x, y, s, r, colors[i % colors.length]));
}

function motifPixelNight(ctx: CanvasRenderingContext2D) {
  const px = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  // 큰 달 (픽셀 원)
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const moonX = 880, moonY = 170, R = 110, P = 14;
  for (let gy = -R; gy <= R; gy += P) {
    for (let gx = -R; gx <= R; gx += P) {
      if (gx * gx + gy * gy <= R * R) px(moonX + gx, moonY + gy, P, P, "#fdf6d8");
    }
  }
  px(moonX - 40, moonY - 20, P * 2, P * 2, "#efe3b0");
  px(moonX + 20, moonY + 30, P, P, "#efe3b0");
  px(moonX - 10, moonY + 60, P * 1.5, P, "#efe3b0");
  // 별 (십자 픽셀)
  const stars: [number, number][] = [[120, 90], [300, 160], [520, 70], [700, 240], [180, 330], [1000, 420], [80, 620], [960, 700], [400, 950], [860, 980]];
  for (const [sx, sy] of stars) {
    px(sx, sy, 10, 10, "#fff6c8");
    px(sx - 10, sy, 10, 10, "rgba(255,246,200,0.5)");
    px(sx + 10, sy, 10, 10, "rgba(255,246,200,0.5)");
    px(sx, sy - 10, 10, 10, "rgba(255,246,200,0.5)");
    px(sx, sy + 10, 10, 10, "rgba(255,246,200,0.5)");
  }
  // 하트
  for (const [hx, hy, c] of [[240, 520, "#ff9fce"], [990, 300, "#ff8ac2"], [140, 900, "#ffb3d9"]] as [number, number, string][]) {
    px(hx, hy, 12, 12, c); px(hx + 24, hy, 12, 12, c);
    px(hx - 6, hy + 10, 48, 12, c); px(hx + 6, hy + 22, 24, 12, c); px(hx + 12, hy + 32, 12, 10, c);
  }
  // 아래 돌 플랫폼 띠
  for (let x = 0; x < SIZE; x += 56) {
    px(x, SIZE - 44, 52, 40, x % 112 === 0 ? "#3a4a7a" : "#31406b");
    px(x, SIZE - 44, 52, 8, "#8fa3d9");
  }
  ctx.restore();
}

function motifSnow(ctx: CanvasRenderingContext2D) {
  // 설산 실루엣
  ctx.fillStyle = "rgba(210,230,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(0, 1080); ctx.lineTo(0, 780); ctx.lineTo(200, 560); ctx.lineTo(360, 760);
  ctx.lineTo(540, 500); ctx.lineTo(760, 800); ctx.lineTo(1080, 620); ctx.lineTo(1080, 1080);
  ctx.closePath(); ctx.fill();
  // 눈송이
  for (const [x, y, r] of [[140, 120, 16], [420, 80, 10], [760, 150, 20], [980, 90, 12], [90, 420, 12], [1010, 380, 16], [200, 700, 10], [900, 760, 14], [520, 960, 12], [320, 300, 8]] as [number, number, number][]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
    }
    ctx.restore();
  }
}

function motifBubbles(ctx: CanvasRenderingContext2D) {
  // 대각 광선
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#bfe8ff";
  for (const x of [200, 480, 760]) {
    ctx.beginPath();
    ctx.moveTo(x, -40); ctx.lineTo(x + 130, -40); ctx.lineTo(x - 160, 1120); ctx.lineTo(x - 290, 1120);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // 물방울
  for (const [x, y, r] of [[120, 200, 26], [220, 640, 16], [90, 880, 34], [980, 180, 22], [1020, 520, 30], [930, 900, 18], [620, 1000, 24], [500, 140, 12]] as [number, number, number][]) {
    ctx.strokeStyle = "rgba(200,240,255,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2); ctx.fill();
  }
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a + Math.PI / 4) * r * 0.28, y + Math.sin(a + Math.PI / 4) * r * 0.28);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function motifGold(ctx: CanvasRenderingContext2D) {
  // 우상단 중심 방사 광선
  ctx.save();
  ctx.translate(SIZE * 0.74, SIZE * 0.28);
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#ffd876";
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(760, -46); ctx.lineTo(760, 46);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  for (const [x, y, r] of [[150, 180, 22], [340, 90, 14], [980, 480, 18], [90, 640, 16], [900, 900, 24], [520, 1000, 14], [1020, 120, 12]] as [number, number, number][]) {
    sparkle(ctx, x, y, r, "rgba(255,225,130,0.85)");
  }
}

function motifCherry(ctx: CanvasRenderingContext2D) {
  // 벚꽃잎 (타원 5장)
  const petal = (x: number, y: number, s: number, rot: number, c: string) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = c;
    for (let i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath(); ctx.ellipse(0, -s, s * 0.45, s, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#fff3b0";
    ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  const cs = ["rgba(255,170,205,0.9)", "rgba(255,140,190,0.85)", "rgba(255,200,225,0.8)"];
  ([[110, 130, 26, 0.3], [980, 100, 34, 1.2], [1010, 420, 20, 2.2], [70, 520, 24, 0.8], [170, 860, 30, 1.9], [950, 820, 22, 0.5], [560, 70, 18, 2.7], [420, 1000, 20, 1.4]] as [number, number, number, number][])
    .forEach(([x, y, s, r], i) => petal(x, y, s, r, cs[i % cs.length]));
  for (const [x, y] of [[300, 240], [820, 300], [640, 940], [220, 660]] as [number, number][]) {
    sparkle(ctx, x, y, 10, "rgba(255,220,240,0.8)");
  }
}

function motifDarkKnight(ctx: CanvasRenderingContext2D) {
  motifLightning("rgba(200,120,255,0.65)")(ctx);
  // 고딕 코너 장식
  ctx.save();
  ctx.strokeStyle = "rgba(170,90,230,0.5)";
  ctx.lineWidth = 6;
  ctx.shadowColor = "rgba(170,90,230,0.8)";
  ctx.shadowBlur = 12;
  const corner = (x: number, y: number, sx: number, sy: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y + 170 * sy);
    ctx.quadraticCurveTo(x, y, x + 170 * sx, y);
    ctx.moveTo(x + 30 * sx, y + 120 * sy);
    ctx.quadraticCurveTo(x + 40 * sx, y + 40 * sy, x + 120 * sx, y + 30 * sy);
    ctx.stroke();
  };
  corner(16, 16, 1, 1); corner(SIZE - 16, 16, -1, 1);
  corner(16, SIZE - 16, 1, -1); corner(SIZE - 16, SIZE - 16, -1, -1);
  ctx.restore();
  // 비네트
  const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 380, SIZE / 2, SIZE / 2, 800);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(10,0,20,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  storm:      { label: "초록 번개", base: ["#06170c", "#020a05"], glow: "rgba(57,255,20,0.5)",  accent: "#ffd54a", motif: motifLightning("rgba(140,255,90,0.7)"), bgImage: "/recruit-card/tpl-storm.png" },
  darkknight: { label: "다크나이트", base: ["#170627", "#06020c"], glow: "rgba(190,80,255,0.5)", accent: "#c77bff", motif: motifDarkKnight, bgImage: "/recruit-card/tpl-darkknight.png" },
  maple:      { label: "단풍", base: ["#241005", "#0d0502"], glow: "rgba(255,140,40,0.5)",  accent: "#ffcf3f", motif: motifMaple, bgImage: "/recruit-card/tpl-maple.png" },
  pastel:     { label: "픽셀 밤하늘", base: ["#232a5c", "#0d1234"], glow: "rgba(255,170,220,0.35)", accent: "#ffb3d9", motif: motifPixelNight, bgImage: "/recruit-card/tpl-pastel.png" },
  aqua:       { label: "아쿠아", base: ["#04263a", "#020d16"], glow: "rgba(90,200,255,0.45)", accent: "#8fe1ff", motif: motifBubbles, bgImage: "/recruit-card/tpl-aqua.png" },
  snow:       { label: "설원", base: ["#12213a", "#070d1a"], glow: "rgba(190,220,255,0.45)", accent: "#cfe4ff", motif: motifSnow, bgImage: "/recruit-card/tpl-snow.png" },
  gold:       { label: "골드", base: ["#211302", "#0c0701"], glow: "rgba(255,205,90,0.5)",  accent: "#ffd876", motif: motifGold, bgImage: "/recruit-card/tpl-gold.png" },
  cherry:     { label: "벚꽃", base: ["#2a0f22", "#12060f"], glow: "rgba(255,150,200,0.45)", accent: "#ffb3d9", motif: motifCherry, bgImage: "/recruit-card/tpl-cherry.png" },
};

// 직업 프리셋 캐릭터 — 파일(web/public/recruit-card/char*.png)이 있으면 자동 노출
// illust: 일러스트 13종(직접 제작·업로드) / sprite: 게임 스프라이트 12종(자쿰 투구+리버스)
interface CharPreset { key: string; label: string; src: string; group: "illust" | "sprite" }

const ILLUST_JOBS: [string, string][] = [
  ["hero", "히어로"], ["paladin", "팔라딘"], ["darkknight", "다크나이트"],
  ["bowmaster", "보우마스터"], ["marksman", "신궁"],
  ["nightlord", "나이트로드"], ["shadower", "섀도어"],
  ["archmage_il", "아크메(썬콜)"], ["archmage_fp", "아크메(불독)"],
  ["bishop", "비숍"], ["viper", "바이퍼"], ["captain", "캡틴"], ["battlemage", "배틀메이지"],
];
const SPRITE_JOBS: [string, string][] = [
  ["hero", "히어로"], ["darkknight", "다크나이트"], ["paladin", "팔라딘"],
  ["bowmaster", "보우마스터"], ["marksman", "신궁"],
  ["nightlord", "나이트로드"], ["shadower", "섀도어"],
  ["archmage", "아크메이지"], ["bishop", "비숍"],
  ["viper", "바이퍼"], ["captain", "캡틴"], ["battlemage", "배틀메이지"],
];
const CHAR_PRESETS: CharPreset[] = [
  ...ILLUST_JOBS.map(([k, label]) => ({
    key: `ai-${k}`, label, src: `/recruit-card/char-ai-${k}.png`, group: "illust" as const,
  })),
  ...SPRITE_JOBS.map(([k, label]) => ({
    key: k, label, src: `/recruit-card/char-${k}.png`, group: "sprite" as const,
  })),
];

// 직접 입력 스탯창 기본 항목
const STAT_LABELS = ["공격력", "물리방어력", "마력", "마법방어력", "명중률", "회피율", "손재주", "이동속도", "점프력"] as const;

interface InfoRow { icon: string; text: string }

interface CardState {
  mode: "구직" | "구인";
  level: string;
  job: string;
  headline: string;
  subline: string;
  pill: string;
  rows: InfoRow[];
  contact: string;
  template: TemplateKey;
  flipCharacter: boolean;
  statMode: "upload" | "input";
  stats: Record<string, string>;
}

const DEFAULT_STATE: CardState = {
  mode: "구직",
  level: "173",
  job: "신궁",
  headline: "",
  subline: "우3 구직합니다!",
  pill: "메사비 6900+ 입니다",
  rows: [
    { icon: "⭐", text: "메사비 6900+" },
    { icon: "🎯", text: "망각의길 우3" },
    { icon: "⚔️", text: "주 5일 저녁 가능" },
  ],
  contact: "관심 있으신 분은 편하게 연락 주세요!",
  template: "storm",
  flipCharacter: false,
  statMode: "upload",
  stats: { 공격력: "5651 ~ 6932", 물리방어력: "670", 마력: "91", 마법방어력: "605", 명중률: "743", 회피율: "448", 손재주: "1228", 이동속도: "140%", 점프력: "123%" },
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 메이플 스타일 스탯창을 캔버스로 직접 렌더 (직접 입력 모드) */
function drawStatWindow(ctx: CanvasRenderingContext2D, zone: { x: number; y: number; w: number; h: number }, stats: Record<string, string>, accent: string) {
  const entries = STAT_LABELS.map((l) => [l, stats[l] ?? ""] as const).filter(([, v]) => v.trim());
  if (!entries.length) return false;
  const rowH = Math.min(46, (zone.h - 52) / entries.length);
  const winH = rowH * entries.length + 40;
  const winY = zone.y + (zone.h - winH) / 2;
  // 창 본체
  ctx.save();
  roundRect(ctx, zone.x, winY, zone.w, winH, 14);
  ctx.fillStyle = "#ece9e2";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, zone.x, winY, zone.w, winH, 14);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  // 행
  let y = winY + 20;
  const labelW = zone.w * 0.4;
  for (const [label, value] of entries) {
    // 라벨 셀 (파란 그라데이션)
    const lg = ctx.createLinearGradient(0, y, 0, y + rowH - 6);
    lg.addColorStop(0, "#7aa7e8");
    lg.addColorStop(1, "#4a7fd6");
    ctx.fillStyle = lg;
    roundRect(ctx, zone.x + 16, y, labelW, rowH - 6, 6);
    ctx.fill();
    ctx.strokeStyle = "#3a66b0";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 값 셀
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, zone.x + 16 + labelW + 8, y, zone.w - labelW - 40, rowH - 6, 6);
    ctx.fill();
    ctx.strokeStyle = "#c9c4b8";
    ctx.stroke();
    // 텍스트
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.min(26, rowH - 16)}px Pretendard, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(label, zone.x + 16 + labelW / 2, y + (rowH - 6) / 2 + 1);
    ctx.textAlign = "left";
    ctx.fillStyle = label === "공격력" ? "#c0392b" : label === "명중률" ? "#5b3cc4" : "#222";
    ctx.fillText(value, zone.x + 16 + labelW + 24, y + (rowH - 6) / 2 + 1);
    y += rowH;
  }
  ctx.textBaseline = "alphabetic";
  return true;
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  s: CardState,
  characterImg: HTMLImageElement | null,
  statImg: HTMLImageElement | null,
  bgArt: HTMLImageElement | null,
) {
  const t = TEMPLATES[s.template];
  // ── 배경 ──────────────────────────────────────────────
  if (bgArt) {
    const scale = Math.max(SIZE / bgArt.width, SIZE / bgArt.height);
    const dw = bgArt.width * scale;
    const dh = bgArt.height * scale;
    ctx.drawImage(bgArt, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);
    const dim = ctx.createLinearGradient(0, 0, 0, SIZE);
    dim.addColorStop(0, "rgba(0,0,0,0.30)");
    dim.addColorStop(0.45, "rgba(0,0,0,0.12)");
    dim.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = dim;
    ctx.fillRect(0, 0, SIZE, SIZE);
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
    bg.addColorStop(0, t.base[0]);
    bg.addColorStop(1, t.base[1]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // 캐릭터 뒤 광원
    const glow = ctx.createRadialGradient(SIZE * 0.74, SIZE * 0.32, 40, SIZE * 0.74, SIZE * 0.32, 380);
    glow.addColorStop(0, t.glow);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // 템플릿 모티프
    t.motif(ctx);
  }

  // ── 상단 인사 배너 ────────────────────────────────────
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 34px Galmuri11, Pretendard, sans-serif";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 6;
  const greeting = `✦ 안녕하세요 ★ ${s.mode === "구직" ? "모집글 보고 연락드립니다" : "공대원을 모집합니다"} ✦`;
  ctx.strokeText(greeting, 48, 88);
  ctx.fillStyle = "#f5f0e0";
  ctx.fillText(greeting, 48, 88);

  // ── 헤드라인 ─────────────────────────────────────────
  const head = s.headline.trim() || `${s.level} ${s.job}`;
  ctx.font = "900 150px Pretendard, 'Apple SD Gothic Neo', sans-serif";
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 22;
  ctx.strokeText(head, 44, 250);
  const marble = ctx.createLinearGradient(0, 130, 0, 260);
  marble.addColorStop(0, "#ffffff");
  marble.addColorStop(0.55, "#d9d9d9");
  marble.addColorStop(1, "#9e9e9e");
  ctx.fillStyle = marble;
  ctx.fillText(head, 44, 250);

  ctx.font = "900 96px Pretendard, 'Apple SD Gothic Neo', sans-serif";
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 18;
  ctx.strokeText(s.subline, 46, 372);
  const gold = ctx.createLinearGradient(0, 300, 0, 380);
  gold.addColorStop(0, "#ffe97a");
  gold.addColorStop(1, "#f5a623");
  ctx.fillStyle = gold;
  ctx.fillText(s.subline, 46, 372);

  // ── 알약 강조 ─────────────────────────────────────────
  if (s.pill.trim()) {
    ctx.font = "800 56px Pretendard, sans-serif";
    const pw = Math.min(ctx.measureText(s.pill).width + 96, 660);
    roundRect(ctx, 46, 412, pw, 96, 20);
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fill();
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fillText(s.pill, 46 + 48, 412 + 66);
  }

  // ── 캐릭터 이미지 (우측) ──────────────────────────────
  if (characterImg) {
    const zone = { x: SIZE * 0.55, y: 60, w: SIZE * 0.43, h: 560 };
    const scale = Math.min(zone.w / characterImg.width, zone.h / characterImg.height);
    const dw = characterImg.width * scale;
    const dh = characterImg.height * scale;
    const dx = zone.x + (zone.w - dw) / 2;
    const dy = zone.y + (zone.h - dh) / 2;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 30;
    if (s.flipCharacter) {
      ctx.translate(dx + dw / 2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(characterImg, -dw / 2, dy, dw, dh);
    } else {
      ctx.drawImage(characterImg, dx, dy, dw, dh);
    }
    ctx.restore();
  }

  // ── 스탯창 (좌하단): 업로드 or 직접 입력 렌더 ─────────
  const statZone = { x: 46, y: 548, w: 560, h: 470 };
  let statDrawn = false;
  if (s.statMode === "input") {
    statDrawn = drawStatWindow(ctx, statZone, s.stats, t.accent);
  } else if (statImg) {
    const scale = Math.min(statZone.w / statImg.width, statZone.h / statImg.height);
    const dw = statImg.width * scale;
    const dh = statImg.height * scale;
    const dx = statZone.x + (statZone.w - dw) / 2;
    const dy = statZone.y + (statZone.h - dh) / 2;
    ctx.save();
    roundRect(ctx, dx - 10, dy - 10, dw + 20, dh + 20, 18);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.restore();
    roundRect(ctx, dx - 10, dy - 10, dw + 20, dh + 20, 18);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.save();
    roundRect(ctx, dx, dy, dw, dh, 10);
    ctx.clip();
    ctx.drawImage(statImg, dx, dy, dw, dh);
    ctx.restore();
    statDrawn = true;
  }
  if (!statDrawn) {
    roundRect(ctx, statZone.x, statZone.y, statZone.w, statZone.h, 18);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.setLineDash([12, 10]);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "600 34px Pretendard, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "center";
    ctx.fillText("스탯창 캡쳐 업로드 또는 직접 입력", statZone.x + statZone.w / 2, statZone.y + statZone.h / 2);
    ctx.textAlign = "left";
  }

  // ── 우하단 정보 패널 ─────────────────────────────────
  const panel = { x: 646, y: 588, w: 388, h: 430 };
  roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 24);
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fill();
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  const rows = s.rows.filter((r) => r.text.trim());
  const contactLines = s.contact.trim() ? [s.contact.trim()] : [];
  const totalRows = rows.length + (contactLines.length ? 1 : 0);
  const rowH = totalRows > 0 ? Math.min(96, (panel.h - 60) / totalRows) : 96;
  let ry = panel.y + 56;
  ctx.textBaseline = "middle";
  for (const row of rows) {
    ctx.font = "52px 'Apple Color Emoji', sans-serif";
    ctx.fillText(row.icon, panel.x + 30, ry + rowH / 2 - 26);
    ctx.font = "800 44px Pretendard, sans-serif";
    ctx.fillStyle = "#fff";
    const text = row.text.length > 12 ? row.text.slice(0, 12) : row.text;
    ctx.fillText(text, panel.x + 106, ry + rowH / 2 - 26);
    ry += rowH;
    if (rows.indexOf(row) < rows.length - 1 || contactLines.length) {
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(panel.x + 24, ry - 14);
      ctx.lineTo(panel.x + panel.w - 24, ry - 14);
      ctx.stroke();
    }
  }
  if (contactLines.length) {
    ctx.font = "52px 'Apple Color Emoji', sans-serif";
    ctx.fillText("💬", panel.x + 30, ry + rowH / 2 - 26);
    ctx.font = "700 34px Pretendard, sans-serif";
    ctx.fillStyle = "#ffe9b0";
    const text = contactLines[0];
    const mid = text.length > 13 ? Math.ceil(text.length / 2) : text.length;
    let split = mid;
    if (text.length > 13) {
      const space = text.lastIndexOf(" ", mid + 2);
      split = space > 4 ? space : mid;
    }
    ctx.fillText(text.slice(0, split).trim(), panel.x + 106, ry + rowH / 2 - 44);
    if (split < text.length) ctx.fillText(text.slice(split).trim(), panel.x + 106, ry + rowH / 2 - 2);
  }
  ctx.textBaseline = "alphabetic";

  // ── 푸터 ─────────────────────────────────────────────
  ctx.font = "600 26px Galmuri11, monospace";
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 4;
  ctx.strokeText("made with 추억길드 메랜정보", 46, SIZE - 28);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("made with 추억길드 메랜정보", 46, SIZE - 28);
}

function useImage(): [HTMLImageElement | null, (file: File | string | null) => void] {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const load = useCallback((src: File | string | null) => {
    if (!src) { setImg(null); return; }
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    const el = new Image();
    el.onload = () => setImg(el);
    el.src = url;
  }, []);
  return [img, load];
}

export default function RecruitCardPage() {
  const [state, setState] = useState<CardState>(DEFAULT_STATE);
  const [characterImg, loadCharacter] = useImage();
  const [statImg, loadStat] = useImage();
  const [characterFile, setCharacterFile] = useState<string | null>(null);
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLoggedIn, setAiLoggedIn] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [bgArts, setBgArts] = useState<Partial<Record<TemplateKey, HTMLImageElement>>>({});
  const [charPresets, setCharPresets] = useState<Record<string, HTMLImageElement>>({});
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 사전 생성 자산 로드 — 없는 항목은 선택지에서 숨김
  useEffect(() => {
    (Object.keys(TEMPLATES) as TemplateKey[]).forEach((key) => {
      const src = TEMPLATES[key].bgImage;
      if (!src) return;
      const el = new Image();
      el.onload = () => setBgArts((m) => ({ ...m, [key]: el }));
      el.src = src;
    });
    CHAR_PRESETS.forEach(({ key, src }) => {
      const el = new Image();
      el.onload = () => setCharPresets((m) => ({ ...m, [key]: el }));
      el.src = src;
    });
  }, []);

  useEffect(() => {
    fetch("/api/recruit-card/quota", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setAiRemaining(d.remaining ?? null);
        setAiLoggedIn(Boolean(d.logged_in));
        setAiEnabled(Boolean(d.enabled) && !d.global_exhausted);
      })
      .catch(() => setAiEnabled(false));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bgArt = bgArts[state.template] ?? null;
    drawCard(ctx, state, characterImg, statImg, bgArt);
    document.fonts?.ready?.then(() => drawCard(ctx, state, characterImg, statImg, bgArt));
  }, [state, characterImg, statImg, bgArts]);

  const onCharacterFile = (file: File | null) => {
    loadCharacter(file);
    setActivePreset(null);
    if (!file) { setCharacterFile(null); return; }
    const reader = new FileReader();
    reader.onload = () => setCharacterFile(String(reader.result));
    reader.readAsDataURL(file);
  };

  const pickPreset = (p: CharPreset) => {
    setActivePreset(p.key);
    setCharacterFile(null);
    loadCharacter(p.src);
  };

  const generateAI = async () => {
    if (!characterFile) { setAiError("먼저 캐릭터 캡쳐를 업로드해주세요."); return; }
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch("/api/recruit-card/illustration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: characterFile, job: state.job }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "생성에 실패했습니다.");
      loadCharacter(data.image);
      setAiRemaining(data.remaining ?? null);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "생성에 실패했습니다.");
    } finally {
      setAiBusy(false);
    }
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `메랜카드_${state.level}${state.job}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  const set = <K extends keyof CardState>(key: K, value: CardState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const inputCls = "w-full border-2 border-edge bg-surface px-3 py-2 text-sm text-ink";
  const availablePresets = CHAR_PRESETS.filter((p) => charPresets[p.key]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold text-ink md:text-3xl font-pixel">구인구직 카드 메이커</h1>
        <p className="max-w-3xl text-sm leading-6 text-dim">
          스탯·캐릭터와 몇 가지 정보만 넣으면 공대 구인·구직 홍보 카드를 만들어 드립니다.
          <strong className="text-ink"> 이미지 합성은 전부 브라우저 안에서 처리되며 서버로 전송되지 않습니다</strong>
          (선택형 AI 일러스트 변환만 서버를 거칩니다).
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* ── 입력 폼 ── */}
        <section className="pixel-panel space-y-4 p-5">
          <div className="flex gap-2">
            {(["구직", "구인"] as const).map((m) => (
              <button key={m} type="button" onClick={() => set("mode", m)}
                className={`min-h-11 flex-1 border-2 px-3 font-pixel text-sm font-bold ${state.mode === m ? "border-maple text-maple bg-surface2" : "border-edge text-ink"}`}>
                {m === "구직" ? "🙋 구직 (자리 구해요)" : "📣 구인 (사람 구해요)"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-dim">레벨
              <input className={inputCls} value={state.level} onChange={(e) => set("level", e.target.value)} placeholder="173" />
            </label>
            <label className="text-xs text-dim">직업
              <input className={inputCls} value={state.job} onChange={(e) => set("job", e.target.value)} placeholder="신궁" />
            </label>
          </div>
          <label className="block text-xs text-dim">노란 문구 (핵심 한 줄)
            <input className={inputCls} value={state.subline} onChange={(e) => set("subline", e.target.value)} placeholder="우3 구직합니다!" />
          </label>
          <label className="block text-xs text-dim">강조 알약 (비우면 숨김)
            <input className={inputCls} value={state.pill} onChange={(e) => set("pill", e.target.value)} placeholder="메사비 6900+ 입니다" />
          </label>
          <div className="space-y-2">
            <p className="text-xs text-dim">정보 행 (아이콘 + 12자 이내)</p>
            {state.rows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input className="w-14 border-2 border-edge bg-surface px-2 py-2 text-center" value={row.icon}
                  onChange={(e) => { const rows = [...state.rows]; rows[i] = { ...row, icon: e.target.value }; set("rows", rows); }} />
                <input className={inputCls} value={row.text} maxLength={12}
                  onChange={(e) => { const rows = [...state.rows]; rows[i] = { ...row, text: e.target.value }; set("rows", rows); }} />
              </div>
            ))}
          </div>
          <label className="block text-xs text-dim">연락 문구
            <input className={inputCls} value={state.contact} onChange={(e) => set("contact", e.target.value)} />
          </label>

          {/* ── 캐릭터 ── */}
          <div className="space-y-2 border-t-2 border-edge pt-4">
            <p className="text-xs font-bold text-ink">캐릭터</p>
            {(["illust", "sprite"] as const).map((group) => {
              const items = availablePresets.filter((p) => p.group === group);
              if (!items.length) return null;
              return (
                <div key={group}>
                  <p className="mb-1 text-xs text-dim">
                    {group === "illust" ? "🎨 일러스트 프리셋" : "👾 게임 스프라이트 프리셋"} (스샷 없이 바로 사용)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((p) => (
                      <button key={p.key} type="button" onClick={() => pickPreset(p)}
                        className={`min-h-9 border-2 px-2 text-xs ${activePreset === p.key ? "border-maple text-maple" : "border-edge text-ink"}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <label className="block text-xs text-dim">직접 업로드 (캡쳐 또는 일러스트)
              <input type="file" accept="image/png,image/jpeg,image/webp" className="mt-1 block w-full text-xs text-dim"
                onChange={(e) => onCharacterFile(e.target.files?.[0] ?? null)} />
            </label>
            {aiLoggedIn ? (
              <button type="button" onClick={generateAI} disabled={!aiEnabled || aiBusy || !characterFile || (aiRemaining !== null && aiRemaining <= 0)}
                className="min-h-11 w-full border-2 border-maple px-3 font-pixel text-sm font-bold text-maple disabled:opacity-40 hover:bg-surface2">
                {aiBusy ? "일러스트 생성 중… (최대 1분)" : `✨ 내 캡쳐를 AI 치비 일러스트로${aiRemaining !== null ? ` (이번 달 ${aiRemaining}회)` : ""}`}
              </button>
            ) : (
              <a href={`/api/auth/discord/login?next=${encodeURIComponent("/recruit-card")}`}
                className="block min-h-11 w-full border-2 border-maple px-3 py-2.5 text-center font-pixel text-sm font-bold text-maple hover:bg-surface2">
                ✨ AI 치비 변환은 디스코드 로그인 후 (월 2회)
              </a>
            )}
            {aiLoggedIn && !aiEnabled && <p className="text-xs text-dim">AI 변환은 준비 중이거나 이번 달 무료분이 소진됐습니다 — 프리셋·직접 업로드는 언제나 가능해요.</p>}
            {aiError && <p className="text-xs text-red-500">{aiError}</p>}
            <label className="flex items-center gap-2 text-xs text-dim">
              <input type="checkbox" checked={state.flipCharacter} onChange={(e) => set("flipCharacter", e.target.checked)} />
              캐릭터 좌우 반전
            </label>
          </div>

          {/* ── 스탯창 ── */}
          <div className="space-y-2 border-t-2 border-edge pt-4">
            <p className="text-xs font-bold text-ink">스탯창</p>
            <div className="flex gap-2">
              {(["upload", "input"] as const).map((m) => (
                <button key={m} type="button" onClick={() => set("statMode", m)}
                  className={`min-h-10 flex-1 border-2 px-2 text-sm ${state.statMode === m ? "border-maple text-maple bg-surface2" : "border-edge text-ink"}`}>
                  {m === "upload" ? "📷 스샷 업로드" : "⌨️ 직접 입력"}
                </button>
              ))}
            </div>
            {state.statMode === "upload" ? (
              <label className="block text-xs text-dim">스탯창 캡쳐
                <input type="file" accept="image/png,image/jpeg,image/webp" className="mt-1 block w-full text-xs text-dim"
                  onChange={(e) => loadStat(e.target.files?.[0] ?? null)} />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {STAT_LABELS.map((label) => (
                  <label key={label} className="text-[11px] text-dim">{label}
                    <input className={inputCls} value={state.stats[label] ?? ""}
                      onChange={(e) => set("stats", { ...state.stats, [label]: e.target.value })}
                      placeholder="비우면 행 숨김" />
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── 템플릿 ── */}
          <div className="border-t-2 border-edge pt-4">
            <p className="mb-2 text-xs text-dim">배경 템플릿</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
                <button key={k} type="button" onClick={() => set("template", k)}
                  className={`min-h-10 border-2 px-1 text-xs ${state.template === k ? "border-maple text-maple" : "border-edge text-ink"}`}>
                  {bgArts[k] ? "🎨" : ""}{TEMPLATES[k].label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-dim">🎨 표시는 일러스트 배경 적용 — 프리셋 아트가 순차 추가됩니다</p>
          </div>

          <button type="button" onClick={download}
            className="pixel-btn min-h-12 w-full border-2 border-maple bg-[color-mix(in_srgb,var(--c-maple)_18%,transparent)] px-4 font-pixel text-base font-bold text-amber-900 dark:text-maple">
            📥 PNG로 저장 (1080×1080)
          </button>
        </section>

        {/* ── 미리보기 ── */}
        <section className="pixel-panel p-5">
          <p className="mb-3 text-xs text-dim">미리보기 — 입력하면 실시간으로 반영됩니다</p>
          <canvas ref={canvasRef} width={SIZE} height={SIZE} className="w-full max-w-[640px] border-2 border-edge" />
        </section>
      </div>
    </div>
  );
}
