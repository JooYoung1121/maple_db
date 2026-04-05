"use client";

import { useState, useMemo, useEffect } from "react";

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
  mobs?: number;
  type: "active";
  element?: "fire" | "ice" | "lightning" | "holy" | "poison" | "dark";
  minDamage: number;
  maxLevel: number;
}

interface BuffSkill {
  name: string;
  type: "passive";
  description: string;
  damageMultiplier?: number;
  statMultiplier?: number;
  critRateBonus?: number;
  critDmgBonus?: number;
  comboType?: boolean;
  comboMultiplierPerOrb?: number;
  maxOrbs?: number;
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
  buffs: BuffSkill[];
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
      { name: "파워스트라이크", damage: 260, hits: 1, mobs: 1, type: "active", minDamage: 165, maxLevel: 20 },
      { name: "슬래시블래스트", damage: 130, hits: 1, mobs: 6, type: "active", minDamage: 72, maxLevel: 20 },
      { name: "브랜디쉬", damage: 260, hits: 2, mobs: 3, type: "active", minDamage: 135, maxLevel: 30 },
    ],
    buffs: [
      {
        name: "어드밴스드 콤보",
        type: "passive",
        description: "콤보 오브 1개당 데미지 +10% (최대 10오브)",
        comboType: true,
        comboMultiplierPerOrb: 10,
        maxOrbs: 10,
      },
      {
        name: "메이플 용사",
        type: "passive",
        description: "모든 스탯 +10%",
        statMultiplier: 1.10,
      },
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
      { name: "파워스트라이크", damage: 260, hits: 1, mobs: 1, type: "active", minDamage: 165, maxLevel: 20 },
      { name: "슬래시블래스트", damage: 130, hits: 1, mobs: 6, type: "active", minDamage: 72, maxLevel: 20 },
      { name: "차지블로우 (파이어)", damage: 120, hits: 1, mobs: 6, type: "active", element: "fire", minDamage: 102, maxLevel: 30 },
      { name: "차지블로우 (아이스)", damage: 110, hits: 1, mobs: 6, type: "active", element: "ice", minDamage: 100, maxLevel: 30 },
      { name: "차지블로우 (썬더)", damage: 110, hits: 1, mobs: 6, type: "active", element: "lightning", minDamage: 100, maxLevel: 30 },
      { name: "차지블로우 (홀리)", damage: 120, hits: 1, mobs: 6, type: "active", element: "holy", minDamage: 102, maxLevel: 30 },
      { name: "블래스트", damage: 550, hits: 1, mobs: 1, type: "active", element: "holy", minDamage: 170, maxLevel: 30 },
      { name: "헤븐즈 해머", damage: 900, hits: 1, mobs: 15, type: "active", element: "holy", minDamage: 420, maxLevel: 30 },
    ],
    buffs: [
      {
        name: "메이플 용사",
        type: "passive",
        description: "모든 스탯 +10%",
        statMultiplier: 1.10,
      },
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
      { name: "파워스트라이크", damage: 260, hits: 1, mobs: 1, type: "active", minDamage: 165, maxLevel: 20 },
      { name: "드래곤 퓨리(폴암)", damage: 250, hits: 1, mobs: 6, type: "active", minDamage: 80, maxLevel: 30 },
      { name: "스피어 크러셔", damage: 170, hits: 3, mobs: 3, type: "active", element: "dark", minDamage: 55, maxLevel: 30 },
      { name: "드래곤로어", damage: 240, hits: 1, mobs: 15, type: "active", element: "dark", minDamage: 96, maxLevel: 30 },
    ],
    buffs: [
      {
        name: "버서크",
        type: "passive",
        description: "HP 50% 이하 시 모든 데미지 ×2",
        damageMultiplier: 2.0,
      },
      {
        name: "메이플 용사",
        type: "passive",
        description: "모든 스탯 +10%",
        statMultiplier: 1.10,
      },
    ],
  },
  "불독(F/P)": {
    label: "불독(F/P)",
    weapons: [],
    isMagic: true,
    passives: [],
    actives: [
      { name: "파이어 에로우", damage: 120, hits: 1, type: "active", element: "fire", minDamage: 33, maxLevel: 30 },
      { name: "익스플로전", damage: 120, hits: 1, mobs: 6, type: "active", element: "fire", minDamage: 60, maxLevel: 30 },
      { name: "페럴라이즈", damage: 210, hits: 1, mobs: 1, type: "active", element: "poison", minDamage: 105, maxLevel: 30 },
      { name: "메테오", damage: 570, hits: 1, mobs: 15, type: "active", element: "fire", minDamage: 330, maxLevel: 30 },
    ],
    buffs: [
      {
        name: "메이플 용사",
        type: "passive",
        description: "모든 스탯 +10%",
        statMultiplier: 1.10,
      },
    ],
  },
  "썬콜(I/L)": {
    label: "썬콜(I/L)",
    weapons: [],
    isMagic: true,
    passives: [],
    actives: [
      { name: "콜드 빔", damage: 100, hits: 1, type: "active", element: "ice", minDamage: 13, maxLevel: 30 },
      { name: "썬더 볼트", damage: 60, hits: 1, mobs: 6, type: "active", element: "lightning", minDamage: 2, maxLevel: 30 },
      { name: "아이스 스트라이크", damage: 90, hits: 1, mobs: 6, type: "active", element: "ice", minDamage: 32, maxLevel: 30 },
      { name: "체인 라이트닝", damage: 180, hits: 1, mobs: 6, type: "active", element: "lightning", minDamage: 103, maxLevel: 30 },
      { name: "블리자드", damage: 570, hits: 1, mobs: 15, type: "active", element: "ice", minDamage: 330, maxLevel: 30 },
    ],
    buffs: [
      {
        name: "메이플 용사",
        type: "passive",
        description: "모든 스탯 +10%",
        statMultiplier: 1.10,
      },
    ],
  },
  "비숍": {
    label: "비숍",
    weapons: [],
    isMagic: true,
    passives: [],
    actives: [
      { name: "홀리 에로우", damage: 80, hits: 1, type: "active", element: "holy", minDamage: 22, maxLevel: 20 },
      { name: "샤이닝 레이", damage: 105, hits: 1, mobs: 6, type: "active", element: "holy", minDamage: 60, maxLevel: 30 },
      { name: "엔젤레이", damage: 450, hits: 1, mobs: 6, type: "active", element: "holy", minDamage: 160, maxLevel: 30 },
      { name: "제네시스", damage: 670, hits: 1, mobs: 15, type: "active", element: "holy", minDamage: 430, maxLevel: 30 },
    ],
    buffs: [
      {
        name: "메이플 용사",
        type: "passive",
        description: "모든 스탯 +10%",
        statMultiplier: 1.10,
      },
    ],
  },
  "보우마스터": {
    label: "보우마스터",
    weapons: ["활"],
    isMagic: false,
    passives: [
      { name: "보우 마스터리", type: "passive", mastery: 60, description: "활 최소 데미지 보장 (60%)" },
      { name: "크리티컬샷", type: "passive", critRate: 40, description: "크리티컬 확률 +40%" },
      { name: "파이널어택", type: "passive", description: "40% 확률로 150% 추가 타격" },
    ],
    actives: [
      { name: "더블샷", damage: 130, hits: 2, mobs: 1, type: "active", minDamage: 92, maxLevel: 20 },
      { name: "애로우 봄", damage: 150, hits: 1, mobs: 6, type: "active", element: "fire", minDamage: 50, maxLevel: 30 },
      { name: "스트레이프", damage: 100, hits: 4, mobs: 1, type: "active", minDamage: 50, maxLevel: 30 },
      { name: "허리케인", damage: 100, hits: 1, mobs: 1, type: "active", minDamage: 51, maxLevel: 30 },
    ],
    buffs: [
      {
        name: "샤프 아이즈",
        type: "passive",
        description: "크리티컬 확률 +20%, 크리티컬 데미지 +40%",
        critRateBonus: 20,
        critDmgBonus: 40,
      },
      {
        name: "메이플 용사",
        type: "passive",
        description: "모든 스탯 +10%",
        statMultiplier: 1.10,
      },
    ],
  },
  "신궁": {
    label: "신궁",
    weapons: ["석궁"],
    isMagic: false,
    passives: [
      { name: "석궁 마스터리", type: "passive", mastery: 60, description: "석궁 최소 데미지 보장 (60%)" },
      { name: "크리티컬샷", type: "passive", critRate: 40, description: "크리티컬 확률 +40%" },
    ],
    actives: [
      { name: "더블샷", damage: 130, hits: 2, mobs: 1, type: "active", minDamage: 92, maxLevel: 20 },
      { name: "블리자드(석궁)", damage: 140, hits: 1, mobs: 6, type: "active", element: "ice", minDamage: 100, maxLevel: 30 },
      { name: "스트레이프", damage: 100, hits: 4, mobs: 1, type: "active", minDamage: 50, maxLevel: 30 },
      { name: "피어싱 애로우", damage: 850, hits: 1, mobs: 6, type: "active", minDamage: 320, maxLevel: 30 },
    ],
    buffs: [
      {
        name: "샤프 아이즈",
        type: "passive",
        description: "크리티컬 확률 +20%, 크리티컬 데미지 +40%",
        critRateBonus: 20,
        critDmgBonus: 40,
      },
      {
        name: "메이플 용사",
        type: "passive",
        description: "모든 스탯 +10%",
        statMultiplier: 1.10,
      },
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
      { name: "럭키세븐", damage: 150, hits: 2, mobs: 1, type: "active", minDamage: 58, maxLevel: 20 },
      { name: "어벤져", damage: 180, hits: 1, mobs: 6, type: "active", minDamage: 65, maxLevel: 30 },
      { name: "트리플 스로우", damage: 150, hits: 3, mobs: 1, type: "active", minDamage: 102, maxLevel: 30 },
    ],
    buffs: [
      {
        name: "메이플 용사",
        type: "passive",
        description: "모든 스탯 +10%",
        statMultiplier: 1.10,
      },
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
      { name: "새비지블로우", damage: 80, hits: 6, mobs: 1, type: "active", minDamage: 40, maxLevel: 30 },
      { name: "부메랑스텝", damage: 500, hits: 2, mobs: 4, type: "active", minDamage: 260, maxLevel: 30 },
      { name: "어쌔시네이트", damage: 600, hits: 3, mobs: 1, type: "active", minDamage: 170, maxLevel: 30 },
    ],
    buffs: [
      {
        name: "메이플 용사",
        type: "passive",
        description: "모든 스탯 +10%",
        statMultiplier: 1.10,
      },
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
      { name: "코크스크류 블로우", damage: 420, hits: 1, mobs: 3, type: "active", minDamage: 135, maxLevel: 20 },
      { name: "쇼크웨이브", damage: 700, hits: 1, mobs: 6, type: "active", minDamage: 265, maxLevel: 30 },
      { name: "드래곤 스트라이크", damage: 810, hits: 1, mobs: 6, type: "active", minDamage: 275, maxLevel: 30 },
    ],
    buffs: [
      {
        name: "메이플 용사",
        type: "passive",
        description: "모든 스탯 +10%",
        statMultiplier: 1.10,
      },
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
      { name: "인비저블샷", damage: 170, hits: 1, mobs: 3, type: "active", minDamage: 75, maxLevel: 20 },
      { name: "래피드파이어", damage: 170, hits: 1, mobs: 1, type: "active", minDamage: 102, maxLevel: 30 },
      { name: "배틀쉽 캐논", damage: 380, hits: 1, mobs: 1, type: "active", minDamage: 205, maxLevel: 30 },
      { name: "배틀쉽 토피도", damage: 780, hits: 1, mobs: 6, type: "active", minDamage: 390, maxLevel: 30 },
    ],
    buffs: [
      {
        name: "메이플 용사",
        type: "passive",
        description: "모든 스탯 +10%",
        statMultiplier: 1.10,
      },
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

// ─── 직업별 레벨 스탯 기본값 ───
// mainStat = level × 5, subStat = 아래 고정값
const JOB_STAT_DEFAULTS: Record<string, { subStatDefault: number }> = {
  "히어로":     { subStatDefault: 25 },  // DEX 25 고정
  "팔라딘":     { subStatDefault: 25 },  // DEX 25 고정
  "다크나이트": { subStatDefault: 25 },  // DEX 25 고정
  "불독(F/P)":  { subStatDefault: 20 },  // LUK 20 고정
  "썬콜(I/L)":  { subStatDefault: 20 },  // LUK 20 고정
  "비숍":       { subStatDefault: 20 },  // LUK 20 고정
  "보우마스터": { subStatDefault: 25 },  // STR 25 고정
  "신궁":       { subStatDefault: 25 },  // STR 25 고정
  "나이트로드": { subStatDefault: 29 },  // STR+DEX 29 고정 (STR 4 + DEX 25)
  "섀도어":     { subStatDefault: 29 },  // STR+DEX 29 고정
  "바이퍼":     { subStatDefault: 25 },  // DEX 25 고정
  "캡틴":       { subStatDefault: 25 },  // STR 25 고정
};

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
  weakness?: "fire" | "ice" | "lightning" | "holy" | "poison" | "dark";
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
  { name: "발록새끼",      level: 18,  hp: 300,       wdef: 40,   mdef: 20,   exp: 52,   map: "슬리피우드",    weakness: "holy" },
  { name: "잭더래빗",      level: 20,  hp: 350,       wdef: 45,   mdef: 30,   exp: 58,   map: "케르닝 지하상가" },
  { name: "좀비버섯",      level: 22,  hp: 400,       wdef: 50,   mdef: 40,   exp: 65,   map: "페리온",        weakness: "holy" },
  { name: "킬라",          level: 25,  hp: 500,       wdef: 55,   mdef: 50,   exp: 75,   map: "케르닝시티" },
  { name: "투카",          level: 26,  hp: 580,       wdef: 58,   mdef: 52,   exp: 82,   map: "케르닝시티" },
  { name: "주니어발록",    level: 28,  hp: 750,       wdef: 60,   mdef: 60,   exp: 95,   map: "슬리피우드",    weakness: "holy" },
  // Level 30-50
  { name: "찰지귀",        level: 30,  hp: 580,       wdef: 50,   mdef: 55,   exp: 58,   map: "케르닝시티" },
  { name: "구울",          level: 32,  hp: 700,       wdef: 65,   mdef: 70,   exp: 65,   map: "페리온",        weakness: "holy" },
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
  { name: "나이트고스트",  level: 62,  hp: 6800,      wdef: 210,  mdef: 230,  exp: 240,  map: "루디브리엄",    weakness: "holy" },
  { name: "아이스드레이크",level: 64,  hp: 7700,      wdef: 200,  mdef: 230,  exp: 250,  map: "엘나스",        weakness: "fire" },
  // Level 65-80
  { name: "예티",          level: 65,  hp: 11000,     wdef: 170,  mdef: 245,  exp: 346,  map: "엘나스" },
  { name: "루미네",        level: 66,  hp: 12000,     wdef: 260,  mdef: 260,  exp: 360,  map: "엘나스" },
  { name: "다크로드",      level: 67,  hp: 12500,     wdef: 275,  mdef: 265,  exp: 370,  map: "루디브리엄" },
  { name: "다크예티",      level: 68,  hp: 13000,     wdef: 190,  mdef: 270,  exp: 409,  map: "엘나스" },
  { name: "타우로마시스",  level: 70,  hp: 15000,     wdef: 250,  mdef: 250,  exp: 472,  map: "미나르숲" },
  { name: "클라크",        level: 70,  hp: 15000,     wdef: 250,  mdef: 250,  exp: 270,  map: "시계탑 최하층" },
  { name: "아이스그림",    level: 72,  hp: 15500,     wdef: 270,  mdef: 265,  exp: 490,  map: "엘나스",        weakness: "fire" },
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
  { name: "파이어독",      level: 90,  hp: 45000,     wdef: 835,  mdef: 505,  exp: 1800, map: "엘나스",        weakness: "ice" },
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
  { name: "아이스드라코",  level: 108, hp: 75000,     wdef: 900,  mdef: 900,  exp: 4100, map: "리프레",        weakness: "fire" },
  { name: "스켈레곤",      level: 110, hp: 80000,     wdef: 900,  mdef: 900,  exp: 4500, map: "리프레",        weakness: "holy" },
  { name: "메카트로피",    level: 112, hp: 88000,     wdef: 970,  mdef: 940,  exp: 4800, map: "루디브리엄" },
  { name: "스켈로스",      level: 113, hp: 85000,     wdef: 810,  mdef: 710,  exp: 4750, map: "리프레",        weakness: "holy" },
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
      ((mainStat * minMult * mastery + subStat) * (atk / 100) * levelPenalty -
        wdef * 0.6) *
        (skillPct / 100),
      1
    ) * hits;
  return { maxDmg, minDmg, avgDmg: (maxDmg + minDmg) / 2 };
}

