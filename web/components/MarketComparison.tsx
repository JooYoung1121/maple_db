"use client";

import { useEffect, useId, useRef, useState } from "react";
import { entityIconUrl, hideIconOnError } from "@/lib/icons";
import { STAT_LABELS, FEE_SOURCE, money, meso, statValue, statDelta, incrementalCost, replacementCost,
  applicationFee, gemEligibility, projectGemOptions, sameFinalOptions, gemCost,
  type ComparedListing, type Listing, type MarketGem } from "@/lib/marketComparison";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const INPUT = "w-full rounded border border-edge bg-surface px-2 py-2 text-sm text-ink";
const STAT_CHOICES = Object.entries(STAT_LABELS).filter(([key]) => key !== "requiredLevelAdjustment");
function deltaText(value: number | null) { return value === null ? "미확인" : `${value > 0 ? "+" : ""}${value}`; }
function at(value: string) { return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }); }
function optionName(item: ComparedListing, index: number) { return `${String.fromCharCode(65 + index)}. ${item.name} · ${meso(money(item.unitPrice))}`; }

function MoneyInput({ label, value, onChange, placeholder = "메소 입력" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block space-y-1 text-xs text-dim">{label}<input className={INPUT} value={value} inputMode="numeric" maxLength={19}
    onChange={e => onChange(e.target.value.replace(/\D/g, ""))} placeholder={placeholder} /></label>;
}
function efficiency(base: ComparedListing, candidate: ComparedListing, stat: string) {
  if (base.key === candidate.key) return "기준 매물";
  const result = incrementalCost(base, candidate, stat);
  if (!result) return "옵션 미확인";
  if (result.delta <= 0) return result.delta === 0 ? "선택 스탯 차이 없음" : "선택 스탯 감소";
  if (result.extra < BigInt(0)) return `스탯 증가 · ${meso(-result.extra)} 저렴`;
  if (result.extra === BigInt(0)) return "같은 가격에 스탯 증가";
  return `약 ${meso(result.perPoint)} / +1`;
}

export default function MarketComparison({ items, open, onClose, onRemove }: {
  items: ComparedListing[]; open: boolean; onClose: () => void; onRemove: (key: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [tab, setTab] = useState<"compare" | "replace" | "gems">("compare");
  const [baseKey, setBaseKey] = useState("");
  const [stat, setStat] = useState("dexterity");
  const [netSale, setNetSale] = useState("");
  const [extraCost, setExtraCost] = useState("0");
  const [currentStat, setCurrentStat] = useState("");
  const base = items.find(x => x.key === baseKey) ?? items[0];
  useEffect(() => {
    const node = dialog.current;
    if (open && node && !node.open) node.showModal();
    if (!open && node?.open) node.close();
  }, [open]);
  const statKeys = Object.keys(STAT_LABELS).filter(key => key === stat || items.some(item => (statValue(item, key) ?? 0) !== 0));

  return <dialog ref={dialog} aria-labelledby={heading} onClose={onClose} onCancel={onClose}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    className="m-auto max-h-[90dvh] w-[min(1100px,95vw)] max-w-none overflow-y-auto rounded-lg border-2 border-edge bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50">
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id={heading} className="font-pixel text-lg font-bold">매물 비교 <span className="text-sm text-dim">{items.length}/5</span></h2>
        <button type="button" onClick={onClose} className="pixel-btn px-3 py-1.5" aria-label="비교 창 닫기">닫기</button>
      </div>
      <p className="mt-2 text-xs text-dim">담은 시점의 가격입니다. 검색을 바꿔도 목록은 유지됩니다. 비교 계산은 추가 조회 없이 진행됩니다.</p>
      <div className="my-4 flex flex-wrap gap-2" aria-label="비교 종류">
        {([["compare", "옵션·추가 스탯당 비용"], ["replace", "내 장비 교체 비용"], ["gems", "보석작 vs 완성품"]] as const).map(([key, label]) =>
          <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}
            className={`pixel-btn px-3 py-2 text-sm ${tab === key ? "bg-maple text-white" : ""}`}>{label}</button>)}
      </div>
      {!base || items.length < 2 ? <p className="py-8 text-center text-dim">비교할 장비 매물을 2개 이상 담아 주세요.</p> : <>
        {tab !== "gems" && <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {tab === "compare" && <label className="space-y-1 text-xs text-dim">비교 기준 매물
            <select value={base.key} onChange={e => setBaseKey(e.target.value)} className={INPUT}>
              {items.map((item, i) => <option key={item.key} value={item.key}>{optionName(item, i)}</option>)}
            </select>
          </label>}
          <label className="space-y-1 text-xs text-dim">추가 비용을 비교할 스탯
            <select value={stat} onChange={e => { setStat(e.target.value); setCurrentStat(""); }} className={INPUT}>
              {STAT_CHOICES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>}
        {tab === "compare" && <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">선택한 매물의 옵션 및 추가 스탯당 비용 비교</caption>
              <thead><tr className="border-b border-edge"><th scope="col" className="min-w-28 p-2">비교 항목</th>
                {items.map((item, i) => <th key={item.key} scope="col" className="min-w-44 max-w-60 p-2 align-top">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entityIconUrl("item", item.itemId)} alt="" width={32} height={32} className="h-8 w-8 object-contain" onError={hideIconOnError} />
                    <span>{String.fromCharCode(65 + i)}. {item.name}</span>
                  </div>
                  <p className="mt-2 font-normal text-dim">{item.kind === "sold" ? "거래 완료 · 참고 가격" : "판매 중"}{base.key === item.key ? " · 기준" : ""}</p>
                  <p className="mt-1 font-normal text-dim">조회 {at(item.fetchedAt)}</p>
                  <button type="button" className="mt-2 text-dim underline" onClick={() => onRemove(item.key)}>비교에서 빼기</button>
                </th>)}
              </tr></thead>
              <tbody>
                <tr className="border-b border-edge/40"><th scope="row" className="p-2">개당 가격</th>{items.map(item => <td key={item.key} className="p-2 font-semibold text-maple">{meso(money(item.unitPrice))}</td>)}</tr>
                <tr className="border-b border-edge/40"><th scope="row" className="p-2">기준 대비 추가금</th>{items.map(item => {
                  const price = money(item.unitPrice), basePrice = money(base.unitPrice);
                  return <td key={item.key} className="p-2">{meso(price !== null && basePrice !== null ? price - basePrice : null)}</td>;
                })}</tr>
                {statKeys.map(key => <tr key={key} className={`border-b border-edge/40 ${key === stat ? "bg-surface2" : ""}`}>
                  <th scope="row" className="p-2">{STAT_LABELS[key]}</th>{items.map(item => <td key={item.key} className="p-2">
                    {statValue(item, key) ?? "미확인"}{item.key !== base.key && <span className="ml-2 text-dim">({deltaText(statDelta(base, item, key))})</span>}
                  </td>)}
                </tr>)}
                <tr className="border-b border-edge/40"><th scope="row" className="p-2">강화 성공 / 남은 횟수</th>{items.map(item => <td key={item.key} className="p-2">{item.options.upgradeCount ?? "?"} / {item.options.remainingUpgrades ?? "?"}</td>)}</tr>
                <tr className="border-b border-edge/40"><th scope="row" className="p-2">보석작</th>{items.map(item => <td key={item.key} className="p-2">{item.options.gemApplied === true ? "적용" : item.options.gemApplied === false ? "없음" : "미확인"}</td>)}</tr>
                <tr className="bg-surface2"><th scope="row" className="p-2">{STAT_LABELS[stat]} +1당 추가금</th>{items.map(item => <td key={item.key} className="p-2 font-semibold">{efficiency(base, item, stat)}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-dim">추가 스탯당 비용 = (비교 매물 가격 − 기준 매물 가격) ÷ 스탯 증가량. 다른 옵션의 상승·하락도 함께 보세요. 직업별 데미지 효율이나 적정가를 뜻하지 않습니다.</p>
          {items.some(x => x.itemId !== base.itemId) && <p className="mt-2 text-xs text-amber-600">서로 다른 아이템이 포함되어 있습니다. 부위·직업·착용 조건은 별도로 확인하세요.</p>}
        </>}
        {tab === "replace" && <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <MoneyInput label="현재 장비 판매 실수령액 (수수료 차감 후)" value={netSale} onChange={setNetSale} />
            <MoneyInput label="추가 거래·교체 비용" value={extraCost} onChange={setExtraCost} />
            <label className="space-y-1 text-xs text-dim">내 장비의 {STAT_LABELS[stat]} (선택)
              <input type="number" min="0" max="9999999" step="1" className={INPUT} value={currentStat} onChange={e => setCurrentStat(e.target.value)} placeholder="장비 한 부위의 옵션" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{items.map((item, i) => {
            const cost = replacementCost(item.unitPrice, netSale, extraCost);
            const value = statValue(item, stat);
            const previous = /^\d{1,7}$/.test(currentStat) ? Number(currentStat) : null;
            const diff = value !== null && previous !== null ? value - previous : null;
            return <div key={item.key} className="rounded border border-edge p-3 text-sm">
              <h3 className="font-semibold">{String.fromCharCode(65 + i)}. {item.name}</h3>
              {item.kind === "sold" ? <p className="mt-2 text-dim">거래 완료 매물은 구매 대상에서 제외됩니다.</p> : <>
                <p className="mt-2">{cost !== null && cost < BigInt(0) ? "교체 후 남는 메소" : "교체 순지출"}: <b className="text-maple">{meso(cost !== null && cost < BigInt(0) ? -cost : cost)}</b></p>
                <p className="mt-1 text-dim">{STAT_LABELS[stat]} 변화: {deltaText(diff)}</p>
                {cost !== null && cost > BigInt(0) && diff !== null && diff > 0 && <p className="mt-1">+1당 약 {meso((cost + BigInt(diff) - BigInt(1)) / BigInt(diff))}</p>}
              </>}
            </div>;
          })}</div>
          <p className="mt-3 text-xs text-dim">순지출 = 새 장비 가격 + 추가 비용 − 현재 장비 판매 실수령액. 보유 장비를 팔지 않는다면 실수령액에 0을 입력하세요.</p>
        </>}
        {tab === "gems" && open && <GemComparison items={items} />}
      </>}
    </div>
  </dialog>;
}

interface GemLine { code: number | null; price: string; note: string; sourceUrl?: string; }
function GemComparison({ items }: { items: ComparedListing[] }) {
  const [catalog, setCatalog] = useState<MarketGem[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [baseKey, setBaseKey] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [lines, setLines] = useState<GemLine[]>(Array.from({ length: 3 }, () => ({ code: null, price: "", note: "" })));
  const [feeOverride, setFeeOverride] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const baseCandidates = items.filter(x => x.kind === "active" && x.options.gemApplied === false);
  const targetCandidates = items.filter(x => x.kind === "active" && x.options.gemApplied === true);
  const base = baseCandidates.find(x => x.key === baseKey) ?? baseCandidates[0];
  const target = targetCandidates.find(x => x.key === targetKey) ?? targetCandidates.find(x => x.itemId === base?.itemId) ?? targetCandidates[0];
  const selected = lines.filter(x => x.code !== null);
  const gems = selected.flatMap(line => { const g = catalog.find(x => x.code === line.code); return g ? [g] : []; });
  const fee = applicationFee(gems);
  const feeValue = feeOverride || fee?.toString() || "";
  const eligibility = base ? gemEligibility(base, gems) : "비교 목록에 보석작 없는 판매 중 장비를 담아 주세요.";
  const projected = base ? projectGemOptions(base, gems) : null;
  const total = !eligibility && base && gems.length === selected.length ? gemCost(base.unitPrice, selected.map(x => x.price), feeValue) : null;
  const targetPrice = target ? money(target.unitPrice) : null;
  const identical = !!(base && target && projected && sameFinalOptions(base, projected, target));
  const savings = total !== null && targetPrice !== null ? targetPrice - total : null;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/itemchart/gems`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (!Array.isArray(body.gems)) throw new Error();
      if (!controller.signal.aborted) setCatalog(body.gems);
    }).catch(() => { if (!controller.signal.aborted) setCatalogError("보석 목록을 불러오지 못했습니다. 창을 다시 열어 주세요."); });
    return () => { controller.abort(); request.current?.abort(); revision.current += 1; };
  }, []);

  function updateLines(next: GemLine[]) { revision.current += 1; request.current?.abort(); setBusy(false); setLines(next); }
  async function loadPrices() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const version = ++revision.current; setBusy(true);
    try {
      // At most three explicit searches, sequential to respect the shared upstream limit.
      for (let index = 0; index < lines.length; index++) {
        const gem = catalog.find(x => x.code === lines[index].code);
        if (!gem) continue;
        let price = "", note = "", sourceUrl: string | undefined;
        try {
          const params = new URLSearchParams({ q: gem.name, kind: "active", sort: "price-asc" });
          const response = await fetch(`${API_BASE}/api/itemchart/search?${params}`, { signal: controller.signal });
          const body = await response.json();
          if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "조회 실패");
          const matching = (body.rows as Listing[]).filter(row => row.itemId === gem.itemId && money(row.unitPrice) !== null);
          if (!matching.length) throw new Error("일치하는 매물 없음 · 직접 입력해 주세요");
          price = matching.reduce((a, b) => money(a.unitPrice)! <= money(b.unitPrice)! ? a : b).unitPrice;
          note = `조회 매물 최저 단가 · ${at(body.fetchedAt)}`; sourceUrl = body.sourceUrl;
        } catch (error) {
          if (controller.signal.aborted) return;
          note = error instanceof Error ? error.message : "조회 실패 · 직접 입력해 주세요";
        }
        if (version !== revision.current) return;
        setLines(current => current.map((line, i) => i === index ? { ...line, price, note, sourceUrl } : line));
      }
    } finally { if (version === revision.current) setBusy(false); }
  }

  return <div className="space-y-4">
    <p className="text-xs text-dim">보석작 없는 장비에 강화보석을 한 번 부여하는 비용과 완성품 구매를 비교합니다. 보석은 하급·중급·상급 완제품 구매 기준이며, 원석 가공·승급 비용은 포함하지 않습니다.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-xs text-dim">직접 보석작할 장비
        <select value={base?.key || ""} onChange={e => setBaseKey(e.target.value)} className={INPUT}>
          {!baseCandidates.length && <option value="">보석작 없는 판매 중 매물을 담아 주세요</option>}
          {baseCandidates.map(x => <option key={x.key} value={x.key}>{optionName(x, items.indexOf(x))}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs text-dim">구매할 보석작 완성품
        <select value={target?.key || ""} onChange={e => setTargetKey(e.target.value)} className={INPUT}>
          {!targetCandidates.length && <option value="">보석작된 판매 중 매물을 담아 주세요</option>}
          {targetCandidates.map(x => <option key={x.key} value={x.key}>{optionName(x, items.indexOf(x))}</option>)}
        </select>
      </label>
    </div>
    {catalogError && <p role="alert" className="text-sm text-red-500">{catalogError}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!target || !catalog.length || busy || !target.options.gems.length || target.options.gems.some(g => !catalog.some(x => x.code === g.code))}
        onClick={() => { updateLines(Array.from({ length: 3 }, (_, i) => ({ code: target?.options.gems[i]?.code ?? null, price: "", note: "" }))); setFeeOverride(""); }}
        className="pixel-btn px-3 py-2 text-xs disabled:opacity-40">완성품과 같은 보석 구성</button>
      <button type="button" onClick={loadPrices} disabled={busy || !gems.length || !!eligibility}
        className="pixel-btn px-3 py-2 text-xs disabled:opacity-40">{busy ? "보석 시세 조회 중…" : "선택한 보석 시세 불러오기"}</button>
    </div>
    {lines.map((line, i) => <div key={i} className="grid gap-2 rounded border border-edge p-3 sm:grid-cols-2">
      <label className="space-y-1 text-xs text-dim">강화보석 {i + 1} · 1개
        <select value={line.code ?? ""} onChange={e => { updateLines(lines.map((old, index) => index === i ? { code: e.target.value ? Number(e.target.value) : null, price: "", note: "" } : old)); setFeeOverride(""); }} className={INPUT}>
          <option value="">선택 안 함</option>
          {catalog.map(gem => <option key={gem.code} value={gem.code}>{gem.name} · {STAT_LABELS[gem.stat]} {gem.amount > 0 ? "+" : ""}{gem.amount}</option>)}
        </select>
      </label>
      <div><MoneyInput label="보석 개당 구매 가격" value={line.price} onChange={value => updateLines(lines.map((old, index) => index === i ? { ...old, price: value, note: "직접 입력", sourceUrl: undefined } : old))} />
        {line.note && <p className="mt-1 text-xs text-dim">{line.note} {line.sourceUrl && <a href={line.sourceUrl} target="_blank" rel="noreferrer" className="text-maple underline">원문</a>}</p>}
      </div>
    </div>)}
    <div className="rounded border border-edge bg-surface2 p-3">
      <p className="text-sm">옵션 부여 수수료: <b>{meso(money(feeValue))}</b> {feeOverride ? "(직접 수정)" : "(자동 계산)"}</p>
      <p className="mt-1 text-xs text-dim">기본 275만 + 하급 75만 / 중급 150만 / 상급 225만 × 각 개수. 보석 구매 가격은 별도입니다. <a href={FEE_SOURCE} target="_blank" rel="noreferrer" className="text-maple underline">커뮤니티 수수료 기준</a></p>
      <details className="mt-2 text-xs"><summary className="cursor-pointer text-dim">게임 수수료가 다르면 수정</summary>
        <div className="mt-2 max-w-sm"><MoneyInput label="수수료 직접 입력 (빈칸이면 자동 계산)" value={feeOverride} onChange={setFeeOverride} /></div>
      </details>
    </div>
    {eligibility && <p className="text-sm text-amber-600">{eligibility}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded border border-edge p-3"><h3 className="text-sm font-semibold">직접 보석작 총비용</h3><p className="mt-2 font-bold text-maple">{meso(total)}</p><p className="mt-1 text-xs text-dim">장비 가격 + 선택한 보석 가격 + 옵션 부여 수수료</p></div>
      <div className="rounded border border-edge p-3"><h3 className="text-sm font-semibold">완성품 구매 가격</h3><p className="mt-2 font-bold text-maple">{meso(targetPrice)}</p></div>
    </div>
    {base && target && projected && <>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">직접 보석작 예상 옵션과 완성품 비교</caption>
        <thead><tr className="border-b border-edge"><th className="p-2">옵션</th><th className="p-2">직접 보석작 후</th><th className="p-2">완성품</th><th className="p-2">완성품 − 직접작</th></tr></thead>
        <tbody>{Object.keys(STAT_LABELS).filter(key => key === "requiredLevelAdjustment" || (projected.stats[key] ?? 0) || (target.options.stats[key] ?? 0)).map(key => {
          const value = key === "requiredLevelAdjustment" ? projected.requiredLevelAdjustment : projected.stats[key] ?? 0;
          const other = statValue(target, key);
          return <tr key={key} className="border-b border-edge/40"><th className="p-2">{STAT_LABELS[key]}</th><td className="p-2">{value ?? "미확인"}</td><td className="p-2">{other ?? "미확인"}</td><td className="p-2">{deltaText(value !== null && other !== null ? other - value : null)}</td></tr>;
        })}
          <tr className="border-b border-edge/40"><th className="p-2">강화 성공 횟수</th><td className="p-2">{projected.upgradeCount ?? "미확인"}</td><td className="p-2">{target.options.upgradeCount ?? "미확인"}</td><td /></tr>
          <tr className="border-b border-edge/40"><th className="p-2">남은 업그레이드</th><td className="p-2">{projected.remainingUpgrades ?? "미확인"}</td><td className="p-2">{target.options.remainingUpgrades ?? "미확인"}</td><td /></tr>
        </tbody>
      </table></div>
      {savings !== null && <p className="rounded bg-surface2 p-3 text-sm">
        {identical ? "표시된 스탯·강화 횟수가 일치합니다. " : "아이템 또는 옵션·강화 횟수가 달라 동등한 완성품 비교가 아닙니다. "}
        {savings === BigInt(0) ? "계산상 비용이 같습니다." : `${savings > BigInt(0) ? "직접 보석작" : "완성품 구매"} 비용이 ${meso(savings > BigInt(0) ? savings : -savings)} 적습니다.`}
        {!identical && " 위 옵션 차이를 함께 확인하세요."}
      </p>}
    </>}
    <p className="text-xs text-dim">시세 조회는 버튼을 누를 때만 최대 3회 실행합니다. 입력·비교 계산은 추가 요청 없이 진행됩니다. 구매 전 실제 매물과 옵션 부여 가능 여부를 게임에서 확인하세요.</p>
  </div>;
}
