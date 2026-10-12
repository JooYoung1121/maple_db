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

type BossId = "horntail" | "chaos-zakum" | "hunt";

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

/* ── 사냥 타이머 프리셋 ──
 * 버프 지속시간 근거: KMST 원본 skills 테이블 마스터 수치 (data/maple.db)
 * — 홀리 심볼 120초 · 샤프 아이즈 300초 · 메이플 용사 900초 · 하이퍼 바디 155초 · 메소 업 120초
 * 메랜은 스킬 레벨에 따라 지속이 짧을 수 있으니 카드에서 수정해 쓰세요.
 */
const HUNT_SECTIONS: TimerSection[] = [
  {
    id: "hunt-buffs",
    title: "파티 버프",
    icon: "✨",
    desc: "버프를 시전한 순간 시작 — 만료 = 리버프 타이밍. 🔁 반복을 켜두면 매 주기 알림. 기본값은 마스터 기준(KMST 원본)이라 스킬 레벨에 맞게 수정하세요",
    timers: [
      { id: "hunt-hs", label: "홀리 심볼 (심볼)", duration: 120, endAt: null, removable: false, repeat: true },
      { id: "hunt-se", label: "샤프 아이즈 (샤프)", duration: 300, endAt: null, removable: false, repeat: true },
      { id: "hunt-mw", label: "메이플 용사 (메용)", duration: 900, endAt: null, removable: false, repeat: true },
      { id: "hunt-hb", label: "하이퍼 바디", duration: 155, endAt: null, removable: true, repeat: true },
      { id: "hunt-mu", label: "메소 업", duration: 120, endAt: null, removable: true, repeat: true },
    ],
  },
  {
    id: "hunt-entry",
    title: "파티원 입장",
    icon: "🚪",
    desc: "파티원이 사냥터에 입장한 순간 시작 — 이름을 닉네임으로 바꿔 두면 사냥·교대 시간을 전원이 공유합니다 (기본 1시간, 수정 가능)",
    timers: [
      { id: "hunt-p1", label: "파티원 1", duration: 3600, endAt: null, removable: true },
      { id: "hunt-p2", label: "파티원 2", duration: 3600, endAt: null, removable: true },
      { id: "hunt-p3", label: "파티원 3", duration: 3600, endAt: null, removable: true },
      { id: "hunt-p4", label: "파티원 4", duration: 3600, endAt: null, removable: true },
      { id: "hunt-p5", label: "파티원 5", duration: 3600, endAt: null, removable: true },
      { id: "hunt-p6", label: "파티원 6", duration: 3600, endAt: null, removable: true },
    ],
  },
  {
    id: "hunt-custom",
    title: "측정 · 커스텀",
    icon: "🧪",
    desc: "경험치 측정, 자리비움 체크 등 자유 타이머 — + 타이머 추가로 얼마든지 늘릴 수 있습니다",
    timers: [
      { id: "hunt-measure", label: "경험치 측정 (30분)", duration: 1800, endAt: null, removable: true },
      { id: "hunt-afk", label: "자리비움 체크", duration: 300, endAt: null, removable: true },
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
  hunt: {
    id: "hunt",
    name: "사냥",
    icon: "⏱️",
    tagline:
      "파티 사냥용 공유 타이머 — 파티원 입장 시간과 홀리 심볼·샤프 아이즈·메이플 용사 리버프 타이밍을 함께 잽니다. 버프는 시전 순간 시작하고 🔁 반복을 켜두세요.",
    guideHref: "/hunt",
    guideLabel: "🎯 사냥터 추천",
    storageKey: "boss_timer_hunt_v1",
    sections: HUNT_SECTIONS,
    hotkeys: {
      "hunt-buffs": ["1", "2", "3", "4", "5", "6", "7"],
      "hunt-entry": ["Q", "W", "E", "R", "T", "Y", "U", "I"],
      "hunt-custom": ["A", "S", "D", "F", "G", "H"],
    },
  },
};

const DEFAULT_BOSS: BossId = "horntail";
const POLL_INTERVAL = 2000;

/* 방 상태(섹션 배열)에서 보스 종류 판별 — 카쿰 섹션 id는 cz-, 사냥은 hunt- 접두 */
function bossOfSections(state: TimerSection[]): BossId {
  if (state.some((s) => String(s.id).startsWith("hunt-"))) return "hunt";
  return state.some((s) => String(s.id).startsWith("cz-")) ? "chaos-zakum" : "horntail";
}

/* ── 원정대 관리 (혼테일·카쿰 공대 편성 보드) ── */
interface ExpMember {
  id: string;
  name: string;
  job: string;
  deathEndAt: number | null; // 사망 복귀 타이머 종료 시각(ms) — 방 모드에선 서버 시계 기준
  skillEndAt: number | null; // 직업 스킬 쿨 종료 시각(ms)
}
interface ExpParty {
  id: string;
  members: ExpMember[];
}
interface Expedition {
  startedAt: number | null; // 레이드 입장 시각(ms)
  parties: ExpParty[];
}

const EMPTY_EXPEDITION: Expedition = { startedAt: null, parties: [] };
const DEATH_RETURN_SECONDS = 840; // 사망 후 마을 복귀 실측 14분 (혼테일 프리셋과 동일 근거)
const MAX_PARTIES = 6;
const MAX_MEMBERS = 6;
const EXP_JOBS = [
  "비숍", "히어로", "팔라딘", "다크나이트", "불독", "썬콜",
  "보우마스터", "신궁", "나이트로드", "섀도어", "바이퍼", "캡틴", "배틀메이지", "기타",
];
/* 멤버별 쿨타임 버튼이 붙는 직업 스킬 — 쿨 근거는 보스 프리셋과 동일 (리저 30분 · 인레이지 8분 · 타임리프 20분 · 연막탄 10분)
 * 아이콘: web/public/skill-icons (sim_skills.icon_path와 동일 에셋, 원본 스킬 ID) */
const EXP_JOB_SKILLS: Record<string, { label: string; duration: number; icon: string }> = {
  비숍: { label: "리저렉션", duration: 1800, icon: "/skill-icons/2321006.png" },
  히어로: { label: "인레이지", duration: 480, icon: "/skill-icons/1121010.png" },
  바이퍼: { label: "타임리프", duration: 1200, icon: "/skill-icons/5121010.png" },
  섀도어: { label: "연막탄", duration: 600, icon: "/skill-icons/4221006.png" },
};

/* 기본 3파티 편성 — 통상 구성: 파티마다 닼나(하이퍼바디) + 비숍 + 격수 4인 (유혹팟·근격 등은 직업만 바꿔 쓰세요) */
function defaultExpParties(): ExpParty[] {
  const rid = () => Math.random().toString(36).slice(2, 8);
  return [1, 2, 3].map(() => ({
    id: `p${rid()}`,
    members: [
      { id: `m${rid()}`, name: "닼나", job: "다크나이트", deathEndAt: null, skillEndAt: null },
      { id: `m${rid()}`, name: "비숍", job: "비숍", deathEndAt: null, skillEndAt: null },
      ...[1, 2, 3, 4].map((n) => ({ id: `m${rid()}`, name: `격수 ${n}`, job: "기타", deathEndAt: null, skillEndAt: null })),
    ],
  }));
}

function fmtHMS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
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

/* 시스템(브라우저) 알림 1회 — 다른 창에서 게임 중일 때도 OS 알림으로 만료를 알린다 */
const notifiedKeys = new Set<string>();
function SysNotifyOnce({ notifyKey, title, body }: { notifyKey: string; title: string; body: string }) {
  useEffect(() => {
    if (notifiedKeys.has(notifyKey)) return;
    notifiedKeys.add(notifyKey);
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const n = new Notification(title, { body, tag: notifyKey });
        setTimeout(() => { try { n.close(); } catch { /* ignore */ } }, 8000);
      }
    } catch {
      // notification not supported
    }
  }, [notifyKey, title, body]);
  return null;
}

