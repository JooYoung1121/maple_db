"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMaps, searchSuggest } from "@/lib/api";
import type { MapData, SearchSuggestion } from "@/lib/types";
import DatasetComparisonNotice from "@/components/DatasetComparisonNotice";

/* 자주 찾는 사냥터 바로가기 */
const POPULAR_MAPS: { id: number; label: string }[] = [
  { id: 240040510, label: "죽은 용의 둥지" },
  { id: 240040511, label: "남겨진 용의 둥지" },
  { id: 240040400, label: "와이번의 협곡" },
  { id: 270020300, label: "후회의 길3" },
  { id: 220050300, label: "시간의 통로" },
  { id: 105090300, label: "드레이크의 밥상" },
];

function MapsPageContent() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<MapData[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* 입력 → 자동완성 */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => {
      searchSuggest(q, 8, "map")
        .then((d) => { setSuggestions(d.suggestions || []); setOpen(true); setActiveIndex(-1); })
        .catch(() => setSuggestions([]));
    }, 150);
  }, [query]);

  function runSearch(q: string) {
    setOpen(false);
    const t = q.trim();
    if (!t) { setResults([]); setSearched(false); return; }
    setSearching(true);
    setSearched(true);
    getMaps({ q: t, per_page: 30 })
      .then((d) => { setResults(d.maps || []); setTotal(d.total || 0); })
      .catch(() => { setResults([]); setTotal(0); })
      .finally(() => setSearching(false));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((p) => (p < suggestions.length - 1 ? p + 1 : 0));
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((p) => (p > 0 ? p - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        router.push(`/maps/${suggestions[activeIndex].entity_id}`);
      } else {
        runSearch(query);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── 검색 허브 ── */}
      <div className="text-center pt-8 pb-6">
        <h1 className="font-pixel text-3xl font-bold text-ink mb-1">🗺 맵 검색</h1>
        <p className="text-sm text-dim">
          맵 이름을 검색하면 생김새 · 몬스터 스폰 위치 · 젠 수 · 드랍템을 볼 수 있습니다
        </p>
      </div>

      <DatasetComparisonNotice type="map" className="mb-5" />

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => { blurRef.current = setTimeout(() => setOpen(false), 150); }}
          placeholder="맵 이름 입력 — 예) 남겨진 용의 둥지, 시간의 신전"
          className="w-full pixel-input px-5 py-4 text-base"
          autoFocus
        />
        {open && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 pixel-panel divide-y divide-edge/40 max-h-80 overflow-y-auto">
            {suggestions.map((s, i) => (
              <Link
                key={s.entity_id}
                href={`/maps/${s.entity_id}`}
                onMouseDown={() => { if (blurRef.current) clearTimeout(blurRef.current); }}
                className={`block px-4 py-2.5 text-sm ${
                  i === activeIndex
                    ? "bg-[color-mix(in_srgb,var(--c-maple)_15%,transparent)]"
                    : "hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
                }`}
              >
                <span className="font-medium">{s.name_kr || s.name}</span>
                {s.name_kr && <span className="text-dim text-xs ml-2">{s.name}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 자주 찾는 사냥터 */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        <span className="text-xs text-dim">자주 찾는 곳:</span>
        {POPULAR_MAPS.map((m) => (
          <Link
            key={m.id}
            href={`/maps/${m.id}`}
            className="px-2.5 py-1 text-xs font-pixel border-2 border-edge text-dim hover:text-maple hover:border-maple transition-colors"
          >
            {m.label}
          </Link>
        ))}
      </div>

      {/* ── 검색 결과 ── */}
      <div className="mt-8">
        {searching ? (
          <div className="text-center py-10 text-dim">검색 중...</div>
        ) : searched ? (
          results.length > 0 ? (
            <>
              <p className="text-sm text-dim mb-2">총 {total.toLocaleString()}건</p>
              <div className="pixel-panel divide-y divide-edge/40">
                {results.map((m) => (
                  <Link
                    key={m.id}
                    href={`/maps/${m.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
                  >
                    <span>
                      <span className="font-medium">{m.name_kr || m.name}</span>
                      {m.name_kr && <span className="text-dim text-xs ml-2">{m.name}</span>}
                      {m.original_data_conflict && <span className="ml-2 border border-amber-400 px-1 py-0.5 font-pixel text-[8px] text-amber-700 dark:text-amber-300">원작 ID 충돌</span>}
                    </span>
                    <span className="text-xs text-dim flex items-center gap-2">
                      {m.is_town === 1 && <span className="text-skill">마을</span>}
                      <span>{m.street_name}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center py-10 text-dim text-sm">검색 결과가 없습니다</p>
          )
        ) : null}
      </div>
    </div>
  );
}

export default function MapsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-dim">로딩 중...</div>}>
      <MapsPageContent />
    </Suspense>
  );
}
