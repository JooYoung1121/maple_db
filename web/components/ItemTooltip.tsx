"use client";

/* 인게임 아이템 툴팁 — 메이플랜드에서 장비에 마우스를 올렸을 때 보이는 창을 재현한다 (v4.16.0).
 *
 * 수치 우선순위: 메이플랜드 현행 DB(item_mapleland_stats, mapledb.kr) → 없으면 items.stats(GMS v92 원작 + 오버라이드).
 * 직업 줄은 인게임처럼 착용 불가 직업을 빨간색으로 표시한다. 메랜 수치가 원작과 다르면 아래 대조 박스에 적는다. */

import type { Item, MaplelandItemStats } from "@/lib/types";
import { entityIconUrl, hideIconOnError } from "@/lib/icons";
import { toSubcategoryKr } from "@/lib/translations";

const JOBS = ["초보자", "전사", "마법사", "궁수", "도적", "해적"] as const;

/* 옵션 표시 순서 (인게임 순서: 스탯 → 공/마 → 방어 → 명중/회피 → HP/MP → 이속/점프) */
const STAT_ORDER: { key: string; label: string; pct?: boolean }[] = [
  { key: "incSTR", label: "STR" }, { key: "incDEX", label: "DEX" }, { key: "incINT", label: "INT" }, { key: "incLUK", label: "LUK" },
  { key: "incMHP", label: "최대 HP" }, { key: "incMMP", label: "최대 MP" },
  { key: "incMHPr", label: "최대 HP", pct: true }, { key: "incMMPr", label: "최대 MP", pct: true },
  { key: "incPAD", label: "공격력" }, { key: "incMAD", label: "마력" },
  { key: "incPDD", label: "물리방어력" }, { key: "incMDD", label: "마법방어력" },
  { key: "incACC", label: "명중률" }, { key: "incEVA", label: "회피율" },
  { key: "incSpeed", label: "이동속도" }, { key: "incJump", label: "점프력" },
];
const LABEL_TO_KEY: Record<string, string> = {
  "물리방어력": "incPDD", "마법방어력": "incMDD", "물리공격력": "incPAD", "마법공격력": "incMAD",
  STR: "incSTR", DEX: "incDEX", INT: "incINT", LUK: "incLUK",
  "최대체력": "incMHP", "최대마나": "incMMP", "명중률": "incACC", "회피율": "incEVA", "이동속도": "incSpeed", "점프력": "incJump",
};
const ML_COVERED_KEYS = new Set(Object.values(LABEL_TO_KEY));
const KEY_LABEL: Record<string, string> = Object.fromEntries(STAT_ORDER.map((s) => [s.key, s.label + (s.pct ? "(%)" : "")]));
KEY_LABEL.level_req = "REQ LEV";

const ATTACK_SPEED: Record<string, string> = { "2": "매우 빠름", "3": "빠름", "4": "빠름", "5": "보통", "6": "보통", "7": "느림", "8": "느림", "9": "매우 느림" };

function attackSpeedLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return ATTACK_SPEED[s] ?? s; // DB에 이미 한글이면 그대로
}

/** job_req("전사/도적") 또는 메랜 jobs("전사,도적" | "공용" | "not") → 착용 가능 직업 집합 (null = 전 직업) */
function allowedJobs(jobReq: string | null | undefined, mlJobs: string | null | undefined): Set<string> | null {
  const raw = (mlJobs && mlJobs !== "not" ? mlJobs : jobReq) ?? "";
  const norm = raw.replace(/법사/g, "마법사").replace(/All|Beginner/g, "공용");
  if (!norm || norm.includes("공용")) return null;
  const set = new Set<string>();
  for (const j of norm.split(/[\/,·\s]+/)) if ((JOBS as readonly string[]).includes(j)) set.add(j);
  return set.size > 0 ? set : null;
}

export interface ItemTooltipProps {
  item: Item;
  nameKr: string | null;
  mapleland?: MaplelandItemStats | null;
}

