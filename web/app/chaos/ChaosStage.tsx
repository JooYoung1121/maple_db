"use client";

/* 혼줌 '직접 발라보기' 연출 스테이지
 * - 큰 아이템 + 혼돈 오라 → 주문서가 떨어지며 흔들림 → 성공(섬광·파편) / 실패(연기) 판정
 * - 툴팁형 옵션 창에서 바뀐 줄이 색으로 번쩍이고 ±변동치가 떠오름
 * - 아이템 이름·오라 색은 주스탯+공/마 합 변화량 단계로 바뀜 (사이트 연출 기준, 인게임 규칙 아님)
 * 확률 계산은 page.tsx의 applyChaos 그대로 — 여기서는 타이밍과 표시만 담당 */

import { useEffect, useRef, useState } from "react";

export type StageLineKey = string;
export type StageLines = Partial<Record<StageLineKey, number>>;

export interface StageRoll {
  success: boolean;
  deltas: Partial<Record<StageLineKey, number>>;
}

interface Props {
  name: string;
  itemId: number | null;
  slots: number;
  used: number;
  slotHistory: boolean[]; // 사용한 장별 성공 여부
  baseLines: StageLines;
  lines: StageLines;
  activeLines: StageLineKey[];
  gainKeys: StageLineKey[]; // 이름 색 단계 계산에 쓰는 줄 (주스탯·공/마)
  successPct: number;
  focusStat: StageLineKey;
  target: number;
  onApply: () => StageRoll | null; // 실제 판정 — null이면 바를 수 없음
  onReset: () => void;
}

type Phase = "idle" | "cast" | "success" | "fail";

const SCROLL_ICON = "/api/icon/item/2049100"; // 혼돈의 주문서 60%
const CAST_MS = 950;
const RESULT_MS = 1100;
const FAST_CAST_MS = 120;
const FAST_RESULT_MS = 250;

/* 이름 색 단계 — 주스탯+공/마 합 변화량 기준 (사이트 연출용) */
const TIERS = [
  { min: -Infinity, label: "하락", color: "#9aa0a6", aura: "rgba(120,120,130,0.55)" },
  { min: 0, label: "노작", color: "#ffffff", aura: "rgba(140,110,255,0.45)" },
  { min: 1, label: "상승", color: "#66ccff", aura: "rgba(80,190,255,0.6)" },
  { min: 6, label: "고작", color: "#c77dff", aura: "rgba(190,110,255,0.7)" },
  { min: 11, label: "대박", color: "#ffb13b", aura: "rgba(255,170,50,0.75)" },
  { min: 16, label: "전설", color: "#ffe066", aura: "rgba(255,230,90,0.85)" },
];

