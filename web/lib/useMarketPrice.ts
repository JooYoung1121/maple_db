"use client";

/* 거래소 시세(matip 집계, /api/matip/*)에서 아이템 이름으로 최근 단가를 끌어오는 훅.
 *
 * 시뮬레이터 '사용 내역'의 단가 자동 채움용 — 이름이 정확히 일치하는 매물이 있을 때만 값을 주고,
 * 없으면 null (사용자가 직접 입력). 아이템 목록은 모듈 캐시(24h 서버 캐시와 동일 수명), 시세는 이름별 1회. */

import { useEffect, useState } from "react";

interface MatipItem { id: number; name: string }
interface QuotePoint { time: string; avg: number; count: number }

export interface MarketUnitPrice {
  price: number;   // 최근 일봉 판매 매물 평균가 (메소)
  time: string;    // 집계 일자
  count: number;   // 매물 수
  itemCode: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
let catalogPromise: Promise<MatipItem[]> | null = null;
const quoteCache = new Map<string, Promise<MarketUnitPrice | null>>();

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function loadCatalog(): Promise<MatipItem[]> {
  if (!catalogPromise) {
    catalogPromise = fetch(`${API_BASE}/api/matip/items`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => (Array.isArray(d) ? (d as MatipItem[]) : []))
      .catch(() => {
        catalogPromise = null; // 다음 호출에서 재시도
        return [];
      });
  }
  return catalogPromise;
}

export function lookupMarketPrice(name: string): Promise<MarketUnitPrice | null> {
  const key = norm(name);
  if (!key) return Promise.resolve(null);
  const cached = quoteCache.get(key);
  if (cached) return cached;
  const p = loadCatalog()
    .then((catalog) => {
      const hit = catalog.find((it) => norm(it.name) === key);
      if (!hit) return null;
      return fetch(`${API_BASE}/api/matip/quote?itemCode=${hit.id}&resolution=day`)
        .then((r) => (r.ok ? r.json() : null))
        .then((q) => {
          const points: QuotePoint[] = q?.sellActive ?? [];
          const last = points.length > 0 ? points[points.length - 1] : null;
          if (!last || !(last.avg > 0)) return null;
          return { price: Math.round(last.avg), time: last.time, count: last.count, itemCode: hit.id };
        });
    })
    .catch(() => null);
  quoteCache.set(key, p);
  return p;
}

/** 이름 목록 → 이름별 시세 (없으면 null). 이름이 바뀌면 다시 조회한다. */
export function useMarketPrices(names: string[]): Record<string, MarketUnitPrice | null> {
  const [prices, setPrices] = useState<Record<string, MarketUnitPrice | null>>({});
  const joined = names.join("\u0001");
  useEffect(() => {
    let cancelled = false;
    const list = joined ? joined.split("\u0001") : [];
    Promise.all(list.map((n) => lookupMarketPrice(n).then((p) => [n, p] as const))).then((entries) => {
      if (!cancelled) setPrices(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [joined]);
  return prices;
}
