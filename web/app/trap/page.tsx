"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── 타입 ───
type ViewMode = "gradient" | "compact" | "sound" | "multi" | "pip";

interface TrapData {
  id: string;
  name: string;
  location: string;
  cycleDuration: number | null; // null = unknown cycle, can't use as timer
  hiddenDuration: number | null;
  visibleDuration: number | null;
  effect: string;
  note: string | null;
  color: string;
}

interface MultiTimer {
  id: string;
  label: string;
  startedAt: number | null; // Date.now() when synced
}

// ─── 함정 데이터 ───
const TRAPS: TrapData[] = [
  {
    id: "leafre-mole",
    name: "리프레 두더지",
    location: "리프레 야외 필드 전체 (미나르숲, 용의 숲, 용의 둥지)",
    cycleDuration: 31,
    hiddenDuration: 30,
    visibleDuration: 1,
    effect: "스턴 3초 (모든 내성 무시)",
    note: "회피율/스탠스/상태이상 내성을 완전 무시하는 강제 스턴",
    color: "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800",
  },
  {
    id: "elnath-steam",
    name: "엘나스 증기 (시련의 동굴)",
    location: "엘나스 시련의 동굴, 위험한 증기 맵",
    cycleDuration: 9,
    hiddenDuration: 7,
    visibleDuration: 2,
    effect: "넉백 + 약 10 데미지",
    note: "바닥에서 주기적으로 분출. 데미지는 낮지만 넉백으로 사냥 방해",
    color: "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800",
  },
  {
    id: "sleepywood-steam",
    name: "슬리피우드 던전 증기",
    location: "슬리피우드 던전 (위험한 증기 맵)",
    cycleDuration: 9,
    hiddenDuration: 7,
    visibleDuration: 2,
    effect: "넉백 + 약 10 데미지",
    note: "엘나스 증기와 동일한 메커니즘",
    color: "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800",
  },
  {
    id: "dragon-forest-rock",
    name: "용의 숲 떨어지는 돌",
    location: "용의 숲",
    cycleDuration: null,
    hiddenDuration: null,
    visibleDuration: null,
    effect: "스턴",
    note: "주기 미확인 — 타이머 사용 불가",
    color: "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
  },
  {
    id: "pig-park-spike",
    name: "돼지공원 가시",
    location: "돼지공원 (헤네시스)",
    cycleDuration: null,
    hiddenDuration: null,
    visibleDuration: null,
    effect: "데미지 + 넉백",
    note: "상시 활성 함정 (매크로 방지) — 타이머 불필요",
    color: "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
  },
  {
    id: "sky-nest-rock",
    name: "천공의 둥지 PQ 돌",
    location: "천공의 둥지 파티퀘스트",
    cycleDuration: null,
    hiddenDuration: null,
    visibleDuration: null,
    effect: "스턴 + 넉백, 약 300 데미지",
    note: "주기 미확인 — 타이머 사용 불가",
    color: "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
  },
  {
    id: "elnath-cave-lava",
    name: "엘나스 폐광 용암",
    location: "시련의 동굴 2 (엘나스)",
    cycleDuration: null,
    hiddenDuration: null,
    visibleDuration: null,
    effect: "폐광 맵으로 강제 이동",
    note: "지형 함정 — 빠지면 폐광 중앙으로 떨어짐",
    color: "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
  },
];

// 타이머 가능한 함정만 필터
const TIMER_TRAPS = TRAPS.filter((t) => t.cycleDuration !== null);

// ─── 유틸: 동적 경고/위험 임계값 계산 ───
function getWarnAt(cycleDuration: number): number {
  if (cycleDuration === 31) return 5;
  return Math.round(cycleDuration * 0.16 * 10) / 10; // ~16% of cycle
}

function getDangerAt(cycleDuration: number): number {
  if (cycleDuration === 31) return 3;
  return Math.round(cycleDuration * 0.10 * 10) / 10; // ~10% of cycle
}

// ─── 유틸: 사이클 내 남은 초 계산 ───
function getSecondsRemaining(startedAt: number | null, cycleTotal: number): number {
  if (startedAt === null) return cycleTotal;
  const elapsed = (Date.now() - startedAt) / 1000;
  const inCycle = elapsed % cycleTotal;
  return cycleTotal - inCycle;
}

