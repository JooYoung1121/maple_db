"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface MatipItem {
  id: number;
  name: string;
}

interface QuotePoint {
  time: string;
  avg: number;
  min?: number;
  max?: number;
  count: number;
}

interface QuoteData {
  sellActive?: QuotePoint[];
  buyActive?: QuotePoint[];
}

type Resolution = "day" | "week" | "month";
type Side = "sell" | "buy";

const RESOLUTION_LABEL: Record<Resolution, string> = { day: "일봉", week: "주봉", month: "월봉" };

// 자주 찾는 아이템 바로가기
const PRESETS: MatipItem[] = [
  { id: 2044401, name: "폴암 공격력 주문서 60%" },
  { id: 2043801, name: "스태프 마력 주문서 60%" },
  { id: 2040901, name: "방패 방어력 주문서 60%" },
  { id: 2290006, name: "[마스터리북] 스탠스 20" },
  { id: 4021007, name: "다이아몬드" },
  { id: 4005001, name: "지혜의 크리스탈" },
];

function fmtMeso(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  const abs = Math.abs(Math.round(n));
  if (abs >= 100_000_000) return `${(abs / 100_000_000).toFixed(2)}억`;
  if (abs >= 10_000) return `${(abs / 10_000).toFixed(1)}만`;
  return abs.toLocaleString("ko-KR");
}

// 공백 무시 + 소문자 비교 검색
function norm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