export default function ItemTooltip({ item, nameKr, mapleland }: ItemTooltipProps) {
  const dbStats: Record<string, number> = (() => {
    try { return item.stats ? JSON.parse(item.stats) : {}; } catch { return {}; }
  })();
  const ml = mapleland && mapleland.source ? mapleland : null;

  // REQ — 메랜 요구 스탯 우선, 없으면 DB reqXXX
  const reqLev = ml?.level ?? item.level_req ?? 0;
  const req = (k: "STR" | "DEX" | "INT" | "LUK" | "POP") => ml?.req?.[k] ?? Number(dbStats[`req${k}`] ?? 0);
  const allowed = allowedJobs(item.job_req, ml?.jobs);

  // 옵션 줄 — 메랜 수치(범위 포함) 우선, 메랜에 없고 DB에만 있는 키(HP% 등)는 뒤에 덧붙인다
  type Line = { key: string; label: string; value: number; pct?: boolean; min?: number | null; max?: number | null; source: "ml" | "db" };
  const lines: Line[] = [];
  const seen = new Set<string>();
  if (ml?.stats) {
    for (const [label, r] of Object.entries(ml.stats)) {
      const key = LABEL_TO_KEY[label] ?? label;
      if (!r || !r.base) continue;
      lines.push({ key, label: KEY_LABEL[key] ?? label, value: r.base, min: r.min, max: r.max, source: "ml" });
      seen.add(key);
    }
  }
  for (const s of STAT_ORDER) {
    const v = Number(dbStats[s.key] ?? 0);
    if (!v || seen.has(s.key)) continue;
    // 메랜 DB가 다루는 14개 옵션인데 메랜 수치에 없음 → 원작에만 있는 줄: 툴팁엔 넣지 않고 아래 대조 박스에서 설명
    if (ml?.stats && Object.keys(ml.stats).length > 0 && ML_COVERED_KEYS.has(s.key)) continue;
    lines.push({ key: s.key, label: s.label, value: v, pct: s.pct, source: "db" });
  }
  const order = new Map(STAT_ORDER.map((s, i) => [s.key, i]));
  lines.sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));

  const category = ml?.subcategory ?? (item.subcategory ? toSubcategoryKr(item.subcategory) : null);
  const speed = attackSpeedLabel(ml?.attack_speed ?? item.attack_speed);
  const slots = item.upgrade_slots ?? null;
  const price = ml?.price ?? item.price ?? null;
  const isEquip = item.overall_category === "Equip" || /Weapon|Armor|Accessory/.test(item.category ?? "");

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="rounded-md border border-[#3a3f4b] bg-[#171a21] text-[#e6e6e6] shadow-[0_8px_30px_rgba(0,0,0,0.45)] px-5 py-4 font-medium leading-6">
        {/* 이름 */}
        <h1 className="text-center text-lg font-bold text-white tracking-tight">{nameKr ?? item.name}</h1>
        {nameKr && <p className="text-center text-[11px] text-[#8b93a3] -mt-0.5">{item.name}</p>}

        {/* 아이콘 + REQ */}
        <div className="mt-3 flex items-center gap-4">
          <div className="w-[88px] h-[88px] shrink-0 rounded border border-[#2a2e38] bg-[#0f1116] flex items-center justify-center">
            <img src={entityIconUrl("item", item.id)} alt="" className="w-16 h-16 object-contain [image-rendering:pixelated]" onError={hideIconOnError} />
          </div>
          <dl className="text-[13px] tabular-nums space-y-0.5">
            {(["LEV", "STR", "DEX", "INT", "LUK", "POP"] as const).map((k) => {
              const v = k === "LEV" ? reqLev : req(k as "STR");
              return (
                <div key={k} className="flex gap-2">
                  <dt className="text-[#9aa3b2] w-[74px]">REQ{k} :</dt>
                  <dd className={v > 0 ? "text-white" : "text-[#c9cdd6]"}>{v}</dd>
                </div>
              );
            })}
          </dl>
        </div>

        {/* 직업 — 착용 불가는 빨간색 */}
        {isEquip && (
          <p className="mt-3 flex flex-wrap justify-center gap-x-3 text-[13px]">
            {JOBS.map((j) => {
              const ok = allowed === null || allowed.has(j);
              return <span key={j} className={ok ? "text-white" : "text-[#ff5a5a]"}>{j}</span>;
            })}
          </p>
        )}

        <hr className="my-3 border-[#3a3f4b]" />

        {/* 옵션 */}
        <dl className="text-[13px] text-center space-y-0.5 tabular-nums">
          {category && <div><span className="text-[#9aa3b2]">장비분류 : </span><span className="text-white">{category}</span></div>}
          {lines.map((l) => (
            <div key={l.key}>
              <span className="text-[#9aa3b2]">{l.label} : </span>
              <span className="text-white">+{l.value}{l.pct ? "%" : ""}</span>
              {l.min != null && l.max != null && l.min !== l.max && (
                <span className="text-[11px] text-[#6f7786] ml-1">({l.min}~{l.max})</span>
              )}
            </div>
          ))}
          {speed && <div><span className="text-[#9aa3b2]">공격속도 : </span><span className="text-white">{speed}</span></div>}
          {slots != null && slots > 0 && <div><span className="text-[#9aa3b2]">업그레이드 가능 횟수 : </span><span className="text-white">{slots}</span></div>}
          {price != null && price > 0 && <div className="pt-1 text-[12px] text-[#8b93a3]">상점 판매가 {price.toLocaleString()} 메소</div>}
          {lines.length === 0 && !category && <div className="text-[#6f7786]">옵션 정보 없음</div>}
        </dl>
        {ml?.gender && ml.gender !== "공용" && <p className="mt-2 text-center text-[11px] text-[#8b93a3]">{ml.gender}성 전용</p>}
      </div>

      {/* 출처 */}
      <p className="mt-1.5 text-center text-[10px] text-dim">
        {ml ? (
          <>메이플랜드 현행 수치 · <a href={ml.source_url ?? "https://mapledb.kr"} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-maple">mapledb.kr</a>{ml.fetched_at ? ` (${ml.fetched_at.slice(0, 10)} 수집)` : ""} · 괄호는 획득 시 옵션 범위</>
        ) : (
          <>원작(GMS v92) 수치{mapleland?.override_note ? " + 메이플랜드 확인 옵션" : ""} · 메랜 현행 DB 미등록 아이템</>
        )}
      </p>
    </div>
  );
}

