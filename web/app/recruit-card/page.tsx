"use client";

/**
 * 구인·구직 카드 메이커.
 * 합성은 전부 브라우저 캔버스에서 처리한다 — 업로드 이미지는 서버로 전송되지 않는다.
 * 유일한 서버 기능은 선택형 "AI 일러스트 변환"(Gemini 무료 티어, 일 3회)뿐이다.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const SIZE = 1080;

type TemplateKey = "storm" | "maple" | "night";

const TEMPLATES: Record<TemplateKey, {
  label: string;
  base: [string, string];      // 배경 그라데이션 (위, 아래)
  glow: string;                // 캐릭터 뒤 광원
  streak: string;              // 에너지 스트로크
  accent: string;              // 포인트(노랑 계열 유지하되 템플릿별 톤)
}> = {
  storm: { label: "번개", base: ["#04120a", "#020604"], glow: "rgba(57,255,20,0.55)", streak: "rgba(120,255,80,0.5)", accent: "#ffd54a" },
  maple: { label: "단풍", base: ["#1c0b02", "#0a0301"], glow: "rgba(255,140,40,0.55)", streak: "rgba(255,180,80,0.5)", accent: "#ffcf3f" },
  night: { label: "밤하늘", base: ["#0a0a24", "#030310"], glow: "rgba(140,120,255,0.55)", streak: "rgba(170,150,255,0.5)", accent: "#ffe066" },
};

interface InfoRow { icon: string; text: string }

interface CardState {
  mode: "구직" | "구인";
  level: string;
  job: string;
  headline: string;      // 비우면 "{level} {job}" 사용
  subline: string;       // 노란 큰 줄 (기본: 우3 구직합니다!)
  pill: string;          // 알약 강조 (예: 메사비 6900+ 입니다)
  rows: InfoRow[];
  contact: string;
  template: TemplateKey;
  flipCharacter: boolean;
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

function drawCard(
  ctx: CanvasRenderingContext2D,
  s: CardState,
  characterImg: HTMLImageElement | null,
  statImg: HTMLImageElement | null,
) {
  const t = TEMPLATES[s.template];
  // ── 배경 ──────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
  bg.addColorStop(0, t.base[0]);
  bg.addColorStop(1, t.base[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 에너지 스트로크 (우측 상단 캐릭터 존 중심)
  ctx.save();
  ctx.translate(SIZE * 0.74, SIZE * 0.3);
  for (let i = 0; i < 14; i++) {
    const angle = (Math.PI * 2 * i) / 14 + 0.4;
    const len = 180 + (i % 4) * 90;
    ctx.strokeStyle = t.streak;
    ctx.globalAlpha = 0.12 + (i % 3) * 0.08;
    ctx.lineWidth = 3 + (i % 3) * 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 60, Math.sin(angle) * 60);
    ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // 캐릭터 뒤 광원
  const glow = ctx.createRadialGradient(SIZE * 0.74, SIZE * 0.32, 40, SIZE * 0.74, SIZE * 0.32, 380);
  glow.addColorStop(0, t.glow);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── 상단 인사 배너 ────────────────────────────────────
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 34px Galmuri11, Pretendard, sans-serif";
  ctx.fillStyle = "#f5f0e0";
  const greeting = `✦ 안녕하세요 ★ ${s.mode === "구직" ? "모집글 보고 연락드립니다" : "공대원을 모집합니다"} ✦`;
  ctx.fillText(greeting, 48, 88);

  // ── 헤드라인 ─────────────────────────────────────────
  const head = s.headline.trim() || `${s.level} ${s.job}`;
  ctx.font = "900 150px Pretendard, 'Apple SD Gothic Neo', sans-serif";
  ctx.lineJoin = "round";
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

  // ── 스탯창 캡쳐 (좌하단) ──────────────────────────────
  const statZone = { x: 46, y: 548, w: 560, h: 470 };
  if (statImg) {
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
  } else {
    roundRect(ctx, statZone.x, statZone.y, statZone.w, statZone.h, 18);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.setLineDash([12, 10]);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "600 38px Pretendard, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "center";
    ctx.fillText("스탯창 캡쳐를 올려주세요", statZone.x + statZone.w / 2, statZone.y + statZone.h / 2);
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
    // 두 줄 줄바꿈
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
  ctx.fillStyle = "rgba(255,255,255,0.45)";
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
  const [characterFile, setCharacterFile] = useState<string | null>(null); // AI 변환용 data URL
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch("/api/recruit-card/quota")
      .then((r) => r.json())
      .then((d) => { setAiRemaining(d.remaining ?? null); setAiEnabled(Boolean(d.enabled) && !d.global_exhausted); })
      .catch(() => setAiEnabled(false));
  }, []);

  // 렌더 루프 — 상태·이미지 변경 시 다시 그림 (폰트 로드 후 1회 재렌더)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawCard(ctx, state, characterImg, statImg);
    document.fonts?.ready?.then(() => drawCard(ctx, state, characterImg, statImg));
  }, [state, characterImg, statImg]);

  const onCharacterFile = (file: File | null) => {
    loadCharacter(file);
    if (!file) { setCharacterFile(null); return; }
    const reader = new FileReader();
    reader.onload = () => setCharacterFile(String(reader.result));
    reader.readAsDataURL(file);
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold text-ink md:text-3xl font-pixel">구인구직 카드 메이커</h1>
        <p className="max-w-3xl text-sm leading-6 text-dim">
          스탯창·캐릭터 캡쳐와 몇 가지 정보만 넣으면 공대 구인·구직 홍보 카드를 만들어 드립니다.
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

          <div className="space-y-2 border-t-2 border-edge pt-4">
            <label className="block text-xs text-dim">캐릭터 이미지 (캡쳐 또는 일러스트)
              <input type="file" accept="image/png,image/jpeg,image/webp" className="mt-1 block w-full text-xs text-dim"
                onChange={(e) => onCharacterFile(e.target.files?.[0] ?? null)} />
            </label>
            <button type="button" onClick={generateAI} disabled={!aiEnabled || aiBusy || (aiRemaining !== null && aiRemaining <= 0)}
              className="min-h-11 w-full border-2 border-maple px-3 font-pixel text-sm font-bold text-maple disabled:opacity-40 hover:bg-surface2">
              {aiBusy ? "일러스트 생성 중… (최대 1분)" : `✨ AI 치비 일러스트로 변환${aiRemaining !== null ? ` (오늘 ${aiRemaining}회 남음)` : ""}`}
            </button>
            {!aiEnabled && <p className="text-xs text-dim">AI 변환은 준비 중이거나 오늘 무료분이 소진됐습니다 — 직접 만든 일러스트 업로드는 언제나 가능해요.</p>}
            {aiError && <p className="text-xs text-red-500">{aiError}</p>}
            <label className="flex items-center gap-2 text-xs text-dim">
              <input type="checkbox" checked={state.flipCharacter} onChange={(e) => set("flipCharacter", e.target.checked)} />
              캐릭터 좌우 반전
            </label>
            <label className="block text-xs text-dim">스탯창 캡쳐
              <input type="file" accept="image/png,image/jpeg,image/webp" className="mt-1 block w-full text-xs text-dim"
                onChange={(e) => loadStat(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <div className="border-t-2 border-edge pt-4">
            <p className="mb-2 text-xs text-dim">배경 템플릿</p>
            <div className="flex gap-2">
              {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
                <button key={k} type="button" onClick={() => set("template", k)}
                  className={`min-h-10 flex-1 border-2 px-2 text-sm ${state.template === k ? "border-maple text-maple" : "border-edge text-ink"}`}>
                  {TEMPLATES[k].label}
                </button>
              ))}
            </div>
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
