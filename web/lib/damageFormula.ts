export type StatKey = "STR" | "DEX" | "INT" | "LUK";
export type JobGroup = "전사" | "마법사" | "궁수" | "도적" | "해적";

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

/**
 * 메이플랜드(빅뱅 전 계열) 상태창 공격 범위 계산용 무기 계수.
 * /nhit, /gear-sim에서 사용 중인 값과 맞췄으며 외부 고전 공식표와 교차 확인했다.
 */
export const WEAPON_FORMULAS: WeaponFormula[] = [
  { key: "one-hand-sword", label: "한손검", jobs: ["전사"], mainStat: "STR", subStats: ["DEX"], maxMultiplier: 4.0, minMultiplier: 4.0, kind: "physical" },
  { key: "two-hand-sword", label: "두손검", jobs: ["전사"], mainStat: "STR", subStats: ["DEX"], maxMultiplier: 4.6, minMultiplier: 4.6, kind: "physical" },
  { key: "one-hand-axe-bw", label: "한손도끼·둔기", jobs: ["전사"], mainStat: "STR", subStats: ["DEX"], maxMultiplier: 4.4, minMultiplier: 3.2, kind: "physical" },
  { key: "two-hand-axe-bw", label: "두손도끼·둔기", jobs: ["전사"], mainStat: "STR", subStats: ["DEX"], maxMultiplier: 4.8, minMultiplier: 3.4, kind: "physical" },
  { key: "spear", label: "창", jobs: ["전사"], mainStat: "STR", subStats: ["DEX"], maxMultiplier: 5.0, minMultiplier: 3.0, kind: "physical" },
  { key: "polearm", label: "폴암", jobs: ["전사"], mainStat: "STR", subStats: ["DEX"], maxMultiplier: 5.0, minMultiplier: 3.0, kind: "physical" },
  { key: "wand-staff", label: "완드·스태프", jobs: ["마법사"], mainStat: "INT", subStats: ["LUK"], maxMultiplier: 0, minMultiplier: 0, kind: "magic" },
  { key: "bow", label: "활", jobs: ["궁수"], mainStat: "DEX", subStats: ["STR"], maxMultiplier: 3.4, minMultiplier: 3.4, kind: "physical" },
  { key: "crossbow", label: "석궁", jobs: ["궁수"], mainStat: "DEX", subStats: ["STR"], maxMultiplier: 3.6, minMultiplier: 3.6, kind: "physical" },
  { key: "dagger", label: "단검", jobs: ["도적"], mainStat: "LUK", subStats: ["STR", "DEX"], maxMultiplier: 3.6, minMultiplier: 3.6, kind: "physical" },
  { key: "claw", label: "아대", jobs: ["도적"], mainStat: "LUK", subStats: ["STR", "DEX"], maxMultiplier: 3.6, minMultiplier: 3.6, kind: "physical" },
  { key: "knuckle", label: "너클", jobs: ["해적"], mainStat: "STR", subStats: ["DEX"], maxMultiplier: 4.8, minMultiplier: 4.8, kind: "physical" },
  { key: "gun", label: "건", jobs: ["해적"], mainStat: "DEX", subStats: ["STR"], maxMultiplier: 3.6, minMultiplier: 3.6, kind: "physical" },
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
