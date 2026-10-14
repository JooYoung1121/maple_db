"use client";

/* 시뮬레이터 공용 키트 — 혼줌(/chaos)·주문서(/scroll-sim) 시뮬레이터가 같은 틀을 쓴다 (v4.15.0).
 *
 * 구성 (maplelog.gg 아이템 강화 화면의 정보 배치를 참고):
 *  - SimItemCard   : 왼쪽 아이템 카드 — 아이콘 · REQ(레벨/직업) · 옵션(기본 → 현재) · 업그레이드 가능 횟수
 *  - SimActionCard : "① 주문서 강화"의 카드형 버튼 — 아이콘 · 단축키 · 이름 · 설명
 *  - SimLedger     : "② 사용 내역" — 누적 개수 × 단가 = 비용, 거래소 시세 자동 단가, 합계
 *  - SimLog        : 하단 "기록" 터미널 패널 — 한 줄씩 쌓이는 로그 · 단축키 안내 · 사운드 토글
 *  - useSimLog / useSimSound / useSimHotkeys : 로그 상태, WebAudio 효과음, 전역 단축키
 *  - SimToolbar    : 상단 바 — 뒤로가기 · 제목 · 링크 복사
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { hideIconOnError } from "@/lib/icons";
import type { MarketUnitPrice } from "@/lib/useMarketPrice";

/* ───────────────────────── 아이템 카드 ───────────────────────── */

export interface SimStatLine {
  label: string;
  base: number;
  current: number;
  /** 수치 단위 표기 (예: "%") */
  unit?: string;
}

export interface SimItemCardProps {
  name: string;
  subName?: string | null;     // 영문명 등
  icon?: string | null;
  reqLevel?: number | null;
  jobReq?: string | null;      // "공용" · "전사" …
  category?: string | null;    // 장비분류
  stats: SimStatLine[];
  slotsTotal: number;
  slotsUsed: number;
  note?: ReactNode;            // 카드 아래 짧은 안내
  children?: ReactNode;        // 접이식 추가 정보 등
}