// ─── 법사 데미지 공식 (메이플랜드 공식 검증 완료) ───
// MAX = ((MA²/1000 + MA) / 30 + INT/200) × skillPct × attrMult - mdef × 0.5 × defMult
// MIN = ((MA²/1000 + MA×0.6×0.9) / 30 + INT/200) × skillPct × attrMult - mdef × 0.6 × defMult
// attrMult는 방어 차감 전에 적용 (속성약점 ×1.5 포함)
const MAGIC_MASTERY = 0.6;

function calcMagicDamage(
  int_: number,
  _luk: number,
  ma: number,
  skillPct: number,
  attrMult: number,
  hits: number,
  charLevel: number,
  monLevel: number,
  mdef: number
): DamageResult {
  const D = Math.max(monLevel - charLevel, 0);
  const defMult = 1 + 0.01 * D;
  const maBase = ma * ma / 1000;
  const maxPower = (maBase + ma) / 30 + int_ / 200;
  const minPower = (maBase + ma * MAGIC_MASTERY * 0.9) / 30 + int_ / 200;
  const maxDmg = Math.max(maxPower * skillPct * attrMult - mdef * 0.5 * defMult, 1) * hits;
  const minDmg = Math.max(minPower * skillPct * attrMult - mdef * 0.6 * defMult, 1) * hits;
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
  const target = hp / hits + wdef * 0.5;
  const base = (mainStat * maxMult + subStat) * levelPenalty * skillPct;
  if (base <= 0) return 0;
  return Math.ceil(target * 10000 / base);
}

// 원킬컷 역산: magic MA (이차방정식 풀이)
// 원킬컷 역산: MA² + 540×MA - 30000T = 0, T = (hp/hits + mdef×0.6×defMult)/(skillPct×attrMult) - INT/200
function calcOneKillMa(
  hp: number,
  int_: number,
  _luk: number,
  skillPct: number,
  attrMult: number,
  hits: number,
  charLevel: number,
  monLevel: number,
  mdef: number
): number {
  const D = Math.max(monLevel - charLevel, 0);
  const defMult = 1 + 0.01 * D;
  const divisor = skillPct * attrMult;
  if (divisor <= 0) return 0;
  const T = (hp / hits + mdef * 0.6 * defMult) / divisor - int_ / 200;
  const disc = 540 * 540 + 4 * 30000 * T;
  if (disc < 0) return 0;
  return Math.ceil((-540 + Math.sqrt(disc)) / 2);
}

// ─── 몬테카를로 시뮬레이션 ───
interface MonteCarloResult {
  distribution: Record<number, number>;
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
  critRate: number,
  critMultiplier: number,
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
      if (hits > 9999) break;
    }
    hitCounts.push(hits);
  }

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