function tierOf(gain: number) {
  if (gain < 0) return TIERS[0];
  let t = TIERS[1];
  for (const tier of TIERS) if (gain >= tier.min) t = tier;
  return t;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ChaosStage(props: Props) {
  const {
    name, itemId, slots, used, slotHistory, baseLines, lines, activeLines, gainKeys,
    successPct, focusStat, target, onApply, onReset,
  } = props;

  const [phase, setPhase] = useState<Phase>("idle");
  const [lastRoll, setLastRoll] = useState<StageRoll | null>(null);
  const [rollId, setRollId] = useState(0);
  const [fast, setFast] = useState(false);
  const [auto, setAuto] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const applyRef = useRef(onApply);
  applyRef.current = onApply;

  const done = used >= slots;
  const busy = phase === "cast";

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  // 아이템이 바뀌거나 리셋되면 연출 상태 초기화
  useEffect(() => {
    if (used === 0) {
      clearTimers();
      setPhase("idle");
      setLastRoll(null);
      setAuto(false);
    }
  }, [used, name]);

  const cast = () => {
    if (busy || done) return;
    const quick = fast || prefersReducedMotion();
    setPhase("cast");
    setLastRoll(null);
    timers.current.push(
      setTimeout(() => {
        const roll = applyRef.current();
        if (!roll) { setPhase("idle"); setAuto(false); return; }
        setLastRoll(roll);
        setRollId((n) => n + 1);
        setPhase(roll.success ? "success" : "fail");
        timers.current.push(setTimeout(() => setPhase((p) => (p === "cast" ? p : "idle")), quick ? FAST_RESULT_MS : RESULT_MS));
      }, quick ? FAST_CAST_MS : CAST_MS),
    );
  };

  // '남은 업횟 전부' — 결과 연출이 끝날 때마다 다음 장
  useEffect(() => {
    if (!auto) return;
    if (done) { setAuto(false); return; }
    if (phase === "idle") cast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, phase, done]);

  const gain = gainKeys.reduce((sum, k) => sum + ((lines[k] ?? 0) - (baseLines[k] ?? 0)), 0);
  const tier = tierOf(gain);
  const focusValue = lines[focusStat] ?? 0;

  return (
    <div className="chaos-stage" style={{ ["--chaos-aura" as string]: tier.aura, ["--chaos-name" as string]: tier.color }}>
      <div className="grid lg:grid-cols-[3fr_2fr] gap-3 items-stretch">
      {/* ── 무대 ── */}
      <div className={`chaos-arena ${phase === "cast" ? "is-cast" : ""}`}>
        <div className="chaos-aura" />
        <div className="chaos-aura chaos-aura--inner" />

        {phase === "cast" && (
          <img src={SCROLL_ICON} alt="" className="chaos-scroll" />
        )}

        <div
          key={`item-${rollId}`}
          className={`chaos-item ${phase === "cast" ? "is-shake" : ""} ${phase === "success" ? "is-pop" : ""} ${phase === "fail" ? "is-dim" : ""}`}
        >
          {itemId ? (
            <img src={`/api/icon/item/${itemId}`} alt={name} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <span className="text-5xl leading-none">🎀</span>
          )}
        </div>

        {phase === "success" && (
          <div key={`fx-s-${rollId}`} className="chaos-fx">
            <div className="chaos-flash" />
            <div className="chaos-ring" />
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="chaos-spark" style={{ ["--a" as string]: `${i * 36}deg` }} />
            ))}
            <div className="chaos-verdict chaos-verdict--ok">SUCCESS</div>
          </div>
        )}
        {phase === "fail" && (
          <div key={`fx-f-${rollId}`} className="chaos-fx">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="chaos-smoke" style={{ ["--i" as string]: i }} />
            ))}
            <div className="chaos-verdict chaos-verdict--ng">FAIL</div>
          </div>
        )}

        {/* 업횟 게이지 */}
        <div className="chaos-slots">
          {Array.from({ length: slots }, (_, i) => {
            const state = i < used ? (slotHistory[i] ? "ok" : "ng") : "left";
            return <span key={i} className={`chaos-slot chaos-slot--${state}`}>{state === "ok" ? "✦" : state === "ng" ? "✕" : ""}</span>;
          })}
        </div>
      </div>

      {/* ── 툴팁형 옵션 창 ── */}
      <div className="chaos-tooltip">
        <div className="chaos-tooltip__name" key={`name-${tier.label}`}>
          {name}
          {gain !== 0 && <span className="chaos-tooltip__gain"> ({gain > 0 ? "+" : ""}{gain})</span>}
        </div>
        <div className="chaos-tooltip__tier">
          <span>{tier.label}</span>
          <span>업그레이드 가능 횟수 : {slots - used}</span>
        </div>
        <div className="chaos-tooltip__lines">
          {activeLines.map((k) => {
            const base = baseLines[k] ?? 0;
            const v = lines[k] ?? 0;
            const d = phase !== "cast" ? lastRoll?.deltas[k] : undefined;
            const flash = d === undefined ? "" : d > 0 ? "is-up" : d < 0 ? "is-down" : "is-zero";
            return (
              <div key={`${k}-${rollId}`} className={`chaos-line ${flash} ${k === focusStat ? "is-focus" : ""}`}>
                <span>{k} : <b className={v > base ? "text-up" : v < base ? "text-down" : ""}>+{v}</b></span>
                {v !== base && <span className="chaos-line__diff">({v > base ? "+" : ""}{v - base})</span>}
                {d !== undefined && d !== 0 && (
                  <span className={`chaos-float ${d > 0 ? "is-up" : "is-down"}`}>{d > 0 ? `+${d}` : d}</span>
                )}
              </div>
            );
          })}
        </div>
        {done && (
          <div className={`chaos-tooltip__done ${focusValue >= target ? "is-hit" : ""}`}>
            완작 · {focusStat} {focusValue} {focusValue >= target ? "— 목표 달성!" : `— 목표 ${target} 미달`}
          </div>
        )}
      </div>
      </div>

      {/* ── 조작 ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={cast} disabled={busy || done || auto}
          className="pixel-btn px-4 py-2 font-pixel text-xs disabled:opacity-50">
          🌀 혼돈의 주문서 사용 ({successPct}%)
        </button>
        {!done && slots - used > 1 && (
          <button type="button" onClick={() => setAuto(true)} disabled={busy || auto}
            className="pixel-card px-3 py-2 font-pixel text-xs text-dim disabled:opacity-50">
            남은 {slots - used}장 연속
          </button>
        )}
        {(done || used > 0) && (
          <button type="button" onClick={() => { clearTimers(); setAuto(false); setPhase("idle"); onReset(); }}
            className="pixel-card px-3 py-2 font-pixel text-xs text-maple">
            {done ? "새 악세서리" : "리셋"}
          </button>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-[11px] text-dim">
          <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="accent-[var(--c-maple)]" />
          빠르게
        </label>
      </div>
      <p className="text-[10px] text-dim">
        이름 색은 주스탯·공/마 합이 기본 대비 얼마나 올랐는지에 따른 사이트 연출입니다 (0 흰색 · +1~5 파랑 · +6~10 보라 · +11~15 주황 · +16 이상 노랑 · 하락 회색). 인게임 아이템 색 규칙과는 무관합니다.
      </p>
    </div>
  );
}
