// Prices remain integers even above Number.MAX_SAFE_INTEGER.
export interface ItemOptions {
  stats: Record<string, number>;
  upgradeCount: number | null;
  remainingUpgrades: number | null;
  requiredLevelAdjustment: number | null;
  gemApplied: boolean | null;
  gems: { code: number; stat: string | null; amount: number | null }[];
  complete: boolean;
  status: "checked" | "inferred" | "unknown" | "not_equipment";
}
export interface Listing {
  id: string;
  itemId: number;
  name: string;
  unitPrice: string;
  quantity: string;
  soldAt: string | null;
  expiresAt: string | null;
  options: ItemOptions;
}
export interface ComparedListing extends Listing {
  key: string;
  kind: "active" | "sold";
  fetchedAt: string;
  sourceUrl: string;
}
export interface MarketGem {
  code: number;
  itemId: number;
  name: string;
  stat: string;
  amount: number;
  grade: number; // 0 low, 1 intermediate, 2 advanced
  weaponOnly: boolean;
}
export const STAT_LABELS: Record<string, string> = {
  attack: "공격력", magicAttack: "마력", strength: "STR", dexterity: "DEX", intelligence: "INT", luck: "LUK",
  hp: "HP", mp: "MP", physicalDefense: "물리방어", magicDefense: "마법방어", accuracy: "명중",
  avoidability: "회피", speed: "이속", jump: "점프", craft: "손재주", requiredLevelAdjustment: "착용 레벨 보정",
};
export const FEE_SOURCE = "https://mapleland-util.com/guides/maker";

export function money(value: string): bigint | null {
  return /^\d{1,19}$/.test(value) ? BigInt(value) : null;
}
export function meso(value: bigint | null): string {
  return value === null ? "금액 입력 필요" : `${value.toLocaleString("ko-KR")} 메소`;
}
export function hasKnownStats(item: Listing): boolean {
  return item.options.complete && ["checked", "inferred"].includes(item.options.status);
}
export function statValue(item: Listing, stat: string): number | null {
  if (!hasKnownStats(item)) return null;
  if (stat === "requiredLevelAdjustment") return item.options.requiredLevelAdjustment;
  return item.options.stats[stat] ?? 0;
}
export function statDelta(base: Listing, candidate: Listing, stat: string): number | null {
  const a = statValue(base, stat), b = statValue(candidate, stat);
  return a === null || b === null ? null : b - a;
}
export function incrementalCost(base: Listing, candidate: Listing, stat: string) {
  const delta = statDelta(base, candidate, stat), a = money(base.unitPrice), b = money(candidate.unitPrice);
  if (delta === null || a === null || b === null) return null;
  const extra = b - a;
  return { delta, extra, perPoint: delta > 0 && extra > BigInt(0) ? (extra + BigInt(delta) - BigInt(1)) / BigInt(delta) : null };
}
export function replacementCost(price: string, netSale: string, extra: string): bigint | null {
  const values = [price, netSale, extra].map(money);
  return values.some(v => v === null) ? null : values[0]! - values[1]! + values[2]!;
}
export function applicationFee(gems: MarketGem[]): bigint | null {
  if (!gems.length || gems.length > 3 || gems.some(g => ![0, 1, 2].includes(g.grade))) return null;
  return BigInt(2_750_000) + gems.reduce((sum, gem) => sum + BigInt(750_000 * (gem.grade + 1)), BigInt(0));
}
export function gemEligibility(base: ComparedListing, gems: MarketGem[]): string | null {
  if (base.kind !== "active") return "거래 완료 장비는 구매할 수 없습니다. 판매 중 매물을 골라 주세요.";
  if (!hasKnownStats(base) || base.options.gemApplied === null) return "장비 옵션 또는 보석작 여부가 미확인입니다.";
  if (base.options.gemApplied) return "이미 보석작된 장비에는 추가 옵션 부여를 계산할 수 없습니다.";
  const type = Math.floor(base.itemId / 10_000);
  const weapon = type >= 130 && type <= 149;
  if (!weapon && ![100, 104, 105, 106, 107, 108, 109].includes(type)) return "이 장비 부위는 옵션 부여 비교를 지원하지 않습니다.";
  if (!gems.length || gems.length > 3) return "사용할 강화보석을 1~3개 골라 주세요.";
  if (new Set(gems.map(g => g.stat)).size !== gems.length) return "같은 종류의 보석은 중복 선택할 수 없습니다.";
  if (!weapon && gems.some(g => g.weaponOnly)) return "다이아몬드·사파이어는 무기에만 사용할 수 있습니다.";
  return null;
}
export function projectGemOptions(base: ComparedListing, gems: MarketGem[]): ItemOptions | null {
  if (gemEligibility(base, gems)) return null;
  const stats = { ...base.options.stats };
  let levelAdjustment = base.options.requiredLevelAdjustment;
  for (const gem of gems) {
    if (gem.stat === "requiredLevelAdjustment") levelAdjustment = levelAdjustment === null ? null : levelAdjustment + gem.amount;
    else stats[gem.stat] = (stats[gem.stat] ?? 0) + gem.amount;
  }
  return { ...base.options, stats, requiredLevelAdjustment: levelAdjustment, gemApplied: true,
    gems: gems.map(g => ({ code: g.code, stat: g.stat, amount: g.amount })) };
}
export function sameFinalOptions(base: ComparedListing, projected: ItemOptions, target: ComparedListing): boolean {
  if (base.itemId !== target.itemId || !hasKnownStats(target) || !target.options.gemApplied) return false;
  if ([projected.upgradeCount, projected.remainingUpgrades, projected.requiredLevelAdjustment,
    target.options.upgradeCount, target.options.remainingUpgrades, target.options.requiredLevelAdjustment].some(v => v === null)) return false;
  if (projected.upgradeCount !== target.options.upgradeCount || projected.remainingUpgrades !== target.options.remainingUpgrades ||
    projected.requiredLevelAdjustment !== target.options.requiredLevelAdjustment) return false;
  return Object.keys(STAT_LABELS).filter(k => k !== "requiredLevelAdjustment")
    .every(k => (projected.stats[k] ?? 0) === (target.options.stats[k] ?? 0));
}
export function gemCost(base: string, prices: string[], fee: string): bigint | null {
  const values = [base, fee, ...prices].map(money);
  if (!prices.length || values.some(v => v === null)) return null;
  return values.reduce<bigint>((sum, v) => sum + v!, BigInt(0));
}