/** 메랜 수치와 원작(items.stats)이 다른 옵션 목록 */
export function MaplelandDiffBox({ mapleland }: { mapleland: MaplelandItemStats | null | undefined }) {
  if (!mapleland) return null;
  const diff = mapleland.diff ?? [];
  if (diff.length === 0 && !mapleland.override_note) return null;
  return (
    <div className="mt-4 border-2 border-amber-300/70 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/25 px-4 py-3 text-xs space-y-1.5">
      <p className="font-pixel text-[11px] text-ink">ⓘ 원작과 다른 옵션</p>
      {diff.length > 0 && (
        <ul className="space-y-0.5">
          {diff.map((d) => (
            <li key={d.key} className="flex flex-wrap gap-x-2">
              <span className="text-dim w-20 shrink-0">{KEY_LABEL[d.key] ?? d.key}</span>
              <span>메랜 <b className="text-maple">{d.mapleland === 0 ? "없음" : `+${d.mapleland}`}</b></span>
              <span className="text-dim">/ 원작(GMS v92) {d.original === 0 ? "없음" : `+${d.original}`}</span>
            </li>
          ))}
        </ul>
      )}
      {mapleland.override_note && <p className="text-dim leading-relaxed">{mapleland.override_note}</p>}
      {diff.length > 0 && <p className="text-[10px] text-dim">툴팁은 메이플랜드 수치를 표시합니다. 원작값은 maplestory.io GMS v92 크롤 기준입니다.</p>}
    </div>
  );
}