function PriceChart({ points }: { points: QuotePoint[] }) {
  if (points.length === 0) return null;
  const W = 640;
  const H = 160;
  const PAD = 8;
  const avgs = points.map((p) => p.avg);
  const lo = Math.min(...points.map((p) => p.min ?? p.avg));
  const hi = Math.max(...points.map((p) => p.max ?? p.avg));
  const span = Math.max(1, hi - lo);
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => H - PAD - ((v - lo) * (H - PAD * 2)) / span;
  const line = avgs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  // min~max 범위 밴드
  const band = [
    ...points.map((p, i) => `${x(i).toFixed(1)},${y(p.max ?? p.avg).toFixed(1)}`),
    ...points.slice().reverse().map((p, i) => `${x(points.length - 1 - i).toFixed(1)},${y(p.min ?? p.avg).toFixed(1)}`),
  ].join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label="시세 추이 차트">
      <polygon points={band} fill="var(--maple, #f97316)" opacity="0.12" />
      <polyline points={line} fill="none" stroke="var(--maple, #f97316)" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={p.time} cx={x(i)} cy={y(p.avg)} r="2.5" fill="var(--maple, #f97316)">
          <title>{`${p.time} · 평균 ${fmtMeso(p.avg)} 메소 · 매물 ${p.count}건`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default function MarketPage() {
  const [catalog, setCatalog] = useState<MatipItem[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MatipItem | null>(null);
  const [resolution, setResolution] = useState<Resolution>("day");
  const [side, setSide] = useState<Side>("sell");
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/matip/items`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: MatipItem[]) => setCatalog(Array.isArray(d) ? d : []))
      .catch(() => setCatalogError(true));
  }, []);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setQuoteLoading(true);
    fetch(`${API_BASE}/api/matip/quote?itemCode=${selected.id}&resolution=${resolution}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: QuoteData | null) => {
        if (alive) setQuote(d);
      })
      .catch(() => {
        if (alive) setQuote(null);
      })
      .finally(() => {
        if (alive) setQuoteLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selected, resolution]);

  const results = useMemo(() => {
    const q = norm(query);
    if (q.length < 1) return [];
    return catalog.filter((it) => norm(it.name).includes(q)).slice(0, 12);
  }, [catalog, query]);

  const points = (side === "sell" ? quote?.sellActive : quote?.buyActive) ?? [];
  const last = points.length > 0 ? points[points.length - 1] : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="font-pixel text-2xl font-bold text-ink">아이템 시세</h1>
        <p className="mt-2 text-sm leading-relaxed text-dim">
          거래소 매물 집계 기반 시세를 조회합니다. 9/11 버닝 월드 통합 직후라{" "}
          <span className="font-semibold text-ink">시세 변동이 클 수 있는 시기</span>이니 최근 매물 수(건수)를 함께 확인하세요.
        </p>
      </header>

      <section className="pixel-panel space-y-3 p-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="아이템 이름 검색 — 예: 폴암 공격력, 스탠스, 다이아몬드"
            className="w-full rounded border border-edge bg-surface px-3 py-2.5 text-sm text-ink"
          />
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded border border-edge bg-surface shadow-lg">
              {results.map((it) => (
                <li key={it.id}>
                  <button
                    onClick={() => {
                      setSelected(it);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${API_BASE}/api/icon/item/${it.id}`} alt="" className="h-6 w-6 object-contain" loading="lazy"
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                    {it.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => setSelected(p)} className="rounded bg-surface2 px-2 py-1 text-xs text-dim hover:text-maple">
              {p.name}
            </button>
          ))}
        </div>
        {catalogError && <p className="text-xs text-red-500">아이템 목록을 불러오지 못했습니다 — 잠시 후 새로고침해 주세요.</p>}
      </section>

      {selected && (
        <section className="pixel-panel p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${API_BASE}/api/icon/item/${selected.id}`} alt="" className="h-10 w-10 object-contain"
              onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
            <div className="min-w-0">
              <h2 className="font-semibold text-ink">{selected.name}</h2>
              <Link href={`/items/${selected.id}`} className="text-xs text-maple hover:underline">아이템 상세 보기 →</Link>
            </div>
            <div className="ml-auto text-right">
              <div className="font-pixel text-xl font-bold text-maple">{last ? `${fmtMeso(last.avg)} 메소` : "매물 없음"}</div>
              {last && <div className="text-xs text-dim">{last.time} · 매물 {last.count}건 평균{last.min != null && last.max != null && last.min !== last.max ? ` · ${fmtMeso(last.min)}~${fmtMeso(last.max)}` : ""}</div>}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1">
            {(["sell", "buy"] as const).map((s) => (
              <button key={s} onClick={() => setSide(s)} className={`pixel-btn px-3 py-1.5 text-xs ${side === s ? "bg-maple text-white" : ""}`}>
                {s === "sell" ? "팝니다" : "삽니다"}
              </button>
            ))}
            <span className="mx-2 text-edge">|</span>
            {(Object.keys(RESOLUTION_LABEL) as Resolution[]).map((r) => (
              <button key={r} onClick={() => setResolution(r)} className={`pixel-btn px-3 py-1.5 text-xs ${resolution === r ? "bg-maple text-white" : ""}`}>
                {RESOLUTION_LABEL[r]}
              </button>
            ))}
          </div>

          <div className="mt-3">
            {quoteLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-dim">시세 불러오는 중...</div>
            ) : points.length > 0 ? (
              <PriceChart points={points} />
            ) : (
              <div className="flex h-24 items-center justify-center text-sm text-dim">
                이 기간에는 집계된 매물이 없습니다 — 주봉/월봉으로 바꿔보세요.
              </div>
            )}
          </div>

          {points.length > 0 && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[480px] text-xs">
                <thead className="border-b border-edge text-left text-dim">
                  <tr><th className="px-2 py-1">기간</th><th className="px-2 py-1">평균가</th><th className="px-2 py-1">최저~최고</th><th className="px-2 py-1">매물</th></tr>
                </thead>
                <tbody>
                  {points.slice(-8).reverse().map((p) => (
                    <tr key={p.time} className="border-b border-edge/40 last:border-0">
                      <td className="px-2 py-1 text-dim">{p.time}</td>
                      <td className="px-2 py-1 font-semibold text-ink">{fmtMeso(p.avg)}</td>
                      <td className="px-2 py-1 text-dim">{p.min != null && p.max != null ? `${fmtMeso(p.min)} ~ ${fmtMeso(p.max)}` : "-"}</td>
                      <td className="px-2 py-1 text-dim">{p.count}건</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="rounded-lg border border-edge bg-surface2 p-4 text-xs leading-relaxed text-dim">
        시세 데이터: <a href="https://matip.kr" target="_blank" rel="noreferrer" className="text-maple hover:underline">matip.kr</a> 거래소
        매물 집계 (5분 캐시 프록시). 실제 거래가와 다를 수 있으며, 매물이 적은 아이템일수록 평균가 신뢰도가 낮습니다.
        찰리중사 교환 효율은 <Link href="/charlie" className="text-maple hover:underline">찰리중사 교환</Link> 페이지에서 시세 연동으로 계산됩니다.
      </section>
    </div>
  );
}
