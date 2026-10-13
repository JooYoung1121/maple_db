"use client";

/* 주문서 시뮬레이터 연출 무대
 * - 큰 장비 아이콘 + 오라 → 선택한 %의 주문서가 떨어지며 흔들림 → 성공(섬광·파편) / 실패(연기)
 * - 툴팁형 창에 성공·실패 수, 누적 스탯 증가량(+변동 플로팅), 장별 사용 주문서 게이지
 * - 이름·오라 색은 성공 비율 단계 (사이트 연출 기준, 인게임 규칙 아님)
 * 성공 판정은 page.tsx(onApply)가 하고 여기서는 타이밍·표시만 담당한다. 스타일은 혼줌 무대(.chaos-*)를 공유 */

import { useEffect, useRef, useState } from "react";
import { pctTheme, scrollIconUrl } from "@/lib/scrollData";

export interface StageRoll {
  success: boolean;
  gain: number; // 이번 장으로 오른 스탯 (실패면 0)
}

export interface StageSlot {
  pct: number;
  ok: boolean;
}

interface Props {
  name: string;
  iconUrl: string | null;
  slots: number;
  history: StageSlot[]; // 사용한 장 (순서대로)
  currentPct: number;
  scrollLabel: string; // 예: 공격력 주문서
  statGain: number; // 누적 스탯 증가량
  onApply: () => StageRoll | null; // null이면 바를 수 없음
  onReset: () => void; // 새 장비 (새 트)
}

type Phase = "idle" | "cast" | "success" | "fail";

const CAST_MS = 900;
const RESULT_MS = 1000;
const FAST_CAST_MS = 110;
const FAST_RESULT_MS = 220;

/* 이름 색 단계 — 성공 비율(성공 수 / 전체 업횟) 기준 */
const TIERS = [
  { min: 0, label: "노작", color: "#ffffff", aura: "rgba(140,110,255,0.45)" },
  { min: 0.01, label: "작", color: "#66ccff", aura: "rgba(80,190,255,0.6)" },
  { min: 0.5, label: "준수", color: "#c77dff", aura: "rgba(190,110,255,0.7)" },
  { min: 0.8, label: "명작", color: "#ffb13b", aura: "rgba(255,170,50,0.75)" },
  { min: 1, label: "올작", color: "#ffe066", aura: "rgba(255,230,90,0.85)" },
];

