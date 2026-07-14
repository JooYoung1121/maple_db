"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ── 타입 ── */
interface RaidTimer {
  id: string;
  label: string;
  duration: number; // 초
  endAt: number | null; // 실행 중이면 종료 시각(ms), 아니면 null
  removable: boolean;
}

interface TimerSection {
  id: string;
  title: string;
  icon: string;
  desc: string;
  timers: RaidTimer[];
}

/* ── 혼테일 프리셋 ──
 * 리저렉션 쿨 30분 / 사망 팅 15분 / 인레이지 6분 / 머리 공무 45초 /
 * 중머리 버프해제(5갈 5분 · 3갈 3분) / 좌팔 HP60% 5분
 * — 기존 혼테일 타이머 사이트(현재 폐쇄) 구성을 따름. 값은 카드별 수정 가능.
 */
const HORNTAIL_SECTIONS: TimerSection[] = [
  {
    id: "resurrection",
    title: "리저렉션",
    icon: "⚕️",
    desc: "비숍별 리저렉션 쿨타임 (기본 30분) — 이름을 비숍 닉네임으로 바꿔 쓰세요",
    timers: [
      { id: "res-1", label: "비숍 1", duration: 1800, endAt: null, removable: false },
      { id: "res-2", label: "비숍 2", duration: 1800, endAt: null, removable: false },
      { id: "res-3", label: "비숍 3", duration: 1800, endAt: null, removable: false },
      { id: "res-4", label: "비숍 4", duration: 1800, endAt: null, removable: false },
      { id: "res-5", label: "비숍 5", duration: 1800, endAt: null, removable: false },
      { id: "res-6", label: "비숍 6", duration: 1800, endAt: null, removable: false },
    ],
  },
  {
    id: "death-buff",
    title: "사망 & 버프",
    icon: "🪦",
    desc: "사망 대기(팅) 15분 · 인레이지 6분",
    timers: [
      { id: "death-1", label: "사망 팅-1", duration: 900, endAt: null, removable: false },
      { id: "death-2", label: "사망 팅-2", duration: 900, endAt: null, removable: false },
      { id: "enrage", label: "인레이지", duration: 360, endAt: null, removable: false },
    ],
  },
  {
    id: "cancel",
    title: "공무",
    icon: "⚔️",
    desc: "머리별 물리공격 무효 45초 — 시전 순간 시작을 누르세요",
    timers: [
      { id: "wc-left", label: "좌머리 공무", duration: 45, endAt: null, removable: false },
      { id: "wc-mid", label: "중머리 공무", duration: 45, endAt: null, removable: false },
      { id: "wc-right", label: "우머리 공무", duration: 45, endAt: null, removable: false },
    ],
  },
  {
    id: "dispel",
    title: "버프해제",
    icon: "🛡️",
    desc: "중머리 5갈 5분 · 3갈 3분 · 좌팔 HP60% 이후 5분",
    timers: [
      { id: "dispel-5", label: "중머리 5갈", duration: 300, endAt: null, removable: false },
      { id: "dispel-3", label: "중머리 3갈", duration: 180, endAt: null, removable: false },
      { id: "dispel-arm", label: "좌팔 HP:60%", duration: 300, endAt: null, removable: false },
    ],
  },
  {
    id: "custom",
    title: "유혹 · 커스텀",
    icon: "🌀",
    desc: "유혹 등 파티마다 다르게 재는 항목은 직접 추가하세요 (이름·시간 자유 설정)",
    timers: [],
  },
];

const STORAGE_KEY = "boss_timer_horntail_v1";

