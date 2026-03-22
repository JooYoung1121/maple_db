"use client";

import { useState, useMemo, useCallback } from "react";

// ─── 무기 배율 테이블 ───
const WEAPON_MULTIPLIERS: Record<
  string,
  { maxMult: number; minMult: number; mainStat: string; subStat: string; type: "melee" | "ranged" | "magic" }
> = {
  "한손검":       { maxMult: 4.0, minMult: 4.0, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "두손검":       { maxMult: 4.6, minMult: 4.6, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "한손도끼/둔기": { maxMult: 4.4, minMult: 3.2, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "두손도끼/둔기": { maxMult: 4.8, minMult: 3.4, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "창":           { maxMult: 5.0, minMult: 3.0, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "폴암":         { maxMult: 5.0, minMult: 3.0, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "활":           { maxMult: 3.4, minMult: 3.4, mainStat: "DEX", subStat: "STR",     type: "ranged" },
  "석궁":         { maxMult: 3.6, minMult: 3.6, mainStat: "DEX", subStat: "STR",     type: "ranged" },
  "단검":         { maxMult: 3.6, minMult: 3.6, mainStat: "LUK", subStat: "STR+DEX", type: "melee"  },
  "아대/클로":    { maxMult: 3.6, minMult: 3.6, mainStat: "LUK", subStat: "STR+DEX", type: "melee"  },
  "너클":         { maxMult: 4.8, minMult: 4.8, mainStat: "STR", subStat: "DEX",     type: "melee"  },
  "건":           { maxMult: 3.6, minMult: 3.6, mainStat: "DEX", subStat: "STR",     type: "ranged" },
};

// ─── 스킬 데이터 ───
interface ActiveSkill {
  name: string;
  damage: number;
  hits: number;
  mobs?: number; // 동시 타격 마리수 (표시용, 엔방컷 계산은 단일 대상 기준)
  type: "active";
  element?: "fire" | "ice" | "lightning" | "holy" | "poison" | "dark";
}

interface PassiveSkill {
  name: string;
  type: "passive";
  mastery?: number;
  critRate?: number;
  critDmg?: number;
  description: string;
}

interface JobSkillData {
  label: string;
  weapons: string[];
  isMagic: boolean;
  passives: PassiveSkill[];
  actives: ActiveSkill[];
}

const JOB_SKILL_DATA: Record<string, JobSkillData> = {
  "히어로": {
    label: "히어로",
    weapons: ["한손검", "두손검", "한손도끼/둔기", "두손도끼/둔기"],
    isMagic: false,
    passives: [
      { name: "소드 마스터리", type: "passive", mastery: 60, description: "검 최소 데미지 보장 (60%)" },
      { name: "파이널어택", type: "passive", description: "40% 확률로 150% 추가 타격" },
    ],
    actives: [
      { name: "파워스트라이크", damage: 260, hits: 1, mobs: 1, type: "active" },
      { name: "슬래시블래스트", damage: 130, hits: 6, mobs: 1, type: "active" },
      { name: "브랜디쉬", damage: 260, hits: 2, mobs: 3, type: "active" },
    ],
  },
  "팔라딘": {
    label: "팔라딘",
    weapons: ["한손검", "두손검", "한손도끼/둔기", "두손도끼/둔기"],
    isMagic: false,
    passives: [
      { name: "소드 마스터리", type: "passive", mastery: 60, description: "검 최소 데미지 보장 (60%)" },
    ],
    actives: [
      { name: "파워스트라이크", damage: 260, hits: 1, mobs: 1, type: "active" },
      { name: "슬래시블래스트", damage: 130, hits: 6, mobs: 1, type: "active" },
      { name: "차지블로우 (파이어)", damage: 280, hits: 1, mobs: 1, type: "active", element: "fire" },
      { name: "차지블로우 (아이스)", damage: 280, hits: 1, mobs: 1, type: "active", element: "ice" },
      { name: "차지블로우 (썬더)", damage: 280, hits: 1, mobs: 1, type: "active", element: "lightning" },
      { name: "차지블로우 (홀리)", damage: 340, hits: 1, mobs: 1, type: "active", element: "holy" },
      { name: "블래스트", damage: 310, hits: 8, mobs: 1, type: "active", element: "holy" },
    ],
  },
  "다크나이트": {
    label: "다크나이트",
    weapons: ["창", "폴암"],
    isMagic: false,
    passives: [
      { name: "창 마스터리", type: "passive", mastery: 60, description: "창 최소 데미지 보장 (60%)" },
      { name: "폴암 마스터리", type: "passive", mastery: 60, description: "폴암 최소 데미지 보장 (60%)" },
    ],
    actives: [
      { name: "파워스트라이크", damage: 260, hits: 1, mobs: 1, type: "active" },
      { name: "드래곤 쓰레셔", damage: 250, hits: 1, mobs: 6, type: "active" },
      { name: "드래곤버스터", damage: 220, hits: 2, mobs: 3, type: "active", element: "dark" },
      { name: "드래곤로어", damage: 150, hits: 1, mobs: 15, type: "active", element: "dark" },
    ],
  },
  "불독(F/P)": {
    label: "불독(F/P)",
    weapons: [],
    isMagic: true,
    passives: [],
    actives: [
      { name: "파이어 에로우", damage: 160, hits: 1, type: "active", element: "fire" },
      { name: "포이즌 브레스", damage: 200, hits: 1, type: "active", element: "poison" },
      { name: "익스플로전", damage: 300, hits: 1, type: "active", element: "fire" },
      { name: "페럴라이즈", damage: 261, hits: 6, mobs: 8, type: "active", element: "poison" },
      { name: "메테오", damage: 800, hits: 1, mobs: 15, type: "active", element: "fire" },
    ],
  },
  "썬콜(I/L)": {
    label: "썬콜(I/L)",
    weapons: [],
    isMagic: true,
    passives: [],
    actives: [
      { name: "콜드 빔", damage: 160, hits: 1, type: "active", element: "ice" },
      { name: "썬더 볼트", damage: 165, hits: 1, type: "active", element: "lightning" },
      { name: "아이스 스트라이크", damage: 210, hits: 1, type: "active", element: "ice" },
      { name: "체인 라이트닝", damage: 300, hits: 1, mobs: 6, type: "active", element: "lightning" },
      { name: "블리자드", damage: 650, hits: 1, type: "active", element: "ice" },
    ],
  },
  "비숍": {
    label: "비숍",
    weapons: [],
    isMagic: true,
    passives: [],
    actives: [
      { name: "홀리 에로우", damage: 160, hits: 1, type: "active", element: "holy" },
      { name: "샤이닝 레이", damage: 220, hits: 1, type: "active", element: "holy" },
      { name: "엔젤레이", damage: 500, hits: 1, type: "active", element: "holy" },
      { name: "제네시스", damage: 670, hits: 1, mobs: 15, type: "active", element: "holy" },
    ],
  },
  "보우마스터": {
    label: "보우마스터",
    weapons: ["활"],
    isMagic: false,
    passives: [
      { name: "보우 마스터리", type: "passive", mastery: 60, description: "활 최소 데미지 보장 (60%)" },
      { name: "파이널어택", type: "passive", description: "40% 확률로 150% 추가 타격" },
    ],
    actives: [
      { name: "더블샷", damage: 130, hits: 2, mobs: 1, type: "active" },
      { name: "애로우 봄", damage: 200, hits: 1, mobs: 6, type: "active" },
      { name: "스트레이프", damage: 100, hits: 4, mobs: 1, type: "active" },
      { name: "폭풍의 시", damage: 100, hits: 1, mobs: 1, type: "active" },
    ],
  },
  "신궁": {
    label: "신궁",
    weapons: ["석궁"],
    isMagic: false,
    passives: [
      { name: "석궁 마스터리", type: "passive", mastery: 60, description: "석궁 최소 데미지 보장 (60%)" },
    ],
    actives: [
      { name: "더블샷", damage: 130, hits: 2, mobs: 1, type: "active" },
      { name: "아이언 에로우", damage: 200, hits: 1, mobs: 1, type: "active" },
      { name: "스트레이프", damage: 100, hits: 4, mobs: 1, type: "active" },
      { name: "피어싱 애로우", damage: 300, hits: 1, mobs: 1, type: "active" },
    ],
  },
  "나이트로드": {
    label: "나이트로드",
    weapons: ["아대/클로"],
    isMagic: false,
    passives: [
      { name: "클로 마스터리", type: "passive", mastery: 60, description: "클로 최소 데미지 보장 (60%)" },
      { name: "크리티컬 스로우", type: "passive", critRate: 50, critDmg: 100, description: "50% 확률로 크리 (+100%)" },
    ],
    actives: [
      { name: "럭키세븐", damage: 250, hits: 2, mobs: 1, type: "active" },
      { name: "어벤져", damage: 300, hits: 1, mobs: 3, type: "active" },
      { name: "트리플 스로우", damage: 150, hits: 3, mobs: 1, type: "active" },
    ],
  },
  "섀도어": {
    label: "섀도어",
    weapons: ["단검"],
    isMagic: false,
    passives: [
      { name: "대거 마스터리", type: "passive", mastery: 60, description: "단검 최소 데미지 보장 (60%)" },
    ],
    actives: [
      { name: "새비지블로우", damage: 120, hits: 6, mobs: 1, type: "active" },
      { name: "부메랑스텝", damage: 500, hits: 2, mobs: 4, type: "active" },
      { name: "어쌔시네이트", damage: 120, hits: 4, mobs: 1, type: "active" },
    ],
  },
  "바이퍼": {
    label: "바이퍼",
    weapons: ["너클"],
    isMagic: false,
    passives: [
      { name: "너클 마스터리", type: "passive", mastery: 60, description: "너클 최소 데미지 보장 (60%)" },
    ],
    actives: [
      { name: "코크스크류 블로우", damage: 360, hits: 1, mobs: 3, type: "active", element: "lightning" },
      { name: "에너지 블래스트", damage: 360, hits: 1, mobs: 3, type: "active" },
      { name: "배럭", damage: 170, hits: 6, mobs: 1, type: "active" },
      { name: "드래곤 스트라이크", damage: 810, hits: 1, mobs: 6, type: "active" },
    ],
  },
  "캡틴": {
    label: "캡틴",
    weapons: ["건"],
    isMagic: false,
    passives: [
      { name: "건 마스터리", type: "passive", mastery: 60, description: "건 최소 데미지 보장 (60%)" },
    ],
    actives: [
      { name: "더블파이어", damage: 130, hits: 2, mobs: 1, type: "active" },
      { name: "래피드파이어", damage: 150, hits: 1, mobs: 1, type: "active" },
      { name: "배틀쉽 캐논", damage: 380, hits: 4, mobs: 1, type: "active" },
      { name: "배틀쉽 토피도", damage: 780, hits: 6, mobs: 1, type: "active" },
    ],
  },
};

// 직업 그룹
const JOB_GROUPS: Record<string, string[]> = {
  "전사": ["히어로", "팔라딘", "다크나이트"],
  "마법사": ["불독(F/P)", "썬콜(I/L)", "비숍"],
  "궁수": ["보우마스터", "신궁"],
  "도적": ["나이트로드", "섀도어"],
  "해적": ["바이퍼", "캡틴"],
};

const JOB_GROUP_KEYS = Object.keys(JOB_GROUPS);

// 속성 뱃지 색상
const ELEMENT_COLORS: Record<string, string> = {
  fire: "bg-red-100 text-red-700",
  ice: "bg-blue-100 text-blue-700",
  lightning: "bg-yellow-100 text-yellow-700",
  holy: "bg-yellow-50 text-yellow-600 border border-yellow-200",
  poison: "bg-green-100 text-green-700",
  dark: "bg-purple-100 text-purple-700",
};

const ELEMENT_LABEL: Record<string, string> = {
  fire: "불",
  ice: "얼음",
  lightning: "번개",
  holy: "신성",
  poison: "독",
  dark: "암흑",
};

// ─── 몬스터 데이터 ───
interface Monster {
  name: string;
  level: number;
  hp: number;
  wdef: number;
  mdef: number;
  exp: number;
  map: string;
}

const HUNTING_GROUNDS: Monster[] = [
  // Level 1-10
  { name: "파란달팽이",    level: 2,   hp: 15,        wdef: 0,    mdef: 0,    exp: 3,    map: "빅토리아 아일랜드" },
  { name: "노란달팽이",    level: 3,   hp: 30,        wdef: 0,    mdef: 0,    exp: 5,    map: "빅토리아 아일랜드" },
  { name: "버섯",          level: 5,   hp: 50,        wdef: 0,    mdef: 0,    exp: 8,    map: "헤네시스" },
  { name: "슬라임",        level: 6,   hp: 50,        wdef: 5,    mdef: 10,   exp: 10,   map: "엘리니아 숲" },
  { name: "스텀프",        level: 7,   hp: 70,        wdef: 5,    mdef: 0,    exp: 12,   map: "헤네시스" },
  { name: "초록버섯",      level: 7,   hp: 80,        wdef: 0,    mdef: 10,   exp: 14,   map: "헤네시스 사냥터" },
  { name: "돼지",          level: 10,  hp: 150,       wdef: 15,   mdef: 10,   exp: 22,   map: "헤네시스" },
  { name: "주황버섯",      level: 10,  hp: 100,       wdef: 0,    mdef: 10,   exp: 18,   map: "헤네시스 사냥터" },
  // Level 10-30
  { name: "뿔버섯",        level: 13,  hp: 160,       wdef: 25,   mdef: 10,   exp: 30,   map: "헤네시스 사냥터" },
  { name: "리본돼지",      level: 15,  hp: 210,       wdef: 35,   mdef: 20,   exp: 46,   map: "남쪽 숲" },
  { name: "발록새끼",      level: 18,  hp: 300,       wdef: 40,   mdef: 20,   exp: 52,   map: "슬리피우드" },
  { name: "잭더래빗",      level: 20,  hp: 350,       wdef: 45,   mdef: 30,   exp: 58,   map: "케르닝 지하상가" },
  { name: "좀비버섯",      level: 22,  hp: 400,       wdef: 50,   mdef: 40,   exp: 65,   map: "페리온" },
  { name: "킬라",          level: 25,  hp: 500,       wdef: 55,   mdef: 50,   exp: 75,   map: "케르닝시티" },
  { name: "투카",          level: 26,  hp: 580,       wdef: 58,   mdef: 52,   exp: 82,   map: "케르닝시티" },
  { name: "주니어발록",    level: 28,  hp: 750,       wdef: 60,   mdef: 60,   exp: 95,   map: "슬리피우드" },
  // Level 30-50
  { name: "찰지귀",        level: 30,  hp: 580,       wdef: 50,   mdef: 55,   exp: 58,   map: "케르닝시티" },
  { name: "구울",          level: 32,  hp: 700,       wdef: 65,   mdef: 70,   exp: 65,   map: "페리온" },
  { name: "주니어셀리온",  level: 33,  hp: 1100,      wdef: 60,   mdef: 80,   exp: 65,   map: "엘리니아" },
  { name: "주니어페페",    level: 35,  hp: 1400,      wdef: 110,  mdef: 100,  exp: 75,   map: "엘나스" },
  { name: "아이언호그",    level: 37,  hp: 1050,      wdef: 115,  mdef: 85,   exp: 85,   map: "로랑 광산" },
  { name: "스트로너",      level: 39,  hp: 1300,      wdef: 120,  mdef: 90,   exp: 92,   map: "로랑" },
  { name: "페어리",        level: 40,  hp: 1500,      wdef: 115,  mdef: 130,  exp: 95,   map: "엘리니아" },
  { name: "네펜데스",      level: 42,  hp: 2100,      wdef: 120,  mdef: 120,  exp: 99,   map: "빅토리아" },
  { name: "오크",          level: 43,  hp: 2400,      wdef: 130,  mdef: 110,  exp: 104,  map: "페리온" },
  { name: "코퍼드레이크",  level: 45,  hp: 2700,      wdef: 100,  mdef: 100,  exp: 105,  map: "슬리피우드" },
  { name: "그린드레이크",  level: 48,  hp: 2900,      wdef: 110,  mdef: 160,  exp: 120,  map: "슬리피우드" },
  { name: "블록고렘",      level: 50,  hp: 3500,      wdef: 190,  mdef: 110,  exp: 140,  map: "로랑" },
  { name: "드레이크",      level: 50,  hp: 3200,      wdef: 110,  mdef: 150,  exp: 135,  map: "슬리피우드 깊은곳" },
  // Level 50-70
  { name: "주니어예티",    level: 50,  hp: 3700,      wdef: 170,  mdef: 180,  exp: 135,  map: "엘나스 산간" },
  { name: "다크드레이크",  level: 55,  hp: 5200,      wdef: 180,  mdef: 195,  exp: 185,  map: "슬리피우드" },
  { name: "와일드보어",    level: 55,  hp: 5000,      wdef: 160,  mdef: 160,  exp: 180,  map: "로랑" },
  { name: "헥터",          level: 55,  hp: 4600,      wdef: 120,  mdef: 120,  exp: 170,  map: "오르비스" },
  { name: "화이트팽",      level: 58,  hp: 5800,      wdef: 200,  mdef: 220,  exp: 220,  map: "엘나스" },
  { name: "레드드레이크",  level: 60,  hp: 6000,      wdef: 190,  mdef: 220,  exp: 220,  map: "용의 둥지 입구" },
  { name: "버피",          level: 61,  hp: 7400,      wdef: 213,  mdef: 213,  exp: 230,  map: "시계탑" },
  { name: "나이트고스트",  level: 62,  hp: 6800,      wdef: 210,  mdef: 230,  exp: 240,  map: "루디브리엄" },
  { name: "아이스드레이크",level: 64,  hp: 7700,      wdef: 200,  mdef: 230,  exp: 250,  map: "엘나스" },
  // Level 65-80
  { name: "예티",          level: 65,  hp: 11000,     wdef: 170,  mdef: 245,  exp: 346,  map: "엘나스" },
  { name: "루미네",        level: 66,  hp: 12000,     wdef: 260,  mdef: 260,  exp: 360,  map: "엘나스" },
  { name: "다크로드",      level: 67,  hp: 12500,     wdef: 275,  mdef: 265,  exp: 370,  map: "루디브리엄" },
  { name: "다크예티",      level: 68,  hp: 13000,     wdef: 190,  mdef: 270,  exp: 409,  map: "엘나스" },
  { name: "타우로마시스",  level: 70,  hp: 15000,     wdef: 250,  mdef: 250,  exp: 472,  map: "미나르숲" },
  { name: "클라크",        level: 70,  hp: 15000,     wdef: 250,  mdef: 250,  exp: 270,  map: "시계탑 최하층" },
  { name: "아이스그림",    level: 72,  hp: 15500,     wdef: 270,  mdef: 265,  exp: 490,  map: "엘나스" },
  { name: "설인",          level: 73,  hp: 16000,     wdef: 310,  mdef: 305,  exp: 510,  map: "엘나스" },
  { name: "버푼",          level: 74,  hp: 16000,     wdef: 340,  mdef: 340,  exp: 340,  map: "시계탑" },
  { name: "타우로스피어",  level: 75,  hp: 18000,     wdef: 550,  mdef: 400,  exp: 567,  map: "미나르숲" },
  { name: "다크클라크",    level: 76,  hp: 18000,     wdef: 380,  mdef: 380,  exp: 370,  map: "시계탑" },
  { name: "가고일",        level: 78,  hp: 24000,     wdef: 620,  mdef: 480,  exp: 750,  map: "루디브리엄" },
  { name: "라이칸스로프",  level: 80,  hp: 27000,     wdef: 650,  mdef: 520,  exp: 850,  map: "엘나스" },
  // Level 80-100
  { name: "블랙라이칸스",  level: 82,  hp: 28500,     wdef: 670,  mdef: 540,  exp: 900,  map: "엘나스" },
  { name: "해적",          level: 83,  hp: 30000,     wdef: 710,  mdef: 710,  exp: 1100, map: "시계탑 최하층" },
  { name: "켄타우로스",    level: 86,  hp: 34000,     wdef: 585,  mdef: 585,  exp: 1450, map: "리프레" },
  { name: "듀얼해적",      level: 87,  hp: 35000,     wdef: 775,  mdef: 775,  exp: 1500, map: "시계탑 최하층" },
  { name: "블루켄타",      level: 88,  hp: 37000,     wdef: 600,  mdef: 600,  exp: 1600, map: "리프레" },
  { name: "주니어와이번",  level: 90,  hp: 43000,     wdef: 800,  mdef: 800,  exp: 1750, map: "리프레" },
  { name: "파이어독",      level: 90,  hp: 45000,     wdef: 835,  mdef: 505,  exp: 1800, map: "엘나스" },
  { name: "다크켄타",      level: 92,  hp: 46000,     wdef: 695,  mdef: 695,  exp: 1920, map: "리프레" },
  { name: "리자드맨",      level: 93,  hp: 47000,     wdef: 700,  mdef: 720,  exp: 2050, map: "리프레" },
  { name: "레드드래곤터틀",level: 93,  hp: 49000,     wdef: 700,  mdef: 700,  exp: 2100, map: "미나르숲" },
  { name: "리자드(레드)",  level: 95,  hp: 51000,     wdef: 720,  mdef: 720,  exp: 2250, map: "리프레" },
  { name: "블루드래곤터틀",level: 96,  hp: 52000,     wdef: 730,  mdef: 730,  exp: 2400, map: "미나르숲" },
  { name: "레드와이번",    level: 97,  hp: 53000,     wdef: 750,  mdef: 750,  exp: 2500, map: "리프레" },
  // Level 100+
  { name: "피아누스",      level: 100, hp: 2400000,   wdef: 800,  mdef: 800,  exp: 0,    map: "루디브리엄 궁전 (보스)" },
  { name: "블루와이번",    level: 101, hp: 57000,     wdef: 800,  mdef: 800,  exp: 3050, map: "리프레" },
  { name: "독수리",        level: 102, hp: 58000,     wdef: 840,  mdef: 840,  exp: 3100, map: "리프레" },
  { name: "다크와이번",    level: 103, hp: 60000,     wdef: 850,  mdef: 850,  exp: 3150, map: "리프레" },
  { name: "만티스",        level: 105, hp: 65000,     wdef: 870,  mdef: 870,  exp: 3600, map: "리프레" },
  { name: "아이스드라코",  level: 108, hp: 75000,     wdef: 900,  mdef: 900,  exp: 4100, map: "리프레" },
  { name: "스켈레곤",      level: 110, hp: 80000,     wdef: 900,  mdef: 900,  exp: 4500, map: "리프레" },
  { name: "메카트로피",    level: 112, hp: 88000,     wdef: 970,  mdef: 940,  exp: 4800, map: "루디브리엄" },
  { name: "스켈로스",      level: 113, hp: 85000,     wdef: 950,  mdef: 950,  exp: 4750, map: "리프레" },
  { name: "파퀴",          level: 115, hp: 95000,     wdef: 1000, mdef: 980,  exp: 5000, map: "루디브리엄" },
  { name: "핫샌드",        level: 116, hp: 100000,    wdef: 1000, mdef: 1000, exp: 5200, map: "리프레" },
  { name: "만타",          level: 118, hp: 108000,    wdef: 1020, mdef: 1020, exp: 5600, map: "리프레" },
  { name: "마리온에트",    level: 120, hp: 120000,    wdef: 1050, mdef: 1050, exp: 6200, map: "루디브리엄" },
  { name: "리스크리",      level: 122, hp: 130000,    wdef: 1080, mdef: 1080, exp: 6800, map: "루디브리엄" },
  // 보스
  { name: "오르카",        level: 130, hp: 35000000,  wdef: 1200, mdef: 1200, exp: 0,    map: "빅마마 섬 (보스)" },
  { name: "자쿰",          level: 140, hp: 128000000, wdef: 1500, mdef: 1500, exp: 0,    map: "자쿰 신전 (보스)" },
];

// ─── 데미지 계산 ───
interface DamageResult {
  maxDmg: number;
  minDmg: number;
  avgDmg: number;
}

function calcPhysicalDamage(
  mainStat: number,
  subStat: number,
  atk: number,
  maxMult: number,
  minMult: number,
  mastery: number,
  skillPct: number,
  hits: number,
  charLevel: number,
  monLevel: number,
  wdef: number
): DamageResult {
  const D = Math.max(monLevel - charLevel, 0);
  const levelPenalty = 1 - 0.01 * D;
  const maxDmg =
    Math.max(
      ((mainStat * maxMult + subStat) * (atk / 100) * levelPenalty - wdef * 0.5) *
        (skillPct / 100),
      1
    ) * hits;
  const minDmg =
    Math.max(
      ((mainStat * minMult * 0.9 * mastery + subStat) * (atk / 100) * levelPenalty -
        wdef * 0.6) *
        (skillPct / 100),
      1
    ) * hits;
  return { maxDmg, minDmg, avgDmg: (maxDmg + minDmg) / 2 };
}

// 법사 데미지: MAX=(INT+LUK)×MA/100, MIN=(INT+LUK×0.5)×MA/100
function calcMagicDamage(
  int_: number,
  luk: number,
  ma: number,
  skillPct: number,
  hits: number,
  charLevel: number,
  monLevel: number,
  mdef: number
): DamageResult {
  const D = Math.max(monLevel - charLevel, 0);
  const defMult = 1 + 0.01 * D;
  const maxBase = (int_ + luk) * (ma / 100);
  const minBase = (int_ + luk * 0.5) * (ma / 100);
  const maxDmg = Math.max((maxBase * (skillPct / 100) - mdef * 0.5 * defMult), 1) * hits;
  const minDmg = Math.max((minBase * (skillPct / 100) - mdef * 0.6 * defMult), 1) * hits;
  return { maxDmg, minDmg, avgDmg: (maxDmg + minDmg) / 2 };
}

function calcNHit(hp: number, dmg: DamageResult): { nHitMax: number; nHitAvg: number } {
  const nHitMax = Math.ceil(hp / dmg.maxDmg);
  const nHitAvg = Math.ceil(hp / dmg.avgDmg);
  return { nHitMax, nHitAvg };
}

// 원킬컷 역산: physical ATK (maxMult 기준)
function calcOneKillAtk(
  hp: number,
  mainStat: number,
  subStat: number,
  maxMult: number,
  skillPct: number,
  hits: number,
  charLevel: number,
  monLevel: number,
  wdef: number
): number {
  const D = Math.max(monLevel - charLevel, 0);
  const levelPenalty = 1 - 0.01 * D;
  const targetDmg = (hp / hits) / (skillPct / 100) + wdef * 0.5;
  const baseAtk = targetDmg / (levelPenalty * ((mainStat * maxMult + subStat) / 100));
  return Math.ceil(baseAtk);
}

// 원킬컷 역산: magic MA
// (INT + LUK) × MA/100 × skill% - MDEF×0.5×defMult = HP/hits
// → MA = (HP/hits / (skill%/100) + MDEF×0.5×defMult) × 100 / (INT + LUK)
function calcOneKillMa(
  hp: number,
  int_: number,
  luk: number,
  skillPct: number,
  hits: number,
  charLevel: number,
  monLevel: number,
  mdef: number
): number {
  const D = Math.max(monLevel - charLevel, 0);
  const defMult = 1 + 0.01 * D;
  const target = (hp / hits) / (skillPct / 100) + mdef * 0.5 * defMult;
  const denom = (int_ + luk) / 100;
  if (denom <= 0) return 0;
  return Math.ceil(target / denom);
}

// ─── 몬테카를로 시뮬레이션 ───
interface MonteCarloResult {
  distribution: Record<number, number>; // { 1: 0.42, 2: 0.38, 3: 0.15, ... }
  expectedHits: number;
  median: number;
  pOneHit: number;
  pTwoHit: number;
  pThreeHit: number;
  pFourPlusHit: number;
}

function runMonteCarlo(
  hp: number,
  minDmg: number,
  maxDmg: number,
  critRate: number,   // 0-100
  critMultiplier: number, // e.g., 2.0 for +100% crit dmg
  simCount: number = 10000
): MonteCarloResult {
  const hitCounts: number[] = [];
  for (let i = 0; i < simCount; i++) {
    let remaining = hp;
    let hits = 0;
    while (remaining > 0) {
      const rawDmg = minDmg + Math.random() * (maxDmg - minDmg);
      const isCrit = critRate > 0 && Math.random() * 100 < critRate;
      const dmg = isCrit ? rawDmg * critMultiplier : rawDmg;
      remaining -= dmg;
      hits++;
      if (hits > 9999) break; // safety
    }
    hitCounts.push(hits);
  }

  // build distribution
  const countMap: Record<number, number> = {};
  for (const h of hitCounts) {
    countMap[h] = (countMap[h] ?? 0) + 1;
  }
  const distribution: Record<number, number> = {};
  for (const [k, v] of Object.entries(countMap)) {
    distribution[Number(k)] = v / simCount;
  }

  hitCounts.sort((a, b) => a - b);
  const expectedHits = hitCounts.reduce((s, v) => s + v, 0) / simCount;
  const median = hitCounts[Math.floor(simCount / 2)];

  const pOneHit = distribution[1] ?? 0;
  const pTwoHit = distribution[2] ?? 0;
  const pThreeHit = distribution[3] ?? 0;
  const pFourPlusHit = 1 - pOneHit - pTwoHit - pThreeHit;

  return { distribution, expectedHits, median, pOneHit, pTwoHit, pThreeHit, pFourPlusHit };
}

// 공통 입력 컴포넌트
function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
      />
    </div>
  );
}

type Tab = "calc" | "hunt";

// ─── 메인 컴포넌트 ───
export default function NHitPage() {
  const [activeTab, setActiveTab] = useState<Tab>("calc");

  // 직업 그룹 & 세부 직업
  const [jobGroup, setJobGroup] = useState("전사");
  const [subJob, setSubJob] = useState("히어로");

  // 세부 직업 데이터
  const jobData = JOB_SKILL_DATA[subJob];
  const isMagic = jobData?.isMagic ?? false;

  // 무기
  const [weaponKey, setWeaponKey] = useState("한손검");

  // 선택된 무기 정보
  const weaponInfo = WEAPON_MULTIPLIERS[weaponKey];

  // 스킬 선택
  const [selectedSkillIdx, setSelectedSkillIdx] = useState(0);

  // 패시브 토글 (기본 true)
  const [enabledPassives, setEnabledPassives] = useState<Record<string, boolean>>({});

  // 스탯 입력
  const [mainStat, setMainStat] = useState(120);
  const [subStat, setSubStat] = useState(50);
  const [atk, setAtk] = useState(80);
  const [ma, setMa] = useState(200);
  const [int_, setInt] = useState(300);
  const [luk, setLuk] = useState(50);
  const [charLevel, setCharLevel] = useState(70);

  // 몬스터 선택
  const [usePreset, setUsePreset] = useState(true);
  const [selectedMonster, setSelectedMonster] = useState(0);
  const [manualName, setManualName] = useState("커스텀 몬스터");
  const [manualLevel, setManualLevel] = useState(70);
  const [manualHp, setManualHp] = useState(15000);
  const [manualWdef, setManualWdef] = useState(250);
  const [manualMdef, setManualMdef] = useState(250);

  // AI 분석
  const [aiResult, setAiResult] = useState<{ claude: string; gemini: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const monster: Monster = usePreset
    ? HUNTING_GROUNDS[selectedMonster]
    : {
        name: manualName,
        level: manualLevel,
        hp: manualHp,
        wdef: manualWdef,
        mdef: manualMdef,
        exp: 0,
        map: "-",
      };

  // 직업 그룹 변경 시 세부 직업 초기화
  const handleJobGroupChange = (group: string) => {
    setJobGroup(group);
    const firstSub = JOB_GROUPS[group][0];
    setSubJob(firstSub);
    setSelectedSkillIdx(0);
    const firstWeapon = JOB_SKILL_DATA[firstSub]?.weapons[0];
    if (firstWeapon) setWeaponKey(firstWeapon);
  };

  // 세부 직업 변경
  const handleSubJobChange = (sub: string) => {
    setSubJob(sub);
    setSelectedSkillIdx(0);
    const firstWeapon = JOB_SKILL_DATA[sub]?.weapons[0];
    if (firstWeapon) setWeaponKey(firstWeapon);
  };

  // 현재 스킬 정보
  const actives = jobData?.actives ?? [];
  const passives = jobData?.passives ?? [];
  const selectedSkill = actives[selectedSkillIdx] ?? actives[0];

  // 마스터리: 활성화된 패시브 중 mastery 값 사용 (최대값)
  const effectiveMastery = useMemo(() => {
    let m = 0;
    for (const p of passives) {
      const key = p.name;
      const isOn = enabledPassives[key] !== false; // 기본 on
      if (isOn && p.mastery != null && p.mastery > m) {
        m = p.mastery;
      }
    }
    return m > 0 ? m : 50; // 패시브 없으면 50% 기본
  }, [passives, enabledPassives]);

  // 크리티컬 정보 (나이트로드 등)
  const effectiveCritRate = useMemo(() => {
    for (const p of passives) {
      if (enabledPassives[p.name] !== false && p.critRate != null) return p.critRate;
    }
    return 0;
  }, [passives, enabledPassives]);

  const effectiveCritDmg = useMemo(() => {
    for (const p of passives) {
      if (enabledPassives[p.name] !== false && p.critDmg != null) return p.critDmg;
    }
    return 0;
  }, [passives, enabledPassives]);

  const skillPct = selectedSkill?.damage ?? 100;
  const skillHits = selectedSkill?.hits ?? 1;

  const dmgResult = useMemo<DamageResult>(() => {
    if (isMagic) {
      return calcMagicDamage(
        int_,
        luk,
        ma,
        skillPct,
        skillHits,
        charLevel,
        monster.level,
        monster.mdef
      );
    }
    return calcPhysicalDamage(
      mainStat,
      subStat,
      atk,
      weaponInfo?.maxMult ?? 4.0,
      weaponInfo?.minMult ?? 4.0,
      effectiveMastery / 100,
      skillPct,
      skillHits,
      charLevel,
      monster.level,
      monster.wdef
    );
  }, [
    isMagic, ma, int_, luk, effectiveMastery, skillPct, skillHits,
    charLevel, mainStat, subStat, atk, weaponInfo, monster,
  ]);

  // 크리티컬 데미지 결과
  const critDmgResult = useMemo<DamageResult>(() => {
    if (effectiveCritRate === 0) return dmgResult;
    const factor = 1 + effectiveCritDmg / 100;
    return {
      maxDmg: dmgResult.maxDmg * factor,
      minDmg: dmgResult.minDmg * factor,
      avgDmg: dmgResult.avgDmg * factor,
    };
  }, [dmgResult, effectiveCritRate, effectiveCritDmg]);

  const { nHitMax, nHitAvg } = calcNHit(monster.hp, dmgResult);
  const { nHitMax: critNHitMax, nHitAvg: critNHitAvg } = calcNHit(monster.hp, critDmgResult);

  const oneKillAtk = isMagic
    ? calcOneKillMa(monster.hp, int_, luk, skillPct, skillHits, charLevel, monster.level, monster.mdef)
    : calcOneKillAtk(
        monster.hp,
        mainStat,
        subStat,
        weaponInfo?.maxMult ?? 4.0,
        skillPct,
        skillHits,
        charLevel,
        monster.level,
        monster.wdef
      );

  // 몬테카를로 결과
  const mcResult = useMemo<MonteCarloResult>(() => {
    return runMonteCarlo(
      monster.hp,
      dmgResult.minDmg,
      dmgResult.maxDmg,
      effectiveCritRate,
      effectiveCritRate > 0 ? 1 + effectiveCritDmg / 100 : 1
    );
  }, [monster.hp, dmgResult.minDmg, dmgResult.maxDmg, effectiveCritRate, effectiveCritDmg]);

  // AI 분석 핸들러
  const handleAiAnalyze = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/nhit-ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobName: subJob,
          skillName: selectedSkill?.name ?? "",
          skillDamage: selectedSkill?.damage ?? 0,
          skillHits: selectedSkill?.hits ?? 1,
          monsterName: monster.name,
          monsterHp: monster.hp,
          monsterLevel: monster.level,
          charLevel,
          mainStat,
          subStat,
          atk,
          weaponType: weaponKey,
          mcResult: {
            pOneHit: mcResult.pOneHit,
            pTwoHit: mcResult.pTwoHit,
            pThreeHit: mcResult.pThreeHit,
            pFourPlusHit: mcResult.pFourPlusHit,
            expectedHits: mcResult.expectedHits,
            median: mcResult.median,
          },
        }),
      });
      const data = await res.json();
      setAiResult(data);
    } catch {
      setAiResult({ claude: "오류 발생", gemini: "오류 발생" });
    } finally {
      setAiLoading(false);
    }
  }, [subJob, selectedSkill, monster, charLevel, mainStat, subStat, atk, weaponKey, mcResult]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">엔방컷 계산기</h1>
      <p className="text-sm text-gray-500 mb-6">
        데미지를 계산하고 몬스터 N방컷을 확인하세요
      </p>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {(
          [
            { key: "calc" as Tab, label: "엔방컷 계산기" },
            { key: "hunt" as Tab, label: "사냥터 추천" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-white text-orange-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "calc" && (
        <CalcTab
          jobGroup={jobGroup}
          onJobGroupChange={handleJobGroupChange}
          subJob={subJob}
          onSubJobChange={handleSubJobChange}
          jobData={jobData}
          weaponKey={weaponKey}
          setWeaponKey={setWeaponKey}
          isMagic={isMagic}
          selectedSkillIdx={selectedSkillIdx}
          setSelectedSkillIdx={setSelectedSkillIdx}
          enabledPassives={enabledPassives}
          setEnabledPassives={setEnabledPassives}
          mainStat={mainStat}
          setMainStat={setMainStat}
          subStat={subStat}
          setSubStat={setSubStat}
          atk={atk}
          setAtk={setAtk}
          ma={ma}
          setMa={setMa}
          int_={int_}
          setInt={setInt}
          luk={luk}
          setLuk={setLuk}
          charLevel={charLevel}
          setCharLevel={setCharLevel}
          usePreset={usePreset}
          setUsePreset={setUsePreset}
          selectedMonster={selectedMonster}
          setSelectedMonster={setSelectedMonster}
          manualName={manualName}
          setManualName={setManualName}
          manualLevel={manualLevel}
          setManualLevel={setManualLevel}
          manualHp={manualHp}
          setManualHp={setManualHp}
          manualWdef={manualWdef}
          setManualWdef={setManualWdef}
          manualMdef={manualMdef}
          setManualMdef={setManualMdef}
          monster={monster}
          dmgResult={dmgResult}
          nHitMax={nHitMax}
          nHitAvg={nHitAvg}
          oneKillAtk={oneKillAtk}
          effectiveMastery={effectiveMastery}
          weaponInfo={weaponInfo}
          effectiveCritRate={effectiveCritRate}
          effectiveCritDmg={effectiveCritDmg}
          critNHitMax={critNHitMax}
          critNHitAvg={critNHitAvg}
          mcResult={mcResult}
          aiResult={aiResult}
          aiLoading={aiLoading}
          onAiAnalyze={handleAiAnalyze}
        />
      )}
      {activeTab === "hunt" && (
        <HuntTab
          charLevel={charLevel}
          isMagic={isMagic}
          dmgResult={dmgResult}
        />
      )}
    </div>
  );
}

// ─── 계산기 탭 Props ───
interface CalcTabProps {
  jobGroup: string;
  onJobGroupChange: (g: string) => void;
  subJob: string;
  onSubJobChange: (s: string) => void;
  jobData: JobSkillData;
  weaponKey: string;
  setWeaponKey: (v: string) => void;
  isMagic: boolean;
  selectedSkillIdx: number;
  setSelectedSkillIdx: (v: number) => void;
  enabledPassives: Record<string, boolean>;
  setEnabledPassives: (v: Record<string, boolean>) => void;
  mainStat: number;
  setMainStat: (v: number) => void;
  subStat: number;
  setSubStat: (v: number) => void;
  atk: number;
  setAtk: (v: number) => void;
  ma: number;
  setMa: (v: number) => void;
  int_: number;
  setInt: (v: number) => void;
  luk: number;
  setLuk: (v: number) => void;
  charLevel: number;
  setCharLevel: (v: number) => void;
  usePreset: boolean;
  setUsePreset: (v: boolean) => void;
  selectedMonster: number;
  setSelectedMonster: (v: number) => void;
  manualName: string;
  setManualName: (v: string) => void;
  manualLevel: number;
  setManualLevel: (v: number) => void;
  manualHp: number;
  setManualHp: (v: number) => void;
  manualWdef: number;
  setManualWdef: (v: number) => void;
  manualMdef: number;
  setManualMdef: (v: number) => void;
  monster: Monster;
  dmgResult: DamageResult;
  nHitMax: number;
  nHitAvg: number;
  oneKillAtk: number;
  effectiveMastery: number;
  weaponInfo: { maxMult: number; minMult: number; mainStat: string; subStat: string; type: "melee" | "ranged" | "magic" } | undefined;
  effectiveCritRate: number;
  effectiveCritDmg: number;
  critNHitMax: number;
  critNHitAvg: number;
  mcResult: MonteCarloResult;
  aiResult: { claude: string; gemini: string } | null;
  aiLoading: boolean;
  onAiAnalyze: () => void;
}

function CalcTab({
  jobGroup, onJobGroupChange, subJob, onSubJobChange, jobData,
  weaponKey, setWeaponKey, isMagic,
  selectedSkillIdx, setSelectedSkillIdx,
  enabledPassives, setEnabledPassives,
  mainStat, setMainStat, subStat, setSubStat, atk, setAtk,
  ma, setMa, int_, setInt, luk, setLuk,
  charLevel, setCharLevel,
  usePreset, setUsePreset, selectedMonster, setSelectedMonster,
  manualName, setManualName, manualLevel, setManualLevel,
  manualHp, setManualHp, manualWdef, setManualWdef, manualMdef, setManualMdef,
  monster, dmgResult, nHitMax, nHitAvg, oneKillAtk,
  effectiveMastery, weaponInfo,
  effectiveCritRate, effectiveCritDmg, critNHitMax, critNHitAvg,
  mcResult, aiResult, aiLoading, onAiAnalyze,
}: CalcTabProps) {
  const actives = jobData?.actives ?? [];
  const passives = jobData?.passives ?? [];
  const selectedSkill = actives[selectedSkillIdx] ?? actives[0];

  const togglePassive = (name: string) => {
    const current = enabledPassives[name] !== false;
    setEnabledPassives({ ...enabledPassives, [name]: !current });
  };

  const nHitColor = (n: number) => {
    if (n === 1) return "text-green-600";
    if (n === 2) return "text-blue-600";
    if (n === 3) return "text-orange-500";
    return "text-red-500";
  };

  const nHitBg = (n: number) => {
    if (n === 1) return "bg-green-50 border-green-200";
    if (n === 2) return "bg-blue-50 border-blue-200";
    if (n === 3) return "bg-orange-50 border-orange-200";
    return "bg-red-50 border-red-200";
  };

  // 확률 분포 카드 스타일 (Tailwind 동적 클래스 방지용 하드코딩)
  const distCardStyle = (color: string) => {
    if (color === "green") return {
      card: "rounded-xl border p-3 text-center bg-green-50 border-green-200",
      label: "text-xs text-green-500 mb-1",
      value: "text-2xl font-bold text-green-700",
      bar: "h-full bg-green-400 rounded-full",
    };
    if (color === "blue") return {
      card: "rounded-xl border p-3 text-center bg-blue-50 border-blue-200",
      label: "text-xs text-blue-500 mb-1",
      value: "text-2xl font-bold text-blue-700",
      bar: "h-full bg-blue-400 rounded-full",
    };
    if (color === "orange") return {
      card: "rounded-xl border p-3 text-center bg-orange-50 border-orange-200",
      label: "text-xs text-orange-500 mb-1",
      value: "text-2xl font-bold text-orange-700",
      bar: "h-full bg-orange-400 rounded-full",
    };
    return {
      card: "rounded-xl border p-3 text-center bg-red-50 border-red-200",
      label: "text-xs text-red-500 mb-1",
      value: "text-2xl font-bold text-red-700",
      bar: "h-full bg-red-400 rounded-full",
    };
  };

  return (
    <div className="space-y-5">
      {/* 캐릭터 설정 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">캐릭터 설정</h2>

        {/* 직업 그룹 선택 */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">직업 계열</label>
          <div className="flex gap-1 flex-wrap">
            {JOB_GROUP_KEYS.map((g) => (
              <button
                key={g}
                onClick={() => onJobGroupChange(g)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  jobGroup === g
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* 세부 직업 선택 */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">세부 직업</label>
          <div className="flex gap-1 flex-wrap">
            {JOB_GROUPS[jobGroup].map((s) => (
              <button
                key={s}
                onClick={() => onSubJobChange(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  subJob === s
                    ? "bg-orange-100 text-orange-700 border border-orange-300"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 무기 선택 (물리 직업만) */}
        {!isMagic && jobData?.weapons.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">무기 종류</label>
            <select
              value={weaponKey}
              onChange={(e) => setWeaponKey(e.target.value)}
              className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              {jobData.weapons.map((w) => (
                <option key={w} value={w}>
                  {w} (최대배율 {WEAPON_MULTIPLIERS[w]?.maxMult} / 최소배율 {WEAPON_MULTIPLIERS[w]?.minMult})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 스탯 입력 */}
        {!isMagic ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NumberInput
              label={`주스탯 (${weaponInfo?.mainStat ?? "STR"})`}
              value={mainStat}
              onChange={setMainStat}
              min={1}
            />
            <NumberInput
              label={`부스탯 (${weaponInfo?.subStat ?? "DEX"})`}
              value={subStat}
              onChange={setSubStat}
              min={0}
            />
            <NumberInput label="공격력 (ATK)" value={atk} onChange={setAtk} min={1} />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NumberInput label="지력 (INT)" value={int_} onChange={setInt} min={1} />
            <NumberInput label="운 (LUK)" value={luk} onChange={setLuk} min={0} />
            <NumberInput label="마법공격력 (MA)" value={ma} onChange={setMa} min={1} />
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <NumberInput label="캐릭터 레벨" value={charLevel} onChange={setCharLevel} min={1} max={200} />
          <div className="flex items-end">
            <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              마스터리 {effectiveMastery}% 적용 중
            </span>
          </div>
        </div>
      </div>

      {/* 스킬 선택 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">스킬 선택</h2>

        {/* 패시브 스킬 토글 */}
        {passives.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">패시브 스킬</label>
            <div className="flex flex-wrap gap-2">
              {passives.map((p) => {
                const isOn = enabledPassives[p.name] !== false;
                return (
                  <button
                    key={p.name}
                    onClick={() => togglePassive(p.name)}
                    title={p.description}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      isOn
                        ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                        : "bg-gray-50 text-gray-400 border-gray-200"
                    }`}
                  >
                    {isOn ? "✓ " : ""}{p.name}
                    {p.mastery != null ? ` (${p.mastery}%)` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 액티브 스킬 선택 */}
        {actives.length > 0 ? (
          <>
            <label className="block text-xs font-medium text-gray-500 mb-2">공격 스킬</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {actives.map((skill, idx) => (
                <button
                  key={skill.name}
                  onClick={() => setSelectedSkillIdx(idx)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    selectedSkillIdx === idx
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {skill.name}
                </button>
              ))}
            </div>

            {/* 선택된 스킬 정보 카드 */}
            {selectedSkill && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-bold text-orange-800">{selectedSkill.name}</span>
                  {selectedSkill.element && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ELEMENT_COLORS[selectedSkill.element]}`}>
                      {ELEMENT_LABEL[selectedSkill.element]}
                    </span>
                  )}
                </div>
                <div className="flex gap-4 text-sm text-orange-700 flex-wrap">
                  <span>
                    <span className="text-orange-400 text-xs mr-1">데미지</span>
                    <span className="font-bold">{selectedSkill.damage}%</span>
                  </span>
                  <span>
                    <span className="text-orange-400 text-xs mr-1">타수</span>
                    <span className="font-bold">{selectedSkill.hits}타</span>
                  </span>
                  {selectedSkill.mobs != null && selectedSkill.mobs > 1 && (
                    <span>
                      <span className="text-orange-400 text-xs mr-1">타격 마리수</span>
                      <span className="font-bold">{selectedSkill.mobs}마리</span>
                    </span>
                  )}
                  <span>
                    <span className="text-orange-400 text-xs mr-1">1회 총 데미지</span>
                    <span className="font-bold">{selectedSkill.damage * selectedSkill.hits}%</span>
                  </span>
                </div>
                {selectedSkill.element && (
                  <p className="text-xs text-orange-500 mt-2">
                    속성 보정(약점 배율) 미포함 — 기본 데미지 기준
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">선택된 직업의 스킬 데이터가 없습니다.</p>
        )}
      </div>

      {/* 몬스터 선택 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">대상 몬스터</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setUsePreset(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                usePreset ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              목록 선택
            </button>
            <button
              onClick={() => setUsePreset(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !usePreset ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              직접 입력
            </button>
          </div>
        </div>

        {usePreset ? (
          <select
            value={selectedMonster}
            onChange={(e) => setSelectedMonster(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
          >
            {HUNTING_GROUNDS.map((m, i) => (
              <option key={i} value={i}>
                {m.name} (Lv.{m.level} / HP {m.hp.toLocaleString()} / 방어 {m.wdef}/{m.mdef}) — {m.map}
              </option>
            ))}
          </select>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">몬스터 이름</label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <NumberInput label="레벨" value={manualLevel} onChange={setManualLevel} min={1} max={200} />
            <NumberInput label="HP" value={manualHp} onChange={setManualHp} min={1} />
            <NumberInput label="물리방어 (WDEF)" value={manualWdef} onChange={setManualWdef} min={0} />
            <NumberInput label="마법방어 (MDEF)" value={manualMdef} onChange={setManualMdef} min={0} />
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
          <span className="bg-gray-50 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs mr-1">몬스터</span>
            <span className="font-medium">{monster.name}</span>
          </span>
          <span className="bg-gray-50 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs mr-1">레벨</span>
            <span className="font-medium">Lv.{monster.level}</span>
          </span>
          <span className="bg-gray-50 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs mr-1">HP</span>
            <span className="font-medium">{monster.hp.toLocaleString()}</span>
          </span>
          <span className="bg-gray-50 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs mr-1">물방/마방</span>
            <span className="font-medium">{monster.wdef}/{monster.mdef}</span>
          </span>
          {monster.exp > 0 && (
            <span className="bg-gray-50 rounded-lg px-3 py-1.5">
              <span className="text-gray-400 text-xs mr-1">경험치</span>
              <span className="font-medium">{monster.exp.toLocaleString()}</span>
            </span>
          )}
        </div>
      </div>

      {/* 결과 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">계산 결과</h2>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">최대 데미지</p>
            <p className="font-bold text-gray-800">{Math.floor(dmgResult.maxDmg).toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">평균 데미지</p>
            <p className="font-bold text-gray-800">{Math.floor(dmgResult.avgDmg).toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">최소 데미지</p>
            <p className="font-bold text-gray-800">{Math.floor(dmgResult.minDmg).toLocaleString()}</p>
          </div>
        </div>

        <div className={`rounded-xl border p-4 mb-3 ${nHitBg(nHitAvg)}`}>
          <p className="text-sm text-gray-500 mb-1">
            {monster.name} N방컷{effectiveCritRate > 0 ? " (노크리)" : ""}
          </p>
          <p className={`text-3xl font-bold ${nHitColor(nHitAvg)}`}>
            평균 {nHitAvg}방컷
          </p>
          <p className="text-sm text-gray-500 mt-1">
            최대 데미지 기준: {nHitMax}방컷 &nbsp;|&nbsp; 평균 데미지 기준: {nHitAvg}방컷
          </p>
          {selectedSkill && selectedSkill.hits > 1 && (
            <p className="text-xs text-gray-400 mt-1">
              {selectedSkill.name} {selectedSkill.hits}타 × {selectedSkill.damage}% = 1회 {selectedSkill.damage * selectedSkill.hits}% 반영
            </p>
          )}
        </div>

        {effectiveCritRate > 0 && (
          <div className="rounded-xl border bg-yellow-50 border-yellow-200 p-4 mb-3">
            <p className="text-sm text-gray-500 mb-1">
              {monster.name} N방컷 (크리 {effectiveCritRate}% 발동 시, +{effectiveCritDmg}%)
            </p>
            <p className={`text-3xl font-bold ${nHitColor(critNHitAvg)}`}>
              크리 {critNHitAvg}방컷
            </p>
            <p className="text-sm text-gray-500 mt-1">
              최대 기준: {critNHitMax}방컷 &nbsp;|&nbsp; 평균 기준: {critNHitAvg}방컷
            </p>
          </div>
        )}

        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">원킬컷 {isMagic ? "마법공격력 (MA)" : "공격력 (ATK)"}</p>
          <p className="text-2xl font-bold text-orange-600">
            {oneKillAtk > 0 ? oneKillAtk.toLocaleString() : "계산 불가"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {monster.name}을 1방에 잡으려면 필요한 {isMagic ? "마법공격력" : "공격력"}
          </p>
        </div>
      </div>

      {/* 몬테카를로 확률 분포 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-bold text-lg">확률 분포</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">몬테카를로 10,000회</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "1방컷", value: mcResult.pOneHit, color: "green" },
            { label: "2방컷", value: mcResult.pTwoHit, color: "blue" },
            { label: "3방컷", value: mcResult.pThreeHit, color: "orange" },
            { label: "4방+", value: mcResult.pFourPlusHit, color: "red" },
          ].map(({ label, value, color }) => {
            const style = distCardStyle(color);
            return (
              <div key={label} className={style.card}>
                <div className={style.label}>{label}</div>
                <div className={style.value}>{(value * 100).toFixed(1)}%</div>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={style.bar} style={{ width: `${value * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 text-sm text-gray-600">
          <span>기댓값 <strong>{mcResult.expectedHits.toFixed(2)}방</strong></span>
          <span>중앙값 <strong>{mcResult.median}방</strong></span>
        </div>
      </div>

      {/* AI 분석 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">AI 분석</h2>
          <button
            onClick={onAiAnalyze}
            disabled={aiLoading}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 transition-all"
          >
            {aiLoading ? "분석 중..." : "Claude + Gemini 분석"}
          </button>
        </div>
        {aiResult && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">Claude</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{aiResult.claude}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Gemini</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{aiResult.gemini}</p>
            </div>
          </div>
        )}
        {!aiResult && !aiLoading && (
          <p className="text-sm text-gray-400 text-center py-4">버튼을 클릭하면 Claude와 Gemini가 현재 세팅을 분석해줍니다</p>
        )}
      </div>

      {/* 공식 설명 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold mb-3 text-gray-700">데미지 공식 참고</h2>
        {!isMagic ? (
          <div className="text-xs text-gray-500 space-y-1 font-mono bg-gray-50 rounded-lg p-3">
            <p>최대 = (주스탯 × 최대배율 + 부스탯) × ATK/100 × (1 - 0.01×D) - 물방×0.5) × 스킬% × 타수</p>
            <p>최소 = (주스탯 × 최소배율 × 0.9 × 마스터리 + 부스탯) × ATK/100 × (1 - 0.01×D) - 물방×0.6) × 스킬% × 타수</p>
            <p className="text-gray-400">D = max(몬스터레벨 - 캐릭터레벨, 0)</p>
          </div>
        ) : (
          <div className="text-xs text-gray-500 space-y-1 font-mono bg-gray-50 rounded-lg p-3">
            <p>최대 = (INT + LUK) × MA/100 × 스킬% × 타수 − 마방×0.5×(1+0.01×D)</p>
            <p>최소 = (INT + LUK×0.5) × MA/100 × 스킬% × 타수 − 마방×0.6×(1+0.01×D)</p>
            <p className="text-gray-400">D = max(몬스터레벨 - 캐릭터레벨, 0)</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 사냥터 추천 탭 ───
interface HuntTabProps {
  charLevel: number;
  isMagic: boolean;
  dmgResult: DamageResult;
}

interface HuntRow {
  monster: Monster;
  nHitMax: number;
  nHitAvg: number;
  hpExp: number;
  efficiency: number;
}

function HuntTab({ charLevel, isMagic, dmgResult }: HuntTabProps) {
  const [levelRange, setLevelRange] = useState(20);
  const [sortBy, setSortBy] = useState<"efficiency" | "level" | "nhit">("efficiency");

  const rows = useMemo<HuntRow[]>(() => {
    return HUNTING_GROUNDS.filter(
      (m) =>
        m.level >= charLevel - levelRange && m.level <= charLevel + levelRange
    ).map((m) => {
      const { nHitMax, nHitAvg } = calcNHit(m.hp, dmgResult);
      const hpExp = m.exp > 0 ? Math.round(m.hp / m.exp) : 9999;
      const efficiency = m.exp > 0 ? Math.round(m.exp / nHitAvg) : 0;
      return { monster: m, nHitMax, nHitAvg, hpExp, efficiency };
    });
  }, [charLevel, levelRange, dmgResult]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sortBy === "efficiency") return copy.sort((a, b) => b.efficiency - a.efficiency);
    if (sortBy === "level") return copy.sort((a, b) => a.monster.level - b.monster.level);
    return copy.sort((a, b) => a.nHitAvg - b.nHitAvg);
  }, [rows, sortBy]);

  const nHitColor = (n: number) => {
    if (n === 1) return "text-green-600 font-bold";
    if (n === 2) return "text-blue-600 font-bold";
    if (n === 3) return "text-orange-500 font-bold";
    return "text-red-500";
  };

  const nHitBadge = (n: number) => {
    if (n === 1) return "bg-green-100 text-green-700";
    if (n === 2) return "bg-blue-100 text-blue-700";
    if (n === 3) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-600";
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">추천 설정</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              레벨 범위 (캐릭터 레벨 ± {levelRange})
            </label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={levelRange}
              onChange={(e) => setLevelRange(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>±5</span>
              <span>±50</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">정렬 기준</label>
            <div className="flex gap-1 flex-wrap">
              {(
                [
                  { key: "efficiency" as const, label: "경험치 효율" },
                  { key: "nhit" as const, label: "N방컷 순" },
                  { key: "level" as const, label: "레벨순" },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === s.key
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          캐릭터 레벨 {charLevel} 기준 · {isMagic ? "마법 데미지" : "물리 데미지"} 적용 ·
          레벨 범위 {charLevel - levelRange}~{charLevel + levelRange}
        </p>
      </div>

      {sorted.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          해당 레벨 범위에 몬스터가 없습니다. 레벨 범위를 넓혀보세요.
        </div>
      )}

      {sorted.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {sorted
              .filter((r) => r.nHitAvg <= 3)
              .slice(0, 3)
              .map((r) => (
                <div
                  key={r.monster.name}
                  className="bg-orange-50 border border-orange-200 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-bold text-gray-800">{r.monster.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${nHitBadge(r.nHitAvg)}`}
                    >
                      {r.nHitAvg}방컷
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Lv.{r.monster.level} · {r.monster.map}</p>
                  <p className="text-xs text-gray-500">
                    경험치 효율 {r.efficiency.toLocaleString()} exp/타
                  </p>
                </div>
              ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-bold">전체 사냥터 목록</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="text-left px-4 py-2.5 font-medium">몬스터</th>
                    <th className="text-center px-3 py-2.5 font-medium">레벨</th>
                    <th className="text-right px-3 py-2.5 font-medium">HP</th>
                    <th className="text-right px-3 py-2.5 font-medium">방어력</th>
                    <th className="text-right px-3 py-2.5 font-medium">경험치</th>
                    <th className="text-right px-3 py-2.5 font-medium">체경비</th>
                    <th className="text-center px-3 py-2.5 font-medium">N방컷</th>
                    <th className="text-right px-3 py-2.5 font-medium">효율(exp/타)</th>
                    <th className="text-left px-4 py-2.5 font-medium">사냥터</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr
                      key={r.monster.name}
                      className={`border-t border-gray-50 ${
                        r.nHitAvg <= 2 ? "bg-green-50/30" : r.nHitAvg === 3 ? "bg-orange-50/30" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium">{r.monster.name}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">
                        {r.monster.level}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {r.monster.hp.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-500">
                        {isMagic ? r.monster.mdef : r.monster.wdef}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {r.monster.exp.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-500">
                        {r.hpExp.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs ${nHitBadge(r.nHitAvg)}`}
                        >
                          {r.nHitAvg}방
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs ${nHitColor(r.nHitAvg)}`}>
                        {r.efficiency.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{r.monster.map}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-green-400 inline-block" />
              1방컷
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-400 inline-block" />
              2방컷
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-orange-400 inline-block" />
              3방컷
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-400 inline-block" />
              4방컷 이상
            </span>
          </div>
        </>
      )}
    </div>
  );
}
