"use client";

/* 인게임 아이템 툴팁 — 메이플랜드에서 장비에 마우스를 올렸을 때 보이는 창을 재현한다 (v4.16.0 · v4.17.0 다중 출처).
 *
 * 수치는 상세 API 가 출처별 수치(item_source_stats: 메팁 · 로그지지 · mapledb 2024 스냅샷)와 운영자 인게임 확인(오버라이드)을
 * 우선순위로 병합한 결과(item.mapleland)를 그대로 그린다. 출처끼리 값이 다른 줄은 ※ 로 표시하고 아래 박스에 출처별 값을 적는다.
 * 어떤 출처도 모르는 아이템은 items.stats(GMS v92 원작 + 오버라이드)로 그린다. */

import type { Item, MaplelandItemStats } from "@/lib/types";
import { entityIconUrl, hideIconOnError } from "@/lib/icons";
import { toSubcategoryKr } from "@/lib/translations";

const JOBS = ["초보자", "전사", "마법사", "궁수", "도적", "해적"] as const;

/* 옵션 표시 순서 (인게임 순서: 스탯 → HP/MP → 공/마 → 방어 → 명중/회피 → 이속/점프) */
const STAT_ORDER: { key: string; label: string; pct?: boolean }[] = [
  { key: "incSTR", label: "STR" }, { key: "incDEX", label: "DEX" }, { key: "incINT", label: "INT" }, { key: "incLUK", label: "LUK" },
  { key: "incMHP", label: "최대 HP" }, { key: "incMMP", label: "최대 MP" },
  { key: "incMHPr", label: "최대 HP", pct: true }, { key: "incMMPr", label: "최대 MP", pct: true },
  { key: "incPAD", label: "공격력" }, { key: "incMAD", label: "마력" },
  { key: "incPDD", label: "물리방어력" }, { key: "incMDD", label: "마법방어력" },
  { key: "incACC", label: "명중률" }, { key: "incEVA", label: "회피율" },
  { key: "incSpeed", label: "이동속도" }, { key: "incJump", label: "점프력" },
];
const STAT_META = new Map(STAT_ORDER.map((s) => [s.key, s]));
export const KEY_LABEL: Record<string, string> = Object.fromEntries(STAT_ORDER.map((s) => [s.key, s.label + (s.pct ? "(%)" : "")]));
KEY_LABEL.level_req = "REQ LEV";

const SOURCE_SHORT: Record<string, string> = { override: "인게임 확인", matip: "메팁", maplelog: "로그지지", mapledb: "mapledb(2024)", gms92: "원작 GMS v92" };
const ATTACK_SPEED: Record<string, string> = { "2": "매우 빠름", "3": "빠름", "4": "빠름", "5": "보통", "6": "보통", "7": "느림", "8": "느림", "9": "매우 느림" };

function attackSpeedLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return ATTACK_SPEED[s] ?? s; // 이미 한글이면 그대로
}

/** DB job_req("전사/도적") → 착용 가능 직업 집합 (null = 전 직업) */
function allowedFromText(jobReq: string | null | undefined): Set<string> | null {
  const norm = (jobReq ?? "").replace(/법사/g, "마법사").replace(/All|Beginner/g, "공용");
  if (!norm || norm.includes("공용")) return null;
  const set = new Set<string>();
  for (const j of norm.split(/[\/,·\s]+/)) if ((JOBS as readonly string[]).includes(j)) set.add(j);
  return set.size > 0 ? set : null;
}

function fmt(v: number, pct?: boolean) { return `${v > 0 ? "+" : ""}${v}${pct ? "%" : ""}`; }

