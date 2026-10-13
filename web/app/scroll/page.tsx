"use client";

import Link from "next/link";
import PageGuide from "@/components/PageGuide";
import { SCROLL_GUIDE } from "@/lib/pageGuides";
import { useState, useMemo } from "react";
import {
  SCROLL_TYPES, WEAPON_SLOTS, SCROLL_STATS,
  binomialProb, binomialCDF, pctTheme, scrollIconUrl, hideOnError,
} from "@/lib/scrollData";

// ─── 탭 타입 ───
// 시뮬레이션·랭킹은 v4.13.0에서 시뮬레이터 메뉴의 /scroll-sim 으로 분리됐다.
type Tab = "calc" | "ref";

export default function ScrollPage() {
  const [activeTab, setActiveTab] = useState<Tab>("calc");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold font-pixel">주문서 확률 계산기</h1>
        <PageGuide guide={SCROLL_GUIDE} />
      </div>
      <p className="text-sm text-dim mb-4">
        주문서 성공 확률 계산과 장비별 주문서 스탯 참고표
      </p>

      {/* 시뮬레이터 이동 안내 */}
      <Link
        href="/scroll-sim"
        className="pixel-panel flex items-center gap-3 px-4 py-3 mb-6 hover:border-maple transition-colors group"
      >
        <span className="text-2xl shrink-0" aria-hidden>🎲</span>
        <span className="min-w-0 flex-1">
          <span className="block font-pixel text-sm text-ink group-hover:text-maple">직접 발라보는 시뮬레이션과 랭킹은 <b>주문서 시뮬레이터</b>로 옮겼습니다</span>
          <span className="block text-xs text-dim mt-0.5">연출 무대에서 한 장씩 바르고, 몇 트에 뭐가 나왔는지 기록이 쌓입니다 → 시뮬레이터 메뉴 · 주문서 시뮬레이터</span>
        </span>
        <span className="text-dim group-hover:text-maple shrink-0">→</span>
      </Link>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-surface2 p-1 w-fit">
        {([
          { key: "calc" as Tab, label: "확률 계산" },
          { key: "ref" as Tab, label: "주문서 스탯표" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === t.key
                ? "pixel-btn"
                : "font-pixel text-dim hover:text-maple"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "calc" && <CalcTab />}
      {activeTab === "ref" && <RefTab />}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  확률 계산 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CalcTab() {
  const [slots, setSlots] = useState(7);
  const [scrollPct, setScrollPct] = useState(60);
  const [weaponType, setWeaponType] = useState("");

  const p = scrollPct / 100;

  // 무기 선택 시 슬롯 자동 설정
  const handleWeaponChange = (wt: string) => {
    setWeaponType(wt);
    if (wt && WEAPON_SLOTS[wt]) {
      setSlots(WEAPON_SLOTS[wt]);
    }
  };

  const rows = useMemo(() => {
    const result = [];
    for (let k = 0; k <= slots; k++) {
      const exact = binomialProb(slots, k, p);
      const atLeast = binomialCDF(slots, k, p);
      result.push({ k, exact, atLeast });
    }
    return result;
  }, [slots, p]);

  // 기대값
  const expected = slots * p;

  return (
    <div className="space-y-6">
      {/* 설정 */}
      <div className="pixel-panel p-5">
        <h2 className="font-bold text-lg mb-4 font-pixel">설정</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-dim mb-1">장비 종류</label>
            <select
              value={weaponType}
              onChange={(e) => handleWeaponChange(e.target.value)}
              className="w-full px-3 py-2 pixel-input text-sm"
            >
              <option value="">직접 입력</option>
              {Object.entries(WEAPON_SLOTS).map(([name, s]) => (
                <option key={name} value={name}>
                  {name} ({s}칸)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-dim mb-1">
              업그레이드 횟수 (슬롯)
            </label>
            <input
              type="number"
              min={1}
              max={15}
              value={slots}
              onChange={(e) => {
                setSlots(Math.max(1, Math.min(15, Number(e.target.value))));
                setWeaponType("");
              }}
              className="w-full px-3 py-2 pixel-input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-dim mb-1">주문서 확률</label>
            <div className="flex gap-1.5 flex-wrap">
              {SCROLL_TYPES.map((s) => {
                const active = scrollPct === s.pct;
                const th = pctTheme(s.pct);
                return (
                  <button
                    key={s.pct}
                    onClick={() => setScrollPct(s.pct)}
                    className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 border-2 transition-colors ${
                      active ? `${th.ring} ${th.bg}` : "border-edge bg-surface2 hover:border-maple/60"
                    }`}
                  >
                    <img
                      src={scrollIconUrl(s.pct)}
                      alt=""
                      onError={hideOnError}
                      className="w-6 h-6 object-contain [image-rendering:pixelated]"
                    />
                    <span className={`font-pixel text-[11px] ${active ? th.text : "text-dim"}`}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="업그레이드 횟수" value={`${slots}칸`} />
        <SummaryCard label="주문서 확률" value={`${scrollPct}%`} />
        <SummaryCard label="기대 성공 횟수" value={`${expected.toFixed(1)}회`} />
        <SummaryCard
          label="올작 확률"
          value={`${(binomialProb(slots, slots, p) * 100).toFixed(
            binomialProb(slots, slots, p) * 100 < 0.01 ? 4 : 2
          )}%`}
          highlight
        />
      </div>

      {/* 확률 테이블 */}
      <div className="pixel-panel overflow-hidden">
        <div className="px-5 py-3 border-b-2 border-edge">
          <h2 className="font-bold font-pixel">성공 횟수별 확률</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface2 text-dim">
                <th className="text-left px-5 py-2.5 font-medium">성공 횟수</th>
                <th className="text-right px-5 py-2.5 font-medium">정확히 N작 확률</th>
                <th className="text-right px-5 py-2.5 font-medium">N작 이상 확률</th>
                <th className="px-5 py-2.5 font-medium text-left">확률 바</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.k}
                  className={`border-t border-edge/40 ${
                    r.k === slots ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]" : ""
                  }`}
                >
                  <td className="px-5 py-2.5 font-medium">
                    {r.k}작{" "}
                    {r.k === slots && (
                      <span className="text-xs text-maple ml-1">올작</span>
                    )}
                    {r.k === 0 && (
                      <span className="text-xs text-red-400 ml-1">꽝</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">
                    {formatPct(r.exact)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">
                    {formatPct(r.atLeast)}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="h-4 bg-surface2 rounded-full overflow-hidden w-full max-w-[200px]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          r.k === slots ? "bg-maple" : "bg-blue-400"
                        }`}
                        style={{ width: `${Math.max(r.exact * 100, 0.5)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 ${
        highlight
          ? "border-2 border-maple bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]"
          : "pixel-panel"
      }`}
    >
      <p className="text-xs text-dim mb-1">{label}</p>
      <p
        className={`text-lg font-bold ${
          highlight ? "text-maple" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatPct(v: number): string {
  const pct = v * 100;
  if (pct === 0) return "0%";
  if (pct === 100) return "100%";
  if (pct < 0.01) return `${pct.toFixed(4)}%`;
  if (pct < 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(2)}%`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  주문서 스탯 참고표 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RefTab() {
  return (
    <div className="space-y-6">
      <div className="pixel-panel p-5">
        <h2 className="font-bold text-lg mb-1 font-pixel">주문서 확률별 설명</h2>
        <p className="text-sm text-dim mb-4">
          각 확률별 주문서의 특성을 비교해보세요
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCROLL_TYPES.map((s) => {
            const th = pctTheme(s.pct);
            return (
              <div key={s.pct} className={`p-4 border-2 flex items-center gap-3 ${th.ring} ${th.bg}`}>
                <img
                  src={scrollIconUrl(s.pct)}
                  alt=""
                  onError={hideOnError}
                  className="w-10 h-10 object-contain [image-rendering:pixelated] shrink-0"
                />
                <div>
                  <p className={`text-xl font-bold mb-0.5 ${th.text}`}>{s.label}</p>
                  <p className="text-sm text-dim">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 장비별 업그레이드 횟수 */}
      <div className="pixel-panel overflow-hidden">
        <div className="px-5 py-3 border-b-2 border-edge">
          <h2 className="font-bold">장비별 업그레이드 횟수</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface2 text-dim">
                <th className="text-left px-5 py-2.5 font-medium">장비</th>
                <th className="text-right px-5 py-2.5 font-medium">업그레이드 횟수</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(WEAPON_SLOTS).map(([name, s]) => (
                <tr key={name} className="border-t border-edge/40">
                  <td className="px-5 py-2">{name}</td>
                  <td className="px-5 py-2 text-right font-mono">{s}칸</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 주문서 스탯표 */}
      {SCROLL_STATS.map((cat) => (
        <div
          key={cat.category}
          className="pixel-panel overflow-hidden"
        >
          <div className="px-5 py-3 border-b-2 border-edge">
            <h2 className="font-bold">{cat.category}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface2 text-dim">
                  <th className="text-left px-5 py-2.5 font-medium">주문서</th>
                  {SCROLL_TYPES.map((s) => (
                    <th key={s.pct} className="px-3 py-2.5 font-medium">
                      <span className="flex flex-col items-center gap-0.5">
                        <img src={scrollIconUrl(s.pct)} alt="" onError={hideOnError} className="w-5 h-5 object-contain [image-rendering:pixelated]" />
                        {s.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cat.items.map((item) => (
                  <tr key={item.name} className="border-t border-edge/40">
                    <td className="px-5 py-2 font-medium">{item.name}</td>
                    {SCROLL_TYPES.map((s) => (
                      <td key={s.pct} className="text-center px-3 py-2 font-mono">
                        {item.stats[s.pct] || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