/* ── 타이머 카드 ── */
function TimerCard({
  timer, now, muted, tts, sysNotify, hotkey, onStart, onStop, onToggleRepeat, onEdit, onRemove,
}: {
  timer: RaidTimer;
  now: number; // 보정된 현재 시각(ms)
  muted: boolean;
  tts: boolean;
  sysNotify: boolean;
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
            {expired && sysNotify && <SysNotifyOnce notifyKey={`n-${timer.id}-${timer.endAt}`} title="⏰ 타이머 종료" body={timer.label} />}
            {justCycled && sysNotify && <SysNotifyOnce notifyKey={`n-${timer.id}-${timer.endAt}-c${cycle}`} title="🔁 주기 알림" body={timer.label} />}
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
  const [sysNotify, setSysNotify] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 원정대 관리 (혼테일·카쿰)
  const [expedition, setExpedition] = useState<Expedition>(EMPTY_EXPEDITION);
  const [expOpen, setExpOpen] = useState(false);

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

  const loadLocalExpedition = useCallback((id: BossId): Expedition => {
    try {
      const raw = localStorage.getItem(`${BOSSES[id].storageKey}_exp`);
      if (raw) {
        const saved = JSON.parse(raw) as Expedition;
        if (saved && Array.isArray(saved.parties)) return { startedAt: saved.startedAt ?? null, parties: saved.parties };
      }
    } catch {
      // ignore
    }
    return EMPTY_EXPEDITION;
  }, []);

  /* 응답 공통 반영 — 방 상태의 섹션으로 보스 종류도 맞춘다 */
  const applyResponse = useCallback((code: string, res: {
    version: number; state?: TimerSection[]; log?: { at: number; text: string }[];
    expedition?: Expedition | null;
    server_now: number; members: number; changed: boolean;
  }) => {
    serverOffsetRef.current = res.server_now - Date.now();
    if (res.changed && res.state) {
      setSections(res.state);
      setBossId(bossOfSections(res.state));
      const exp = res.expedition;
      setExpedition(exp && Array.isArray(exp.parties) ? exp : EMPTY_EXPEDITION);
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
      const isBossId = (v: string | null): v is BossId => v === "horntail" || v === "chaos-zakum" || v === "hunt";
      const initialBoss: BossId = isBossId(urlBoss) ? urlBoss : isBossId(savedBoss) ? savedBoss : DEFAULT_BOSS;
      setBossId(initialBoss);
      setSections(loadLocalSections(initialBoss));
      const exp = loadLocalExpedition(initialBoss);
      setExpedition(exp);
      if (exp.parties.length > 0) setExpOpen(true);

      const m = localStorage.getItem("boss_timer_muted");
      if (m) setMuted(m === "true");
      const t = localStorage.getItem("boss_timer_tts");
      if (t) setTts(t === "true");
      // 시스템 알림은 브라우저 권한이 살아있을 때만 복원
      try {
        if (localStorage.getItem("boss_timer_sysnotify") === "true" &&
            typeof Notification !== "undefined" && Notification.permission === "granted") {
          setSysNotify(true);
        }
      } catch { /* ignore */ }

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
  }, [applyResponse, loadLocalSections, loadLocalExpedition]);

  /* 로컬 모드에서만 로컬 저장 */
  useEffect(() => {
    if (!loaded || inRoom) return;
    try { localStorage.setItem(BOSSES[bossId].storageKey, JSON.stringify(sections)); } catch { /* ignore */ }
  }, [sections, loaded, inRoom, bossId]);

  useEffect(() => {
    if (!loaded || inRoom) return;
    try { localStorage.setItem(`${BOSSES[bossId].storageKey}_exp`, JSON.stringify(expedition)); } catch { /* ignore */ }
  }, [expedition, loaded, inRoom, bossId]);

  useEffect(() => {
    localStorage.setItem("boss_timer_muted", String(muted));
  }, [muted]);

  useEffect(() => {
    localStorage.setItem("boss_timer_tts", String(tts));
  }, [tts]);

  useEffect(() => {
    try { localStorage.setItem("boss_timer_sysnotify", String(sysNotify)); } catch { /* ignore */ }
  }, [sysNotify]);

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
  const anyRunning =
    sections.some((s) => s.timers.some((t) => t.endAt !== null)) ||
    expedition.startedAt !== null ||
    expedition.parties.some((p) => p.members.some((m) => m.deathEndAt !== null || m.skillEndAt !== null));
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [anyRunning]);

  /* 백그라운드 틱 보강 — 숨긴 탭에선 window 타이머가 최대 1분까지 지연(크롬 intensive throttling)되므로
   * 스로틀이 없는 워커 타이머로 1초 틱을 유지해 알림음·TTS·시스템 알림이 제때 울리게 한다 */
  useEffect(() => {
    if (!anyRunning) return;
    let worker: Worker | null = null;
    let url = "";
    try {
      const blob = new Blob(["setInterval(function(){postMessage(0)},1000)"], { type: "text/javascript" });
      url = URL.createObjectURL(blob);
      worker = new Worker(url);
      worker.onmessage = () => setNow(Date.now());
    } catch {
      // 워커 생성 실패(CSP 등) 시 기존 틱만 사용
    }
    return () => {
      worker?.terminate();
      if (url) URL.revokeObjectURL(url);
    };
  }, [anyRunning]);

  /* 시스템 알림 토글 — 켤 때 브라우저 권한을 요청한다 */
  const toggleSysNotify = useCallback(async () => {
    if (sysNotify) { setSysNotify(false); return; }
    try {
      if (typeof Notification === "undefined") {
        alert("이 브라우저는 시스템 알림을 지원하지 않습니다.");
        return;
      }
      const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (perm === "granted") setSysNotify(true);
      else alert("알림 권한이 거부되어 있습니다. 주소창 옆 사이트 설정에서 알림을 허용해 주세요.");
    } catch { /* ignore */ }
  }, [sysNotify]);

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

  /* ── 원정대 관리 디스패치: 로컬이면 즉시, 방이면 서버 액션 (타이머 디스패치와 동일 패턴) ── */
  const expDispatch = useCallback((
    action: { type: string; party_id?: string; member_id?: string; label?: string; job?: string; kind?: string; op?: string; duration?: number },
    localApply: (prev: Expedition) => Expedition,
  ) => {
    const r = roomRef.current;
    if (!r) { setExpedition(localApply); return; }
    bossTimerAction(r.code, action, clientIdRef.current, nicknameRef.current || "익명")
      .then((res) => applyResponse(r.code, res))
      .catch((e) => setShareError(String(e.message)));
  }, [applyResponse]);

  const expRaid = useCallback((op: "start" | "stop") => {
    expDispatch({ type: "exp_raid", op }, (prev) => ({ ...prev, startedAt: op === "start" ? Date.now() : null }));
  }, [expDispatch]);

  const expPreset = useCallback(() => {
    const hasMembers = expedition.parties.some((p) => p.members.length > 0);
    if (hasMembers && !confirm("현재 편성을 지우고 기본 3파티(닼나+비숍+격수 4)로 바꿀까요?")) return;
    expDispatch({ type: "exp_preset" }, (prev) => ({ ...prev, parties: defaultExpParties() }));
  }, [expDispatch, expedition.parties]);

  const expPartyAdd = useCallback(() => {
    expDispatch({ type: "exp_party_add" }, (prev) =>
      prev.parties.length >= MAX_PARTIES
        ? prev
        : { ...prev, parties: [...prev.parties, { id: `p${Math.random().toString(36).slice(2, 8)}`, members: [] }] });
  }, [expDispatch]);

  const expPartyRemove = useCallback((partyId: string) => {
    expDispatch({ type: "exp_party_remove", party_id: partyId }, (prev) => ({
      ...prev,
      parties: prev.parties.filter((p) => p.id !== partyId),
    }));
  }, [expDispatch]);

  const expMemberAdd = useCallback((partyId: string) => {
    expDispatch({ type: "exp_member_add", party_id: partyId }, (prev) => ({
      ...prev,
      parties: prev.parties.map((p) =>
        p.id !== partyId || p.members.length >= MAX_MEMBERS
          ? p
          : {
              ...p,
              members: [
                ...p.members,
                { id: `m${Math.random().toString(36).slice(2, 8)}`, name: `파티원 ${p.members.length + 1}`, job: "비숍", deathEndAt: null, skillEndAt: null },
              ],
            }),
    }));
  }, [expDispatch]);

  const expMemberEdit = useCallback((partyId: string, memberId: string, patch: { name?: string; job?: string }) => {
    expDispatch({ type: "exp_member_edit", party_id: partyId, member_id: memberId, label: patch.name, job: patch.job }, (prev) => ({
      ...prev,
      parties: prev.parties.map((p) =>
        p.id !== partyId
          ? p
          : {
              ...p,
              members: p.members.map((m) =>
                m.id !== memberId
                  ? m
                  : {
                      ...m,
                      ...(patch.name !== undefined ? { name: patch.name } : {}),
                      // 직업이 바뀌면 이전 직업의 스킬 쿨은 의미가 없어 리셋
                      ...(patch.job !== undefined ? { job: patch.job, skillEndAt: null } : {}),
                    }),
            }),
    }));
  }, [expDispatch]);

  const expMemberRemove = useCallback((partyId: string, memberId: string) => {
    expDispatch({ type: "exp_member_remove", party_id: partyId, member_id: memberId }, (prev) => ({
      ...prev,
      parties: prev.parties.map((p) => (p.id !== partyId ? p : { ...p, members: p.members.filter((m) => m.id !== memberId) })),
    }));
  }, [expDispatch]);

  const expMemberTimer = useCallback((partyId: string, memberId: string, kind: "death" | "skill", op: "start" | "stop", duration: number) => {
    expDispatch({ type: "exp_member_timer", party_id: partyId, member_id: memberId, kind, op, duration }, (prev) => ({
      ...prev,
      parties: prev.parties.map((p) =>
        p.id !== partyId
          ? p
          : {
              ...p,
              members: p.members.map((m) => {
                if (m.id !== memberId) return m;
                const endAt = op === "start" ? Date.now() + duration * 1000 : null;
                return kind === "death" ? { ...m, deathEndAt: endAt } : { ...m, skillEndAt: endAt };
              }),
            }),
    }));
  }, [expDispatch]);

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
    setExpedition(loadLocalExpedition(id));
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
  }, [bossId, loadLocalSections, loadLocalExpedition]);

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
    createBossTimerRoom(sections, nickname || "익명", clientIdRef.current, expedition)
      .then((res) => {
        applyResponse(res.code!, { ...res, changed: true });
        localStorage.setItem("boss_timer_room", res.code!);
      })
      .catch((e) => setShareError(String(e.message)))
      .finally(() => setShareBusy(false));
  }, [sections, expedition, nickname, applyResponse]);

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
            onClick={toggleSysNotify}
            className={`px-3 py-1.5 text-xs font-pixel border-2 transition-colors ${
              sysNotify ? "border-maple text-maple" : "border-edge text-dim hover:text-maple"
            }`}
            title="타이머 종료 시 OS 알림(브라우저 알림)을 띄웁니다 — 게임 창에 가려져 있어도 보입니다. 켜면 브라우저 권한을 요청합니다"
          >
            {sysNotify ? "🖥️ 시스템 알림 켜짐" : "🖥️ 시스템 알림"}
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

      {/* ── 원정대 관리 — 보스 프리셋에서만 (사냥 탭엔 파티원 입장 섹션이 따로 있음) ── */}
      {bossId !== "hunt" && (
        <ExpeditionPanel
          exp={expedition}
          now={correctedNow}
          open={expOpen}
          muted={muted}
          sysNotify={sysNotify}
          onToggleOpen={() => setExpOpen((v) => !v)}
          onRaid={expRaid}
          onPreset={expPreset}
          onPartyAdd={expPartyAdd}
          onPartyRemove={expPartyRemove}
          onMemberAdd={expMemberAdd}
          onMemberEdit={expMemberEdit}
          onMemberRemove={expMemberRemove}
          onMemberTimer={expMemberTimer}
        />
      )}

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
                  sysNotify={sysNotify}
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
            <span><strong>탭</strong>: 상단에서 혼테일/카오스 자쿰/사냥을 전환합니다. 탭별 타이머 구성과 설정이 따로 저장됩니다. (방 참여 중엔 방의 구성으로 고정)</span>
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            <span><strong>원정대 관리</strong> (혼테일·카쿰): 파티별로 공대원을 등록하면 멤버마다 <strong>사망</strong>(복귀 14분)과 직업 스킬 쿨(비숍 리저렉션 · 히어로 인레이지 · 바이퍼 타임리프 · 섀도어 연막탄) 버튼이 생깁니다. 입장 버튼으로 레이드 경과 시간을 재고, 방 공유 중이면 편성·사망 현황이 전원에게 동기화됩니다.</span>
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            <span><strong>사냥 탭</strong>: 파티원 입장 시간과 홀리 심볼·샤프 아이즈·메이플 용사 등 파티 버프 리버프 타이밍을 잽니다. 버프 지속 기본값은 원본 마스터 수치라 스킬 레벨에 맞게 수정하세요.</span>
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            <span><strong>시스템 알림(🖥️)</strong>: 켜면 타이머 종료 시 브라우저(OS) 알림이 떠서 게임 창에 가려져 있어도 보입니다. 탭을 백그라운드에 둬도 워커 틱으로 제때 울립니다. (최초 1회 브라우저 권한 허용 필요)</span>
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

