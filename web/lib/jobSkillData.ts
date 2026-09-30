/**
 * 직업별 무기·마스터리·스킬 데이터 (빅뱅 전 12직업) — /nhit에서 추출한 공유 정본.
 * /nhit(엔방컷 계산기)와 /hp-exp(체경비 내 캐릭터 계산)가 함께 사용한다.
 * 스킬 수치는 만렙 기준 단일값 — 레벨별 수치(sim_skills.level_properties) 파싱은 v2 백로그.
 */

// ─── 스킬 데이터 ───
export interface ActiveSkill {
  name: string;
  damage: number;
  hits: number;
  mobs?: number;
  type: "active";
  element?: "fire" | "ice" | "lightning" | "holy" | "poison" | "dark";
  minDamage: number;
  maxLevel: number;
}

export interface BuffSkill {
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

export interface PassiveSkill {
  name: string;
  type: "passive";
  mastery?: number;
  critRate?: number;
  critDmg?: number;
  description: string;
}

export interface JobSkillData {
  label: string;
  weapons: string[];
  isMagic: boolean;
  passives: PassiveSkill[];
  actives: ActiveSkill[];
  buffs: BuffSkill[];
}

export const JOB_SKILL_DATA: Record<string, JobSkillData> = {
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
export const JOB_GROUPS: Record<string, string[]> = {
  "전사": ["히어로", "팔라딘", "다크나이트"],
  "마법사": ["불독(F/P)", "썬콜(I/L)", "비숍"],
  "궁수": ["보우마스터", "신궁"],
  "도적": ["나이트로드", "섀도어"],
  "해적": ["바이퍼", "캡틴"],
};

export const JOB_GROUP_KEYS = Object.keys(JOB_GROUPS);

// ─── 직업별 레벨 스탯 기본값 ───
// mainStat = level × 5, subStat = 아래 고정값
export const JOB_STAT_DEFAULTS: Record<string, { subStatDefault: number }> = {
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