export function SimItemCard(p: SimItemCardProps) {
  const remaining = Math.max(0, p.slotsTotal - p.slotsUsed);
  return (
    <aside className="pixel-panel p-4 space-y-3" aria-label="대상 아이템 정보">
      <h2 className="font-pixel text-sm text-ink text-center truncate" title={p.name}>{p.name}</h2>
      {p.subName && <p className="text-[11px] text-dim text-center -mt-2 truncate">{p.subName}</p>}
      <div className="flex items-start gap-3">
        <div className="w-20 h-20 shrink-0 bg-surface2 border-2 border-edge flex items-center justify-center">
          {p.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.icon} alt="" className="w-14 h-14 object-contain [image-rendering:pixelated]" onError={hideIconOnError} />
          ) : (
            <span className="text-2xl text-dim">◇</span>
          )}
        </div>
        <dl className="text-[11px] leading-5 min-w-0">
          <div className="flex gap-2"><dt className="text-dim w-16 shrink-0">REQ LEV</dt><dd className="text-ink font-mono">{p.reqLevel ?? "-"}</dd></div>
          <div className="flex gap-2"><dt className="text-dim w-16 shrink-0">REQ JOB</dt><dd className="text-ink truncate">{p.jobReq || "공용"}</dd></div>
          <div className="flex gap-2"><dt className="text-dim w-16 shrink-0">분류</dt><dd className="text-ink truncate">{p.category ?? "-"}</dd></div>
          <div className="flex gap-2"><dt className="text-dim w-16 shrink-0">업횟</dt><dd className="font-mono"><span className={remaining === 0 ? "text-red-500" : "text-maple"}>{remaining}</span><span className="text-dim"> / {p.slotsTotal}</span></dd></div>
        </dl>
      </div>
      <div className="border-t-2 border-edge pt-2">
        {p.stats.length === 0 ? (
          <p className="text-[11px] text-dim text-center py-2">표시할 옵션이 없습니다</p>
        ) : (
          <ul className="space-y-0.5">
            {p.stats.map((s) => {
              const d = s.current - s.base;
              return (
                <li key={s.label} className="flex items-baseline justify-between text-xs px-1">
                  <span className="text-dim">{s.label}</span>
                  <span className="font-mono">
                    <span className={d > 0 ? "text-green-500 font-bold" : d < 0 ? "text-red-500 font-bold" : "text-ink"}>+{s.current}{s.unit ?? ""}</span>
                    {d !== 0 && <span className="text-[10px] text-dim ml-1">({d > 0 ? "+" : ""}{d})</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-2 flex gap-0.5" aria-label="업그레이드 횟수 게이지">
          {Array.from({ length: p.slotsTotal }).map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 ${i < p.slotsUsed ? "bg-maple" : "bg-edge"}`} />
          ))}
        </div>
      </div>
      {p.note && <div className="text-[11px] text-dim leading-relaxed">{p.note}</div>}
      {p.children}
    </aside>
  );
}

/* ───────────────────────── 액션 카드 ───────────────────────── */

export interface SimActionCardProps {
  icon: ReactNode;           // <img> 또는 이모지
  hotkey?: string;           // "A" · "R" · "Space"
  title: string;
  subtitle?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;          // 선택형 카드(주문서 % 선택)에서 현재 선택
  tone?: "primary" | "neutral" | "danger";
  className?: string;
}

export function SimActionCard(p: SimActionCardProps) {
  const toneCls = p.active
    ? "border-maple bg-[color-mix(in_srgb,var(--c-maple)_12%,transparent)]"
    : p.tone === "danger"
      ? "border-edge bg-surface2 hover:border-red-400"
      : "border-edge bg-surface2 hover:border-maple/70";
  return (
    <button
      type="button"
      onClick={p.onClick}
      disabled={p.disabled}
      className={`relative flex flex-col items-center justify-center gap-1 px-3 py-4 border-2 text-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-[120px] ${toneCls} ${p.className ?? ""}`}
    >
      {p.hotkey && (
        <span className={`absolute top-1.5 right-1.5 font-pixel text-[10px] px-1 border ${p.active ? "border-maple text-maple" : "border-edge text-dim"}`}>{p.hotkey}</span>
      )}
      <span className="h-10 flex items-center justify-center text-2xl">{p.icon}</span>
      <span className={`font-pixel text-xs ${p.active ? "text-maple" : "text-ink"}`}>{p.title}</span>
      {p.subtitle && <span className="text-[10px] text-dim leading-tight">{p.subtitle}</span>}
    </button>
  );
}

/* ───────────────────────── 사용 내역 ───────────────────────── */

export interface SimLedgerRow {
  key: string;
  icon?: string | null;
  label: string;
  count: number;
  unitPrice: number | null;          // 메소. null = 미입력
  market?: MarketUnitPrice | null;   // 거래소 시세 (있으면 자동 채움 버튼)
}

export interface SimLedgerProps {
  rows: SimLedgerRow[];
  onUnitPriceChange: (key: string, price: number | null) => void;
  onResetAll: () => void;
  resetHotkey?: string;
  footnote?: ReactNode;
}

export function formatMeso(n: number): string {
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${(n / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}억`;
  if (abs >= 10_000) return `${(n / 10_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만`;
  return n.toLocaleString("ko-KR");
}

export function SimLedger(p: SimLedgerProps) {
  const total = p.rows.reduce((sum, r) => sum + r.count * (r.unitPrice ?? 0), 0);
  const missing = p.rows.some((r) => r.count > 0 && r.unitPrice === null);
  return (
    <section className="pixel-panel p-4 space-y-3" aria-label="사용 내역">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-pixel text-sm text-ink">② 사용 내역</h2>
        <span className="text-[11px] text-dim">누적 개수 × 단가 = 비용</span>
      </div>
      <ul className="space-y-1.5">
        {p.rows.map((r) => {
          const cost = r.count * (r.unitPrice ?? 0);
          return (
            <li key={r.key} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-7 h-7 shrink-0 flex items-center justify-center bg-surface2 border border-edge">
                {r.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.icon} alt="" className="w-6 h-6 object-contain [image-rendering:pixelated]" onError={hideIconOnError} />
                ) : "◇"}
              </span>
              <span className="text-ink min-w-0 flex-1 sm:flex-none sm:w-44 truncate" title={r.label}>{r.label}</span>
              <span className="font-mono text-ink w-12 text-right">× {r.count}</span>
              <div className="flex items-center gap-1 flex-1 min-w-[160px]">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  inputMode="numeric"
                  value={r.unitPrice ?? ""}
                  placeholder="단가 (메소)"
                  onChange={(e) => {
                    const v = e.target.value;
                    p.onUnitPriceChange(r.key, v === "" ? null : Math.max(0, Math.floor(Number(v) || 0)));
                  }}
                  className="pixel-input flex-1 px-2 py-1.5 text-right text-xs font-mono"
                  aria-label={`${r.label} 단가`}
                />
                {r.market && r.unitPrice !== r.market.price && (
                  <button
                    type="button"
                    onClick={() => p.onUnitPriceChange(r.key, r.market!.price)}
                    className="shrink-0 px-1.5 py-1 border border-edge text-[10px] text-maple hover:border-maple whitespace-nowrap"
                    title={`거래소 ${r.market.time} 판매 매물 ${r.market.count}건 평균`}
                  >
                    시세 {formatMeso(r.market.price)}
                  </button>
                )}
              </div>
              <span className="font-mono text-ink w-20 text-right">{r.unitPrice === null ? <span className="text-dim">-</span> : formatMeso(cost)}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge pt-2">
        <button type="button" onClick={p.onResetAll} className="pixel-card px-3 py-1.5 font-pixel text-[11px] text-dim hover:text-maple">
          전체 리셋{p.resetHotkey ? ` (${p.resetHotkey})` : ""}
        </button>
        <span className="text-sm">
          합계 <b className="text-maple font-mono">{formatMeso(total)}</b> 메소
          {missing && <span className="text-[10px] text-dim ml-1">(단가 미입력 항목 제외)</span>}
        </span>
      </div>
      {p.footnote && <p className="text-[10px] text-dim">{p.footnote}</p>}
    </section>
  );
}

/* ───────────────────────── 기록 로그 ───────────────────────── */

export type SimLogTone = "ok" | "fail" | "info" | "warn" | "best";

export interface SimLogEntry {
  id: number;
  time: string;
  text: string;
  tone: SimLogTone;
}

const TONE_CLS: Record<SimLogTone, string> = {
  ok: "text-green-500",
  fail: "text-red-400",
  info: "text-dim",
  warn: "text-amber-500",
  best: "text-maple font-bold",
};

const MAX_LOG = 300;

export function useSimLog() {
  const [entries, setEntries] = useState<SimLogEntry[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, tone: SimLogTone = "info") => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    seq.current += 1;
    const entry: SimLogEntry = { id: seq.current, time, text, tone };
    setEntries((prev) => [entry, ...prev].slice(0, MAX_LOG));
  }, []);
  const clear = useCallback(() => setEntries([]), []);
  return { entries, push, clear };
}

export interface SimLogProps {
  entries: SimLogEntry[];
  hotkeyLegend: string;          // "A · R · V · M"
  soundOn: boolean;
  onToggleSound: () => void;
  onClear: () => void;
}

export function SimLog(p: SimLogProps) {
  return (
    <section className="pixel-panel overflow-hidden" aria-label="기록">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b-2 border-edge bg-surface2">
        <div className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden>
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </span>
          <h2 className="font-pixel text-sm text-ink">기록</h2>
          <span className="text-[10px] text-dim">{p.entries.length}줄</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-dim">
          <span className="hidden sm:inline font-mono tracking-wide">{p.hotkeyLegend}</span>
          <button type="button" onClick={p.onToggleSound} className={`px-1.5 py-0.5 border ${p.soundOn ? "border-maple text-maple" : "border-edge"}`} title="효과음 (M)" aria-pressed={p.soundOn}>
            {p.soundOn ? "🔊" : "🔇"}
          </button>
          {p.entries.length > 0 && (
            <button type="button" onClick={p.onClear} className="hover:text-maple">지우기</button>
          )}
        </div>
      </div>
      <div className="h-48 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-5 bg-[#0d0f14] text-[#c9d1d9]">
        {p.entries.length === 0 ? (
          <p className="text-dim">기록이 없습니다</p>
        ) : (
          p.entries.map((e) => (
            <p key={e.id} className="whitespace-pre-wrap break-words">
              <span className="text-[#5c6370] mr-2">{e.time}</span>
              <span className={TONE_CLS[e.tone]}>{e.text}</span>
            </p>
          ))
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── 효과음 ───────────────────────── */

type SoundKind = "success" | "fail" | "click" | "fanfare";
const SOUND_PREF_KEY = "sim_sound_on";

export function useSimSound() {
  const [enabled, setEnabled] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try { setEnabled(localStorage.getItem(SOUND_PREF_KEY) === "1"); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((v) => {
      try { localStorage.setItem(SOUND_PREF_KEY, v ? "0" : "1"); } catch { /* ignore */ }
      return !v;
    });
  }, []);

  const play = useCallback((kind: SoundKind) => {
    if (!enabled) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      if (!ctxRef.current) ctxRef.current = new AC();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const t0 = ctx.currentTime;
      const tone = (freq: number, start: number, dur: number, type: OscillatorType = "square", gain = 0.06) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0 + start);
        g.gain.setValueAtTime(0.0001, t0 + start);
        g.gain.exponentialRampToValueAtTime(gain, t0 + start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
        osc.connect(g).connect(ctx.destination);
        osc.start(t0 + start);
        osc.stop(t0 + start + dur + 0.02);
      };
      if (kind === "success") { tone(660, 0, 0.09); tone(990, 0.09, 0.14); }
      else if (kind === "fail") { tone(220, 0, 0.12, "sawtooth"); tone(160, 0.1, 0.2, "sawtooth"); }
      else if (kind === "fanfare") { tone(523, 0, 0.1); tone(659, 0.1, 0.1); tone(784, 0.2, 0.1); tone(1046, 0.3, 0.25); }
      else tone(440, 0, 0.05, "triangle", 0.04);
    } catch { /* 오디오 불가 환경 */ }
  }, [enabled]);

  return { enabled, toggle, play };
}

/* ───────────────────────── 단축키 ───────────────────────── */

/** code(KeyA, Space …) → 핸들러. 입력 요소에 포커스가 있으면 무시, 수정키 조합은 무시 */
export function useSimHotkeys(map: Record<string, () => void>) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const fn = ref.current[e.code];
      if (fn) { e.preventDefault(); fn(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

/* ───────────────────────── 상단 바 ───────────────────────── */

export function SimToolbar({ backHref, backLabel, title, right }: { backHref: string; backLabel: string; title: ReactNode; right?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* 클립보드 불가 */ }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={backHref} className="pixel-card px-3 py-1.5 font-pixel text-xs text-dim hover:text-maple">← {backLabel}</Link>
      <div className="font-pixel text-lg text-ink flex-1 min-w-0 truncate">{title}</div>
      {right}
      <button type="button" onClick={copyLink} className="pixel-card px-3 py-1.5 font-pixel text-xs text-dim hover:text-maple">
        {copied ? "복사됨 ✓" : "🔗 링크 복사"}
      </button>
    </div>
  );
}
