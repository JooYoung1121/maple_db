"use client";

const STAT_MAP: Record<string, { label: string; category: "attack" | "defense" | "stat" | "other" }> = {
  // 공격
  incPAD: { label: "공격력", category: "attack" },
  incMAD: { label: "마력", category: "attack" },
  // 방어
  incPDD: { label: "방어력", category: "defense" },
  incMDD: { label: "마법방어력", category: "defense" },
  // 스탯
  incSTR: { label: "힘(STR)", category: "stat" },
  incDEX: { label: "민첩(DEX)", category: "stat" },
  incINT: { label: "지능(INT)", category: "stat" },
  incLUK: { label: "행운(LUK)", category: "stat" },
  // 기타
  incMHP: { label: "HP", category: "other" },
  incMMP: { label: "MP", category: "other" },
  incSpeed: { label: "이동속도", category: "other" },
  incJump: { label: "점프력", category: "other" },
  incACC: { label: "명중", category: "other" },
  incEVA: { label: "회피", category: "other" },
  // 요구 능력치
  reqSTR: { label: "요구 힘(STR)", category: "stat" },
  reqDEX: { label: "요구 민첩(DEX)", category: "stat" },
  reqINT: { label: "요구 지능(INT)", category: "stat" },
  reqLUK: { label: "요구 행운(LUK)", category: "stat" },
  // v92 aliases
  STR: { label: "힘(STR)", category: "stat" },
  DEX: { label: "민첩(DEX)", category: "stat" },
  INT: { label: "지능(INT)", category: "stat" },
  LUK: { label: "행운(LUK)", category: "stat" },
  PAD: { label: "공격력", category: "attack" },
  MAD: { label: "마력", category: "attack" },
  PDD: { label: "방어력", category: "defense" },
  MDD: { label: "마법방어력", category: "defense" },
  ACC: { label: "명중", category: "other" },
  EVA: { label: "회피", category: "other" },
  Speed: { label: "이동속도", category: "other" },
  Jump: { label: "점프력", category: "other" },
  HP: { label: "HP", category: "other" },
  MP: { label: "MP", category: "other" },
  MHP: { label: "HP", category: "other" },
  MMP: { label: "MP", category: "other" },
};

const CATEGORY_META: Record<string, { label: string; color: string; bgColor: string }> = {
  attack: { label: "공격", color: "text-red-700", bgColor: "bg-red-50" },
  defense: { label: "방어", color: "text-blue-700", bgColor: "bg-blue-50" },
  stat: { label: "스탯", color: "text-green-700", bgColor: "bg-green-50" },
  other: { label: "기타", color: "text-gray-700", bgColor: "bg-gray-50" },
};

const CATEGORY_ORDER = ["attack", "defense", "stat", "other"] as const;

interface Props {
  stats: Record<string, number | string>;
  title?: string;
}

export default function StatGrid({ stats, title = "스탯" }: Props) {
  // Filter out zero values and group by category
  const entries = Object.entries(stats).filter(([, v]) => {
    const n = Number(v);
    return !isNaN(n) && n !== 0;
  });

  if (entries.length === 0) return null;

  const grouped = new Map<string, { key: string; label: string; value: number }[]>();
  for (const [key, value] of entries) {
    const meta = STAT_MAP[key];
    const category = meta?.category || "other";
    const label = meta?.label || key;
    const list = grouped.get(category) || [];
    list.push({ key, label, value: Number(value) });
    grouped.set(category, list);
  }

  return (
    <div className="mt-4">
      <span className="text-sm font-semibold text-gray-700">{title}</span>
      <div className="mt-2 space-y-3">
        {CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => {
          const meta = CATEGORY_META[cat];
          const items = grouped.get(cat)!;
          return (
            <div key={cat}>
              <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {items.map((item) => (
                  <span
                    key={item.key}
                    className={`px-3 py-1.5 ${meta.bgColor} ${meta.color} rounded-lg text-sm font-medium`}
                  >
                    {item.label} +{item.value}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
