"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createBossTimerRoom, pollBossTimerRoom, bossTimerAction } from "@/lib/api";

/* ── 타입 ── */
interface RaidTimer {
  id: string;
  label: string;
  duration: number; // 초
  endAt: number | null; // 실행 중이면 종료 시각(ms), 아니면 null. 공유 방에선 서버 시계 기준
  removable: boolean;
}

interface TimerSection {
  id: string;
  title: string;
  icon: string;
  desc: string;
  timers: RaidTimer[];
}

interface RoomInfo {
  code: string;
  version: number;
  members: number;
  log: { at: number; text: string }[];
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
const POLL_INTERVAL = 2000;

/* 섹션별 단축키 풀 — 키보드 한 줄이 섹션 하나에 대응. 타이머 순서대로 배정, 풀 소진 시 이후 타이머는 단축키 없음 */
const SECTION_HOTKEYS: Record<string, string[]> = {
  resurrection: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  "death-buff": ["Q", "W", "E", "R", "T"],
  cancel: ["A", "S", "D", "F", "G"],
  dispel: ["Z", "X", "C", "V", "B"],
  custom: ["U", "I", "O", "P", "J", "K", "L"],
};

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

/* 만료 알림음 1회 재생 마커 — 같은 실행(endAt)당 한 번만 */
const beepedKeys = new Set<string>();
let sharedAudioCtx: { current: AudioContext | null } = { current: null };
function ExpireBeeper({ beepKey }: { beepKey: string }) {
  useEffect(() => {
    if (beepedKeys.has(beepKey)) return;
    beepedKeys.add(beepKey);
    playBeep(sharedAudioCtx, 1100, 0.25, 0.5);
    const t = setTimeout(() => playBeep(sharedAudioCtx, 1400, 0.35, 0.5), 300);
    return () => clearTimeout(t);
  }, [beepKey]);
  return null;
}

/* ── 타이머 카드 ── */
function TimerCard({
  timer, now, muted, hotkey, onStart, onStop, onEdit, onRemove,
}: {
  timer: RaidTimer;
  now: number; // 보정된 현재 시각(ms)
  muted: boolean;
  hotkey?: string;
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
              onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && saveEdit()}
              className="w-full pixel-input px-2 py-1 text-xs"
              placeholder="이름"
              autoFocus
            />
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={durDraft}
                onChange={(e) => setDurDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && saveEdit()}
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
              {hotkey && (
                <kbd
                  className="shrink-0 font-mono text-[10px] leading-none text-dim border border-edge px-1 py-0.5 bg-surface2"
                  title={`${hotkey}: 시작/재시작 · Shift+${hotkey}: 정지`}
                >
                  {hotkey}
                </kbd>
              )}
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
            {expired && !muted && <ExpireBeeper beepKey={`${timer.id}-${timer.endAt}`} />}
          </>
        )}
      </div>
      {running && !expired ? (
        <div className="w-16 shrink-0 flex flex-col border-l-2 border-edge">
          <button
            onClick={onStart}
            className="flex-1 font-pixel text-[12px] bg-surface2 text-dim hover:text-maple transition-colors"
            title="재시작 (재동기화)"
          >
            재시작
          </button>
          <button
            onClick={onStop}
            className="flex-1 font-pixel text-[12px] border-t-2 border-edge bg-surface2 text-dim hover:text-red-500 transition-colors"
            title="정지 (리셋)"
          >
            정지
          </button>
        </div>
      ) : (
        <button
          onClick={expired ? onStop : onStart}
          onContextMenu={(e) => { e.preventDefault(); onStop(); }}
          className={`w-16 shrink-0 font-pixel text-[13px] transition-colors border-l-2 border-edge ${
            expired ? "bg-red-500 text-white hover:bg-red-600" : "bg-maple text-white hover:brightness-110"
          }`}
          title={expired ? "리셋" : "시작"}
        >
          {expired ? "완료" : "시작"}
        </button>
      )}
    </div>
  );
}

