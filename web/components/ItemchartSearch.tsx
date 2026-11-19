"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import ItemNameAutocomplete from "@/components/ItemNameAutocomplete";
import MarketComparison from "@/components/MarketComparison";
import { type ItemOptions, type Listing, type ComparedListing } from "@/lib/marketComparison";
import { entityIconUrl, hideIconOnError } from "@/lib/icons";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const SORT_LABELS: Record<string, string> = {
  "price-asc": "낮은 가격순", "price-desc": "높은 가격순", "time-desc": "최신순", "time-asc": "오래된 거래순",
};
const LABELS: Record<string, string> = {
  strength: "STR", dexterity: "DEX", intelligence: "INT", luck: "LUK", hp: "HP", mp: "MP",
  attack: "공격력", magicAttack: "마력", physicalDefense: "물리방어", magicDefense: "마법방어",
  accuracy: "명중", avoidability: "회피", speed: "이속", jump: "점프", craft: "손재주",
  requiredLevelAdjustment: "착용 레벨",
};
const STAT_FILTERS = [
  ["attack", "공격력"], ["magicAttack", "마력"], ["STR", "STR"], ["DEX", "DEX"], ["INT", "INT"], ["LUK", "LUK"],
  ["HP", "HP"], ["MP", "MP"], ["physicalDefense", "물리방어"], ["magicDefense", "마법방어"],
  ["accuracy", "명중"], ["avoidability", "회피"], ["speed", "이속"], ["jump", "점프"],
  ["remaining", "남은 업그레이드"], ["upgrades", "강화 성공 횟수"],
];

interface SearchResult {
  query: string;
  kind: "active" | "sold";
  sort: string;
  sourceUrl: string;
  fetchedAt: string;
  observedAt: number | null;
  cached: boolean;
  cacheSeconds: number;
  filters: { stat: string | null; statMin: number | null; statMax: number | null; gem: string; minPrice: string | null; maxPrice: string | null };
  rows: Listing[];
}

function numberText(value: string) {
  return /^\d+$/.test(value) ? BigInt(value).toLocaleString("ko-KR") : "—";
}

function mesoText(value: string) {
  if (!/^\d+$/.test(value)) return "—";
  const n = BigInt(value);
  const hundredMillion = BigInt(100_000_000);
  const tenThousand = BigInt(10_000);
  return [n >= hundredMillion ? `${n / hundredMillion}억` : "",
    n % hundredMillion >= tenThousand ? `${n % hundredMillion / tenThousand}만` : "",
    n % tenThousand > BigInt(0) ? `${n % tenThousand}` : ""].filter(Boolean).join(" ") || "0";
}

function dateText(value: string | number | null) {
  if (value === null) return "시각 미확인";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "시각 미확인" : date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function EquipmentOptions({ options }: { options: ItemOptions }) {
  if (options.status === "not_equipment") return <span className="text-dim">장비 옵션 없음</span>;
  return <div className="space-y-2">
    {options.complete && options.status !== "unknown" ? <>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(options.stats).filter(([, value]) => value !== 0).map(([key, value]) => (
          <span key={key} className={key === "attack" || key === "magicAttack" ? "font-semibold text-maple" : ""}>
            {LABELS[key] || key} {value > 0 ? "+" : ""}{value}
          </span>
        ))}
      </div>
      {options.requiredLevelAdjustment != null && options.requiredLevelAdjustment !== 0 && <p>착용 레벨 {options.requiredLevelAdjustment}</p>}
    </> : <p className="text-amber-600 dark:text-amber-400">최종 옵션 미확인 · 원문 확인 필요</p>}
    <p className="text-dim">강화 성공 {options.upgradeCount ?? "?"}회 · 남은 업그레이드 {options.remainingUpgrades ?? "?"}회</p>
    <div className="flex flex-wrap gap-1.5">
      <span className={`rounded px-2 py-0.5 ${options.gemApplied === true ? "bg-maple/10 text-maple" : "bg-surface2 text-dim"}`}>
        {options.gemApplied === true ? "보석작 적용" : options.gemApplied === false ? "보석작 없음" : "보석작 여부 미확인"}
      </span>
      {options.status === "inferred" && <span className="text-dim" title="원본 거래 정보에서 해석한 값입니다. 구매 전 게임에서 확인하세요.">옵션 추정</span>}
    </div>
    {options.gems.length > 0 && <p className="text-dim">
      보석 효과: {options.gems.map((gem) => gem.stat && gem.amount != null
        ? `${LABELS[gem.stat] || gem.stat} ${gem.amount > 0 ? "+" : ""}${gem.amount}`
        : "미확인 보석").join(" · ")}
      {options.complete && " (위 옵션에 포함)"}
    </p>}
  </div>;
}