export function sourceShort(src: string, ml?: MaplelandItemStats | null): string {
  return ml?.source_meta?.[src]?.short ?? SOURCE_SHORT[src] ?? src;
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
  const ml = mapleland && Array.isArray(mapleland.stats) ? mapleland : null;

  // REQ — 병합 수치 우선, 없으면 DB reqXXX
  const reqLev = ml?.level ?? item.level_req ?? 0;
  const req = (k: "STR" | "DEX" | "INT" | "LUK" | "POP") =>
    ml?.req && Object.keys(ml.req).length > 0 ? (ml.req[k] ?? 0) : Number(dbStats[`req${k}`] ?? 0);
  const allowed: Set<string> | null = ml?.jobs_known ? (ml.jobs ? new Set(ml.jobs) : null) : allowedFromText(item.job_req);

  // 옵션 줄
  type Line = { key: string; label: string; value: number; pct?: boolean; min?: number | null; max?: number | null; conflict: boolean; source: string };
  let lines: Line[];
  if (ml) {
    lines = ml.stats!.map((s) => {
      const meta = STAT_META.get(s.key);
      return { key: s.key, label: meta?.label ?? s.key, value: s.value, pct: meta?.pct, min: s.min, max: s.max, conflict: s.conflict, source: s.source };
    });
  } else {
    lines = STAT_ORDER.flatMap((s) => {
      const v = Number(dbStats[s.key] ?? 0);
      return v ? [{ key: s.key, label: s.label, value: v, pct: s.pct, conflict: false, source: "gms92" }] : [];
    });
  }
  const order = new Map(STAT_ORDER.map((s, i) => [s.key, i]));
  lines.sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));

  const category = ml?.subcategory ?? (item.subcategory ? toSubcategoryKr(item.subcategory) : null);
  const speed = attackSpeedLabel(ml?.attack_speed ?? item.attack_speed);
  const slots = ml?.tuc ?? item.upgrade_slots ?? null;
  const price = ml?.price ?? item.price ?? null;
  const isEquip = item.overall_category
    ? item.overall_category === "Equip"
    : /Weapon|Armor|Accessory/.test(item.category ?? "") && !/Scroll/.test(item.category ?? "");
  const hasConflict = lines.some((l) => l.conflict) || !!ml?.level_conflict || !!ml?.job_conflict;
  const sources = ml?.sources_used ?? [];

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
          {isEquip && <dl className="text-[13px] tabular-nums space-y-0.5">
            {(["LEV", "STR", "DEX", "INT", "LUK", "POP"] as const).map((k) => {
              const v = k === "LEV" ? reqLev : req(k as "STR");
              return (
                <div key={k} className="flex gap-2">
                  <dt className="text-[#9aa3b2] w-[74px]">REQ{k} :</dt>
                  <dd className={v > 0 ? "text-white" : "text-[#c9cdd6]"}>
                    {v}{k === "LEV" && ml?.level_conflict && <sup className="text-amber-400 ml-0.5">※</sup>}
                  </dd>
                </div>
              );
            })}
          </dl>}
          {!isEquip && ml?.description && <p className="text-[12px] text-[#c9cdd6] leading-5">{ml.description}</p>}
        </div>

        {/* 직업 — 착용 불가는 빨간색 */}
        {isEquip && (
          <p className="mt-3 flex flex-wrap justify-center gap-x-3 text-[13px]">
            {JOBS.map((j) => {
              const ok = allowed === null || allowed.has(j);
              return <span key={j} className={ok ? "text-white" : "text-[#ff5a5a]"}>{j}</span>;
            })}
            {ml?.job_conflict && <sup className="text-amber-400">※</sup>}
          </p>
        )}

        <hr className="my-3 border-[#3a3f4b]" />

        {/* 옵션 */}
        <dl className="text-[13px] text-center space-y-0.5 tabular-nums">
          {category && <div><span className="text-[#9aa3b2]">장비분류 : </span><span className="text-white">{category}</span></div>}
          {lines.map((l) => (
            <div key={l.key}>
              <span className="text-[#9aa3b2]">{l.label} : </span>
              <span className="text-white">{fmt(l.value, l.pct)}</span>
              {l.min != null && l.max != null && l.min !== l.max && (
                <span className="text-[11px] text-[#6f7786] ml-1">({l.min}~{l.max})</span>
              )}
              {l.conflict && <sup className="text-amber-400 ml-0.5" title="출처별로 값이 다릅니다">※</sup>}
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
      <p className="mt-1.5 text-center text-[10px] text-dim leading-relaxed">
        {ml ? (
          <>
            메이플랜드 현행 수치 · 출처{" "}
            {sources.map((s, i) => {
              const meta = ml.source_meta?.[s];
              const label = sourceShort(s, ml);
              return (
                <span key={s}>
                  {i > 0 && " · "}
                  {meta?.url ? <a href={meta.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-maple">{label}</a> : label}
                </span>
              );
            })}
            {lines.some((l) => l.min != null) && " · 괄호는 획득 시 옵션 범위"}
            {hasConflict && <> · <span className="text-amber-600 dark:text-amber-400">※ 출처별 값이 다름(아래 참고)</span></>}
          </>
        ) : (
          <>원작(GMS v92) 수치{mapleland?.override_note ? " + 메이플랜드 인게임 확인 옵션" : ""} · 메팁·로그지지 DB 미등록 아이템</>
        )}
      </p>
    </div>
  );
}

/** 출처별로 다른 옵션 · 원작과 다른 옵션 · 운영자 메모 */
export function MaplelandDiffBox({ mapleland }: { mapleland: MaplelandItemStats | null | undefined }) {
  if (!mapleland) return null;
  const ml = Array.isArray(mapleland.stats) ? mapleland : null;
  const conflicts = ml?.conflicts ?? [];
  const diff = ml?.diff ?? [];
  const notes = ml?.notes ?? {};
  const noteEntries = Object.entries(notes).filter(([s]) => s !== "override");
  const primary = ml?.primary;
  const lineSource = new Map((ml?.stats ?? []).map((s) => [s.key, s.source]));
  if (conflicts.length === 0 && diff.length === 0 && !ml?.level_conflict && !ml?.job_conflict && !mapleland.override_note && noteEntries.length === 0) return null;

  const fmtV = (key: string, v: number) => (v === 0 ? "없음" : `${v > 0 ? "+" : ""}${v}${/r$/.test(key) ? "%" : ""}`);

  return (
    <div className="mt-4 border-2 border-amber-300/70 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/25 px-4 py-3 text-xs space-y-2">
      {(conflicts.length > 0 || ml?.level_conflict || ml?.job_conflict) && (
        <div>
          <p className="font-pixel text-[11px] text-ink">※ 출처별로 다른 옵션</p>
          <ul className="mt-1 space-y-0.5">
            {ml?.level_conflict && (
              <li className="flex flex-wrap gap-x-2">
                <span className="text-dim w-20 shrink-0">REQ LEV</span>
                {Object.entries(ml.level_conflict).map(([s, v]) => (
                  <span key={s} className={s === primary ? "font-semibold text-maple" : ""}>{sourceShort(s, ml)} {v}</span>
                ))}
              </li>
            )}
            {ml?.job_conflict && (
              <li className="flex flex-wrap gap-x-2">
                <span className="text-dim w-20 shrink-0">직업</span>
                {Object.entries(ml.job_conflict).map(([s, v]) => (
                  <span key={s} className={s === primary ? "font-semibold text-maple" : ""}>{sourceShort(s, ml)} {v && v.length > 0 ? v.join("·") : "공용"}</span>
                ))}
              </li>
            )}
            {conflicts.map((c) => (
              <li key={c.key} className="flex flex-wrap gap-x-2">
                <span className="text-dim w-20 shrink-0">{KEY_LABEL[c.key] ?? c.key}</span>
                {Object.entries(c.values).map(([s, v]) => (
                  <span key={s} className={s === lineSource.get(c.key) ? "font-semibold text-maple" : ""}>{sourceShort(s, ml)} {fmtV(c.key, v)}</span>
                ))}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-dim">툴팁은 인게임 확인 › 메팁 › 로그지지 › mapledb(2024 스냅샷) 순으로 고른 값(굵게)입니다. 인게임에서 확인되면 오버라이드로 확정합니다.</p>
        </div>
      )}
      {diff.length > 0 && (
        <div>
          <p className="font-pixel text-[11px] text-ink">ⓘ 원작과 다른 옵션</p>
          <ul className="mt-1 space-y-0.5">
            {diff.map((d) => (
              <li key={d.key} className="flex flex-wrap gap-x-2">
                <span className="text-dim w-20 shrink-0">{KEY_LABEL[d.key] ?? d.key}</span>
                <span>메랜 <b className="text-maple">{fmtV(d.key, d.mapleland)}</b></span>
                <span className="text-dim">/ 원작(GMS v92) {fmtV(d.key, d.original)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {mapleland.override_note && <p className="text-dim leading-relaxed">{mapleland.override_note}</p>}
      {noteEntries.map(([s, n]) => (
        <p key={s} className="text-[10px] text-dim leading-relaxed">{sourceShort(s, ml)} 메모: {n}</p>
      ))}
    </div>
  );
}