/* ── 유틸 ── */
function fmt(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function parseDuration(text: string): number | null {
  const t = text.trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10); // 초 단위
  const m = t.match(/^(\d+):([0-5]?\d)$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return null;
}

function playBeep(audioCtxRef: React.MutableRefObject<AudioContext | null>, frequency: number, duration: number, volume: number) {
  try {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // audio not supported
  }
}

/* ── 타이머 카드 ── */
function TimerCard({
  timer, now, muted, onStart, onStop, onEdit, onRemove,
}: {
  timer: RaidTimer;
  now: number;
  muted: boolean;
  onStart: () => void;
  onStop: () => void;
  onEdit: (label: string, duration: number) => void;
  onRemove?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(timer.label);
  const [durDraft, setDurDraft] = useState(fmt(timer.duration));

  const running = timer.endAt !== null;
  const remaining = running ? Math.max(0, (timer.endAt! - now) / 1000) : timer.duration;
  const expired = running && remaining <= 0;
  const urgent = running && !expired && remaining <= Math.min(10, timer.duration * 0.2);

  function saveEdit() {
    const d = parseDuration(durDraft);
    if (!labelDraft.trim() || d === null || d <= 0) return;
    onEdit(labelDraft.trim(), d);
    setEditing(false);
  }

  return (
    <div
      className={`pixel-card p-0 overflow-hidden flex items-stretch transition-colors ${
        expired ? "border-red-500" : urgent ? "border-yellow-500" : ""
      }`}
    >
      <div className="flex-1 min-w-0 px-3 py-2.5">
        {editing ? (
          <div className="space-y-1.5">
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              className="w-full pixel-input px-2 py-1 text-xs"
              placeholder="이름"
              autoFocus
            />
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={durDraft}
                onChange={(e) => setDurDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                className="w-20 pixel-input px-2 py-1 text-xs font-mono"
                placeholder="분:초"
              />
              <button onClick={saveEdit} className="pixel-btn px-2 py-1 text-[11px]">저장</button>
              <button
                onClick={() => { setEditing(false); setLabelDraft(timer.label); setDurDraft(fmt(timer.duration)); }}
                className="px-2 py-1 text-[11px] text-dim hover:text-maple"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-semibold truncate">{timer.label}</span>
              <button
                onClick={() => { setEditing(true); setLabelDraft(timer.label); setDurDraft(fmt(timer.duration)); }}
                className="shrink-0 text-[10px] font-pixel text-dim border border-edge px-1.5 py-0.5 hover:text-maple hover:border-maple transition-colors"
              >
                수정
              </button>
              {onRemove && (
                <button onClick={onRemove} className="shrink-0 text-dim hover:text-red-500 transition-colors" title="삭제">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div
              className={`font-mono font-bold tabular-nums text-4xl leading-none ${
                expired
                  ? "text-red-500 animate-pulse"
                  : urgent
                  ? "text-yellow-500"
                  : running
                  ? "text-green-500"
                  : "text-ink"
              }`}
            >
              {fmt(remaining)}
            </div>
            {expired && !muted && <ExpireBeeper timerId={timer.id} />}
          </>
        )}
      </div>
      <button
        onClick={running ? (expired ? onStop : onStart) : onStart}
        onContextMenu={(e) => { e.preventDefault(); onStop(); }}
        className={`w-16 shrink-0 font-pixel text-[13px] transition-colors border-l-2 border-edge ${
          expired
            ? "bg-red-500 text-white hover:bg-red-600"
            : running
            ? "bg-surface2 text-dim hover:text-maple"
            : "bg-maple text-white hover:brightness-110"
        }`}
        title={running ? "클릭: 재시작 · 우클릭: 리셋" : "시작"}
      >
        {expired ? "완료" : running ? "재시작" : "시작"}
      </button>
    </div>
  );
}

/* 만료 순간 비프음을 1회만 내기 위한 마커 컴포넌트 (부모 리렌더와 분리) */
const beepedIds = new Set<string>();
let sharedAudioCtx: { current: AudioContext | null } = { current: null };
function ExpireBeeper({ timerId }: { timerId: string }) {
  useEffect(() => {
    if (beepedIds.has(timerId)) return;
    beepedIds.add(timerId);
    playBeep(sharedAudioCtx, 1100, 0.25, 0.5);
    const t = setTimeout(() => playBeep(sharedAudioCtx, 1400, 0.35, 0.5), 300);
    return () => clearTimeout(t);
  }, [timerId]);
  return null;
}

/* ── 메인 ── */
export default function BossTimerPage() {
  const [sections, setSections] = useState<TimerSection[]>(HORNTAIL_SECTIONS);
  const [now, setNow] = useState(0);
  const [muted, setMuted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  sharedAudioCtx = audioCtxRef;

  /* localStorage 복원 — endAt은 벽시계 기준이라 새로고침해도 이어짐 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: TimerSection[] = JSON.parse(raw);
        // 프리셋 구조가 바뀌어도 저장본과 병합되도록 섹션 id 기준으로 복원
        setSections(
          HORNTAIL_SECTIONS.map((preset) => {
            const s = saved.find((x) => x.id === preset.id);
            return s ? { ...preset, timers: s.timers } : preset;
          })
        );
      }
      const m = localStorage.getItem("boss_timer_muted");
      if (m) setMuted(m === "true");
    } catch {
      // ignore
    }
    setNow(Date.now());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sections)); } catch { /* ignore */ }
  }, [sections, loaded]);

  useEffect(() => {
    localStorage.setItem("boss_timer_muted", String(muted));
  }, [muted]);

  /* 틱 — 실행 중 타이머가 있을 때만 */
  const anyRunning = sections.some((s) => s.timers.some((t) => t.endAt !== null));
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [anyRunning]);

  const updateTimer = useCallback((sectionId: string, timerId: string, patch: Partial<RaidTimer>) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId ? s : { ...s, timers: s.timers.map((t) => (t.id === timerId ? { ...t, ...patch } : t)) }
      )
    );
  }, []);

  const startTimer = useCallback((sectionId: string, timer: RaidTimer) => {
    beepedIds.delete(timer.id);
    updateTimer(sectionId, timer.id, { endAt: Date.now() + timer.duration * 1000 });
    setNow(Date.now());
  }, [updateTimer]);

  const stopTimer = useCallback((sectionId: string, timerId: string) => {
    beepedIds.delete(timerId);
    updateTimer(sectionId, timerId, { endAt: null });
  }, [updateTimer]);

  const addTimer = useCallback((sectionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              timers: [
                ...s.timers,
                {
                  id: `${sectionId}-${s.timers.length + 1}-${Math.floor(Math.random() * 1e6)}`,
                  label: sectionId === "custom" ? "유혹" : `타이머 ${s.timers.length + 1}`,
                  duration: 60,
                  endAt: null,
                  removable: true,
                },
              ],
            }
      )
    );
  }, []);

  const removeTimer = useCallback((sectionId: string, timerId: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id !== sectionId ? s : { ...s, timers: s.timers.filter((t) => t.id !== timerId) }))
    );
  }, []);

  const resetAll = useCallback(() => {
    if (!confirm("모든 타이머를 정지하고 초기 상태로 되돌릴까요? (이름·시간 설정은 유지)")) return;
    beepedIds.clear();
    setSections((prev) => prev.map((s) => ({ ...s, timers: s.timers.map((t) => ({ ...t, endAt: null })) })));
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold font-pixel">🐉 혼테일 타이머</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMuted(!muted)}
            className={`px-3 py-1.5 text-xs font-pixel border-2 transition-colors ${
              muted ? "border-red-400 text-red-500" : "border-edge text-dim hover:text-maple"
            }`}
          >
            {muted ? "🔇 알림음 꺼짐" : "🔔 알림음 켜짐"}
          </button>
          <button
            onClick={resetAll}
            className="px-3 py-1.5 text-xs font-pixel border-2 border-edge text-dim hover:text-red-500 hover:border-red-400 transition-colors"
          >
            전체 리셋
          </button>
        </div>
      </div>
      <p className="text-sm text-dim mb-6">
        혼테일 공대용 쿨타임 보드 — 리저렉션·사망팅·공무·버프해제를 각각 독립 타이머로 잽니다.
        모든 카드는 <span className="text-maple">수정</span> 버튼으로 이름과 시간을 바꿀 수 있고, 설정은 이 브라우저에 저장됩니다.
      </p>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.id}>
            <div className="flex items-baseline gap-2 mb-1">
              <h2 className="font-pixel font-bold text-lg">{section.icon} {section.title}</h2>
            </div>
            <p className="text-xs text-dim mb-3">{section.desc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.timers.map((timer) => (
                <TimerCard
                  key={timer.id}
                  timer={timer}
                  now={now}
                  muted={muted}
                  onStart={() => startTimer(section.id, timer)}
                  onStop={() => stopTimer(section.id, timer.id)}
                  onEdit={(label, duration) =>
                    updateTimer(section.id, timer.id, { label, duration, endAt: null })
                  }
                  onRemove={timer.removable ? () => removeTimer(section.id, timer.id) : undefined}
                />
              ))}
              <button
                onClick={() => addTimer(section.id)}
                className="min-h-[72px] border-2 border-dashed border-edge text-sm text-dim hover:border-maple hover:text-maple transition-colors"
              >
                + 타이머 추가
              </button>
            </div>
          </section>
        ))}
      </div>

      {/* 사용법 */}
      <div className="pixel-panel p-5 mt-8">
        <h2 className="font-bold mb-3 font-pixel">사용법</h2>
        <ul className="space-y-1.5">
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            게임 내에서 해당 스킬(리저렉션, 공무 시전 등)이 발동하는 순간 <strong>시작</strong>을 누르세요. 남은 시간이 카운트다운됩니다.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            실행 중 버튼을 다시 누르면 <strong>재시작</strong>(재동기화), 우클릭하면 리셋됩니다.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            리저렉션 카드의 이름을 공대 비숍 닉네임으로 바꿔두면 순서 관리가 편합니다.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            유혹처럼 파티마다 재는 방식이 다른 항목은 <strong>유혹 · 커스텀</strong> 섹션에서 직접 추가하고 시간을 설정하세요.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            타이머 종료 시 알림음이 울리고 숫자가 붉게 깜빡입니다. 새로고침해도 진행 중인 타이머는 이어집니다.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            기본값(리저 30분, 사망팅 15분, 인레이지 6분, 공무 45초 등)은 통용되는 공략 기준이며, 실측과 다르면 각 카드에서 수정해 쓰세요.
          </li>
        </ul>
      </div>
    </div>
  );
}
