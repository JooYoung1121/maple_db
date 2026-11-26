"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CHARLIE_MATERIALS,
  CHARLIE_NEED_PER_EXCHANGE,
  CHARLIE_EXP_PER_EXCHANGE,
  DEFAULT_SCROLL_PCT,
  DEFAULT_RARE_PCT,
  NPC_PRICE,
  type CharlieMaterial,
  type CharlieReward,
} from "@/lib/charlieExchange";


const icon = (id: number) => `https://maplestory.io/api/gms/92/item/${id}/icon`;

function fmtMeso(n: number): string {
  if (!Number.isFinite(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(2)}억`;
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(1)}만`;
  return `${sign}${abs.toLocaleString()}`;
}

/** 보상별 확률(%) 계산 — 어금니는 실측값, 나머지는 그룹 추정 모델 */
function rewardProbs(m: CharlieMaterial, scrollPct: number, rarePct: number): number[] {
  if (m.hasMeasured) {
    return m.rewards.map((rw) => rw.measured ?? 0);
  }
  const scrolls = m.rewards.filter((rw) => rw.group === "scroll").length;
  const rares = m.rewards.filter((rw) => rw.group === "rare").length;
  const commons = m.rewards.filter((rw) => rw.group === "common").length;
  const remain = Math.max(0, 100 - scrolls * scrollPct - rares * rarePct);
  const commonEach = commons > 0 ? remain / commons : 0;
  return m.rewards.map((rw) =>
    rw.group === "scroll" ? scrollPct : rw.group === "rare" ? rarePct : commonEach
  );
}

export default function CharliePage() {
  const [overrides, setOverrides] = useState<Record<number, string>>({}); // 재료 매입가 수동 입력
  const [scrollPct, setScrollPct] = useState(DEFAULT_SCROLL_PCT);
  const [rarePct, setRarePct] = useState(DEFAULT_RARE_PCT);
  const [open, setOpen] = useState<number | null>(null);
  const [sortByEff, setSortByEff] = useState(true);

  /** NPC 판매 가격. 재료 매입가는 직접 입력한다. */
  const priceInfo = (id: number | null): [number | null, "market" | "npc" | null] => {
    if (id == null) return [null, null];
    if (NPC_PRICE[id] != null) return [NPC_PRICE[id], "npc"];
    return [null, null];
  };
  const priceOf = (id: number | null): number | null => priceInfo(id)[0];

  const materialCost = (m: CharlieMaterial): number | null => {
    const ov = overrides[m.itemId];
    if (ov !== undefined && ov !== "") return Number(ov.replace(/[,\s]/g, "")) || 0;
    return priceOf(m.itemId);
  };

  const rows = useMemo(() => {
    return CHARLIE_MATERIALS.map((m) => {
      const probs = rewardProbs(m, scrollPct, rarePct);
      let ev = 0;
      let missing = 0;
      m.rewards.forEach((rw, i) => {
        const p = priceOf(rw.itemId);
        if (p == null) { missing += 1; return; }
        ev += (probs[i] / 100) * rw.qty * p;
      });
      const unit = materialCost(m);
      const cost = unit != null ? unit * CHARLIE_NEED_PER_EXCHANGE : null;
      const net = cost != null ? ev - cost : null;
      return { m, probs, ev, cost, unit, net, missing };
    }).sort((a, b) => {
      if (!sortByEff) return 0;
      const av = a.net ?? -Infinity;
      const bv = b.net ?? -Infinity;
      return bv - av;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides, scrollPct, rarePct, sortByEff]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 font-pixel">🪖 찰리중사 교환</h1>
      <p className="text-dim mb-4 text-sm">
        오르비스 마을 무기상점 위의 찰리중사에게 전리품 <b className="text-ink">{CHARLIE_NEED_PER_EXCHANGE}개</b>를 주면
        경험치 <b className="text-ink">{CHARLIE_EXP_PER_EXCHANGE}</b>과 보상 1종을 랜덤으로 받습니다. 레벨 제한 없음 · 무한 반복 가능.
      </p>

      {/* 확률 모델 설정 */}
      <div className="pixel-panel p-3 mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="font-pixel text-xs text-ink">확률 가정</span>
        <label className="flex items-center gap-1.5 text-xs text-dim">
          주문서
          <input type="number" step={0.1} min={0} max={10} value={scrollPct}
            onChange={(e) => setScrollPct(Math.max(0, Math.min(10, Number(e.target.value))))}
            className="pixel-input w-16 px-1.5 py-1 text-center" />%
        </label>
        <label className="flex items-center gap-1.5 text-xs text-dim">
          희귀템(날개·표창 등)
          <input type="number" step={0.1} min={0} max={10} value={rarePct}
            onChange={(e) => setRarePct(Math.max(0, Math.min(10, Number(e.target.value))))}
            className="pixel-input w-16 px-1.5 py-1 text-center" />%
        </label>
        <span className="text-[11px] text-dim">
          나머지 확률은 일반 보상이 균등 분배 · 어금니는 158회 실측값 고정(★) · 주문서 0.63%는 실측 기반
        </span>
      </div>

      {/* 시세 상태 */}
      <div className="flex items-center justify-between mb-2 text-[11px] text-dim">
        <span>
          외부 시세 연동 종료 — 재료 매입가는 직접 입력해 주세요. 보상은 NPC 판매가 기준입니다.
        </span>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={sortByEff} onChange={(e) => setSortByEff(e.target.checked)} />
          효율순 정렬
        </label>
      </div>

      {/* 재료 테이블 */}
      <div className="space-y-1.5 mb-6">
        {rows.map(({ m, probs, ev, cost, unit, net, missing }) => {
          const isOpen = open === m.itemId;
          return (
            <div key={m.itemId} className="pixel-card">
              <button onClick={() => setOpen(isOpen ? null : m.itemId)} className="w-full text-left p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <img src={icon(m.itemId)} alt="" className="w-7 h-7 object-contain shrink-0" />
                  <span className="font-medium text-ink">{m.name}</span>
                  {m.hasMeasured && <span className="font-pixel text-[10px] px-1 py-0.5 bg-maple text-white">★ 실측</span>}
                  <span className="ml-auto flex items-center gap-3 text-xs">
                    <span className="text-dim hidden sm:inline">
                      비용 {cost != null ? fmtMeso(cost) : "시세없음"}
                    </span>
                    <span className="text-dim hidden sm:inline">기대 {fmtMeso(ev)}</span>
                    <span className={`font-pixel ${net == null ? "text-dim" : net >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {net == null ? "-" : `${net >= 0 ? "+" : ""}${fmtMeso(net)}/회`}
                    </span>
                    <span className="text-dim">{isOpen ? "▲" : "▼"}</span>
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 border-t-2 border-edge/40 pt-2.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-dim mb-2.5">
                    <Link href={`/items/${m.itemId}`} className="text-maple hover:underline">
                      드랍 몬스터 · 아이템 정보 보기 →
                    </Link>
                    <label className="flex items-center gap-1.5">
                      재료 1개 매입가
                      <input
                        inputMode="numeric"
                        value={overrides[m.itemId] ?? (unit != null ? String(Math.round(unit)) : "")}
                        placeholder="시세없음"
                        onChange={(e) => setOverrides({ ...overrides, [m.itemId]: e.target.value })}
                        className="pixel-input w-24 px-1.5 py-1 text-right"
                      />
                      메소
                    </label>
                    <span>교환 1회 = {CHARLIE_NEED_PER_EXCHANGE}개 {cost != null ? `= ${fmtMeso(cost)}` : ""} + 경험치 {CHARLIE_EXP_PER_EXCHANGE}</span>
                    {net != null && net < 0 && (
                      <span>1,000 경험치당 순비용 ≈ <b className="text-ink">{fmtMeso(-net * (1000 / CHARLIE_EXP_PER_EXCHANGE))}</b></span>
                    )}
                    {net != null && net >= 0 && <span className="text-green-600">교환만으로 이득 + 경험치는 덤</span>}
                  </div>

                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        {["보상", "수량", "확률", "개당 시세", "기대값"].map((h) => (
                          <th key={h} className="font-pixel text-[11px] text-dim text-left px-2 py-1.5 border-b-2 border-edge">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {m.rewards.map((rw: CharlieReward, i) => {
                        const p = priceOf(rw.itemId);
                        const contrib = p != null ? (probs[i] / 100) * rw.qty * p : null;
                        return (
                          <tr key={i} className="border-b border-edge/30">
                            <td className="px-2 py-1.5">
                              <span className="flex items-center gap-1.5">
                                {rw.itemId && <img src={icon(rw.itemId)} alt="" className="w-5 h-5 object-contain" />}
                                {rw.itemId ? (
                                  <Link href={`/items/${rw.itemId}`} className="text-ink hover:text-maple">{rw.name}</Link>
                                ) : (
                                  <span className="text-ink">{rw.name} <span className="text-[10px] text-dim">(ID 미확인)</span></span>
                                )}
                                {rw.group === "scroll" && <span className="font-pixel text-[9px] px-1 bg-surface2 border border-edge text-dim">주문서</span>}
                                {rw.group === "rare" && <span className="font-pixel text-[9px] px-1 bg-surface2 border border-edge text-maple">희귀</span>}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-dim">{rw.qty}개</td>
                            <td className="px-2 py-1.5">
                              <span className={rw.measured != null ? "text-maple font-medium" : "text-dim"}>
                                {probs[i].toFixed(2)}%{rw.measured != null ? " ★" : ""}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-dim">
                              {p != null ? fmtMeso(p) : "-"}
                              {priceInfo(rw.itemId)[1] === "npc" && <span className="text-[9px] ml-0.5">(NPC)</span>}
                            </td>
                            <td className="px-2 py-1.5 text-ink">{contrib != null ? fmtMeso(contrib) : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {missing > 0 && (
                    <p className="text-[10px] text-dim mt-1.5">
                      ※ 시세 없는 보상 {missing}종은 기대값 0으로 계산됨 (실제 기대값은 이보다 높음)
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 출처·주의 */}
      <div className="pixel-panel p-4 text-[11px] text-dim leading-relaxed space-y-1">
        <p className="font-pixel text-xs text-ink mb-1">📎 출처 · 주의사항</p>
        <p>
          · 교환 테이블: <a href="https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=709953" target="_blank" rel="noopener noreferrer" className="text-maple hover:underline">디시 메랜갤 교환템 목록 ↗</a>
          {" "}· 확률 실측: <a href="https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=729938" target="_blank" rel="noopener noreferrer" className="text-maple hover:underline">어금니 15,800개(158회) 실측 분석 ↗</a>
        </p>
        <p>· 어금니 외 재료의 확률은 미실측 — 위 실측 패턴(일반 보상 균등 + 주문서 0.63%)을 가정한 추정치입니다. 상단에서 가정을 조정하세요.</p>
        <p>· 정리 시점이 1.0(2024-01) 기준이라 2.0에서 보상·확률이 다를 수 있습니다. 실측 제보는 길드 디스코드로!</p>
        <p>· 보상은 <b>NPC 판매가</b> 기준으로 계산합니다. 가격 정보가 없는 보상은 기대값에서 빠지며, 재료 매입가는 직접 입력해 주세요.</p>
      </div>
    </div>
  );
}
