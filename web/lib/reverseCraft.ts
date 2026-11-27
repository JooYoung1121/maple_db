export type Weapon = {
  id: string; name: string; kind: string; itemId: number;
  baseAtk: number; baseItemAtk: number; attackLabel: "공격력" | "마력";
  mainName: "STR" | "DEX" | "INT" | "LUK"; mainBase: number;
  subName: "STR" | "DEX" | "INT" | "LUK"; subBase: number;
  scroll60Main: number; scroll10Main: number;
  levelMin: number; levelWeights: number[]; slots: number; growthSource: string;
};

function normalized(values: number[]): number[] {
  const safe = values.map((v) => Math.max(0, Number.isFinite(v) ? v : 0));
  const total = safe.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return safe.map((_, index) => (index === 0 ? 1 : 0));
  return safe.map((value) => value / total);
}

function convolve(left: Map<number, number>, right: Map<number, number>): Map<number, number> {
  const result = new Map<number, number>();
  for (const [leftValue, leftP] of left) {
    for (const [rightValue, rightP] of right) {
      const value = leftValue + rightValue;
      result.set(value, (result.get(value) ?? 0) + leftP * rightP);
    }
  }
  return result;
}

function repeatDistribution(source: Map<number, number>, count: number): Map<number, number> {
  let result = new Map<number, number>([[0, 1]]);
  for (let i = 0; i < count; i++) result = convolve(result, source);
  return result;
}

export function attackDistribution(weapon: Weapon, bonusWeights: number[]): Map<number, number> {
  const bonus = new Map(normalized(bonusWeights).map((probability, value) => [value, probability]));
  const level = new Map(normalized(weapon.levelWeights).map((probability, value) => [weapon.levelMin + value, probability]));
  const scroll = new Map([[0, 0.4], [2, 0.6]]);
  const offset = convolve(convolve(bonus, repeatDistribution(level, 3)), repeatDistribution(scroll, 7));
  return new Map([...offset].map(([value, probability]) => [weapon.baseAtk + value, probability]));
}