function getPhase(remaining: number, warnAt: number, dangerAt: number, visibleDuration: number): "safe" | "caution" | "danger" | "appearing" {
  if (remaining <= visibleDuration) return "appearing";
  if (remaining <= dangerAt) return "danger";
  if (remaining <= warnAt) return "caution";
  return "safe";
}

// ─── 오디오 유틸 ───
function playBeep(
  audioCtxRef: React.MutableRefObject<AudioContext | null>,
  frequency: number,
  duration: number,
  volume: number
) {
  try {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
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
    // Audio not supported
  }
}

// ─── 메인 컴포넌트 ───
export default function TrapTimerPage() {
  // 모드 및 설정
  const [mode, setMode] = useState<ViewMode>("pip");
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // 선택된 함정
  const [selectedTrapId, setSelectedTrapId] = useState<string>("leafre-mole");

  // 싱글 타이머 상태
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(31);

  // 멀티 타이머 상태
  const [multiTimers, setMultiTimers] = useState<MultiTimer[]>([
    { id: "1", label: "", startedAt: null },
  ]);
  const [multiRemainings, setMultiRemainings] = useState<Record<string, number>>({});

  // PiP
  const [pipSupported, setPipSupported] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipContainerRef = useRef<HTMLDivElement>(null);

  // 오디오
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastBeepPhaseRef = useRef<string>("");

  // 선택된 함정 데이터 + 동적 상수
  const selectedTrap = useMemo(
    () => TIMER_TRAPS.find((t) => t.id === selectedTrapId) ?? TIMER_TRAPS[0],
    [selectedTrapId]
  );
  const cycleTotal = selectedTrap.cycleDuration!;
  const visibleDuration = selectedTrap.visibleDuration ?? 1;
  const warnAt = getWarnAt(cycleTotal);
  const dangerAt = getDangerAt(cycleTotal);

  // localStorage 로드
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("trap_mode");
      if (savedMode) setMode(savedMode as ViewMode);
      else setMode("pip");
      const savedVol = localStorage.getItem("trap_volume");
      if (savedVol) setVolume(parseFloat(savedVol));
      const savedMuted = localStorage.getItem("trap_muted");
      if (savedMuted) setMuted(savedMuted === "true");
      const savedTrap = localStorage.getItem("trap_selected");
      if (savedTrap && TIMER_TRAPS.some((t) => t.id === savedTrap)) {
        setSelectedTrapId(savedTrap);
      }
      const savedTimers = localStorage.getItem("trap_multi_timers");
      if (savedTimers) {
        const parsed = JSON.parse(savedTimers);
        setMultiTimers(
          parsed.map((t: { id: string; label: string }) => ({
            ...t,
            startedAt: null,
          }))
        );
      }
    } catch {
      // ignore
    }
    if (typeof window !== "undefined" && "documentPictureInPicture" in window) {
      setPipSupported(true);
    }
  }, []);

  // localStorage 저장
  useEffect(() => {
    localStorage.setItem("trap_mode", mode);
  }, [mode]);
  useEffect(() => {
    localStorage.setItem("trap_volume", String(volume));
  }, [volume]);
  useEffect(() => {
    localStorage.setItem("trap_muted", String(muted));
  }, [muted]);
  useEffect(() => {
    localStorage.setItem("trap_selected", selectedTrapId);
  }, [selectedTrapId]);
  useEffect(() => {
    localStorage.setItem(
      "trap_multi_timers",
      JSON.stringify(multiTimers.map((t) => ({ id: t.id, label: t.label })))
    );
  }, [multiTimers]);

  // 함정 변경 시 타이머 리셋
  const handleTrapChange = useCallback((trapId: string) => {
    setSelectedTrapId(trapId);
    setStartedAt(null);
    lastBeepPhaseRef.current = "";
  }, []);

  // remaining 초기화 (cycleTotal 변경 시)
  useEffect(() => {
    if (startedAt === null) {
      setRemaining(cycleTotal);
    }
  }, [cycleTotal, startedAt]);

  // 메인 타이머 루프 (싱글)
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => {
      const r = getSecondsRemaining(startedAt, cycleTotal);
      setRemaining(r);
    }, 50);
    return () => clearInterval(id);
  }, [startedAt, cycleTotal]);

  // 멀티 타이머 루프
  useEffect(() => {
    const hasActive = multiTimers.some((t) => t.startedAt !== null);
    if (!hasActive) return;
    const id = setInterval(() => {
      const newR: Record<string, number> = {};
      multiTimers.forEach((t) => {
        newR[t.id] = getSecondsRemaining(t.startedAt, cycleTotal);
      });
      setMultiRemainings(newR);
    }, 50);
    return () => clearInterval(id);
  }, [multiTimers, cycleTotal]);

  // 사운드 모드: 비프음
  useEffect(() => {
    if (mode !== "sound" || startedAt === null || muted) return;
    const phase = getPhase(remaining, warnAt, dangerAt, visibleDuration);
    const key = `${phase}-${Math.floor(remaining)}`;
    if (key === lastBeepPhaseRef.current) return;
    lastBeepPhaseRef.current = key;

    const effectiveVol = volume;
    if (phase === "caution" && Math.floor(remaining) === Math.floor(warnAt)) {
      playBeep(audioCtxRef, 600, 0.15, effectiveVol);
    } else if (phase === "danger" && remaining <= dangerAt && remaining > visibleDuration) {
      playBeep(audioCtxRef, 900, 0.1, effectiveVol);
    } else if (phase === "appearing") {
      playBeep(audioCtxRef, 1200, 0.3, effectiveVol);
    }
  }, [mode, remaining, startedAt, muted, volume, warnAt, dangerAt, visibleDuration]);

  // 키보드: 스페이스바로 시작/리셋
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        setStartedAt(Date.now());
        lastBeepPhaseRef.current = "";
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // PiP 업데이트
  useEffect(() => {
    if (!pipWindow || pipWindow.closed) return;
    const el = pipWindow.document.getElementById("pip-remaining");
    const statusEl = pipWindow.document.getElementById("pip-status");
    const containerEl = pipWindow.document.getElementById("pip-container");
    const labelEl = pipWindow.document.getElementById("pip-label");
    if (el) {
      el.textContent = startedAt === null ? "--" : remaining.toFixed(1);
    }
    if (labelEl) {
      labelEl.textContent = `${selectedTrap.name} 타이머 (${cycleTotal}초)`;
    }
    if (statusEl) {
      const phase = getPhase(remaining, warnAt, dangerAt, visibleDuration);
      if (startedAt === null) {
        statusEl.textContent = "스페이스바 또는 시작 버튼";
        statusEl.style.color = "#9ca3af";
      } else if (phase === "appearing") {
        statusEl.textContent = "함정 발동!";
        statusEl.style.color = "#ef4444";
      } else if (phase === "danger") {
        statusEl.textContent = "위험!";
        statusEl.style.color = "#ef4444";
      } else if (phase === "caution") {
        statusEl.textContent = "주의";
        statusEl.style.color = "#eab308";
      } else {
        statusEl.textContent = "안전";
        statusEl.style.color = "#22c55e";
      }
    }
    if (containerEl) {
      const phase = getPhase(remaining, warnAt, dangerAt, visibleDuration);
      if (startedAt !== null && (phase === "danger" || phase === "appearing")) {
        containerEl.style.backgroundColor = "rgba(127,29,29,0.8)";
      } else {
        containerEl.style.backgroundColor = "rgba(0,0,0,0.85)";
      }
    }
  }, [remaining, startedAt, pipWindow, selectedTrap.name, cycleTotal, warnAt, dangerAt, visibleDuration]);

  const handleSync = useCallback(() => {
    setStartedAt(Date.now());
    lastBeepPhaseRef.current = "";
  }, []);

  const handleReset = useCallback(() => {
    setStartedAt(null);
    lastBeepPhaseRef.current = "";
  }, []);

  // PiP 열기
  const openPiP = useCallback(async () => {
    if (!("documentPictureInPicture" in window)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pip = await (window as any).documentPictureInPicture.requestWindow({
        width: 320,
        height: 140,
      });
      // 스타일 복사
      const style = pip.document.createElement("style");
      style.textContent = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; overflow: hidden; }
        #pip-container {
          width: 100%; height: 100vh;
          background: rgba(0,0,0,0.85);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          color: white; padding: 12px;
          transition: background-color 0.3s;
        }
        #pip-remaining {
          font-size: 48px; font-weight: bold;
          line-height: 1.1;
        }
        #pip-status {
          font-size: 14px; margin-top: 4px; color: #9ca3af;
        }
        #pip-label {
          font-size: 11px; color: #6b7280; margin-top: 2px;
        }
      `;
      pip.document.head.appendChild(style);
      pip.document.body.innerHTML = `
        <div id="pip-container">
          <div id="pip-remaining">--</div>
          <div id="pip-status">스페이스바 또는 시작 버튼</div>
          <div id="pip-label">${selectedTrap.name} 타이머 (${cycleTotal}초)</div>
        </div>
      `;
      setPipWindow(pip);
      pip.addEventListener("pagehide", () => setPipWindow(null));
    } catch {
      // PiP failed
    }
  }, [selectedTrap.name, cycleTotal]);

  // 멀티 타이머 함수
  const addMultiTimer = () => {
    const newId = String(Date.now());
    setMultiTimers((prev) => [...prev, { id: newId, label: "", startedAt: null }]);
  };
  const removeMultiTimer = (id: string) => {
    setMultiTimers((prev) => prev.filter((t) => t.id !== id));
  };
  const syncMultiTimer = (id: string) => {
    setMultiTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, startedAt: Date.now() } : t))
    );
  };
  const resetMultiTimer = (id: string) => {
    setMultiTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, startedAt: null } : t))
    );
  };
  const updateMultiLabel = (id: string, label: string) => {
    setMultiTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, label } : t))
    );
  };

  // 현재 phase
  const phase = startedAt !== null ? getPhase(remaining, warnAt, dangerAt, visibleDuration) : null;

  // 모드 탭 정보
  const modes: { key: ViewMode; label: string }[] = [
    { key: "gradient", label: "컬러 상태바" },
    { key: "compact", label: "컴팩트" },
    { key: "sound", label: "알림음" },
    { key: "multi", label: "다중 타이머" },
    { key: "pip", label: "PiP 모드" },
  ];

  // 함정 출현 시 표시 텍스트
  const trapAppearText = selectedTrap.id === "leafre-mole" ? "두더지 출현" : "함정 발동";

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">맵 함정 타이머</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {selectedTrap.name} 사이클 타이머 — {cycleTotal}초 주기
        {selectedTrap.hiddenDuration !== null && selectedTrap.visibleDuration !== null
          ? ` (은신 ${selectedTrap.hiddenDuration}초 + 출현 ${selectedTrap.visibleDuration}초)`
          : ""}
      </p>

      {/* ─── 함정 선택 ─── */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          타이머 대상 함정
        </label>
        <div className="flex flex-wrap gap-2">
          {TIMER_TRAPS.map((trap) => (
            <button
              key={trap.id}
              onClick={() => handleTrapChange(trap.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                selectedTrapId === trap.id
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400"
              }`}
            >
              {trap.name}
              <span className={`ml-1.5 text-xs ${
                selectedTrapId === trap.id
                  ? "text-orange-100"
                  : "text-gray-400 dark:text-gray-500"
              }`}>
                ({trap.cycleDuration}초)
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── 모드 선택 탭 ─── */}
      <div className="flex flex-wrap gap-1 mb-4">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === m.key
                ? "bg-orange-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ─── 시작/리셋 버튼 (싱글 모드 공통) ─── */}
      {mode !== "multi" && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleSync}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium text-sm transition-colors"
          >
            {startedAt === null ? "시작" : "재동기화"}
          </button>
          {startedAt !== null && (
            <button
              onClick={handleReset}
              className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-sm transition-colors"
            >
              리셋
            </button>
          )}
          <span className="text-xs text-gray-400 hidden sm:inline">
            스페이스바로도 시작/재동기화 가능
          </span>
        </div>
      )}

      {/* ─── Mode 1: 컬러 그라데이션 상태바 ─── */}
      {mode === "gradient" && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <div className="text-center mb-4">
            <div
              className={`text-6xl font-mono font-bold tabular-nums transition-colors ${
                phase === "appearing"
                  ? "text-red-500 animate-pulse"
                  : phase === "danger"
                  ? "text-red-500 animate-trapShake"
                  : phase === "caution"
                  ? "text-yellow-500"
                  : "text-green-500"
              }`}
            >
              {startedAt === null ? "--" : remaining.toFixed(1)}
              <span className="text-2xl ml-1">초</span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {startedAt === null
                ? "시작 버튼 또는 스페이스바를 눌러 함정 발동에 맞춰 동기화하세요"
                : phase === "appearing"
                ? `${trapAppearText} 중!`
                : phase === "danger"
                ? "위험! 곧 발동합니다"
                : phase === "caution"
                ? "주의 — 잠시 후 발동"
                : "안전 구간"}
            </div>
          </div>
          {/* 프로그레스 바 */}
          <div className="w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                phase === "appearing"
                  ? "bg-red-600 animate-pulse"
                  : phase === "danger"
                  ? "bg-red-500"
                  : phase === "caution"
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{
                width:
                  startedAt === null
                    ? "0%"
                    : `${((cycleTotal - remaining) / cycleTotal) * 100}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>안전</span>
            <span>주의 ({Math.round(warnAt)}초)</span>
            <span>위험 ({Math.round(dangerAt)}초)</span>
            <span>발동</span>
          </div>
        </div>
      )}

      {/* ─── Mode 2: 컴팩트 오버레이 ─── */}
      {mode === "compact" && (
        <div className="bg-black/70 rounded-xl p-6 mb-6 max-w-xs mx-auto text-center" style={{ minHeight: 120 }}>
          <div
            className={`text-5xl font-mono font-bold tabular-nums ${
              phase === "appearing" || phase === "danger"
                ? "text-red-500"
                : phase === "caution"
                ? "text-yellow-400"
                : "text-white"
            }`}
          >
            {startedAt === null ? "--" : remaining.toFixed(1)}
          </div>
          <div
            className={`text-sm mt-1 font-medium ${
              phase === "danger" || phase === "appearing"
                ? "text-red-400"
                : phase === "caution"
                ? "text-yellow-400"
                : "text-gray-400"
            }`}
          >
            {startedAt === null
              ? "대기 중"
              : phase === "appearing"
              ? `${trapAppearText}!`
              : phase === "danger"
              ? "위험!"
              : phase === "caution"
              ? "주의"
              : "안전"}
          </div>
        </div>
      )}

      {/* ─── Mode 3: 알림음 + 진동 효과 ─── */}
      {mode === "sound" && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <div className="text-center mb-4">
            <div
              className={`text-6xl font-mono font-bold tabular-nums transition-colors ${
                phase === "appearing"
                  ? "text-red-500 animate-pulse"
                  : phase === "danger"
                  ? "text-red-500 animate-trapShake"
                  : phase === "caution"
                  ? "text-yellow-500"
                  : "text-green-500"
              }`}
            >
              {startedAt === null ? "--" : remaining.toFixed(1)}
              <span className="text-2xl ml-1">초</span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {startedAt === null
                ? "시작 버튼을 눌러 동기화하세요"
                : phase === "appearing"
                ? `${trapAppearText} 중!`
                : phase === "danger"
                ? "위험! 곧 발동합니다"
                : phase === "caution"
                ? "주의 — 잠시 후 발동"
                : "안전 구간"}
            </div>
          </div>
          {/* 프로그레스 바 */}
          <div className="w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                phase === "appearing"
                  ? "bg-red-600 animate-pulse"
                  : phase === "danger"
                  ? "bg-red-500"
                  : phase === "caution"
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{
                width:
                  startedAt === null
                    ? "0%"
                    : `${((cycleTotal - remaining) / cycleTotal) * 100}%`,
              }}
            />
          </div>
          {/* 사운드 컨트롤 */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <button
              onClick={() => setMuted(!muted)}
              className={`p-1.5 rounded-lg transition-colors ${
                muted
                  ? "bg-red-100 dark:bg-red-900/30 text-red-500"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              }`}
              title={muted ? "음소거 해제" : "음소거"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {muted ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072M12 6.253v11.494m0 0L7.293 13.04a1 1 0 00-.707-.293H4a1 1 0 01-1-1V8.253a1 1 0 011-1h2.586a1 1 0 00.707-.293L12 2.253"
                  />
                )}
              </svg>
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 accent-orange-500"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[3rem] text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {Math.round(warnAt)}초 전: 경고음 / {Math.round(dangerAt)}초 이내: 긴급음 / 발동 시: 알림음
          </p>
        </div>
      )}

      {/* ─── Mode 4: 다중 타이머 ─── */}
      {mode === "multi" && (
        <div className="space-y-3 mb-6">
          {[...multiTimers]
            .sort((a, b) => {
              const ra = a.startedAt !== null ? (multiRemainings[a.id] ?? cycleTotal) : Infinity;
              const rb = b.startedAt !== null ? (multiRemainings[b.id] ?? cycleTotal) : Infinity;
              return ra - rb;
            })
            .map((timer, idx) => {
              const r = multiRemainings[timer.id] ?? cycleTotal;
              const p = timer.startedAt !== null ? getPhase(r, warnAt, dangerAt, visibleDuration) : null;
              return (
                <div
                  key={timer.id}
                  className={`bg-white dark:bg-gray-800 border rounded-xl p-4 transition-colors ${
                    p === "appearing" || p === "danger"
                      ? "border-red-400 dark:border-red-600"
                      : p === "caution"
                      ? "border-yellow-400 dark:border-yellow-600"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-5">#{idx + 1}</span>
                    <input
                      type="text"
                      value={timer.label}
                      onChange={(e) => updateMultiLabel(timer.id, e.target.value)}
                      placeholder="라벨 (예: 남둥 1ch)"
                      className="flex-1 min-w-0 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                    <div
                      className={`text-3xl font-mono font-bold tabular-nums min-w-[5rem] text-right ${
                        p === "appearing"
                          ? "text-red-500 animate-pulse"
                          : p === "danger"
                          ? "text-red-500"
                          : p === "caution"
                          ? "text-yellow-500"
                          : timer.startedAt !== null
                          ? "text-green-500"
                          : "text-gray-300 dark:text-gray-600"
                      }`}
                    >
                      {timer.startedAt === null ? "--" : r.toFixed(1)}
                    </div>
                    <button
                      onClick={() => syncMultiTimer(timer.id)}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      {timer.startedAt === null ? "시작" : "재동기화"}
                    </button>
                    {timer.startedAt !== null && (
                      <button
                        onClick={() => resetMultiTimer(timer.id)}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors"
                      >
                        리셋
                      </button>
                    )}
                    {multiTimers.length > 1 && (
                      <button
                        onClick={() => removeMultiTimer(timer.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        title="삭제"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          <button
            onClick={addMultiTimer}
            className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:border-orange-400 hover:text-orange-500 transition-colors"
          >
            + 타이머 추가
          </button>
        </div>
      )}

      {/* ─── Mode 5: PiP 오버레이 모드 ─── */}
      {mode === "pip" && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          {/* 시작/리셋 버튼은 싱글 모드 공통에서 이미 표시 */}
          {/* 컴팩트 프리뷰 */}
          <div
            ref={pipContainerRef}
            className="bg-black/70 rounded-xl p-6 max-w-xs mx-auto text-center mb-4"
            style={{ minHeight: 120 }}
          >
            <div
              className={`text-5xl font-mono font-bold tabular-nums ${
                phase === "appearing" || phase === "danger"
                  ? "text-red-500"
                  : phase === "caution"
                  ? "text-yellow-400"
                  : "text-white"
              }`}
            >
              {startedAt === null ? "--" : remaining.toFixed(1)}
            </div>
            <div
              className={`text-sm mt-1 font-medium ${
                phase === "danger" || phase === "appearing"
                  ? "text-red-400"
                  : phase === "caution"
                  ? "text-yellow-400"
                  : "text-gray-400"
              }`}
            >
              {startedAt === null
                ? "대기 중"
                : phase === "appearing"
                ? `${trapAppearText}!`
                : phase === "danger"
                ? "위험!"
                : phase === "caution"
                ? "주의"
                : "안전"}
            </div>
          </div>
          {pipSupported ? (
            <div className="text-center">
              <button
                onClick={openPiP}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium text-sm transition-colors"
              >
                PiP로 띄우기
              </button>
              <p className="text-xs text-gray-400 mt-2">
                작은 항상-위 창으로 타이머가 표시됩니다. 먼저 &quot;시작&quot; 버튼으로 타이머를 동기화하세요.
              </p>
              {pipWindow && !pipWindow.closed && (
                <p className="text-xs text-green-500 mt-1">PiP 창이 열려있습니다</p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                이 브라우저는 Document Picture-in-Picture API를 지원하지 않습니다.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Chrome 116+ 또는 Edge 116+ 브라우저를 사용해주세요.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── 오버레이 설정 가이드 ─── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl mb-6 overflow-hidden">
        <button
          onClick={() => setGuideOpen(!guideOpen)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <span className="font-bold text-sm">오버레이 설정 가이드</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${guideOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {guideOpen && (
          <div className="px-5 pb-5 space-y-5 border-t border-gray-100 dark:border-gray-700 pt-4">
            {/* 방법 1 */}
            <div>
              <h3 className="font-bold text-sm text-orange-600 mb-2">
                방법 1: PiP 모드 (추천 — 설치 불필요)
              </h3>
              <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>Chrome/Edge 브라우저에서 이 페이지를 엽니다</li>
                <li>위의 &quot;PiP로 띄우기&quot; 버튼을 클릭합니다</li>
                <li>작은 타이머 창이 화면 구석에 고정됩니다</li>
                <li>메이플랜드를 <strong>창모드</strong>로 실행하면 타이머가 항상 위에 표시됩니다</li>
                <li>창 크기와 위치를 드래그로 조절하세요</li>
              </ol>
            </div>
            {/* 방법 2 */}
            <div>
              <h3 className="font-bold text-sm text-orange-600 mb-2">
                방법 2: PowerToys Always on Top (Windows)
              </h3>
              <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>
                  Microsoft PowerToys를 설치합니다 (
                  <a
                    href="https://aka.ms/installpowertoys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 hover:underline"
                  >
                    https://aka.ms/installpowertoys
                  </a>
                  )
                </li>
                <li>이 페이지를 작은 브라우저 창으로 엽니다</li>
                <li>해당 브라우저 창에서 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">Win + Ctrl + T</code>를 누르면 항상 위에 고정됩니다</li>
                <li>메이플랜드를 창모드로 실행하세요</li>
              </ol>
            </div>
            {/* 방법 3 */}
            <div>
              <h3 className="font-bold text-sm text-orange-600 mb-2">
                방법 3: 브라우저 창 수동 배치
              </h3>
              <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>이 페이지를 별도 브라우저 창으로 엽니다</li>
                <li>창 크기를 작게 줄입니다</li>
                <li>메이플랜드를 창모드로 실행합니다</li>
                <li>타이머 창을 게임 창 옆에 배치합니다</li>
              </ol>
            </div>
            {/* 중요 */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
                중요: 메이플랜드는 반드시 <strong>창모드</strong> 또는 <strong>보더리스 창모드</strong>로 실행해야 오버레이가 보입니다.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── 맵 함정 정보 ─── */}
      <div className="mb-6">
        <h2 className="font-bold text-lg mb-3">맵 함정 정보</h2>
        <div className="space-y-2">
          {TRAPS.map((trap) => (
            <div
              key={trap.id}
              className={`border rounded-xl p-4 ${trap.color}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">{trap.name}</h3>
                    {trap.cycleDuration !== null ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                        타이머 사용 가능
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                        타이머 불가
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{trap.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{trap.effect}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    사이클: {trap.cycleDuration !== null
                      ? `${trap.cycleDuration}초${trap.hiddenDuration !== null && trap.visibleDuration !== null ? ` (은신 ${trap.hiddenDuration}초 + 출현 ${trap.visibleDuration}초)` : ""}`
                      : "불명"}
                  </p>
                </div>
              </div>
              {trap.note && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1.5">{trap.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── 참고사항 ─── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-bold mb-3">참고사항</h2>
        <ul className="space-y-1.5">
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            타이머는 게임 내 실제 함정 발동에 맞춰 수동으로 동기화해야 합니다.
          </li>
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            함정이 발동하는 순간 시작 버튼(또는 스페이스바)을 누르면 다음 사이클부터 정확하게 예측됩니다.
          </li>
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            리프레 두더지: 은신 30초 + 출현 1초 = 총 31초. 출현 시 3초 스턴 (모든 내성 무시).
          </li>
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            엘나스/슬리피우드 증기: 은신 7초 + 분출 2초 = 총 9초 주기.
          </li>
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            장시간 사용 시 타이머와 게임 간 미세한 오차가 발생할 수 있습니다. 필요 시 재동기화하세요.
          </li>
        </ul>
      </div>

    </div>
  );
}
