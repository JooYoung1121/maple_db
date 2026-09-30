export type StatKey = "STR" | "DEX" | "INT" | "LUK";
export type JobGroup = "전사" | "마법사" | "궁수" | "도적" | "해적";
export type WeaponKind = "melee" | "ranged" | "magic";

/**
 * 무기 배율 단일 정본 (빅뱅 전 계열, 메이플랜드 공식 검증 완료).
 * /nhit·/gear-sim·/damage·/hp-exp 가 전부 이 테이블을 공유한다 —
 * 과거 3곳(nhit/gear-sim/damageFormula)에 중복 하드코딩돼 드리프트 위험이 있었다.
 */
export interface WeaponMultiplier {
  maxMult: number;
  minMult: number;
  mainStat: StatKey;
  subStat: "STR" | "DEX" | "STR+DEX";
  type: WeaponKind;
}

export const WEAPON_MULTIPLIERS: Record<string, WeaponMultiplier> = {
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

export interface WeaponFormula {
  key: string;
  label: string;
  jobs: JobGroup[];
  mainStat: StatKey;
  subStats: StatKey[];
  maxMultiplier: number;
  minMultiplier: number;
  kind: "physical" | "magic";
}

function fromMultiplier(
  key: string,
  label: string,
  jobs: JobGroup[],
  multKey: string,
): WeaponFormula {
  const m = WEAPON_MULTIPLIERS[multKey];
  return {
    key,
    label,
    jobs,
    mainStat: m.mainStat,
    subStats: m.subStat === "STR+DEX" ? ["STR", "DEX"] : [m.subStat],
    maxMultiplier: m.maxMult,
    minMultiplier: m.minMult,
    kind: "physical",
  };
}

/** /damage 상태창 계산기용 뷰 — 값은 WEAPON_MULTIPLIERS에서 파생 (단일 정본 유지) */
export const WEAPON_FORMULAS: WeaponFormula[] = [
  fromMultiplier("one-hand-sword", "한손검", ["전사"], "한손검"),
  fromMultiplier("two-hand-sword", "두손검", ["전사"], "두손검"),
  fromMultiplier("one-hand-axe-bw", "한손도끼·둔기", ["전사"], "한손도끼/둔기"),
  fromMultiplier("two-hand-axe-bw", "두손도끼·둔기", ["전사"], "두손도끼/둔기"),
  fromMultiplier("spear", "창", ["전사"], "창"),
  fromMultiplier("polearm", "폴암", ["전사"], "폴암"),
  { key: "wand-staff", label: "완드·스태프", jobs: ["마법사"], mainStat: "INT", subStats: ["LUK"], maxMultiplier: 0, minMultiplier: 0, kind: "magic" },
  fromMultiplier("bow", "활", ["궁수"], "활"),
  fromMultiplier("crossbow", "석궁", ["궁수"], "석궁"),
  fromMultiplier("dagger", "단검", ["도적"], "단검"),
  fromMultiplier("claw", "아대", ["도적"], "아대/클로"),
  fromMultiplier("knuckle", "너클", ["해적"], "너클"),
  fromMultiplier("gun", "건", ["해적"], "건"),
];

export const DEFAULT_WEAPON_BY_JOB: Record<JobGroup, string> = {
  전사: "two-hand-sword",
  마법사: "wand-staff",
  궁수: "bow",
  도적: "claw",
  해적: "knuckle",
};

export const DAMAGE_FORMULA_SOURCES = [
  {
    label: "StrategyWiki · MapleStory Formulas",
    href: "https://strategywiki.org/wiki/MapleStory/Formulas",
  },
  {
    label: "StrategyWiki · Bowman (활 3.4 / 석궁 3.6)",
    href: "https://strategywiki.org/wiki/MapleStory/Bowman",
  },
  {
    label: "MapleStory Classic · Pre-Big Bang Mechanics",
    href: "https://www.maplestoryclassicworld.com/guides/pre-big-bang-mechanics",
  },
] as const;

// ─── 실전 데미지 공식 (/nhit 검증본이 정본) ───

export interface DamageResult {
  maxDmg: number;
  minDmg: number;
  avgDmg: number;
}

/**
 * 물리 데미지. 레벨 페널티(몹이 높을 때 1%/레벨)와 물방(wdef) 차감 포함.
 * skillPct 100 = 평타.
 */
export function calcPhysicalDamage(
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

// ─── 법사 데미지 공식 (메이플랜드 공식 검증 완료) ───
// MAX = ((MA²/1000 + MA) / 30 + INT/200) × skillPct × attrMult - mdef × 0.5 × defMult
// MIN = ((MA²/1000 + MA×0.6×0.9) / 30 + INT/200) × skillPct × attrMult - mdef × 0.6 × defMult
// attrMult는 방어 차감 전에 적용 (속성약점 ×1.5 포함)
export const MAGIC_MASTERY = 0.6;

export function calcMagicDamage(
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

export function calcNHit(hp: number, dmg: DamageResult): { nHitMax: number; nHitAvg: number } {
  const nHitMax = Math.ceil(hp / dmg.maxDmg);
  const nHitAvg = Math.ceil(hp / dmg.avgDmg);
  return { nHitMax, nHitAvg };
}

// 원킬컷 역산: physical ATK (최소 데미지 기준 보장 컷)
export function calcOneKillAtk(
  hp: number,
  mainStat: number,
  subStat: number,
  minMult: number,
  mastery: number,
  skillPct: number,
  hits: number,
  charLevel: number,
  monLevel: number,
  wdef: number
): number {
  const D = Math.max(monLevel - charLevel, 0);
  const levelPenalty = Math.max(1 - 0.01 * D, 0);
  const statTerm = mainStat * minMult * 0.9 * mastery + subStat;
  if (levelPenalty <= 0 || statTerm <= 0 || skillPct <= 0 || hits <= 0) return 0;
  const requiredBeforeDefense = (hp / hits) * 100 / skillPct + wdef * 0.6;
  return Math.ceil(requiredBeforeDefense * 100 / (statTerm * levelPenalty));
}

// 원킬컷 역산: magic MA (이차방정식 풀이)
// MA² + 540×MA - 30000T = 0, T = (hp/hits + mdef×0.6×defMult)/(skillPct×attrMult) - INT/200
export function calcOneKillMa(
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

export interface MonteCarloResult {
  distribution: Record<number, number>;
  expectedHits: number;
  median: number;
  pOneHit: number;
  pTwoHit: number;
  pThreeHit: number;
  pFourPlusHit: number;
}

export function runMonteCarlo(
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

// ─── 상태창 범위 계산 (/damage 페이지) ───

export interface DamageRangeInput {
  stats: Record<StatKey, number>;
  totalAttack: number;
  mastery: number;
  weapon: WeaponFormula;
}

export interface DamageRangeResult {
  minimum: number;
  average: number;
  maximum: number;
  attackGain: number;
  mainStatGain: number;
  attackToMainStat: number;
}

export function calculateDamageRange({
  stats,
  totalAttack,
  mastery,
  weapon,
}: DamageRangeInput): DamageRangeResult | null {
  if (weapon.kind !== "physical" || totalAttack <= 0) return null;

  const main = Math.max(0, stats[weapon.mainStat]);
  const sub = weapon.subStats.reduce((sum, key) => sum + Math.max(0, stats[key]), 0);
  const attack = Math.max(0, totalAttack);
  const safeMastery = Math.min(100, Math.max(0, mastery)) / 100;
  const maximum = (main * weapon.maxMultiplier + sub) * attack / 100;
  const minimum = (main * weapon.minMultiplier * 0.9 * safeMastery + sub) * attack / 100;
  const attackGain = (main * weapon.maxMultiplier + sub) / 100;
  const mainStatGain = weapon.maxMultiplier * attack / 100;

  return {
    minimum,
    average: (minimum + maximum) / 2,
    maximum,
    attackGain,
    mainStatGain,
    attackToMainStat: mainStatGain > 0 ? attackGain / mainStatGain : 0,
  };
}

export function applyMapleWarrior(
  pure: Record<StatKey, number>,
  gear: Record<StatKey, number>,
  enabled: boolean,
  rate: number,
) {
  return (Object.keys(pure) as StatKey[]).reduce<Record<StatKey, number>>(
    (acc, key) => {
      const pureStat = Math.max(0, pure[key]);
      acc[key] = pureStat + Math.max(0, gear[key]) + (enabled ? Math.floor(pureStat * rate / 100) : 0);
      return acc;
    },
    { STR: 0, DEX: 0, INT: 0, LUK: 0 },
  );
}