// 공통 입력 컴포넌트 (백스페이스 편집 가능)
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
  const [inputVal, setInputVal] = useState(String(value));

  // 외부 value 변경 시 동기화 (포커스 중이 아닐 때)
  useEffect(() => {
    setInputVal(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputVal(raw);
    const n = Number(raw);
    if (raw !== "" && !isNaN(n)) {
      onChange(n);
    }
  };

  const handleBlur = () => {
    const n = parseFloat(inputVal);
    if (inputVal === "" || isNaN(n)) {
      const fallback = min ?? 0;
      setInputVal(String(fallback));
      onChange(fallback);
    } else {
      const clamped = min !== undefined ? Math.max(min, n) : n;
      const clampedMax = max !== undefined ? Math.min(max, clamped) : clamped;
      setInputVal(String(clampedMax));
      onChange(clampedMax);
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        value={inputVal}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        max={max}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
      />
    </div>
  );
}

type Tab = "calc" | "hunt" | "taken";

// ─── 피격뎀 계산 공식 (mapleland.st 참조, WZ 데이터 검증) ───
// 직업별 레벨 기본 방어력 테이블
const JOB_BASE_DEF: Record<string, Record<number, number>> = {
  "전사": { 1:7, 10:54, 20:103, 30:154, 40:207, 50:261, 60:310, 70:359, 80:405, 90:450, 100:494, 110:535, 120:577, 130:618, 140:658, 150:699, 160:739, 170:779, 180:819, 190:859, 200:900 },
  "마법사": { 1:7, 10:31, 20:53, 30:75, 40:103, 50:131, 60:157, 70:184, 80:209, 90:237, 100:266, 110:292, 120:319, 130:346, 140:374, 150:401, 160:427, 170:455, 180:483, 190:510, 200:537 },
  "궁수": { 1:7, 10:32, 20:63, 30:95, 40:121, 50:145, 60:175, 70:206, 80:233, 90:265, 100:298, 110:327, 120:356, 130:386, 140:416, 150:445, 160:476, 170:507, 180:537, 190:568, 200:598 },
  "도적": { 1:7, 10:42, 20:79, 30:115, 40:148, 50:184, 60:221, 70:257, 80:288, 90:318, 100:331, 110:346, 120:360, 130:374, 140:389, 150:403, 160:418, 170:432, 180:446, 190:461, 200:475 },
  "해적": { 1:7, 10:24, 20:52, 30:82, 40:114, 50:146, 60:177, 70:207, 80:241, 90:275, 100:309, 110:341, 120:373, 130:405, 140:437, 150:469, 160:501, 170:533, 180:565, 190:597, 200:629 },
};

function getJobBaseDef(jobGroup: string, level: number): number {
  const table = JOB_BASE_DEF[jobGroup];
  if (!table) return 7;
  const levels = Object.keys(table).map(Number).sort((a, b) => a - b);
  let lower = levels[0], upper = levels[0];
  for (let i = 0; i < levels.length - 1; i++) {
    if (level >= levels[i] && level <= levels[i + 1]) {
      lower = levels[i];
      upper = levels[i + 1];
      break;
    }
    if (level > levels[i]) { lower = levels[i]; upper = levels[i]; }
  }
  if (lower === upper) return table[lower];
  const ratio = (level - lower) / (upper - lower);
  return Math.round(table[lower] + ratio * (table[upper] - table[lower]));
}

// 물리 피격뎀 계산
function calcPhysDamageTaken(
  mobAtk: number, playerPDef: number, jobBaseDef: number,
  playerLevel: number, mobLevel: number, isWarrior: boolean,
  str: number, dex: number, int_: number, luk: number
): { min: number; max: number } {
  const statDef = isWarrior
    ? str / 2800 + dex / 3200 + int_ / 7200 + luk / 3200
    : str / 2000 + dex / 2800 + int_ / 7200 + luk / 3200;
  const primaryFactor = statDef + 0.28;

  let secondaryFactor: number;
  if (playerPDef >= jobBaseDef) {
    secondaryFactor = statDef * 28 / 45 + playerLevel * 7 / 13000 + 0.196;
  } else {
    const levelPenalty = playerLevel >= mobLevel
      ? 13 / (13 + playerLevel - mobLevel)
      : 1.3;
    secondaryFactor = levelPenalty * (statDef + playerLevel / 550 + 0.28);
  }

  const rawMin = mobAtk * mobAtk * 0.008;
  const rawMax = mobAtk * mobAtk * 0.0085;
  const defReduction = playerPDef * primaryFactor + (playerPDef - jobBaseDef) * secondaryFactor;

  return {
    min: Math.max(1, Math.floor(rawMin - defReduction)),
    max: Math.max(1, Math.floor(rawMax - defReduction)),
  };
}

// 마법 피격뎀 계산
function calcMagicDamageTaken(
  mobMatk: number, playerMDef: number, isMagician: boolean,
  str: number, dex: number, luk: number
): { min: number; max: number } {
  const magicBonus = isMagician ? 1.2 : 1.0;
  const defReduction = (playerMDef / 4 + str / 28 + dex / 24 + luk / 20) * magicBonus;

  return {
    min: Math.max(1, Math.floor(mobMatk * mobMatk * 0.0075 - defReduction)),
    max: Math.max(1, Math.floor(mobMatk * mobMatk * 0.008 - defReduction)),
  };
}

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
  const [skillLevel, setSkillLevel] = useState(30);

  // 패시브 토글 (기본 true)
  const [enabledPassives, setEnabledPassives] = useState<Record<string, boolean>>({});

  // 버프 토글 (기본 false)
  const [enabledBuffs, setEnabledBuffs] = useState<Record<string, boolean>>({});
  const [comboOrbs, setComboOrbs] = useState(5);

  // 물리 스탯 입력 (분리된 공격력)
  const [mainStat, setMainStat] = useState(120);
  const [subStat, setSubStat] = useState(50);
  const [weaponAtk, setWeaponAtk] = useState(80);
  const [gloveAtk, setGloveAtk] = useState(0);
  const [otherAtk, setOtherAtk] = useState(0);
  const [buff1, setBuff1] = useState(0);
  const [buff2, setBuff2] = useState(0);

  // 법사 스탯 입력 (INT/LUK 분리)
  const [pureInt, setPureInt] = useState(300);
  const [bonusInt, setBonusInt] = useState(0);
  const [pureLuk, setPureLuk] = useState(50);
  const [bonusLuk, setBonusLuk] = useState(0);
  const [ma, setMa] = useState(200);

  const [charLevel, setCharLevel] = useState(70);

  // 레벨 기준 스탯 자동 계산
  const [autoStatEnabled, setAutoStatEnabled] = useState(true);

  const applyLevelStats = (level: number, job: string) => {
    const defaults = JOB_STAT_DEFAULTS[job];
    if (!defaults) return;
    const jobInfo = JOB_SKILL_DATA[job];
    const autoMain = level * 5;
    if (jobInfo?.isMagic) {
      setPureInt(autoMain);
      setBonusInt(0);
      setPureLuk(defaults.subStatDefault);
      setBonusLuk(0);
    } else {
      setMainStat(autoMain);
      setSubStat(defaults.subStatDefault);
    }
  };

  const handleCharLevelChange = (level: number) => {
    setCharLevel(level);
    if (autoStatEnabled) applyLevelStats(level, subJob);
  };

  // 총 공격력 (물리)
  const totalAtk = weaponAtk + gloveAtk + otherAtk + buff1 + buff2;

  // 총 INT / LUK (법사)
  const totalInt = pureInt + bonusInt;
  const totalLuk = pureLuk + bonusLuk;

  // 몬스터 선택
  const [usePreset, setUsePreset] = useState(true);
  const [selectedMonster, setSelectedMonster] = useState(0);
  const [manualName, setManualName] = useState("커스텀 몬스터");
  const [manualLevel, setManualLevel] = useState(70);
  const [manualHp, setManualHp] = useState(15000);
  const [manualWdef, setManualWdef] = useState(250);
  const [manualMdef, setManualMdef] = useState(250);
  const [manualWeakness, setManualWeakness] = useState<string>("");

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
        weakness: (manualWeakness as Monster["weakness"]) || undefined,
      };

  // 직업 그룹 변경 시 세부 직업 초기화
  const handleJobGroupChange = (group: string) => {
    setJobGroup(group);
    const firstSub = JOB_GROUPS[group][0];
    setSubJob(firstSub);
    setSelectedSkillIdx(0);
    setSkillLevel(30);
    setEnabledBuffs({});
    setEnabledPassives({});
    const firstWeapon = JOB_SKILL_DATA[firstSub]?.weapons[0];
    if (firstWeapon) setWeaponKey(firstWeapon);
    if (autoStatEnabled) applyLevelStats(charLevel, firstSub);
  };

  // 세부 직업 변경
  const handleSubJobChange = (sub: string) => {
    setSubJob(sub);
    setSelectedSkillIdx(0);
    setSkillLevel(30);
    setEnabledBuffs({});
    setEnabledPassives({});
    const firstWeapon = JOB_SKILL_DATA[sub]?.weapons[0];
    if (firstWeapon) setWeaponKey(firstWeapon);
    if (autoStatEnabled) applyLevelStats(charLevel, sub);
  };

  // 현재 스킬 정보
  const actives = jobData?.actives ?? [];
  const passives = jobData?.passives ?? [];
  const selectedSkill = actives[selectedSkillIdx] ?? actives[0];

  // 마스터리
  const effectiveMastery = useMemo(() => {
    let m = 0;
    for (const p of passives) {
      const key = p.name;
      const isOn = enabledPassives[key] !== false;
      if (isOn && p.mastery != null && p.mastery > m) {
        m = p.mastery;
      }
    }
    return m > 0 ? m : 50;
  }, [passives, enabledPassives]);

  // 크리티컬 정보
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

  // 스킬 레벨 보간 데미지 계산
  const interpolatedSkillDamage = useMemo(() => {
    if (!selectedSkill) return 100;
    const { minDamage, damage: maxDamage, maxLevel } = selectedSkill;
    if (maxLevel <= 1) return maxDamage;
    const interpolated = minDamage + (skillLevel - 1) * (maxDamage - minDamage) / (maxLevel - 1);
    return Math.round(interpolated);
  }, [selectedSkill, skillLevel]);

  const skillPct = interpolatedSkillDamage;
  const skillHits = selectedSkill?.hits ?? 1;

  // 버프 효과 계산
  const buffs = jobData?.buffs ?? [];

  const activeStatMultiplier = useMemo(() => {
    for (const b of buffs) {
      if (enabledBuffs[b.name] && b.statMultiplier != null) return b.statMultiplier;
    }
    return 1;
  }, [buffs, enabledBuffs]);

  const activeDamageMultiplier = useMemo(() => {
    for (const b of buffs) {
      if (enabledBuffs[b.name] && b.damageMultiplier != null) return b.damageMultiplier;
    }
    return 1;
  }, [buffs, enabledBuffs]);

  const activeComboBonus = useMemo(() => {
    for (const b of buffs) {
      if (enabledBuffs[b.name] && b.comboType) {
        return comboOrbs * (b.comboMultiplierPerOrb ?? 0) / 100;
      }
    }
    return 0;
  }, [buffs, enabledBuffs, comboOrbs]);

  const buffCritRateBonus = useMemo(() => {
    let bonus = 0;
    for (const b of buffs) {
      if (enabledBuffs[b.name] && b.critRateBonus != null) bonus += b.critRateBonus;
    }
    return bonus;
  }, [buffs, enabledBuffs]);

  const buffCritDmgBonus = useMemo(() => {
    let bonus = 0;
    for (const b of buffs) {
      if (enabledBuffs[b.name] && b.critDmgBonus != null) bonus += b.critDmgBonus;
    }
    return bonus;
  }, [buffs, enabledBuffs]);

  // 스탯에 statMultiplier 적용
  const effectiveMainStat = mainStat * activeStatMultiplier;
  const effectiveSubStat = subStat * activeStatMultiplier;
  const effectiveTotalInt = totalInt * activeStatMultiplier;
  const effectiveTotalLuk = totalLuk * activeStatMultiplier;

  const dmgResult = useMemo<DamageResult>(() => {
    // 속성 약점 배율
    const attrMult = (selectedSkill?.element && monster.weakness === selectedSkill.element) ? 1.5 : 1.0;
    let result: DamageResult;
    if (isMagic) {
      // 법사: attrMult를 공식 내부에서 방어 차감 전에 적용
      result = calcMagicDamage(
        effectiveTotalInt,
        effectiveTotalLuk,
        ma,
        skillPct,
        attrMult,
        skillHits,
        charLevel,
        monster.level,
        monster.mdef
      );
    } else {
      result = calcPhysicalDamage(
        effectiveMainStat,
        effectiveSubStat,
        totalAtk,
        weaponInfo?.maxMult ?? 4.0,
        weaponInfo?.minMult ?? 4.0,
        effectiveMastery / 100,
        skillPct,
        skillHits,
        charLevel,
        monster.level,
        monster.wdef
      );
    }
    // damageMultiplier (버서크) 및 comboBonus 적용
    const totalMult = activeDamageMultiplier * (1 + activeComboBonus);
    // 물리직업: attrMult 외부 적용 / 법사: 이미 내부 적용됨
    const externalAttrMult = isMagic ? 1.0 : attrMult;
    return {
      maxDmg: result.maxDmg * totalMult * externalAttrMult,
      minDmg: result.minDmg * totalMult * externalAttrMult,
      avgDmg: result.avgDmg * totalMult * externalAttrMult,
    };
  }, [
    isMagic, ma, effectiveTotalInt, effectiveTotalLuk, effectiveMastery, skillPct, skillHits,
    charLevel, effectiveMainStat, effectiveSubStat, totalAtk, weaponInfo, monster,
    activeDamageMultiplier, activeComboBonus, selectedSkill,
  ]);

  // 속성 약점 여부 (UI 표시용)
  const isAttrWeakness = !!(selectedSkill?.element && monster.weakness === selectedSkill.element);

  // 크리티컬 정보 (버프 보너스 포함)
  const totalCritRate = effectiveCritRate + buffCritRateBonus;
  const totalCritDmg = effectiveCritDmg + buffCritDmgBonus;

  // 크리티컬 데미지 결과
  const critDmgResult = useMemo<DamageResult>(() => {
    if (totalCritRate === 0) return dmgResult;
    const factor = 1 + totalCritDmg / 100;
    return {
      maxDmg: dmgResult.maxDmg * factor,
      minDmg: dmgResult.minDmg * factor,
      avgDmg: dmgResult.avgDmg * factor,
    };
  }, [dmgResult, totalCritRate, totalCritDmg]);

  const { nHitMax, nHitAvg } = calcNHit(monster.hp, dmgResult);
  const { nHitMax: critNHitMax, nHitAvg: critNHitAvg } = calcNHit(monster.hp, critDmgResult);

  const oneKillAtk = isMagic
    ? calcOneKillMa(monster.hp, effectiveTotalInt, effectiveTotalLuk, skillPct, isAttrWeakness ? 1.5 : 1.0, skillHits, charLevel, monster.level, monster.mdef)
    : calcOneKillAtk(
        monster.hp,
        effectiveMainStat,
        effectiveSubStat,
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
      totalCritRate,
      totalCritRate > 0 ? 1 + totalCritDmg / 100 : 1
    );
  }, [monster.hp, dmgResult.minDmg, dmgResult.maxDmg, totalCritRate, totalCritDmg]);

  // 스탯공격력 범위 (물리)
  const statAtkMax = useMemo(() => {
    if (isMagic) return 0;
    return (effectiveMainStat * (weaponInfo?.maxMult ?? 4.0) + effectiveSubStat) * totalAtk / 100;
  }, [isMagic, effectiveMainStat, effectiveSubStat, totalAtk, weaponInfo]);

  const statAtkMin = useMemo(() => {
    if (isMagic) return 0;
    return (effectiveMainStat * (weaponInfo?.minMult ?? 4.0) * 0.9 * (effectiveMastery / 100) + effectiveSubStat) * totalAtk / 100;
  }, [isMagic, effectiveMainStat, effectiveSubStat, totalAtk, weaponInfo, effectiveMastery]);

  // 마법 기본 파워 (스킬% 1 기준, 방어/속성 미포함)
  // MAX power = (MA²/1000 + MA) / 30 + INT/200
  // MIN power = (MA²/1000 + MA×0.54) / 30 + INT/200
  const magicDmgMax = useMemo(() => {
    if (!isMagic) return 0;
    return (ma * ma / 1000 + ma) / 30 + effectiveTotalInt / 200;
  }, [isMagic, effectiveTotalInt, ma]);

  const magicDmgMin = useMemo(() => {
    if (!isMagic) return 0;
    return (ma * ma / 1000 + ma * MAGIC_MASTERY * 0.9) / 30 + effectiveTotalInt / 200;
  }, [isMagic, effectiveTotalInt, ma]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">엔방컷 계산기</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        데미지를 계산하고 몬스터 N방컷을 확인하세요
      </p>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-fit">
        {(
          [
            { key: "calc" as Tab, label: "엔방컷 계산기" },
            { key: "taken" as Tab, label: "피격뎀 계산기" },
            { key: "hunt" as Tab, label: "사냥터 추천" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-white dark:bg-gray-800 text-orange-600 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"
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
          skillLevel={skillLevel}
          setSkillLevel={setSkillLevel}
          interpolatedSkillDamage={interpolatedSkillDamage}
          enabledPassives={enabledPassives}
          setEnabledPassives={setEnabledPassives}
          enabledBuffs={enabledBuffs}
          setEnabledBuffs={setEnabledBuffs}
          comboOrbs={comboOrbs}
          setComboOrbs={setComboOrbs}
          mainStat={mainStat}
          setMainStat={setMainStat}
          subStat={subStat}
          setSubStat={setSubStat}
          weaponAtk={weaponAtk}
          setWeaponAtk={setWeaponAtk}
          gloveAtk={gloveAtk}
          setGloveAtk={setGloveAtk}
          otherAtk={otherAtk}
          setOtherAtk={setOtherAtk}
          buff1={buff1}
          setBuff1={setBuff1}
          buff2={buff2}
          setBuff2={setBuff2}
          totalAtk={totalAtk}
          pureInt={pureInt}
          setPureInt={setPureInt}
          bonusInt={bonusInt}
          setBonusInt={setBonusInt}
          pureLuk={pureLuk}
          setPureLuk={setPureLuk}
          bonusLuk={bonusLuk}
          setBonusLuk={setBonusLuk}
          totalInt={totalInt}
          totalLuk={totalLuk}
          ma={ma}
          setMa={setMa}
          charLevel={charLevel}
          setCharLevel={handleCharLevelChange}
          autoStatEnabled={autoStatEnabled}
          setAutoStatEnabled={setAutoStatEnabled}
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
          manualWeakness={manualWeakness}
          setManualWeakness={setManualWeakness}
          isAttrWeakness={isAttrWeakness}
          monster={monster}
          dmgResult={dmgResult}
          nHitMax={nHitMax}
          nHitAvg={nHitAvg}
          oneKillAtk={oneKillAtk}
          effectiveMastery={effectiveMastery}
          weaponInfo={weaponInfo}
          effectiveCritRate={effectiveCritRate}
          effectiveCritDmg={effectiveCritDmg}
          totalCritRate={totalCritRate}
          totalCritDmg={totalCritDmg}
          critNHitMax={critNHitMax}
          critNHitAvg={critNHitAvg}
          mcResult={mcResult}
          statAtkMax={statAtkMax}
          statAtkMin={statAtkMin}
          magicDmgMax={magicDmgMax}
          magicDmgMin={magicDmgMin}
          activeDamageMultiplier={activeDamageMultiplier}
          activeComboBonus={activeComboBonus}
        />
      )}
      {activeTab === "taken" && <DamageTakenTab />}
      {activeTab === "hunt" && <HuntTab />}
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
  skillLevel: number;
  setSkillLevel: (v: number) => void;
  interpolatedSkillDamage: number;
  enabledPassives: Record<string, boolean>;
  setEnabledPassives: (v: Record<string, boolean>) => void;
  enabledBuffs: Record<string, boolean>;
  setEnabledBuffs: (v: Record<string, boolean>) => void;
  comboOrbs: number;
  setComboOrbs: (v: number) => void;
  mainStat: number;
  setMainStat: (v: number) => void;
  subStat: number;
  setSubStat: (v: number) => void;
  weaponAtk: number;
  setWeaponAtk: (v: number) => void;
  gloveAtk: number;
  setGloveAtk: (v: number) => void;
  otherAtk: number;
  setOtherAtk: (v: number) => void;
  buff1: number;
  setBuff1: (v: number) => void;
  buff2: number;
  setBuff2: (v: number) => void;
  totalAtk: number;
  pureInt: number;
  setPureInt: (v: number) => void;
  bonusInt: number;
  setBonusInt: (v: number) => void;
  pureLuk: number;
  setPureLuk: (v: number) => void;
  bonusLuk: number;
  setBonusLuk: (v: number) => void;
  totalInt: number;
  totalLuk: number;
  ma: number;
  setMa: (v: number) => void;
  charLevel: number;
  setCharLevel: (v: number) => void;
  autoStatEnabled: boolean;
  setAutoStatEnabled: (v: boolean) => void;
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
  manualWeakness: string;
  setManualWeakness: (v: string) => void;
  isAttrWeakness: boolean;
  monster: Monster;
  dmgResult: DamageResult;
  nHitMax: number;
  nHitAvg: number;
  oneKillAtk: number;
  effectiveMastery: number;
  weaponInfo: { maxMult: number; minMult: number; mainStat: string; subStat: string; type: "melee" | "ranged" | "magic" } | undefined;
  effectiveCritRate: number;
  effectiveCritDmg: number;
  totalCritRate: number;
  totalCritDmg: number;
  critNHitMax: number;
  critNHitAvg: number;
  mcResult: MonteCarloResult;
  statAtkMax: number;
  statAtkMin: number;
  magicDmgMax: number;
  magicDmgMin: number;
  activeDamageMultiplier: number;
  activeComboBonus: number;
}

function CalcTab({
  jobGroup, onJobGroupChange, subJob, onSubJobChange, jobData,
  weaponKey, setWeaponKey, isMagic,
  selectedSkillIdx, setSelectedSkillIdx,
  skillLevel, setSkillLevel, interpolatedSkillDamage,
  enabledPassives, setEnabledPassives,
  enabledBuffs, setEnabledBuffs,
  comboOrbs, setComboOrbs,
  mainStat, setMainStat, subStat, setSubStat,
  weaponAtk, setWeaponAtk, gloveAtk, setGloveAtk,
  otherAtk, setOtherAtk, buff1, setBuff1, buff2, setBuff2,
  totalAtk,
  pureInt, setPureInt, bonusInt, setBonusInt,
  pureLuk, setPureLuk, bonusLuk, setBonusLuk,
  totalInt, totalLuk,
  ma, setMa,
  charLevel, setCharLevel, autoStatEnabled, setAutoStatEnabled,
  usePreset, setUsePreset, selectedMonster, setSelectedMonster,
  manualName, setManualName, manualLevel, setManualLevel,
  manualHp, setManualHp, manualWdef, setManualWdef, manualMdef, setManualMdef,
  manualWeakness, setManualWeakness, isAttrWeakness,
  monster, dmgResult, nHitMax, nHitAvg, oneKillAtk,
  effectiveMastery, weaponInfo,
  effectiveCritRate, effectiveCritDmg,
  totalCritRate, totalCritDmg,
  critNHitMax, critNHitAvg,
  mcResult,
  statAtkMax, statAtkMin,
  magicDmgMax, magicDmgMin,
  activeDamageMultiplier, activeComboBonus,
}: CalcTabProps) {
  const actives = jobData?.actives ?? [];
  const passives = jobData?.passives ?? [];
  const buffs = jobData?.buffs ?? [];
  const selectedSkill = actives[selectedSkillIdx] ?? actives[0];

  const togglePassive = (name: string) => {
    const current = enabledPassives[name] !== false;
    setEnabledPassives({ ...enabledPassives, [name]: !current });
  };

  const toggleBuff = (name: string) => {
    setEnabledBuffs({ ...enabledBuffs, [name]: !enabledBuffs[name] });
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

  // 확률 분포 카드 스타일
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
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">캐릭터 설정</h2>

        {/* 직업 그룹 선택 */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">직업 계열</label>
          <div className="flex gap-1 flex-wrap">
            {JOB_GROUP_KEYS.map((g) => (
              <button
                key={g}
                onClick={() => onJobGroupChange(g)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  jobGroup === g
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* 세부 직업 선택 */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">세부 직업</label>
          <div className="flex gap-1 flex-wrap">
            {JOB_GROUPS[jobGroup].map((s) => (
              <button
                key={s}
                onClick={() => onSubJobChange(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  subJob === s
                    ? "bg-orange-100 text-orange-700 border border-orange-300"
                    : "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700"
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
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">무기 종류</label>
            <select
              value={weaponKey}
              onChange={(e) => setWeaponKey(e.target.value)}
              className="w-full sm:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
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
          <div className="space-y-3">
            {/* 주스탯 / 부스탯 */}
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            {/* 공격력 분리 입력 */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <NumberInput label="무기 공격력" value={weaponAtk} onChange={setWeaponAtk} min={0} />
              <NumberInput label="장갑 공격력" value={gloveAtk} onChange={setGloveAtk} min={0} />
              <NumberInput label="기타 공격력" value={otherAtk} onChange={setOtherAtk} min={0} />
              <NumberInput label="도핑1" value={buff1} onChange={setBuff1} min={0} />
              <NumberInput label="도핑2" value={buff2} onChange={setBuff2} min={0} />
            </div>
            {/* 총 공격력 표시 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                총 공격력: <span className="font-bold text-gray-800 dark:text-gray-200">{totalAtk.toLocaleString()}</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* INT 분리 */}
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="순수 INT" value={pureInt} onChange={setPureInt} min={1} />
              <NumberInput label="추가 INT" value={bonusInt} onChange={setBonusInt} min={0} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                총 INT: <span className="font-bold text-gray-800 dark:text-gray-200">{totalInt.toLocaleString()}</span>
              </span>
            </div>
            {/* LUK 분리 */}
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="순수 LUK" value={pureLuk} onChange={setPureLuk} min={0} />
              <NumberInput label="추가 LUK" value={bonusLuk} onChange={setBonusLuk} min={0} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                총 LUK: <span className="font-bold text-gray-800 dark:text-gray-200">{totalLuk.toLocaleString()}</span>
              </span>
            </div>
            {/* 마력 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <NumberInput label="총 마력 (MA)" value={ma} onChange={setMa} min={1} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <NumberInput label="캐릭터 레벨" value={charLevel} onChange={setCharLevel} min={1} max={200} />
          <div className="flex items-end gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
              <input
                type="checkbox"
                checked={autoStatEnabled}
                onChange={(e) => setAutoStatEnabled(e.target.checked)}
                className="accent-orange-500 w-3.5 h-3.5"
              />
              레벨 기준 스탯 자동 계산
            </label>
            {!isMagic && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                마스터리 {effectiveMastery}% 적용 중
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 스킬 선택 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">스킬 선택</h2>

        {/* 패시브 스킬 토글 */}
        {passives.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">패시브 스킬</label>
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
                        : "bg-gray-50 dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-700"
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

        {/* 버프 스킬 토글 */}
        {buffs.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">버프 스킬</label>
            <div className="flex flex-wrap gap-2">
              {buffs.map((b) => {
                const isOn = !!enabledBuffs[b.name];
                return (
                  <div key={b.name} className="flex flex-col gap-1">
                    <button
                      onClick={() => toggleBuff(b.name)}
                      title={b.description}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                        isOn
                          ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                          : "bg-gray-50 dark:bg-gray-900 text-gray-400 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      {isOn ? "✓ " : ""}{b.name}
                    </button>
                    {isOn && b.comboType && (
                      <div className="px-1">
                        <label className="text-xs text-emerald-600 mb-0.5 block">
                          콤보 오브: {comboOrbs}개 (+{comboOrbs * (b.comboMultiplierPerOrb ?? 0)}%)
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={b.maxOrbs ?? 10}
                          step={1}
                          value={comboOrbs}
                          onChange={(e) => setComboOrbs(Number(e.target.value))}
                          className="w-32 accent-emerald-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 액티브 스킬 선택 */}
        {actives.length > 0 ? (
          <>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">공격 스킬</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {actives.map((skill, idx) => (
                <button
                  key={skill.name}
                  onClick={() => { setSelectedSkillIdx(idx); setSkillLevel(30); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    selectedSkillIdx === idx
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:bg-gray-700"
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

                {/* 스킬 레벨 슬라이더 */}
                <div className="mb-3">
                  <label className="text-xs text-orange-600 mb-1 block">
                    스킬 레벨: <span className="font-bold">{skillLevel}</span> | 데미지 <span className="font-bold">{interpolatedSkillDamage}%</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={selectedSkill.maxLevel}
                    step={1}
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(Number(e.target.value))}
                    className="w-full accent-orange-500"
                  />
                  <div className="flex justify-between text-xs text-orange-300 mt-0.5">
                    <span>Lv.1 ({selectedSkill.minDamage}%)</span>
                    <span>Lv.{selectedSkill.maxLevel} ({selectedSkill.damage}%)</span>
                  </div>
                </div>

                <div className="flex gap-4 text-sm text-orange-700 flex-wrap">
                  <span>
                    <span className="text-orange-400 text-xs mr-1">현재 데미지</span>
                    <span className="font-bold">{interpolatedSkillDamage}%</span>
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
                    <span className="text-orange-400 text-xs mr-1">총 데미지%</span>
                    <span className="font-bold">{interpolatedSkillDamage * selectedSkill.hits}%</span>
                  </span>
                  {(activeDamageMultiplier !== 1 || activeComboBonus > 0) && (
                    <span>
                      <span className="text-orange-400 text-xs mr-1">버프 후 배율</span>
                      <span className="font-bold text-emerald-700">
                        ×{(activeDamageMultiplier * (1 + activeComboBonus)).toFixed(2)}
                      </span>
                    </span>
                  )}
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
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">대상 몬스터</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setUsePreset(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                usePreset ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
              }`}
            >
              목록 선택
            </button>
            <button
              onClick={() => setUsePreset(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !usePreset ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
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
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
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
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">몬스터 이름</label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <NumberInput label="레벨" value={manualLevel} onChange={setManualLevel} min={1} max={200} />
            <NumberInput label="HP" value={manualHp} onChange={setManualHp} min={1} />
            <NumberInput label="물리방어 (WDEF)" value={manualWdef} onChange={setManualWdef} min={0} />
            <NumberInput label="마법방어 (MDEF)" value={manualMdef} onChange={setManualMdef} min={0} />
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">속성 약점</label>
              <select
                value={manualWeakness}
                onChange={(e) => setManualWeakness(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                <option value="">없음</option>
                <option value="fire">불</option>
                <option value="ice">얼음</option>
                <option value="lightning">번개</option>
                <option value="holy">신성</option>
                <option value="poison">독</option>
                <option value="dark">암흑</option>
              </select>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
          <span className="bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs mr-1">몬스터</span>
            <span className="font-medium">{monster.name}</span>
          </span>
          <span className="bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs mr-1">레벨</span>
            <span className="font-medium">Lv.{monster.level}</span>
          </span>
          <span className="bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs mr-1">HP</span>
            <span className="font-medium">{monster.hp.toLocaleString()}</span>
          </span>
          <span className="bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs mr-1">물방/마방</span>
            <span className="font-medium">{monster.wdef}/{monster.mdef}</span>
          </span>
          {monster.weakness && (
            <span className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
              <span className="text-yellow-500 text-xs mr-1">속성 약점</span>
              <span className="font-medium text-yellow-700">{ELEMENT_LABEL[monster.weakness]} ({isAttrWeakness ? "✓ 적용 ×1.5" : "스킬 속성 불일치"})</span>
            </span>
          )}
          {monster.exp > 0 && (
            <span className="bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-1.5">
              <span className="text-gray-400 text-xs mr-1">경험치</span>
              <span className="font-medium">{monster.exp.toLocaleString()}</span>
            </span>
          )}
        </div>
      </div>

      {/* 결과 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-4">계산 결과</h2>

        {/* 스탯공격력 / 마법 데미지 범위 */}
        {!isMagic ? (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-medium text-indigo-500 mb-1">스탯공격력 범위</p>
            <p className="text-xl font-bold text-indigo-700">
              {Math.floor(statAtkMin).toLocaleString()} ~ {Math.floor(statAtkMax).toLocaleString()}
            </p>
            <p className="text-xs text-indigo-400 mt-1">
              (주스탯 × 배율 + 부스탯) × 공격력/100 범위
            </p>
          </div>
        ) : (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-medium text-purple-500 mb-1">마법 데미지 범위 (스킬% 미포함)</p>
            <p className="text-xl font-bold text-purple-700">
              {Math.floor(magicDmgMin).toLocaleString()} ~ {Math.floor(magicDmgMax).toLocaleString()}
            </p>
            <p className="text-xs text-purple-400 mt-1">
              스킬 1%당 파워 MAX=(MA²/1000+MA)/30+INT/200 · MIN=(MA²/1000+MA×0.54)/30+INT/200
            </p>
          </div>
        )}

        {/* 확률 분포 — PRIMARY (최상단) */}
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-bold text-gray-800 dark:text-gray-200">확률 분포</span>
            <span className="text-xs text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded-full">몬테카를로 10,000회</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
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
          <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>기댓값 <strong>{mcResult.expectedHits.toFixed(2)}방</strong></span>
            <span>중앙값 <strong>{mcResult.median}방</strong></span>
          </div>
        </div>

        {/* 데미지 범위 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">최대 데미지</p>
            <p className="font-bold text-gray-800 dark:text-gray-200">{Math.floor(dmgResult.maxDmg).toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">평균 데미지</p>
            <p className="font-bold text-gray-800 dark:text-gray-200">{Math.floor(dmgResult.avgDmg).toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">최소 데미지</p>
            <p className="font-bold text-gray-800 dark:text-gray-200">{Math.floor(dmgResult.minDmg).toLocaleString()}</p>
          </div>
        </div>

        <div className={`rounded-xl border p-4 mb-3 ${nHitBg(nHitAvg)}`}>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {monster.name} N방컷{totalCritRate > 0 ? " (노크리)" : ""}
          </p>
          <p className={`text-3xl font-bold ${nHitColor(nHitAvg)}`}>
            평균 {nHitAvg}방컷
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            최대 데미지 기준: {nHitMax}방컷 &nbsp;|&nbsp; 평균 데미지 기준: {nHitAvg}방컷
          </p>
          {selectedSkill && selectedSkill.hits > 1 && (
            <p className="text-xs text-gray-400 mt-1">
              {selectedSkill.name} {selectedSkill.hits}타 × {interpolatedSkillDamage}% = 1회 {interpolatedSkillDamage * selectedSkill.hits}% 반영
            </p>
          )}
        </div>

        {totalCritRate > 0 && (
          <div className="rounded-xl border bg-yellow-50 border-yellow-200 p-4 mb-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {monster.name} N방컷 (크리 {totalCritRate}% 발동 시, +{totalCritDmg}%)
            </p>
            <p className={`text-3xl font-bold ${nHitColor(critNHitAvg)}`}>
              크리 {critNHitAvg}방컷
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              최대 기준: {critNHitMax}방컷 &nbsp;|&nbsp; 평균 기준: {critNHitAvg}방컷
            </p>
          </div>
        )}

        {/* 원킬컷 공격력 */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">원킬컷 {isMagic ? "마법공격력 (MA)" : "공격력 (ATK)"}</p>
          <p className="text-2xl font-bold text-orange-600">
            {oneKillAtk > 0 ? oneKillAtk.toLocaleString() : "계산 불가"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {monster.name}을 1방에 잡으려면 필요한 {isMagic ? "마법공격력" : "공격력"}
          </p>
        </div>
      </div>

      {/* 공식 설명 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-bold mb-3 text-gray-700 dark:text-gray-300">데미지 공식 참고</h2>
        {!isMagic ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 font-mono bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <p>최대 = (주스탯 × 최대배율 + 부스탯) × ATK/100 × (1 - 0.01×D) - 물방×0.5) × 스킬% × 타수</p>
            <p>최소 = (주스탯 × 최소배율 × 0.9 × 마스터리 + 부스탯) × ATK/100 × (1 - 0.01×D) - 물방×0.6) × 스킬% × 타수</p>
            <p className="text-gray-400">D = max(몬스터레벨 - 캐릭터레벨, 0)</p>
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 font-mono bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <p>최대 = (INT + LUK) × MA/100 × 스킬% × 타수 − 마방×0.5×(1+0.01×D)</p>
            <p>최소 = (INT + LUK×0.5) × MA/100 × 스킬% × 타수 − 마방×0.6×(1+0.01×D)</p>
            <p className="text-gray-400">D = max(몬스터레벨 - 캐릭터레벨, 0)</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 사냥터 젠컷 정보 데이터 ───
interface HuntSpot {
  name: string;
  alias?: string;
  zone: string;
  levelRange: [number, number];
  monster: {
    name: string;
    level: number;
    hp: number;
    wdef: number;
    mdef: number;
    weakness?: "fire" | "ice" | "lightning" | "holy" | "poison" | "dark";
    spawns?: number;
  };
  communityData?: {
    job: string;
    skill: string;
    note: string;
  }[];
  notes?: string;
}

const HUNT_SPOTS: HuntSpot[] = [
  {
    name: "미나르숲 (타우로마시스)",
    zone: "미나르숲",
    levelRange: [65, 80],
    monster: { name: "타우로마시스", level: 70, hp: 15000, wdef: 250, mdef: 250 },
  },
  {
    name: "미나르숲 (타우로스피어)",
    zone: "미나르숲",
    levelRange: [70, 85],
    monster: { name: "타우로스피어", level: 75, hp: 18000, wdef: 550, mdef: 400 },
  },
  {
    name: "리프레 (켄타우로스 계열)",
    zone: "리프레",
    levelRange: [80, 100],
    monster: { name: "켄타우로스", level: 86, hp: 34000, wdef: 585, mdef: 585 },
  },
  {
    name: "리프레 (주니어와이번)",
    zone: "리프레",
    levelRange: [85, 110],
    monster: { name: "주니어와이번", level: 90, hp: 43000, wdef: 800, mdef: 800 },
  },
  {
    name: "리프레 (다크와이번)",
    zone: "리프레",
    levelRange: [95, 120],
    monster: { name: "다크와이번", level: 103, hp: 60000, wdef: 850, mdef: 850 },
  },
  {
    name: "리프레 (아이스드라코)",
    zone: "리프레",
    levelRange: [100, 125],
    monster: { name: "아이스드라코", level: 108, hp: 75000, wdef: 900, mdef: 900, weakness: "fire" },
    notes: "불 속성 약점. 불독(F/P) 파이어 에로우/익스플로전 효과적.",
  },
  {
    name: "죽은 용의 둥지 (스켈레곤)",
    alias: "죽둥",
    zone: "리프레",
    levelRange: [105, 140],
    monster: { name: "스켈레곤", level: 110, hp: 80000, wdef: 900, mdef: 900, weakness: "holy" },
    notes: "성 속성 약점. 비숍·팔라딘 홀리 스킬 효과적.",
  },
  {
    name: "남겨진/위험한 용의 둥지 (스켈로스)",
    alias: "남둥/위용둥",
    zone: "리프레",
    levelRange: [110, 200],
    monster: { name: "스켈로스", level: 113, hp: 85000, wdef: 810, mdef: 710, weakness: "holy" },
    communityData: [
      { job: "비숍", skill: "제네시스", note: "2확컷 마력 885~910 · 1확컷 마력 1,295+ (커뮤니티)" },
      { job: "나이트로드", skill: "트리플 스로우", note: "위용둥 좌1 스공 2,600+ (트스10 · 메용20 제외)" },
      { job: "나이트로드", skill: "트리플 스로우", note: "최대 5젠컷 한계" },
      { job: "신궁", skill: "피어싱 애로우", note: "5.5젠컷 가능" },
    ],
    notes: "성 속성 약점. 비숍 제네시스 × 1.5 적용. 메이플랜드 최고 인기 사냥터.",
  },
  {
    name: "루디브리엄 (마리온에트)",
    zone: "루디브리엄",
    levelRange: [115, 140],
    monster: { name: "마리온에트", level: 120, hp: 120000, wdef: 1050, mdef: 1050 },
  },
  {
    name: "루디브리엄 (리스크리)",
    zone: "루디브리엄",
    levelRange: [120, 145],
    monster: { name: "리스크리", level: 122, hp: 130000, wdef: 1080, mdef: 1080 },
  },
  {
    name: "망가진 용의 둥지 (뉴트주니어)",
    alias: "망용둥",
    zone: "미나르숲",
    levelRange: [140, 200],
    monster: { name: "뉴트주니어", level: 105, hp: 68000, wdef: 850, mdef: 700, spawns: 8 },
    communityData: [
      { job: "보우마스터", skill: "폭풍의 시", note: "스공 5,400+ → 옥상 6젠컷 (Lv.167+)" },
      { job: "보우마스터", skill: "폭풍의 시", note: "스공 4,400~4,700 → 2층 5젠컷" },
      { job: "나이트로드", skill: "트리플 스로우", note: "스공 3,800~4,000 → 5젠컷" },
      { job: "나이트로드", skill: "트리플 스로우", note: "스공 4,500+ → 5.5젠컷" },
    ],
    notes: "메이플랜드 최고 경험치 사냥터. 자릿값 매우 높음.",
  },
];

// 직업별 추천 스킬 (젠컷 계산 기준)
const JOB_BEST_SKILL: Record<string, string> = {
  "히어로": "브랜디쉬",
  "팔라딘": "블래스트",
  "다크나이트": "드래곤 쓰레셔",
  "불독(F/P)": "메테오",
  "썬콜(I/L)": "블리자드",
  "비숍": "제네시스",
  "보우마스터": "폭풍의 시",
  "신궁": "피어싱 애로우",
  "나이트로드": "트리플 스로우",
  "섀도어": "부메랑스텝",
  "바이퍼": "드래곤 스트라이크",
  "캡틴": "배틀쉽 토피도",
};

// N방컷 역산: 해당 직업이 이 몬스터를 nHit방에 잡으려면 필요한 스공/마력
function calcNHitCut(
  monster: HuntSpot["monster"],
  job: string,
  nHit: number,
  charLevel: number
): number {
  const jobData = JOB_SKILL_DATA[job];
  if (!jobData) return 0;
  const skillName = JOB_BEST_SKILL[job];
  const skill = jobData.actives.find((s) => s.name === skillName) ?? jobData.actives[0];
  if (!skill) return 0;

  const isWeakness = !!(skill.element && monster.weakness === skill.element);
  const attrMult = isWeakness ? 1.5 : 1.0;
  const hpPerHit = monster.hp / nHit;

  if (jobData.isMagic) {
    const int_ = charLevel * 5;
    const luk = JOB_STAT_DEFAULTS[job]?.subStatDefault ?? 20;
    return calcOneKillMa(
      hpPerHit, int_, luk, skill.damage, attrMult,
      skill.hits ?? 1, charLevel, monster.level, monster.mdef
    );
  } else {
    const weaponKey = jobData.weapons[0];
    const wInfo = WEAPON_MULTIPLIERS[weaponKey];
    const mainStat = charLevel * 5;
    const subStat = JOB_STAT_DEFAULTS[job]?.subStatDefault ?? 25;
    return calcOneKillAtk(
      hpPerHit, mainStat, subStat, wInfo?.maxMult ?? 4.0,
      skill.damage, skill.hits ?? 1, charLevel, monster.level, monster.wdef
    );
  }
}

// 물리직업: 기준 스탯공격력으로 몇 방컷인지 역산
function calcHitsNeeded(
  monster: HuntSpot["monster"],
  job: string,
  statAtk: number,
  charLevel: number
): number {
  const jobData = JOB_SKILL_DATA[job];
  if (!jobData || jobData.isMagic) return 0;
  const skillName = JOB_BEST_SKILL[job];
  const skill = jobData.actives.find((s) => s.name === skillName) ?? jobData.actives[0];
  if (!skill) return 0;

  const weaponKey = jobData.weapons[0];
  const wInfo = WEAPON_MULTIPLIERS[weaponKey];
  const mainStat = charLevel * 5;
  const subStat = JOB_STAT_DEFAULTS[job]?.subStatDefault ?? 25;
  const statFactor = mainStat * (wInfo?.maxMult ?? 4.0) + subStat;
  if (statFactor <= 0) return 0;

  const weaponATK = (statAtk * 100) / statFactor;
  const D = Math.max(monster.level - charLevel, 0);
  const levelPenalty = 1 - 0.01 * D;
  const isWeakness = !!(skill.element && monster.weakness === skill.element);
  const attrMult = isWeakness ? 1.5 : 1.0;

  const dmgPerCast = Math.max(
    (statFactor * (weaponATK / 100) * levelPenalty - monster.wdef * 0.5) *
      (skill.damage / 100) *
      (skill.hits ?? 1) *
      attrMult,
    1
  );
  return Math.ceil(monster.hp / dmgPerCast);
}

// ─── 사냥터 카드 컴포넌트 ───
function HuntSpotCard({
  spot,
  jobs,
  charLevel,
  refStatAtk,
}: {
  spot: HuntSpot;
  jobs: string[];
  charLevel: number;
  refStatAtk: number;
}) {
  const thresholds = useMemo(
    () =>
      jobs.map((job) => {
        const isMagic = JOB_SKILL_DATA[job]?.isMagic ?? false;
        const skillName = JOB_BEST_SKILL[job] ?? "-";
        if (isMagic) {
          return {
            job, isMagic, skillName,
            one: calcNHitCut(spot.monster, job, 1, charLevel),
            two: calcNHitCut(spot.monster, job, 2, charLevel),
            three: calcNHitCut(spot.monster, job, 3, charLevel),
            hits: 0,
          };
        } else {
          return {
            job, isMagic, skillName,
            one: 0, two: 0, three: 0,
            hits: calcHitsNeeded(spot.monster, job, refStatAtk, charLevel),
          };
        }
      }),
    [spot, jobs, charLevel, refStatAtk]
  );

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-bold text-gray-800 dark:text-gray-200">{spot.name}</h3>
          {spot.alias && (
            <span className="text-xs bg-gray-200 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
              {spot.alias}
            </span>
          )}
          <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">
            추천 Lv.{spot.levelRange[0]}~{spot.levelRange[1]}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 dark:text-gray-400">
          <span>
            {spot.monster.name} · Lv.{spot.monster.level} · HP{" "}
            {spot.monster.hp.toLocaleString()}
          </span>
          <span>물방 {spot.monster.wdef} / 마방 {spot.monster.mdef}</span>
          {spot.monster.weakness && (
            <span
              className={`px-1.5 py-0.5 rounded text-xs ${
                ELEMENT_COLORS[spot.monster.weakness]
              }`}
            >
              {ELEMENT_LABEL[spot.monster.weakness]} 약점
            </span>
          )}
          {spot.monster.spawns && (
            <span className="text-gray-400">최대 {spot.monster.spawns}젠</span>
          )}
        </div>
      </div>

      {/* 직업별 컷 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs">
              <th className="text-left px-4 py-2 font-medium">직업</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">추천 스킬</th>
              <th className="text-right px-3 py-2 font-medium text-green-600">1방컷 (마력)</th>
              <th className="text-right px-3 py-2 font-medium text-blue-600">2방컷 (마력)</th>
              <th className="text-right px-3 py-2 font-medium text-gray-500 dark:text-gray-400">
                스탯공격력 기준 방컷
              </th>
            </tr>
          </thead>
          <tbody>
            {thresholds.map((t) => (
              <tr
                key={t.job}
                className="border-t border-gray-50 hover:bg-gray-50 dark:bg-gray-900/40 transition-colors"
              >
                <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200 text-sm">{t.job}</td>
                <td className="px-3 py-2.5 text-xs text-gray-400 hidden sm:table-cell">
                  {t.skillName}
                </td>
                {t.isMagic ? (
                  <>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-green-700 font-mono text-xs font-semibold">
                        {t.one > 0 ? t.one.toLocaleString() : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-blue-700 font-mono text-xs font-semibold">
                        {t.two > 0 ? t.two.toLocaleString() : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-gray-300">—</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2.5 text-right text-xs text-gray-300">—</td>
                    <td className="px-3 py-2.5 text-right text-xs text-gray-300">—</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`font-mono text-xs font-semibold ${
                        t.hits <= 3 ? "text-green-600" :
                        t.hits <= 7 ? "text-blue-600" :
                        t.hits <= 15 ? "text-orange-500" : "text-red-500"
                      }`}>
                        {t.hits}방컷
                      </span>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 커뮤니티 확인 데이터 */}
      {spot.communityData && spot.communityData.length > 0 && (
        <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
          <p className="text-xs font-semibold text-amber-700 mb-1.5">
            💬 커뮤니티 확인 데이터
          </p>
          <div className="space-y-1">
            {spot.communityData.map((d, i) => (
              <p key={i} className="text-xs text-amber-700">
                <strong>{d.job}</strong>{" "}
                <span className="text-amber-500">({d.skill})</span>: {d.note}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 노트 */}
      {spot.notes && (
        <div className="px-5 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-100">
          <p className="text-xs text-gray-400">{spot.notes}</p>
        </div>
      )}
    </div>
  );
}

// ─── 사냥터 젠컷 정보 탭 (메인) ───
function HuntTab() {
  const [charLevel, setCharLevel] = useState(120);
  const [refStatAtk, setRefStatAtk] = useState(5000);
  const [jobGroupFilter, setJobGroupFilter] = useState<string>("전체");
  const [zoneFilter, setZoneFilter] = useState<string>("전체");

  const zones = ["전체", ...Array.from(new Set(HUNT_SPOTS.map((s) => s.zone)))];

  const filteredSpots = HUNT_SPOTS.filter((spot) => {
    const inLevel =
      charLevel >= spot.levelRange[0] - 20 &&
      charLevel <= spot.levelRange[1] + 30;
    const inZone = zoneFilter === "전체" || spot.zone === zoneFilter;
    return inLevel && inZone;
  });

  const filteredJobs =
    jobGroupFilter === "전체"
      ? Object.values(JOB_GROUPS).flat()
      : JOB_GROUPS[jobGroupFilter] ?? Object.values(JOB_GROUPS).flat();

  return (
    <div className="space-y-5">
      {/* 설명 + 필터 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-bold text-lg mb-1">사냥터 젠컷 정보</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          마법직업: 1방/2방컷에 필요한 <strong>마력(MA)</strong> 기준 표시.
          물리직업: 입력한 <strong>스탯공격력 기준 방컷 수</strong> 표시.
          계산은 레벨×5 기본 주스탯 가정. 커뮤니티 검증 수치는 별도 표시.
        </p>

        {/* 기준 레벨 + 스탯공격력 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              내 캐릭터 레벨
            </label>
            <input
              type="number"
              value={charLevel}
              onChange={(e) => setCharLevel(Math.max(1, Math.min(200, Number(e.target.value))))}
              min={1}
              max={200}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              물리직업 기준 스탯공격력
              <span className="ml-1 text-gray-400 font-normal">(스탯×배율×ATK/100)</span>
            </label>
            <input
              type="number"
              value={refStatAtk}
              onChange={(e) => setRefStatAtk(Math.max(100, Number(e.target.value)))}
              min={100}
              step={500}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Lv.{Math.max(1, charLevel - 20)} ~ Lv.{Math.min(200, charLevel + 30)} 범위 사냥터 표시
        </p>

        {/* 직업 필터 */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">직업 계열 필터</label>
          <div className="flex gap-1 flex-wrap">
            {["전체", ...JOB_GROUP_KEYS].map((g) => (
              <button
                key={g}
                onClick={() => setJobGroupFilter(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  jobGroupFilter === g
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* 지역 필터 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">지역 필터</label>
          <div className="flex gap-1 flex-wrap">
            {zones.map((z) => (
              <button
                key={z}
                onClick={() => setZoneFilter(z)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  zoneFilter === z
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-700"
                }`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap px-1">
        <span className="font-medium text-gray-600 dark:text-gray-400">물리직업 방컷 수:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-500 inline-block" />
          1~3방 (매우 좋음)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
          4~7방
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-400 inline-block" />
          8~15방
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-400 inline-block" />
          16방+
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-300 inline-block" />
          커뮤니티 확인 데이터
        </span>
      </div>

      {filteredSpots.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-10 text-center text-gray-400">
          해당 레벨·지역 범위에 사냥터가 없습니다.
        </div>
      ) : (
        filteredSpots.map((spot) => (
          <HuntSpotCard
            key={spot.name}
            spot={spot}
            jobs={filteredJobs}
            charLevel={charLevel}
            refStatAtk={refStatAtk}
          />
        ))
      )}

      <p className="text-xs text-gray-300 text-center pb-2">
        * 수치는 레벨×5 기본 주스탯 가정. 실제 스펙·버프에 따라 차이 있음.
      </p>
    </div>
  );
}

// ─── 피격뎀 계산기 탭 ───
function DamageTakenTab() {
  const [jobGroup, setJobGroup] = useState("전사");
  const [charLevel, setCharLevel] = useState(70);
  const [totalStr, setTotalStr] = useState(350);
  const [totalDex, setTotalDex] = useState(50);
  const [totalInt, setTotalInt] = useState(4);
  const [totalLuk, setTotalLuk] = useState(4);
  const [playerPDef, setPlayerPDef] = useState(300);
  const [playerMDef, setPlayerMDef] = useState(200);
  const [playerMaxHp, setPlayerMaxHp] = useState(5000);

  const [mobName, setMobName] = useState("호문쿨루");
  const [mobLevel, setMobLevel] = useState(92);
  const [mobPAtk, setMobPAtk] = useState(460);
  const [mobMAtk, setMobMAtk] = useState(510);

  const [usePreset, setUsePreset] = useState(true);
  const [selectedMob, setSelectedMob] = useState(0);

  const MOB_PRESETS = useMemo(() => [
    { name: "주니어 부기", level: 13, pAtk: 38, mAtk: 0 },
    { name: "스톤골렘", level: 55, pAtk: 180, mAtk: 0 },
    { name: "스켈레톤 사병", level: 72, pAtk: 290, mAtk: 320 },
    { name: "예티", level: 76, pAtk: 310, mAtk: 350 },
    { name: "주니어 발록", level: 80, pAtk: 335, mAtk: 360 },
    { name: "호문쿨루", level: 92, pAtk: 460, mAtk: 510 },
    { name: "트리플 루모", level: 95, pAtk: 480, mAtk: 500 },
    { name: "우드마스크", level: 97, pAtk: 490, mAtk: 480 },
    { name: "스켈로사우르스", level: 100, pAtk: 520, mAtk: 540 },
    { name: "네카드", level: 105, pAtk: 550, mAtk: 580 },
    { name: "스켈레곤", level: 110, pAtk: 590, mAtk: 610 },
    { name: "마리온에트", level: 120, pAtk: 650, mAtk: 670 },
    { name: "자쿰", level: 140, pAtk: 2000, mAtk: 2500 },
    { name: "혼테일", level: 160, pAtk: 2900, mAtk: 3400 },
    { name: "핑크빈", level: 180, pAtk: 4000, mAtk: 4800 },
  ], []);

  useEffect(() => {
    if (usePreset && MOB_PRESETS[selectedMob]) {
      const m = MOB_PRESETS[selectedMob];
      setMobName(m.name);
      setMobLevel(m.level);
      setMobPAtk(m.pAtk);
      setMobMAtk(m.mAtk);
    }
  }, [selectedMob, usePreset, MOB_PRESETS]);

  const isWarrior = jobGroup === "전사";
  const isMagician = jobGroup === "마법사";
  const jobBaseDef = getJobBaseDef(jobGroup, charLevel);

  const physDmg = useMemo(() =>
    calcPhysDamageTaken(mobPAtk, playerPDef, jobBaseDef, charLevel, mobLevel, isWarrior, totalStr, totalDex, totalInt, totalLuk),
    [mobPAtk, playerPDef, jobBaseDef, charLevel, mobLevel, isWarrior, totalStr, totalDex, totalInt, totalLuk]
  );

  const magicDmg = useMemo(() =>
    calcMagicDamageTaken(mobMAtk, playerMDef, isMagician, totalStr, totalDex, totalLuk),
    [mobMAtk, playerMDef, isMagician, totalStr, totalDex, totalLuk]
  );

  const physHitsToKill = playerMaxHp > 0 ? Math.ceil(playerMaxHp / physDmg.max) : 0;
  const magicHitsToKill = playerMaxHp > 0 ? Math.ceil(playerMaxHp / magicDmg.max) : 0;

  const dmgColor = (dmg: number) => {
    const ratio = playerMaxHp > 0 ? dmg / playerMaxHp : 0;
    if (ratio >= 1) return "text-red-600";
    if (ratio >= 0.5) return "text-orange-500";
    if (ratio >= 0.25) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
        <h3 className="font-bold text-sm">캐릭터 설정</h3>
        <div className="flex gap-1 flex-wrap">
          {Object.keys(JOB_BASE_DEF).map((j) => (
            <button key={j} onClick={() => setJobGroup(j)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                jobGroup === j ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"}`}>
              {j}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberInput label="캐릭터 레벨" value={charLevel} onChange={setCharLevel} min={1} max={200} />
          <NumberInput label="최대 HP" value={playerMaxHp} onChange={setPlayerMaxHp} min={1} />
          <NumberInput label="물리 방어력 (WDEF)" value={playerPDef} onChange={setPlayerPDef} min={0} />
          <NumberInput label="마법 방어력 (MDEF)" value={playerMDef} onChange={setPlayerMDef} min={0} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberInput label="STR" value={totalStr} onChange={setTotalStr} min={4} />
          <NumberInput label="DEX" value={totalDex} onChange={setTotalDex} min={4} />
          <NumberInput label="INT" value={totalInt} onChange={setTotalInt} min={4} />
          <NumberInput label="LUK" value={totalLuk} onChange={setTotalLuk} min={4} />
        </div>
        <p className="text-xs text-gray-400">
          직업 기본 방어력 (Lv{charLevel} {jobGroup}): <span className="font-medium text-gray-600 dark:text-gray-400">{jobBaseDef}</span>
          {playerPDef < jobBaseDef && <span className="text-red-500 ml-2">( 기본 방어력 미달 - 피격뎀 증가!)</span>}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
        <h3 className="font-bold text-sm">몬스터 설정</h3>
        <div className="flex gap-2 mb-2">
          <button onClick={() => setUsePreset(true)}
            className={`px-3 py-1.5 rounded-lg text-sm ${usePreset ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>
            프리셋
          </button>
          <button onClick={() => setUsePreset(false)}
            className={`px-3 py-1.5 rounded-lg text-sm ${!usePreset ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>
            직접 입력
          </button>
        </div>
        {usePreset ? (
          <select value={selectedMob} onChange={(e) => setSelectedMob(Number(e.target.value))}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm">
            {MOB_PRESETS.map((m, i) => (
              <option key={i} value={i}>Lv{m.level} {m.name} (물공:{m.pAtk} / 마공:{m.mAtk})</option>
            ))}
          </select>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">몬스터 이름</label>
              <input value={mobName} onChange={(e) => setMobName(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <NumberInput label="몬스터 레벨" value={mobLevel} onChange={setMobLevel} min={1} />
            <NumberInput label="물리 공격력" value={mobPAtk} onChange={setMobPAtk} min={0} />
            <NumberInput label="마법 공격력" value={mobMAtk} onChange={setMobMAtk} min={0} />
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <h3 className="font-bold text-sm mb-4">{mobName} 피격 시 예상 데미지</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 물리 피격 */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">&#9876;</span>
              <span className="font-bold text-sm">물리 피격</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">최소 데미지</span>
                <span className={`font-bold ${dmgColor(physDmg.min)}`}>{physDmg.min.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">최대 데미지</span>
                <span className={`font-bold ${dmgColor(physDmg.max)}`}>{physDmg.max.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">HP 대비</span>
                <span className={`font-bold ${dmgColor(physDmg.max)}`}>
                  {playerMaxHp > 0 ? ((physDmg.max / playerMaxHp) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2 mt-2">
                <span className="text-gray-500 dark:text-gray-400">생존 가능 타수</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{physHitsToKill}회</span>
              </div>
            </div>
            {/* HP 바 */}
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, playerMaxHp > 0 ? (physDmg.max / playerMaxHp) * 100 : 0)}%`,
                  backgroundColor: physDmg.max >= playerMaxHp ? '#ef4444' : physDmg.max >= playerMaxHp * 0.5 ? '#f97316' : '#22c55e',
                }} />
            </div>
          </div>

          {/* 마법 피격 */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">&#10024;</span>
              <span className="font-bold text-sm">마법 피격</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">최소 데미지</span>
                <span className={`font-bold ${dmgColor(magicDmg.min)}`}>{magicDmg.min.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">최대 데미지</span>
                <span className={`font-bold ${dmgColor(magicDmg.max)}`}>{magicDmg.max.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">HP 대비</span>
                <span className={`font-bold ${dmgColor(magicDmg.max)}`}>
                  {playerMaxHp > 0 ? ((magicDmg.max / playerMaxHp) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2 mt-2">
                <span className="text-gray-500 dark:text-gray-400">생존 가능 타수</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{magicHitsToKill}회</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, playerMaxHp > 0 ? (magicDmg.max / playerMaxHp) * 100 : 0)}%`,
                  backgroundColor: magicDmg.max >= playerMaxHp ? '#ef4444' : magicDmg.max >= playerMaxHp * 0.5 ? '#f97316' : '#22c55e',
                }} />
            </div>
          </div>
        </div>
      </div>

      {/* 공식 레퍼런스 */}
      <details className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <summary className="font-bold text-sm cursor-pointer">피격뎀 계산 공식</summary>
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 space-y-2 font-mono">
          <p className="font-bold text-gray-800 dark:text-gray-200">물리 피격 데미지:</p>
          <p>rawDmg = mobATK^2 x 0.008 ~ 0.0085</p>
          <p>statDef = {isWarrior ? "STR/2800 + DEX/3200 + INT/7200 + LUK/3200 (전사)" : "STR/2000 + DEX/2800 + INT/7200 + LUK/3200"}</p>
          <p>defReduction = WDEF x (statDef + 0.28) + (WDEF - jobBaseDef) x secondaryFactor</p>
          <p>finalDmg = max(1, rawDmg - defReduction)</p>
          <hr className="my-2" />
          <p className="font-bold text-gray-800 dark:text-gray-200">마법 피격 데미지:</p>
          <p>rawDmg = mobMATK^2 x 0.0075 ~ 0.008</p>
          <p>defReduction = (MDEF/4 + STR/28 + DEX/24 + LUK/20) x {isMagician ? "1.2 (마법사)" : "1.0"}</p>
          <p>finalDmg = max(1, rawDmg - defReduction)</p>
        </div>
      </details>
    </div>
  );
}