function SortArrows({ direction }: { direction: "ascending" | "descending" | "none" }) {
  return <span aria-hidden="true" className="inline-flex flex-col text-[9px] leading-[9px]">
    <span className={direction === "ascending" ? "text-maple" : "opacity-35"}>▲</span>
    <span className={direction === "descending" ? "text-maple" : "opacity-35"}>▼</span>
  </span>;
}

export default function ItemchartSearch() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"active" | "sold">("active");
  const [sort, setSort] = useState("price-asc");
  const [stat, setStat] = useState("");
  const [statMin, setStatMin] = useState("");
  const [statMax, setStatMax] = useState("");
  const [gem, setGem] = useState("any");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [data, setData] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [compared, setCompared] = useState<ComparedListing[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [requestedUrl, setRequestedUrl] = useState("https://itemchart.net/mapleland/market");
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current += 1; controller.current?.abort(); }, []);

  function toggleComparison(row: Listing) {
    if (!data) return;
    const key = `${data.kind}:${row.id}`;
    setCompared(current => current.some(item => item.key === key)
      ? current.filter(item => item.key !== key)
      : current.length >= 5 ? current : [...current, { ...row, key, kind: data.kind, fetchedAt: data.fetchedAt, sourceUrl: data.sourceUrl }]);
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = query.trim();
    if (!name) { setError("아이템 이름을 입력해 주세요."); return; }
    if ((stat && statMin && statMax && Number(statMin) > Number(statMax)) ||
      (minPrice && maxPrice && BigInt(minPrice) > BigInt(maxPrice))) {
      setError("최솟값은 최댓값보다 클 수 없습니다."); return;
    }
    const params = new URLSearchParams({ q: name, kind, sort, gem });
    if (stat) {
      params.set("stat", stat);
      if (statMin) params.set("stat_min", statMin);
      if (statMax) params.set("stat_max", statMax);
    }
    if (minPrice) params.set("min_price", minPrice);
    if (maxPrice) params.set("max_price", maxPrice);
    void loadResults(params);
  }

  async function loadResults(params: URLSearchParams, keepResults = false) {
    setRequestedUrl(`https://itemchart.net/mapleland/${params.get("kind") === "active" ? "market" : "sold"}?${new URLSearchParams({ q: params.get("q") || "" })}`);
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const request = ++sequence.current;
    setLoading(true); setError("");
    if (!keepResults) setData(null);
    try {
      const response = await fetch(`${API_BASE}/api/itemchart/search?${params}`, { signal: abort.signal, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "검색 조건을 확인하고 다시 검색해 주세요.");
      if (!Array.isArray(body.rows)) throw new Error("검색 결과를 읽지 못했습니다.");
      if (sequence.current === request) setData(body);
    } catch (error) {
      if (sequence.current === request && !abort.signal.aborted) setError(error instanceof Error ? error.message : "조회에 실패했습니다.");
    } finally {
      if (sequence.current === request) setLoading(false);
    }
  }

  function changeResultSort(next: string) {
    if (!data || loading) return;
    // Requery the displayed search, not any unsubmitted edits in the form.
    const params = new URLSearchParams({ q: data.query, kind: data.kind, sort: next, gem: data.filters.gem });
    const filters = data.filters;
    if (filters.stat) {
      params.set("stat", filters.stat);
      if (filters.statMin !== null) params.set("stat_min", String(filters.statMin));
      if (filters.statMax !== null) params.set("stat_max", String(filters.statMax));
    }
    if (filters.minPrice !== null) params.set("min_price", filters.minPrice);
    if (filters.maxPrice !== null) params.set("max_price", filters.maxPrice);
    if (kind === data.kind) setSort(next);
    void loadResults(params, true);
  }

  const priceDirection = data?.sort === "price-asc" ? "ascending" : data?.sort === "price-desc" ? "descending" : "none";
  const timeDirection = data?.sort === "time-asc" ? "ascending" : data?.sort === "time-desc" ? "descending" : "none";
  const nextPriceSort = data?.sort === "price-asc" ? "price-desc" : "price-asc";
  const nextTimeSort = data?.sort === "time-desc" ? "time-asc" : "time-desc";

  const inputClass = "w-full rounded border border-edge bg-surface px-3 py-2 text-sm text-ink";
  const labelClass = "space-y-1 text-xs text-dim";
  return <section className="space-y-4" aria-label="템차트 매물 검색">
    <form onSubmit={search} className="pixel-panel space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <ItemNameAutocomplete value={query} onChange={setQuery} className={inputClass} />
        <button type="submit" disabled={loading} className="pixel-btn bg-maple px-5 py-2 text-sm text-white disabled:opacity-50">
          {loading ? "조회 중…" : "검색"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {["슈피겔만의 혼돈 목걸이", "혼돈의 주문서 60%", "드래곤"].map((name) => (
          <button key={name} type="button" onClick={() => setQuery(name)} className="rounded bg-surface2 px-2 py-1 text-xs text-dim hover:text-maple">{name}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className={labelClass}>조회 대상
          <select value={kind} onChange={(event) => { setKind(event.target.value as "active" | "sold"); setSort(event.target.value === "sold" ? "time-desc" : "price-asc"); }} className={inputClass}>
            <option value="active">판매 중 매물</option><option value="sold">최근 거래</option>
          </select>
        </label>
        <label className={labelClass}>정렬
          <select value={sort} onChange={(event) => setSort(event.target.value)} className={inputClass}>
            <option value="price-asc">낮은 가격순</option><option value="price-desc">높은 가격순</option><option value="time-desc">최신순</option>
            {kind === "sold" && <option value="time-asc">오래된 거래순</option>}
          </select>
        </label>
        <label className={labelClass}>보석작 여부
          <select value={gem} onChange={(event) => setGem(event.target.value)} className={inputClass}>
            <option value="any">전체</option><option value="applied">보석작 적용</option><option value="none">보석작 없음</option>
          </select>
        </label>
        <label className={labelClass}>장비 옵션
          <select value={stat} onChange={(event) => setStat(event.target.value)} className={inputClass}>
            <option value="">제한 없음</option>{STAT_FILTERS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className={labelClass}>옵션 최솟값
          <input type="number" min="0" max="9999999" step="1" disabled={!stat} value={statMin} onChange={(event) => setStatMin(event.target.value)} placeholder="제한 없음" className={inputClass} />
        </label>
        <label className={labelClass}>옵션 최댓값
          <input type="number" min="0" max="9999999" step="1" disabled={!stat} value={statMax} onChange={(event) => setStatMax(event.target.value)} placeholder="제한 없음" className={inputClass} />
        </label>
        <label className={labelClass}>최소 개당 가격 (메소)
          <input inputMode="numeric" pattern="[0-9]*" maxLength={19} value={minPrice} onChange={(event) => setMinPrice(event.target.value.replace(/\D/g, ""))} placeholder="제한 없음" className={inputClass} />
        </label>
        <label className={labelClass}>최대 개당 가격 (메소)
          <input inputMode="numeric" pattern="[0-9]*" maxLength={19} value={maxPrice} onChange={(event) => setMaxPrice(event.target.value.replace(/\D/g, ""))} placeholder="제한 없음" className={inputClass} />
        </label>
      </div>
      <p className="text-xs leading-relaxed text-dim">조건·정렬을 선택한 뒤 검색을 눌러 주세요. 자동 갱신 없이 요청할 때만 조회합니다.{" "}
        <Link href="/guide#market-updates" className="text-maple underline">언제 다시 조회하나요?</Link>
      </p>
    </form>

    {compared.length > 0 && <div className="sticky top-2 z-20 rounded border-2 border-edge bg-surface p-3 shadow-md" aria-label="비교할 매물">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold" aria-live="polite">비교 {compared.length}/5</span>
        <button type="button" disabled={compared.length < 2} onClick={() => setCompareOpen(true)} className="pixel-btn bg-maple px-3 py-2 text-sm text-white disabled:opacity-40">선택 매물 비교</button>
        <button type="button" onClick={() => setCompared([])} className="px-2 py-1 text-xs text-dim underline">모두 비우기</button>
        <span className="text-xs text-dim">장비 2~5개 · 다른 검색 결과에서도 추가할 수 있습니다.</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">{compared.map((item, i) => <button key={item.key} type="button"
        onClick={() => setCompared(current => current.filter(x => x.key !== item.key))}
        aria-label={`${item.name} ${numberText(item.unitPrice)} 메소 비교에서 빼기`}
        className="rounded bg-surface2 px-2 py-1 text-xs text-dim">{String.fromCharCode(65 + i)}. {item.name} · {mesoText(item.unitPrice)} 메소 ×</button>)}</div>
    </div>}

    <div aria-live="polite" aria-busy={loading}>
      {loading && <p className="py-6 text-center text-sm text-dim">템차트에서 매물 정보를 확인하고 있습니다…</p>}
      {error && <div role="alert" className="rounded border border-edge bg-surface2 p-4 text-sm">
        <p>{error}</p><a href={requestedUrl} target="_blank" rel="noreferrer" className="text-maple hover:underline">템차트에서 이름 검색 →</a>
      </div>}
      {data && <div className="pixel-panel space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">{data.query} · {data.kind === "active" ? "판매 중" : "최근 거래"}</h2>
          <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-maple hover:underline">같은 조건으로 템차트에서 더 보기 →</a>
        </div>
        <p className="text-xs text-dim">
          검색 결과 첫 페이지 {data.rows.length}건 · <strong className="text-ink">{SORT_LABELS[data.sort] || data.sort}</strong>
          <br />조회 {dateText(data.fetchedAt)} (한국 시간){data.cached ? ` · ${data.cacheSeconds}초 이내 조회 결과` : ""}
        </p>
        <p className="text-xs text-dim">가격{data.kind === "sold" ? "·거래 시각" : ""}의 화살표를 누르면 같은 조건으로 다시 조회합니다.</p>
        <p className="text-xs text-dim">
          적용 조건: {data.filters.gem === "applied" ? "보석작 적용" : data.filters.gem === "none" ? "보석작 없음" : "보석작 전체"}
          {data.filters.stat && ` · ${STAT_FILTERS.find(([key]) => key === data.filters.stat)?.[1] ?? data.filters.stat} ${data.filters.statMin ?? "제한 없음"} ~ ${data.filters.statMax ?? "제한 없음"}`}
          {(data.filters.minPrice !== null || data.filters.maxPrice !== null) && ` · 가격 ${data.filters.minPrice === null ? "제한 없음" : numberText(data.filters.minPrice)} ~ ${data.filters.maxPrice === null ? "제한 없음" : numberText(data.filters.maxPrice)} 메소`}
        </p>
        {data.rows.length === 0 ? <p className="py-6 text-sm text-dim">일치하는 결과가 없습니다. 이름이나 옵션 조건을 바꿔 검색해 주세요.</p> :
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <caption className="sr-only">{data.query} 옵션·보석작·개당 가격 비교</caption>
              <thead className="border-b border-edge text-dim"><tr>
                <th scope="col" className="p-2">비교</th>
                <th scope="col" className="p-2">아이템</th><th scope="col" className="p-2">옵션 · 보석작</th>
                <th scope="col" aria-sort={priceDirection} className="p-2 text-right">
                  <button type="button" disabled={loading} onClick={() => changeResultSort(nextPriceSort)}
                    aria-label={`개당 가격 · 현재 ${priceDirection === "none" ? "다른 기준으로 정렬" : SORT_LABELS[data.sort]} · ${SORT_LABELS[nextPriceSort]}으로 변경`}
                    className="inline-flex items-center gap-2 rounded py-1 hover:text-maple disabled:opacity-50">
                    개당 가격 <SortArrows direction={priceDirection} />
                  </button><span className="font-normal"> / 수량</span>
                </th>
                <th scope="col" aria-sort={data.kind === "sold" ? timeDirection : undefined} className="p-2">
                  {data.kind === "sold" ? <button type="button" disabled={loading} onClick={() => changeResultSort(nextTimeSort)}
                    aria-label={`거래 시각 · ${SORT_LABELS[nextTimeSort]}으로 변경`}
                    className="inline-flex items-center gap-2 rounded py-1 hover:text-maple disabled:opacity-50">
                    거래 시각 (한국) <SortArrows direction={timeDirection} />
                  </button> : "만료 시각 (한국)"}
                </th>
              </tr></thead>
              <tbody>{data.rows.map((row, index) => <tr key={`${row.id}:${index}`} className="border-b border-edge/40 align-top last:border-0">
                <td className="p-2"><button type="button" onClick={() => toggleComparison(row)}
                  aria-label={`${row.name} ${numberText(row.unitPrice)} 메소 비교 선택`}
                  aria-pressed={compared.some(item => item.key === `${data.kind}:${row.id}`)}
                  disabled={row.options.status === "not_equipment" || (compared.length >= 5 && !compared.some(item => item.key === `${data.kind}:${row.id}`))}
                  className={`pixel-btn whitespace-nowrap px-2 py-1 disabled:opacity-35 ${compared.some(item => item.key === `${data.kind}:${row.id}`) ? "bg-maple text-white" : ""}`}>
                  {compared.some(item => item.key === `${data.kind}:${row.id}`) ? "✓ 담음" : "비교 +"}
                </button></td>
                <td className="max-w-40 p-2"><Link href={`/items/${row.itemId}`} className="flex items-center gap-2 font-semibold text-ink hover:text-maple">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entityIconUrl("item", row.itemId)} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 shrink-0 object-contain" onError={hideIconOnError} />
                  {row.name}
                </Link></td>
                <td className="min-w-56 p-2"><EquipmentOptions options={row.options} /></td>
                <td className="whitespace-nowrap p-2 text-right">
                  <p className="font-semibold text-maple">{numberText(row.unitPrice)} 메소</p>
                  <p className="mt-1 text-dim">{mesoText(row.unitPrice)} 메소</p>
                  <p className="mt-1 text-dim">수량 {numberText(row.quantity)}</p>
                </td>
                <td className="p-2 text-dim">{dateText(data.kind === "sold" ? row.soldAt : row.expiresAt)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
      </div>}
    </div>
    <p className="text-xs leading-relaxed text-dim">
      출처: <a href="https://itemchart.net/mapleland/market" target="_blank" rel="noreferrer" className="text-maple hover:underline">템차트</a>.
      판매 중 가격은 판매자의 희망 가격이며 최근 거래와 구분됩니다. 일부 장비 옵션은 추정값으로, 거래 전 게임에서 최종 옵션과 보석작을 확인하세요.
    </p>
    <MarketComparison items={compared} open={compareOpen} onClose={() => setCompareOpen(false)} onRemove={key => setCompared(current => current.filter(item => item.key !== key))} />
  </section>;
}