/* ── 메인 ── */
export default function BossTimerPage() {
  const [sections, setSections] = useState<TimerSection[]>(HORNTAIL_SECTIONS);
  const [now, setNow] = useState(0);
  const [muted, setMuted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 공유 방
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const [copied, setCopied] = useState(false);
  const clientIdRef = useRef("");
  const serverOffsetRef = useRef(0); // server_now - Date.now()
  const roomRef = useRef<RoomInfo | null>(null);
  roomRef.current = room;
  const nicknameRef = useRef("");
  nicknameRef.current = nickname;

  const audioCtxRef = useRef<AudioContext | null>(null);
  sharedAudioCtx = audioCtxRef;

  const inRoom = room !== null;

  /* 응답 공통 반영 */
  const applyResponse = useCallback((code: string, res: {
    version: number; state?: TimerSection[]; log?: { at: number; text: string }[];
    server_now: number; members: number; changed: boolean;
  }) => {
    serverOffsetRef.current = res.server_now - Date.now();
    if (res.changed && res.state) setSections(res.state);
    setRoom((prev) => ({
      code,
      version: res.version,
      members: res.members,
      log: res.log ?? prev?.log ?? [],
    }));
  }, []);

  /* 초기화: 로컬 저장 복원 + 닉네임/클라이언트ID + URL·저장된 방 자동 참여 */
  useEffect(() => {
    try {
      let cid = localStorage.getItem("boss_timer_client_id");
      if (!cid) {
        cid = Math.random().toString(36).slice(2, 12);
        localStorage.setItem("boss_timer_client_id", cid);
      }
      clientIdRef.current = cid;
      setNickname(localStorage.getItem("boss_timer_nickname") ?? "");

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: TimerSection[] = JSON.parse(raw);
        setSections(
          HORNTAIL_SECTIONS.map((preset) => {
            const s = saved.find((x) => x.id === preset.id);
            return s ? { ...preset, timers: s.timers } : preset;
          })
        );
      }
      const m = localStorage.getItem("boss_timer_muted");
      if (m) setMuted(m === "true");

      // URL ?room=CODE 또는 이전 세션의 방으로 재참여
      const urlCode = new URLSearchParams(window.location.search).get("room");
      const savedCode = localStorage.getItem("boss_timer_room");
      const code = (urlCode || savedCode || "").toUpperCase();
      if (code) {
        const nick = localStorage.getItem("boss_timer_nickname") || "익명";
        pollBossTimerRoom(code, 0, cid, nick)
          .then((res) => applyResponse(code, res))
          .catch(() => localStorage.removeItem("boss_timer_room"));
      }
    } catch {
      // ignore
    }
    setNow(Date.now());
    setLoaded(true);
  }, [applyResponse]);

  /* 로컬 모드에서만 로컬 저장 */
  useEffect(() => {
    if (!loaded || inRoom) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sections)); } catch { /* ignore */ }
  }, [sections, loaded, inRoom]);

  useEffect(() => {
    localStorage.setItem("boss_timer_muted", String(muted));
  }, [muted]);

  useEffect(() => {
    if (nickname) localStorage.setItem("boss_timer_nickname", nickname);
  }, [nickname]);

  /* 방 폴링 — 2초마다 version 증가분 수신 */
  useEffect(() => {
    if (!inRoom) return;
    const id = setInterval(() => {
      const r = roomRef.current;
      if (!r) return;
      pollBossTimerRoom(r.code, r.version, clientIdRef.current, nicknameRef.current || "익명")
        .then((res) => applyResponse(r.code, res))
        .catch((e) => {
          if (String(e.message).includes("찾을 수 없")) {
            setShareError("방이 만료되었습니다");
            setRoom(null);
            localStorage.removeItem("boss_timer_room");
          }
        });
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [inRoom, applyResponse]);

  /* 틱 — 실행 중 타이머가 있을 때만 (방 모드에선 서버 시계 오프셋 보정) */
  const anyRunning = sections.some((s) => s.timers.some((t) => t.endAt !== null));
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [anyRunning]);

  const correctedNow = inRoom ? now + serverOffsetRef.current : now;

  /* ── 동작 디스패치: 로컬이면 즉시 변경, 방이면 서버 액션 ── */
  const dispatch = useCallback((
    action: { type: "start" | "stop" | "edit" | "add" | "remove"; section_id: string; timer_id?: string; label?: string; duration?: number },
    localApply: () => void
  ) => {
    const r = roomRef.current;
    if (!r) { localApply(); return; }
    bossTimerAction(r.code, action, clientIdRef.current, nicknameRef.current || "익명")
      .then((res) => applyResponse(r.code, res))
      .catch((e) => setShareError(String(e.message)));
  }, [applyResponse]);

  const updateTimerLocal = useCallback((sectionId: string, timerId: string, patch: Partial<RaidTimer>) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId ? s : { ...s, timers: s.timers.map((t) => (t.id === timerId ? { ...t, ...patch } : t)) }
      )
    );
  }, []);

  const startTimer = useCallback((sectionId: string, timer: RaidTimer) => {
    beepedKeys.delete(`${timer.id}-${timer.endAt}`);
    dispatch({ type: "start", section_id: sectionId, timer_id: timer.id }, () => {
      updateTimerLocal(sectionId, timer.id, { endAt: Date.now() + timer.duration * 1000 });
      setNow(Date.now());
    });
  }, [dispatch, updateTimerLocal]);

  const stopTimer = useCallback((sectionId: string, timerId: string) => {
    dispatch({ type: "stop", section_id: sectionId, timer_id: timerId }, () => {
      updateTimerLocal(sectionId, timerId, { endAt: null });
    });
  }, [dispatch, updateTimerLocal]);

  /* ── 단축키 ── 섹션별 풀에서 타이머 순서대로 배정. 키: 시작/재시작 · Shift+키: 정지 */
  const hotkeyOf = useMemo(() => {
    const map = new Map<string, string>(); // timer.id → key
    for (const s of sections) {
      const pool = SECTION_HOTKEYS[s.id] ?? [];
      s.timers.forEach((t, i) => {
        if (i < pool.length) map.set(t.id, pool[i]);
      });
    }
    return map;
  }, [sections]);

  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      // Shift+숫자는 e.key가 특수문자로 바뀌므로 물리 키(e.code) 기준으로 매칭
      const m = e.code.match(/^(?:Digit|Numpad)(\d)$|^Key([A-Z])$/);
      if (!m) return;
      const key = m[1] ?? m[2];
      for (const s of sectionsRef.current) {
        const pool = SECTION_HOTKEYS[s.id] ?? [];
        const idx = pool.indexOf(key);
        if (idx < 0 || idx >= s.timers.length) continue;
        e.preventDefault();
        const t = s.timers[idx];
        if (e.shiftKey) stopTimer(s.id, t.id);
        else startTimer(s.id, t);
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [startTimer, stopTimer]);

  const editTimer = useCallback((sectionId: string, timerId: string, label: string, duration: number) => {
    dispatch({ type: "edit", section_id: sectionId, timer_id: timerId, label, duration }, () => {
      updateTimerLocal(sectionId, timerId, { label, duration, endAt: null });
    });
  }, [dispatch, updateTimerLocal]);

  const addTimer = useCallback((sectionId: string) => {
    const label = sectionId === "custom" ? "유혹" : "타이머";
    dispatch({ type: "add", section_id: sectionId, label, duration: 60 }, () => {
      setSections((prev) =>
        prev.map((s) =>
          s.id !== sectionId
            ? s
            : {
                ...s,
                timers: [
                  ...s.timers,
                  {
                    id: `${sectionId}-x${Math.random().toString(36).slice(2, 8)}`,
                    label: s.timers.length > 0 && sectionId !== "custom" ? `타이머 ${s.timers.length + 1}` : label,
                    duration: 60,
                    endAt: null,
                    removable: true,
                  },
                ],
              }
        )
      );
    });
  }, [dispatch]);

  const removeTimer = useCallback((sectionId: string, timerId: string) => {
    dispatch({ type: "remove", section_id: sectionId, timer_id: timerId }, () => {
      setSections((prev) =>
        prev.map((s) => (s.id !== sectionId ? s : { ...s, timers: s.timers.filter((t) => t.id !== timerId) }))
      );
    });
  }, [dispatch]);

  const resetAll = useCallback(() => {
    if (roomRef.current) {
      alert("공유 방에서는 전체 리셋 대신 각 타이머를 개별 리셋(우클릭)해 주세요.");
      return;
    }
    if (!confirm("모든 타이머를 정지하고 초기 상태로 되돌릴까요? (이름·시간 설정은 유지)")) return;
    beepedKeys.clear();
    setSections((prev) => prev.map((s) => ({ ...s, timers: s.timers.map((t) => ({ ...t, endAt: null })) })));
  }, []);

  /* ── 방 만들기 / 참여 / 나가기 ── */
  const createRoom = useCallback(() => {
    setShareBusy(true);
    setShareError("");
    createBossTimerRoom(sections, nickname || "익명", clientIdRef.current)
      .then((res) => {
        applyResponse(res.code!, { ...res, changed: true });
        localStorage.setItem("boss_timer_room", res.code!);
      })
      .catch((e) => setShareError(String(e.message)))
      .finally(() => setShareBusy(false));
  }, [sections, nickname, applyResponse]);

  const joinRoom = useCallback(() => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setShareError("6자리 방 코드를 입력하세요"); return; }
    setShareBusy(true);
    setShareError("");
    pollBossTimerRoom(code, 0, clientIdRef.current, nickname || "익명")
      .then((res) => {
        applyResponse(code, res);
        localStorage.setItem("boss_timer_room", code);
        setJoinCode("");
      })
      .catch((e) => setShareError(String(e.message)))
      .finally(() => setShareBusy(false));
  }, [joinCode, nickname, applyResponse]);

  const leaveRoom = useCallback(() => {
    setRoom(null);
    localStorage.removeItem("boss_timer_room");
    // 로컬 설정 복원
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: TimerSection[] = JSON.parse(raw);
        setSections(
          HORNTAIL_SECTIONS.map((preset) => {
            const s = saved.find((x) => x.id === preset.id);
            return s ? { ...preset, timers: s.timers } : preset;
          })
        );
      } else {
        setSections(HORNTAIL_SECTIONS);
      }
    } catch {
      setSections(HORNTAIL_SECTIONS);
    }
  }, []);

  const copyShareLink = useCallback(() => {
    if (!roomRef.current) return;
    const url = `${window.location.origin}/boss-timer?room=${roomRef.current.code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
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
      <p className="text-sm text-dim mb-4">
        혼테일 공대용 쿨타임 보드 — 리저렉션·사망팅·공무·버프해제를 각각 독립 타이머로 잽니다.
        모든 카드는 <span className="text-maple">수정</span> 버튼으로 이름과 시간을 바꿀 수 있습니다.
      </p>

      {/* ── 공대 공유 패널 ── */}
      <div className="pixel-panel p-4 mb-6">
        {inRoom ? (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-pixel text-sm text-maple">📡 공유 중</span>
              <span className="font-mono font-bold text-lg tracking-widest">{room.code}</span>
              <span className="text-xs text-dim">👥 {room.members}명 접속</span>
              <button onClick={copyShareLink} className="pixel-btn px-3 py-1.5 text-xs">
                {copied ? "복사됨!" : "초대 링크 복사"}
              </button>
              <button
                onClick={leaveRoom}
                className="px-3 py-1.5 text-xs font-pixel border-2 border-edge text-dim hover:text-red-500 hover:border-red-400 transition-colors"
              >
                방 나가기
              </button>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 12))}
                placeholder="내 닉네임"
                className="pixel-input px-2 py-1.5 text-xs w-28"
              />
            </div>
            {room.log.length > 0 && (
              <div className="mt-3 pt-3 border-t border-edge/60 space-y-0.5">
                {[...room.log].reverse().slice(0, 4).map((l, i) => (
                  <p key={`${l.at}-${i}`} className={`text-xs ${i === 0 ? "text-ink" : "text-dim"}`}>
                    <span className="text-dim font-mono">
                      {new Date(l.at).toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>{" "}
                    {l.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-pixel text-sm">📡 공대 공유</span>
            <span className="text-xs text-dim mr-2">— 한 명이 누르면 전원 화면에 반영됩니다</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 12))}
              placeholder="내 닉네임"
              className="pixel-input px-2 py-1.5 text-xs w-28"
            />
            <button onClick={createRoom} disabled={shareBusy} className="pixel-btn px-3 py-1.5 text-xs disabled:opacity-50">
              방 만들기
            </button>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && joinRoom()}
                placeholder="방 코드"
                className="pixel-input px-2 py-1.5 text-xs font-mono w-24 uppercase"
              />
              <button onClick={joinRoom} disabled={shareBusy} className="px-3 py-1.5 text-xs font-pixel border-2 border-edge text-dim hover:text-maple transition-colors disabled:opacity-50">
                참여
              </button>
            </div>
          </div>
        )}
        {shareError && <p className="text-xs text-red-500 mt-2">{shareError}</p>}
      </div>

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
                  now={correctedNow}
                  muted={muted}
                  hotkey={hotkeyOf.get(timer.id)}
                  onStart={() => startTimer(section.id, timer)}
                  onStop={() => stopTimer(section.id, timer.id)}
                  onEdit={(label, duration) => editTimer(section.id, timer.id, label, duration)}
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
            <span><strong>공대 공유</strong>: 방을 만들어 초대 링크(또는 6자리 코드)를 공대원에게 보내면, 누가 타이머를 시작하든 전원 화면에 2초 안에 반영됩니다. 기록 로그에 누가 눌렀는지 표시됩니다.</span>
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            실행 중에는 <strong>재시작</strong>(재동기화)과 <strong>정지</strong> 버튼이 함께 표시됩니다. 버튼 우클릭으로도 리셋할 수 있습니다.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            <span><strong>키보드 단축키</strong>: 각 카드 이름 옆의 키를 누르면 시작/재시작, <strong>Shift+키</strong>는 정지입니다. 키보드 줄별로 리저렉션 <span className="font-mono">1~0</span> · 사망&버프 <span className="font-mono">Q W E…</span> · 공무 <span className="font-mono">A S D…</span> · 버프해제 <span className="font-mono">Z X C…</span> · 커스텀 <span className="font-mono">U I O…</span> 순서로 배정됩니다. (입력창에 커서가 있을 땐 동작하지 않습니다)</span>
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
            타이머 종료 시 알림음이 울리고 숫자가 붉게 깜빡입니다. 새로고침해도 진행 중인 타이머와 방 참여가 이어집니다.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            기본값(리저 30분, 사망팅 15분, 인레이지 6분, 공무 45초 등)은 통용되는 공략 기준이며, 실측과 다르면 각 카드에서 수정해 쓰세요. 방은 마지막 조작 후 48시간이 지나면 자동 삭제됩니다.
          </li>
        </ul>
      </div>
    </div>
  );
}
