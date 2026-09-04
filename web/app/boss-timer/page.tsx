"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { createBossTimerRoom, pollBossTimerRoom, bossTimerAction } from "@/lib/api";

/* ── 타입 ── */
interface RaidTimer {
  id: string;
  label: string;
  duration: number; // 초
  endAt: number | null; // 실행 중이면 종료 시각(ms), 아니면 null. 공유 방에선 서버 시계 기준
  removable: boolean;
  repeat?: boolean; // 만료 시 자동 재시작(주기 패턴용). 구버전 저장분엔 없음(=꺼짐)
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

type BossId = "horntail" | "chaos-zakum";

interface BossPreset {
  id: BossId;
  name: string;
  icon: string;
  tagline: string;
  guideHref: string;
  guideLabel: string;
  /* 프리셋 기본값이 바뀌면 키 버전을 올려 구 저장분을 무시한다
   * (로드 시 저장분이 프리셋 duration을 덮어쓰는 구조) */
  storageKey: string;
  sections: TimerSection[];
  hotkeys: Record<string, string[]>; // 섹션 id → 키 풀 (키보드 한 줄 = 섹션 하나)
}

/* ── 혼테일 프리셋 ──
 * 수치 근거: 원작 v62 WZ 원본(MobSkill.img) + 메랜 유저 실측 (2026-07 검증)
 * - 공무·마무: 지속 40초(실측 43초) · 재사용 60초 — 머리별 물/마 모두 보유
 * - 버프해제: 중머리·좌팔 HP60%↓ 5분 / HP30%↓ 3분 (독립 쿨)
 * - 단체유혹: 좌팔·우팔 각각 HP30%↓ 60초마다 10인 · 개인유혹: 양팔 3분마다 1인(원정대 1번 고정)
 * - 인레이지 쿨 8분 / 리저 30분 / 사망 복귀 실측 14분
 * 값은 카드별 수정 가능.
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
    desc: "사망 후 마을 복귀 14분 · 인레이지 쿨 8분(지속 4분)",
    timers: [
      { id: "death-1", label: "사망 복귀-1", duration: 840, endAt: null, removable: false },
      { id: "death-2", label: "사망 복귀-2", duration: 840, endAt: null, removable: false },
      { id: "enrage", label: "인레이지", duration: 480, endAt: null, removable: false },
    ],
  },
  {
    id: "cancel",
    title: "공무 · 마무",
    icon: "⚔️",
    desc: "머리별 물리/마법 무효 — 지속 40초(실측 43초) · 재사용 60초. 시전 순간 시작",
    timers: [
      { id: "wc-left", label: "좌머리 공무", duration: 43, endAt: null, removable: false },
      { id: "wc-mid", label: "중머리 공무", duration: 43, endAt: null, removable: false },
      { id: "wc-right", label: "우머리 공무", duration: 43, endAt: null, removable: false },
      { id: "mc-left", label: "좌머리 마무", duration: 43, endAt: null, removable: false },
      { id: "mc-mid", label: "중머리 마무", duration: 43, endAt: null, removable: false },
      { id: "mc-right", label: "우머리 마무", duration: 43, endAt: null, removable: false },
    ],
  },
  {
    id: "dispel",
    title: "버프해제",
    icon: "🛡️",
    desc: "중머리·좌팔 각각 HP60%↓ 5분(5갈) · HP30%↓ 3분(3갈) — 서로 독립 쿨. 🔁 반복을 켜두면 매 주기 알림",
    timers: [
      { id: "dispel-5", label: "중머리 5갈 (60%↓)", duration: 300, endAt: null, removable: false },
      { id: "dispel-3", label: "중머리 3갈 (30%↓)", duration: 180, endAt: null, removable: false },
      { id: "dispel-arm", label: "좌팔 5갈 (60%↓)", duration: 300, endAt: null, removable: false },
      { id: "dispel-arm3", label: "좌팔 3갈 (30%↓)", duration: 180, endAt: null, removable: false },
    ],
  },
  {
    id: "custom",
    title: "유혹 · 커스텀",
    icon: "🌀",
    desc: "시전 순간 시작 — 타이머 종료 = 재시전 가능 시점(최소 간격). 단체유혹: 양팔 각각 HP30%↓ 쿨 60초 · 개인유혹: 양팔 각각 쿨 3분(원정대 1번 고정)",
    timers: [
      { id: "sed-left", label: "단체유혹 좌팔", duration: 60, endAt: null, removable: true },
      { id: "sed-right", label: "단체유혹 우팔", duration: 60, endAt: null, removable: true },
      { id: "sed-solo", label: "개인유혹", duration: 180, endAt: null, removable: true },
    ],
  },
];

/* ── 카오스 자쿰 프리셋 ──
 * 수치 근거: 메랜 2.0 커뮤니티 실측 공략(아카라이브 메이플랜드 채널 177722971, 2026-07)
 * + 메이플 아틀리에 카쿰 타이머 구성(첫/정기 유혹·디스펠·공격무효·직업 스킬) 참고
 * - 단체유혹: 입장순서 앞 5명 대상, 무조건 우측으로 시전 — 각 페이즈 시작 90초 후 첫 시전, 이후 30~180초 무작위
 * - 버프해제(몸통): 1페 없음 · 2페 진입(공략 표기 시점)부터 2분 간격 · 3페 진입 후 30~180초 무작위 (영웅의 메아리 제외 전부 해제)
 * - 팔 페이즈: 좌4·우4팔이 벞해, 좌2팔이 단유 — 팔 벞해는 무작위 수시라 타이머 대신 최우선 격파 대상
 * - 공무 40초: 메랜 실측(메이플 아틀리에 2026-06 공지 "공무 타이머 40초로 수정" 기준)
 * - 리저 30분·인레이지 8분: 혼테일과 동일 검증값 / 위협 40초·타임리프 20분·연막탄 10분: 원작 통용값 (실측 시 카드 수정)
 */
const CHAOS_ZAKUM_SECTIONS: TimerSection[] = [
  {
    id: "cz-seduce",
    title: "단체유혹",
    icon: "🌀",
    desc: "입장순서 앞 5명이 무조건 우측으로 걸림 — 첫 단유: 페이즈 시작 순간 시작(90초 후 시전) · 다음 단유: 시전 순간 시작(30~180초 무작위, 만료 = 위험 구간 진입)",
    timers: [
      { id: "cz-sed-first", label: "첫 단유 (페이즈+90초)", duration: 90, endAt: null, removable: false },
      { id: "cz-sed-next", label: "다음 단유 (최소 30초)", duration: 30, endAt: null, removable: false, repeat: true },
    ],
  },
  {
    id: "cz-dispel",
    title: "버프해제",
    icon: "🛡️",
    desc: "팔페: 좌4·우4팔이 무작위 시전(타이머 없음 — 최우선 격파) · 몸통: 1페 없음, 2페 진입 후 2분 간격, 3페 진입 후 30~180초 무작위. 영메 제외 전 버프 해제 — 만료 5초 전부터 뻥·가드 대기",
    timers: [
      { id: "cz-dis-p2", label: "벞해 2페 (2분 간격)", duration: 120, endAt: null, removable: false, repeat: true },
      { id: "cz-dis-p3", label: "벞해 3페 (최소 30초)", duration: 30, endAt: null, removable: false, repeat: true },
    ],
  },
  {
    id: "cz-combat",
    title: "공무 · 위협",
    icon: "⚔️",
    desc: "공무: 몸통 공격무효 지속 40초 — 시전 순간 시작 · 위협: 팔라딘 위협 지속 체크 — 만료가 곧 재시전 타이밍",
    timers: [
      { id: "cz-cancel", label: "공무 (공격무효)", duration: 40, endAt: null, removable: false },
      { id: "cz-threat", label: "위협 (팔라딘)", duration: 40, endAt: null, removable: false, repeat: true },
    ],
  },
  {
    id: "cz-skills",
    title: "리저렉션 · 직업 스킬",
    icon: "⚕️",
    desc: "비숍 리저 30분 — 이름을 비숍 닉네임으로 바꿔 쓰세요 · 인레이지 8분 · 타임리프 20분 · 연막탄 10분 (통용값 — 실측과 다르면 수정)",
    timers: [
      { id: "cz-res-1", label: "비숍 1", duration: 1800, endAt: null, removable: false },
      { id: "cz-res-2", label: "비숍 2", duration: 1800, endAt: null, removable: false },
      { id: "cz-res-3", label: "비숍 3", duration: 1800, endAt: null, removable: false },
      { id: "cz-enrage", label: "인레이지", duration: 480, endAt: null, removable: false },
      { id: "cz-timeleap", label: "타임리프", duration: 1200, endAt: null, removable: false },
      { id: "cz-smoke", label: "연막탄", duration: 600, endAt: null, removable: false },
    ],
  },
  {
    id: "cz-death",
    title: "사망 · 커스텀",
    icon: "🪦",
    desc: "사망 후 마을 복귀 14분 — 사망 순간 시작해 재입장 시점을 잽니다 (공대 룰에 맞게 수정 가능)",
    timers: [
      { id: "cz-death-1", label: "사망 복귀-1", duration: 840, endAt: null, removable: true },
      { id: "cz-death-2", label: "사망 복귀-2", duration: 840, endAt: null, removable: true },
    ],
  },
];

const BOSSES: Record<BossId, BossPreset> = {
  horntail: {
    id: "horntail",
    name: "혼테일",
    icon: "🐉",
    tagline:
      "혼테일 공대용 쿨타임 보드 — 리저렉션·사망팅·공무·버프해제를 각각 독립 타이머로 잽니다.",
    guideHref: "/horntail",
    guideLabel: "🐲 공략 가이드",
    storageKey: "boss_timer_horntail_v4",
    sections: HORNTAIL_SECTIONS,
    hotkeys: {
      resurrection: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      "death-buff": ["Q", "W", "E", "R", "T"],
      cancel: ["A", "S", "D", "F", "G", "H"],
      dispel: ["Z", "X", "C", "V", "B"],
      custom: ["U", "I", "O", "P", "J", "K", "L"],
    },
  },
  "chaos-zakum": {
    id: "chaos-zakum",
    name: "카오스 자쿰",
    icon: "🗿",
    tagline:
      "카오스 자쿰 공대용 쿨타임 보드 — 단체유혹·버프해제(2/3페)·공무·직업 스킬 쿨을 잽니다. 첫 단유는 페이즈 시작과 동시에, 나머지는 시전 순간 시작하세요.",
    guideHref: "/guild/info/5",
    guideLabel: "🗿 공략 가이드",
    storageKey: "boss_timer_chaos_zakum_v2",
    sections: CHAOS_ZAKUM_SECTIONS,
    hotkeys: {
      "cz-seduce": ["1", "2", "3", "4"],
      "cz-dispel": ["Q", "W", "E", "R"],
      "cz-combat": ["A", "S", "D", "F"],
      "cz-skills": ["Z", "X", "C", "V", "B", "N"],
      "cz-death": ["U", "I", "O", "P"],
    },
  },
};

const DEFAULT_BOSS: BossId = "horntail";
const POLL_INTERVAL = 2000;

/* 방 상태(섹션 배열)에서 보스 종류 판별 — 카쿰 섹션 id는 cz- 접두 */
function bossOfSections(state: TimerSection[]): BossId {
  return state.some((s) => String(s.id).startsWith("cz-")) ? "chaos-zakum" : "horntail";
}

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

/* 타이머 표시 상태 — 반복 타이머는 만료 후에도 다음 주기를 계속 카운트다운 */
function timerState(timer: RaidTimer, now: number) {
  const running = timer.endAt !== null;
  const repeatOn = !!timer.repeat;
  const raw = running ? (timer.endAt! - now) / 1000 : timer.duration;
  let remaining = raw;
  let cycle = 0; // 0 = 첫 실행, 1부터 반복 회차
  if (running && raw <= 0 && repeatOn && timer.duration > 0) {
    const over = -raw;
    cycle = Math.floor(over / timer.duration) + 1;
    remaining = timer.duration - (over % timer.duration);
  }
  const expired = running && !repeatOn && raw <= 0;
  const urgent = running && !expired && remaining <= Math.min(10, timer.duration * 0.2);
  return { running, repeatOn, remaining: Math.max(0, remaining), cycle, expired, urgent };
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

/* 만료 알림음 1회 재생 마커 — 같은 실행(endAt)·회차당 한 번만 */
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

/* TTS 음성 알림 — 종료 10초 전 "«이름» 10초 전" 1회. 라벨의 괄호 설명은 읽지 않는다 */
const spokenKeys = new Set<string>();
function ttsText(label: string): string {
  return `${label.replace(/\s*\([^)]*\)\s*/g, " ").trim()} 10초 전`;
}
function TtsOnce({ speakKey, text }: { speakKey: string; text: string }) {
  useEffect(() => {
    if (spokenKeys.has(speakKey)) return;
    spokenKeys.add(speakKey);
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ko-KR";
      u.rate = 1.15;
      window.speechSynthesis.speak(u);
    } catch {
      // speech not supported
    }
  }, [speakKey, text]);
  return null;
}

/* ── 타이머 카드 ── */
function TimerCard({
  timer, now, muted, tts, hotkey, onStart, onStop, onToggleRepeat, onEdit, onRemove,
}: {
  timer: RaidTimer;
  now: number; // 보정된 현재 시각(ms)
  muted: boolean;
  tts: boolean;
  hotkey?: string;
  onStart: () => void;
  onStop: () => void;
  onToggleRepeat: () => void;
  onEdit: (label: string, duration: number) => void;
  onRemove?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(timer.label);
  const [durDraft, setDurDraft] = useState(fmt(timer.duration));

  const { running, repeatOn, remaining, cycle, expired, urgent } = timerState(timer, now);
  /* 반복 경계 직후 2초 안에서만 알림 트리거 — 페이지를 늦게 열었을 때 지난 회차 알림이 몰아치는 걸 방지 */
  const justCycled = cycle > 0 && timer.duration - remaining < 2;
  const progress = running && !expired ? Math.max(0, Math.min(1, remaining / timer.duration)) : 0;

  function saveEdit() {
    const d = parseDuration(durDraft);
    if (!labelDraft.trim() || d === null || d <= 0) return;
    onEdit(labelDraft.trim(), d);
    setEditing(false);
  }

  return (
    <div
      className={`pixel-card relative p-0 overflow-hidden flex items-stretch transition-colors ${
        expired ? "border-red-500" : urgent ? "border-yellow-500" : ""
      }`}
    >
      <div className="flex-1 min-w-0 px-3 py-2.5 pb-3">
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
                  title={`${hotkey}: 시작/정지 토글 · Shift+${hotkey}: 재시작`}
                >
                  {hotkey}
                </kbd>
              )}
              <button
                onClick={onToggleRepeat}
                className={`shrink-0 text-[11px] leading-none px-1 py-0.5 border transition-colors ${
                  repeatOn ? "border-maple text-maple" : "border-edge text-dim hover:text-maple hover:border-maple"
                }`}
                title={repeatOn ? "반복 켜짐 — 만료되면 자동으로 다시 카운트하며 매 주기 알림 (클릭해 끄기)" : "반복 꺼짐 — 켜면 만료 시 자동 재시작 (위협·벞해·유혹 같은 주기 패턴용)"}
              >
                🔁
              </button>
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
            <div className="flex items-baseline gap-2">
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
              {cycle > 0 && (
                <span className="text-[10px] font-pixel text-dim" title="반복 회차">
                  {cycle + 1}회차
                </span>
              )}
            </div>
            {expired && !muted && <ExpireBeeper beepKey={`${timer.id}-${timer.endAt}`} />}
            {justCycled && !muted && <ExpireBeeper beepKey={`${timer.id}-${timer.endAt}-c${cycle}`} />}
            {tts && running && !expired && timer.duration >= 30 && remaining <= 10 && remaining > 2 && (
              <TtsOnce speakKey={`${timer.id}-${timer.endAt}-c${cycle}`} text={ttsText(timer.label)} />
            )}
          </>
        )}
      </div>
      {/* 진행바 — 남은 비율 */}
      {running && !expired && !editing && (
        <div
          className={`absolute bottom-0 left-0 h-1 transition-[width] duration-200 ${urgent ? "bg-yellow-500" : "bg-green-600/70"}`}
          style={{ width: `${progress * 100}%` }}
        />
      )}
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