/* ── 원정대 관리 보드 ── */
function MemberNameInput({ value, onCommit }: { value: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const name = draft.trim().slice(0, 12);
    if (!name || name === value) { setDraft(value); return; }
    onCommit(name);
  };
  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur(); }}
      className="pixel-input px-2 py-1 text-xs font-bold flex-1 min-w-0"
      maxLength={12}
      title="클릭해서 닉네임으로 변경"
    />
  );
}

/* 멤버의 사망/스킬 쿨 버튼 — 대기 → 카운트다운 → 만료(준비됨) 3단계 */
function MemberTimerButton({
  endAt, now, icon, idleLabel, runningLabel, readyLabel, muted, sysNotify, notifyBody, keyBase, onStart, onStop,
}: {
  endAt: number | null;
  now: number;
  icon?: string; // 스킬 아이콘 이미지 경로 (없으면 라벨의 이모지 사용)
  idleLabel: string;
  runningLabel: string;
  readyLabel: string;
  muted: boolean;
  sysNotify: boolean;
  notifyBody: string;
  keyBase: string;
  onStart: () => void;
  onStop: () => void;
}) {
  const running = endAt !== null && now < endAt;
  const ready = endAt !== null && now >= endAt;
  return (
    <>
      <button
        type="button"
        onClick={ready || running ? onStop : onStart}
        onContextMenu={(e) => { e.preventDefault(); onStop(); }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 border-2 transition-colors ${
          ready
            ? "border-green-600 text-green-500 animate-pulse"
            : running
            ? "border-red-400 text-red-500"
            : "border-edge text-dim hover:text-maple hover:border-maple"
        }`}
        title={running ? "클릭하면 리셋합니다" : ready ? "클릭하면 초기 상태로 돌아갑니다" : "클릭하면 카운트다운을 시작합니다"}
      >
        {icon && (
          <img src={icon} alt="" className="w-5 h-5 object-contain [image-rendering:pixelated] shrink-0"
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <span className="text-xs font-pixel leading-none">
          {ready ? readyLabel : running ? runningLabel : idleLabel}
        </span>
        {running && (
          <span className="font-mono font-bold tabular-nums text-sm leading-none">{fmt((endAt! - now) / 1000)}</span>
        )}
      </button>
      {ready && !muted && <ExpireBeeper beepKey={`exp-${keyBase}-${endAt}`} />}
      {ready && sysNotify && <SysNotifyOnce notifyKey={`exp-n-${keyBase}-${endAt}`} title="⏰ 원정대 알림" body={notifyBody} />}
    </>
  );
}

function ExpeditionPanel({
  exp, now, open, muted, sysNotify, onToggleOpen, onRaid, onPreset, onPartyAdd, onPartyRemove, onMemberAdd, onMemberEdit, onMemberRemove, onMemberTimer,
}: {
  exp: Expedition;
  now: number;
  open: boolean;
  muted: boolean;
  sysNotify: boolean;
  onToggleOpen: () => void;
  onRaid: (op: "start" | "stop") => void;
  onPreset: () => void;
  onPartyAdd: () => void;
  onPartyRemove: (partyId: string) => void;
  onMemberAdd: (partyId: string) => void;
  onMemberEdit: (partyId: string, memberId: string, patch: { name?: string; job?: string }) => void;
  onMemberRemove: (partyId: string, memberId: string) => void;
  onMemberTimer: (partyId: string, memberId: string, kind: "death" | "skill", op: "start" | "stop", duration: number) => void;
}) {
  const total = exp.parties.reduce((sum, p) => sum + p.members.length, 0);
  const raidRunning = exp.startedAt !== null;

  return (
    <div className="pixel-panel p-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onToggleOpen} className="font-pixel text-sm text-ink hover:text-maple transition-colors">
          {open ? "▼" : "▶"} ⚔️ 원정대 관리 {total > 0 && <span className="text-dim">총 {total}명</span>}
        </button>
        <div className="flex items-center gap-2 ml-auto">
          {raidRunning ? (
            <>
              <span className="text-[11px] text-dim">
                입장{" "}
                {new Date(exp.startedAt!).toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span className="font-mono font-bold tabular-nums text-xl text-green-500">{fmtHMS((now - exp.startedAt!) / 1000)}</span>
              <button
                type="button"
                onClick={() => { if (confirm("레이드 경과 시간을 초기화할까요?")) onRaid("stop"); }}
                className="px-2.5 py-1 text-[11px] font-pixel border-2 border-edge text-dim hover:text-red-500 hover:border-red-400 transition-colors"
              >
                초기화
              </button>
            </>
          ) : (
            <button type="button" onClick={() => onRaid("start")} className="pixel-btn px-3 py-1.5 text-xs">
              ▶ 입장 (경과 기록)
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-edge/60">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <p className="text-[11px] text-dim flex-1 min-w-48">
              파티별로 공대원을 등록하고 직업을 고르면 멤버마다 <b className="text-ink">사망</b>(복귀 {Math.round(DEATH_RETURN_SECONDS / 60)}분)과
              직업 스킬 쿨(리저렉션 30분 · 인레이지 8분 · 타임리프 20분 · 연막탄 10분) 버튼이 생깁니다. 방 공유 중이면 전원에게 동기화됩니다.
            </p>
            <button
              type="button"
              onClick={onPreset}
              className="pixel-btn px-3 py-1.5 text-xs shrink-0"
              title="통상 구성(파티마다 닼나+비숍+격수 4인) 3파티를 한 번에 만듭니다 — 이름·직업은 만들고 나서 바꿔 쓰세요"
            >
              ⚡ 기본 3파티 편성
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {exp.parties.map((party, pi) => (
              <div key={party.id} className="pixel-card p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-pixel text-xs text-ink">{pi + 1}파티 <span className="text-dim">{party.members.length}/{MAX_MEMBERS}</span></span>
                  <button
                    type="button"
                    onClick={() => { if (party.members.length === 0 || confirm(`${pi + 1}파티를 삭제할까요?`)) onPartyRemove(party.id); }}
                    className="text-dim hover:text-red-500 transition-colors"
                    title="파티 삭제"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-2">
                  {party.members.map((member) => {
                    const skill = EXP_JOB_SKILLS[member.job];
                    return (
                      <div key={member.id} className="border border-edge/70 p-1.5 space-y-1.5 bg-surface2/50">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={member.job}
                            onChange={(e) => onMemberEdit(party.id, member.id, { job: e.target.value })}
                            className="pixel-input px-1 py-1 text-[11px] w-[88px] shrink-0"
                            title="직업"
                          >
                            {EXP_JOBS.map((j) => <option key={j} value={j}>{j}</option>)}
                          </select>
                          <MemberNameInput value={member.name} onCommit={(name) => onMemberEdit(party.id, member.id, { name })} />
                          <button
                            type="button"
                            onClick={() => onMemberRemove(party.id, member.id)}
                            className="text-dim hover:text-red-500 transition-colors shrink-0"
                            title="파티원 제외"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <MemberTimerButton
                            endAt={member.deathEndAt}
                            now={now}
                            idleLabel="🪦 사망"
                            runningLabel="⚰️ 복귀"
                            readyLabel="✅ 복귀 가능"
                            muted={muted}
                            sysNotify={sysNotify}
                            notifyBody={`${member.name} 복귀 가능 (사망 ${Math.round(DEATH_RETURN_SECONDS / 60)}분 경과)`}
                            keyBase={`${member.id}-death`}
                            onStart={() => onMemberTimer(party.id, member.id, "death", "start", DEATH_RETURN_SECONDS)}
                            onStop={() => onMemberTimer(party.id, member.id, "death", "stop", 0)}
                          />
                          {skill && (
                            <MemberTimerButton
                              endAt={member.skillEndAt}
                              now={now}
                              icon={skill.icon}
                              idleLabel={skill.label}
                              runningLabel={skill.label}
                              readyLabel={`${skill.label} 준비됨`}
                              muted={muted}
                              sysNotify={sysNotify}
                              notifyBody={`${member.name} ${skill.label} 쿨타임 완료`}
                              keyBase={`${member.id}-skill`}
                              onStart={() => onMemberTimer(party.id, member.id, "skill", "start", skill.duration)}
                              onStop={() => onMemberTimer(party.id, member.id, "skill", "stop", 0)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {party.members.length < MAX_MEMBERS && (
                    <button
                      type="button"
                      onClick={() => onMemberAdd(party.id)}
                      className="w-full py-1.5 border border-dashed border-edge text-[11px] text-dim hover:border-maple hover:text-maple transition-colors"
                    >
                      + 파티원
                    </button>
                  )}
                </div>
              </div>
            ))}
            {exp.parties.length < MAX_PARTIES && (
              <button
                type="button"
                onClick={onPartyAdd}
                className="min-h-[88px] border-2 border-dashed border-edge text-sm text-dim hover:border-maple hover:text-maple transition-colors"
              >
                + 파티 추가
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