function tierOf(ratio: number) {
  let t = TIERS[0];
  for (const tier of TIERS) if (ratio >= tier.min) t = tier;
  return t;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ScrollStage(props: Props) {
  const { name, iconUrl, slots, history, currentPct, scrollLabel, statGain, onApply, onReset } = props;

  const [phase, setPhase] = useState<Phase>("idle");
  const [lastRoll, setLastRoll] = useState<StageRoll | null>(null);
  const [rollId, setRollId] = useState(0);
  const [fast, setFast] = useState(false);
  const [auto, setAuto] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const applyRef = useRef(onApply);
  applyRef.current = onApply;

  const used = history.length;
  const successes = history.filter((h) => h.ok).length;
  const fails = used - successes;
  const done = used >= slots;
  const busy = phase === "cast";

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  // 장비가 바뀌거나 새 트가 시작되면 연출 상태 초기화
  useEffect(() => {
    if (used === 0) {
      clearTimers();
      setPhase("idle");
      setLastRoll(null);
      setAuto(false);
    }
  }, [used, name, slots]);

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

  // 남은 장 연속 — 결과 연출이 끝날 때마다 다음 장
  useEffect(() => {
    if (!auto) return;
    if (done) { setAuto(false); return; }
    if (phase === "idle") cast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, phase, done]);

  // 키보드: Space=바르기(완료 후엔 새 장비), F=새 장비. 주문서 % 단축키(Q~T)는 page.tsx 담당
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (done) { clearTimers(); setAuto(false); setPhase("idle"); onReset(); }
        else cast();
      } else if (e.code === "KeyF") {
        e.preventDefault();
        clearTimers(); setAuto(false); setPhase("idle"); onReset();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, busy, fast, onReset]);

  const tier = tierOf(slots > 0 ? successes / slots : 0);
  const th = pctTheme(currentPct);

  return (
    <div className="chaos-stage" style={{ ["--chaos-aura" as string]: tier.aura, ["--chaos-name" as string]: tier.color }}>
      <div className="grid lg:grid-cols-[3fr_2fr] gap-3 items-stretch">
        {/* ── 무대 ── */}
        <div className={`chaos-arena ${phase === "cast" ? "is-cast" : ""}`}>
          <div className="chaos-aura" />
          <div className="chaos-aura chaos-aura--inner" />

          {phase === "cast" && (
            <img src={scrollIconUrl(currentPct)} alt="" className="chaos-scroll" />
          )}

          <div
            key={`item-${rollId}`}
            className={`chaos-item ${phase === "cast" ? "is-shake" : ""} ${phase === "success" ? "is-pop" : ""} ${phase === "fail" ? "is-dim" : ""}`}
          >
            {iconUrl ? (
              <img src={iconUrl} alt={name} onError={(e) => { e.currentTarget.style.display = "none"; }} />
            ) : (
              <span className="text-5xl leading-none">🗡️</span>
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

          {/* 업횟 게이지 — 장별 사용 주문서 % */}
          <div className="chaos-slots">
            {Array.from({ length: slots }, (_, i) => {
              const h = history[i];
              const state = h ? (h.ok ? "ok" : "ng") : "left";
              return (
                <span key={i} className={`chaos-slot chaos-slot--${state}`} title={h ? `${i + 1}칸 · ${h.pct}% ${h.ok ? "성공" : "실패"}` : `${i + 1}칸`}>
                  {state === "ok" ? "✦" : state === "ng" ? "✕" : ""}
                </span>
              );
            })}
          </div>
        </div>

        {/* ── 툴팁형 창 ── */}
        <div className="chaos-tooltip">
          <div className="chaos-tooltip__name" key={`name-${tier.label}`}>
            {name}
            {successes > 0 && <span className="chaos-tooltip__gain"> (+{successes})</span>}
          </div>
          <div className="chaos-tooltip__tier">
            <span>{tier.label}</span>
            <span>업그레이드 가능 횟수 : {slots - used}</span>
          </div>
          <div className="chaos-tooltip__lines" style={{ gridTemplateColumns: "1fr" }}>
            <div className="chaos-line">
              <span>성공 : <b className="text-up">{successes}</b></span>
              <span className="chaos-line__diff">실패 {fails} · 남음 {slots - used}</span>
            </div>
            <div key={`gain-${rollId}`} className={`chaos-line is-focus ${lastRoll && phase !== "cast" ? (lastRoll.success ? "is-up" : "is-zero") : ""}`}>
              <span>{scrollLabel.replace(" 주문서", "")} : <b className={statGain > 0 ? "text-up" : ""}>+{statGain}</b></span>
              {lastRoll && phase !== "cast" && lastRoll.success && lastRoll.gain > 0 && (
                <span className="chaos-float is-up">+{lastRoll.gain}</span>
              )}
            </div>
            {history.length > 0 && (
              <div className="chaos-line" style={{ flexWrap: "wrap", gap: "0.25rem" }}>
                {history.map((h, i) => (
                  <span key={i} className={`inline-flex items-center gap-0.5 text-[10px] px-1 border ${h.ok ? "border-[#ffd54a] text-[#ffe680]" : "border-[#6a2b2b] text-[#c06060] line-through"}`}>
                    <img src={scrollIconUrl(h.pct)} alt="" className="w-3 h-3 object-contain [image-rendering:pixelated]" />{h.pct}
                  </span>
                ))}
              </div>
            )}
          </div>
          {done && (
            <div className={`chaos-tooltip__done ${successes === slots ? "is-hit" : ""}`}>
              {successes === slots ? `🎉 ${slots}칸 올작!` : `완작 · ${slots}칸 중 ${successes}작`}{statGain > 0 && ` · ${scrollLabel.replace(" 주문서", "")} +${statGain}`}
            </div>
          )}
        </div>
      </div>

      {/* ── 조작 ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={cast} disabled={busy || done || auto}
          className={`pixel-btn px-4 py-2 font-pixel text-xs disabled:opacity-50 inline-flex items-center gap-1.5`}>
          <img src={scrollIconUrl(currentPct)} alt="" className="w-4 h-4 object-contain [image-rendering:pixelated]" />
          <span className={th.text}>{currentPct}%</span> 바르기 (Space)
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
            {done ? "새 장비 — 다음 트 (F)" : "리셋 (F)"}
          </button>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-[11px] text-dim">
          <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="accent-[var(--c-maple)]" />
          빠르게
        </label>
      </div>
      <p className="text-[10px] text-dim">
        이름 색은 성공 비율에 따른 사이트 연출입니다 (0작 흰색 · 1작~ 파랑 · 절반~ 보라 · 80%~ 주황 · 올작 노랑). 인게임 아이템 색 규칙과는 무관합니다.
      </p>
    </div>
  );
}