/* ── PIP 미니 뷰 — 실행 중 타이머만 임박 순으로 (인라인 스타일: PIP 창엔 앱 CSS가 없음) ── */
function PipView({ boss, sections, now, roomCode }: {
  boss: BossPreset;
  sections: TimerSection[];
  now: number;
  roomCode: string | null;
}) {
  const rows = sections
    .flatMap((s) => s.timers)
    .map((t) => ({ t, st: timerState(t, now) }))
    .filter((r) => r.st.running)
    .sort((a, b) => (a.st.expired ? -1 : b.st.expired ? 1 : a.st.remaining - b.st.remaining));

  return (
    <div style={{ padding: "8px 10px", fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #3a352b" }}>
        <span style={{ fontWeight: 700 }}>{boss.icon} {boss.name}</span>
        {roomCode && <span style={{ fontSize: 11, color: "#a89f8c", letterSpacing: 2 }}>{roomCode}</span>}
      </div>
      {rows.length === 0 ? (
        <div style={{ color: "#a89f8c", fontSize: 12, padding: "12px 0" }}>실행 중인 타이머가 없습니다</div>
      ) : (
        rows.map(({ t, st }) => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", gap: 8 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#e8e0d0" }}>
              {t.label}{st.repeatOn ? " 🔁" : ""}
            </span>
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                fontWeight: 700,
                fontSize: 18,
                color: st.expired ? "#ef4444" : st.urgent ? "#eab308" : "#22c55e",
              }}
            >
              {fmt(st.remaining)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

/* Document Picture-in-Picture (크롬/엣지 데스크톱) — 표준 타입 정의가 아직 없어 최소 선언 */
interface DppHost {
  documentPictureInPicture?: { requestWindow: (opts: { width: number; height: number }) => Promise<Window> };
}

/* ── 메인 ── */
export default function BossTimerPage() {
  const [bossId, setBossId] = useState<BossId>(DEFAULT_BOSS);
  const [sections, setSections] = useState<TimerSection[]>(BOSSES[DEFAULT_BOSS].sections);
  const [now, setNow] = useState(0);
  const [muted, setMuted] = useState(false);
  const [tts, setTts] = useState(true);
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

  // PIP
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const pipRootRef = useRef<HTMLElement | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  sharedAudioCtx = audioCtxRef;

  const inRoom = room !== null;
  const boss = BOSSES[bossId];

  /* 보스별 로컬 저장분 로드 — 저장분은 timers만 덮어쓰고 섹션 메타(title/desc)는 항상 최신 프리셋 */
  const loadLocalSections = useCallback((id: BossId): TimerSection[] => {
    try {
      const raw = localStorage.getItem(BOSSES[id].storageKey);
      if (raw) {
        const saved: TimerSection[] = JSON.parse(raw);
        return BOSSES[id].sections.map((preset) => {
          const s = saved.find((x) => x.id === preset.id);
          return s ? { ...preset, timers: s.timers } : preset;
        });
      }
    } catch {
      // ignore
    }
    return BOSSES[id].sections;
  }, []);

  /* 응답 공통 반영 — 방 상태의 섹션으로 보스 종류도 맞춘다 */
  const applyResponse = useCallback((code: string, res: {
    version: number; state?: TimerSection[]; log?: { at: number; text: string }[];
    server_now: number; members: number; changed: boolean;
  }) => {
    serverOffsetRef.current = res.server_now - Date.now();
    if (res.changed && res.state) {
      setSections(res.state);
      setBossId(bossOfSections(res.state));
    }
    setRoom((prev) => ({
      code,
      version: res.version,
      members: res.members,
      log: res.log ?? prev?.log ?? [],
    }));
  }, []);

  /* 초기화: 보스 선택 + 로컬 저장 복원 + 닉네임/클라이언트ID + URL·저장된 방 자동 참여 */
  useEffect(() => {
    try {
      let cid = localStorage.getItem("boss_timer_client_id");
      if (!cid) {
        cid = Math.random().toString(36).slice(2, 12);
        localStorage.setItem("boss_timer_client_id", cid);
      }
      clientIdRef.current = cid;
      setNickname(localStorage.getItem("boss_timer_nickname") ?? "");

      const params = new URLSearchParams(window.location.search);
      const urlBoss = params.get("boss");
      const savedBoss = localStorage.getItem("boss_timer_boss");
      const initialBoss: BossId =
        urlBoss === "chaos-zakum" || (!urlBoss && savedBoss === "chaos-zakum") ? "chaos-zakum" : "horntail";
      setBossId(initialBoss);
      setSections(loadLocalSections(initialBoss));

      const m = localStorage.getItem("boss_timer_muted");
      if (m) setMuted(m === "true");
      const t = localStorage.getItem("boss_timer_tts");
      if (t) setTts(t === "true");

      // URL ?room=CODE 또는 이전 세션의 방으로 재참여
      const urlCode = params.get("room");
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
  }, [applyResponse, loadLocalSections]);

  /* 로컬 모드에서만 로컬 저장 */
  useEffect(() => {
    if (!loaded || inRoom) return;
    try { localStorage.setItem(BOSSES[bossId].storageKey, JSON.stringify(sections)); } catch { /* ignore */ }
  }, [sections, loaded, inRoom, bossId]);

  useEffect(() => {
    localStorage.setItem("boss_timer_muted", String(muted));
  }, [muted]);

  useEffect(() => {
    localStorage.setItem("boss_timer_tts", String(tts));
  }, [tts]);

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
    action: { type: "start" | "stop" | "edit" | "add" | "remove" | "repeat"; section_id: string; timer_id?: string; label?: string; duration?: number },
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

  const toggleRepeat = useCallback((sectionId: string, timer: RaidTimer) => {
    dispatch({ type: "repeat", section_id: sectionId, timer_id: timer.id }, () => {
      updateTimerLocal(sectionId, timer.id, { repeat: !timer.repeat });
    });
  }, [dispatch, updateTimerLocal]);

  /* ── 단축키 ── 섹션별 풀에서 타이머 순서대로 배정. 키: 시작/재시작 · Shift+키: 정지 */
  const hotkeyOf = useMemo(() => {
    const map = new Map<string, string>(); // timer.id → key
    for (const s of sections) {
      const pool = boss.hotkeys[s.id] ?? [];
      s.timers.forEach((t, i) => {
        if (i < pool.length) map.set(t.id, pool[i]);
      });
    }
    return map;
  }, [sections, boss]);

  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const bossRef = useRef(boss);
  bossRef.current = boss;

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
        const pool = bossRef.current.hotkeys[s.id] ?? [];
        const idx = pool.indexOf(key);
        if (idx < 0 || idx >= s.timers.length) continue;
        e.preventDefault();
        const t = s.timers[idx];
        // on/off 토글: 실행 중이면 정지, 아니면 시작. Shift+키는 재시작(재동기화)
        if (e.shiftKey) startTimer(s.id, t);
        else if (t.endAt !== null) stopTimer(s.id, t.id);
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
    spokenKeys.clear();
    setSections((prev) => prev.map((s) => ({ ...s, timers: s.timers.map((t) => ({ ...t, endAt: null })) })));
  }, []);

  /* ── 보스 전환 (방 참여 중엔 잠금 — 방 상태가 곧 진실원) ── */
  const switchBoss = useCallback((id: BossId) => {
    if (roomRef.current || id === bossId) return;
    setBossId(id);
    setSections(loadLocalSections(id));
    setNow(Date.now());
    try {
      localStorage.setItem("boss_timer_boss", id);
      const url = new URL(window.location.href);
      if (id === DEFAULT_BOSS) url.searchParams.delete("boss");
      else url.searchParams.set("boss", id);
      window.history.replaceState(null, "", url.toString());
    } catch {
      // ignore
    }
  }, [bossId, loadLocalSections]);

  /* ── PIP ── */
  const openPip = useCallback(async () => {
    if (pipWin) { pipWin.focus(); return; }
    const dpp = (window as unknown as DppHost).documentPictureInPicture;
    if (!dpp) {
      alert("PIP는 데스크톱 크롬/엣지 최신 버전에서만 지원됩니다.");
      return;
    }
    try {
      const w = await dpp.requestWindow({ width: 340, height: 420 });
      const doc = w.document;
      doc.title = "보스 타이머 PIP";
      doc.body.style.cssText =
        "margin:0;background:#15130f;color:#e8e0d0;font-family:ui-monospace,Menlo,Consolas,monospace;";
      const root = doc.createElement("div");
      doc.body.appendChild(root);
      pipRootRef.current = root;
      w.addEventListener("pagehide", () => {
        pipRootRef.current = null;
        setPipWin(null);
      });
      setPipWin(w);
    } catch {
      // 사용자가 거부했거나 정책상 차단
    }
  }, [pipWin]);

  useEffect(() => {
    return () => {
      try { pipWin?.close(); } catch { /* ignore */ }
    };
  }, [pipWin]);

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
    // 현재 보스의 로컬 설정 복원
    setSections(loadLocalSections(bossId));
  }, [bossId, loadLocalSections]);

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
      {/* 보스 탭 */}
      <div className="flex items-center gap-1.5 mb-3">
        {(Object.values(BOSSES) as BossPreset[]).map((b) => (
          <button
            key={b.id}
            onClick={() => switchBoss(b.id)}
            disabled={inRoom && bossId !== b.id}
            className={`px-3 py-1.5 text-sm font-pixel border-2 transition-colors ${
              bossId === b.id
                ? "border-maple text-maple bg-surface2"
                : "border-edge text-dim hover:text-maple hover:border-maple disabled:opacity-40 disabled:hover:text-dim disabled:hover:border-edge"
            }`}
            title={inRoom && bossId !== b.id ? "방 참여 중에는 보스를 전환할 수 없습니다 — 방 나가기 후 전환하세요" : undefined}
          >
            {b.icon} {b.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold font-pixel">{boss.icon} {boss.name} 타이머</h1>
        <div className="flex items-center gap-2">
          <Link
            href={boss.guideHref}
            className="px-3 py-1.5 text-xs font-pixel border-2 border-edge text-dim hover:text-maple transition-colors"
          >
            {boss.guideLabel}
          </Link>
          <button
            onClick={openPip}
            className={`px-3 py-1.5 text-xs font-pixel border-2 transition-colors ${
              pipWin ? "border-maple text-maple" : "border-edge text-dim hover:text-maple"
            }`}
            title="실행 중인 타이머를 항상 위에 뜨는 작은 창(PIP)으로 봅니다 — 데스크톱 크롬/엣지"
          >
            📌 PIP
          </button>
          <button
            onClick={() => setTts(!tts)}
            className={`px-3 py-1.5 text-xs font-pixel border-2 transition-colors ${
              tts ? "border-edge text-dim hover:text-maple" : "border-red-400 text-red-500"
            }`}
            title="종료 10초 전 음성 안내 (30초 이상 타이머만)"
          >
            {tts ? "🗣️ 음성 켜짐" : "🗣️ 음성 꺼짐"}
          </button>
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
        {boss.tagline}{" "}
        모든 카드는 <span className="text-maple">수정</span> 버튼으로 이름과 시간을, <span className="text-maple">🔁</span>로 반복 여부를 바꿀 수 있습니다.
      </p>

      {/* ── 공대 공유 패널 ── */}
      <div className="pixel-panel p-4 mb-6">
        {inRoom ? (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-pixel text-sm text-maple">📡 공유 중</span>
              <span className="font-pixel text-xs text-dim">{boss.icon} {boss.name}</span>
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
                  tts={tts}
                  hotkey={hotkeyOf.get(timer.id)}
                  onStart={() => startTimer(section.id, timer)}
                  onStop={() => stopTimer(section.id, timer.id)}
                  onToggleRepeat={() => toggleRepeat(section.id, timer)}
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
            게임 내에서 해당 패턴/스킬(단체유혹, 공무 시전 등)이 발동하는 순간 <strong>시작</strong>을 누르세요. 남은 시간이 카운트다운됩니다.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            <span><strong>보스 탭</strong>: 상단에서 혼테일/카오스 자쿰을 전환합니다. 보스별 타이머 구성과 설정이 따로 저장됩니다. (방 참여 중엔 방의 보스로 고정)</span>
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            <span><strong>반복(🔁)</strong>: 위협·벞해·유혹처럼 주기적으로 오는 패턴은 반복을 켜두면 만료 시 자동으로 다시 카운트하며 매 주기 알림이 울립니다. 카드에 회차가 표시됩니다.</span>
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            <span><strong>음성 알림(TTS)</strong>: 종료 10초 전에 &ldquo;OO 10초 전&rdquo;을 읽어줍니다 (30초 이상 타이머만, 브라우저 음성 지원 시).</span>
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            <span><strong>PIP(📌)</strong>: 실행 중인 타이머를 게임 화면 위에 항상 떠 있는 작은 창으로 봅니다 — 데스크톱 크롬/엣지 지원.</span>
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            <span><strong>공대 공유</strong>: 방을 만들어 초대 링크(또는 6자리 코드)를 공대원에게 보내면, 누가 타이머를 시작하든 전원 화면에 2초 안에 반영됩니다. 반복 설정도 함께 동기화되고, 기록 로그에 누가 눌렀는지 표시됩니다.</span>
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            <span><strong>키보드 단축키</strong>: 각 카드 이름 옆의 키를 누르면 <strong>시작↔정지 토글</strong>(한 번 누르면 시작, 다시 누르면 정지), <strong>Shift+키</strong>는 재시작(재동기화)입니다. 키보드 줄별로 첫 섹션 <span className="font-mono">1~0</span> · 둘째 <span className="font-mono">Q W E…</span> · 셋째 <span className="font-mono">A S D…</span> · 넷째 <span className="font-mono">Z X C…</span> · 다섯째 <span className="font-mono">U I O…</span> 순서로 배정됩니다. (입력창에 커서가 있을 땐 동작하지 않습니다)</span>
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            실행 중에는 <strong>재시작</strong>(재동기화)과 <strong>정지</strong> 버튼이 함께 표시됩니다. 버튼 우클릭으로도 리셋할 수 있습니다.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            타이머 종료 시 알림음이 울리고 숫자가 붉게 깜빡입니다. 새로고침해도 진행 중인 타이머와 방 참여가 이어집니다.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            기본값(리저 30분 · 사망 복귀 14분 · 인레이지 8분 · 공무 43초 · 카쿰 벞해 2분 등)은 통용되는 공략 기준이며, 실측과 다르면 각 카드에서 수정해 쓰세요. 방은 마지막 조작 후 48시간이 지나면 자동 삭제됩니다.
          </li>
        </ul>
      </div>

      {/* PIP 포털 — PIP 창의 DOM으로 렌더 */}
      {pipWin && pipRootRef.current
        ? createPortal(
            <PipView boss={boss} sections={sections} now={correctedNow} roomCode={room?.code ?? null} />,
            pipRootRef.current
          )
        : null}
    </div>
  );
}
