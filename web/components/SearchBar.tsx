"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useId } from "react";
import { useRouter } from "next/navigation";
import { searchSuggest } from "@/lib/api";
import type { SearchSuggestion } from "@/lib/types";
import { SEARCH_TYPE_META, searchFeatures, type SiteFeature } from "@/lib/siteFeatures";

interface GroupedSuggestions {
  type: string;
  label: string;
  items: SearchSuggestion[];
}

function groupByType(suggestions: SearchSuggestion[]): GroupedSuggestions[] {
  const order = ["item", "mob", "map", "npc", "quest", "skill", "post"];
  const map = new Map<string, SearchSuggestion[]>();
  for (const s of suggestions) {
    const list = map.get(s.entity_type) || [];
    list.push(s);
    map.set(s.entity_type, list);
  }
  return order
    .filter((t) => map.has(t))
    .map((t) => ({ type: t, label: SEARCH_TYPE_META[t]?.label || t, items: map.get(t)! }));
}

/* 키보드 내비게이션용 통합 행 — 기능 바로가기(로컬 매칭)가 먼저, 엔티티 제안이 뒤 */
type SuggestRow =
  | { kind: "feature"; feature: SiteFeature }
  | { kind: "entity"; suggestion: SearchSuggestion };

export default function SearchBar({ large = false }: { large?: boolean }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const listboxId = useId();

  // 기능/가이드 페이지는 로컬 데이터라 디바운스 없이 즉시 매칭
  const featureMatches = useMemo(() => (query.trim() ? searchFeatures(query.trim(), 4) : []), [query]);

  const flatList: SuggestRow[] = useMemo(
    () => [
      ...featureMatches.map((feature) => ({ kind: "feature" as const, feature })),
      ...suggestions.map((suggestion) => ({ kind: "entity" as const, suggestion })),
    ],
    [featureMatches, suggestions]
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    try {
      const data = await searchSuggest(q, 10);
      setSuggestions(data.suggestions);
      setOpen(data.suggestions.length > 0 || searchFeatures(q, 4).length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
    }
  }, []);

  function handleChange(q: string) {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    // 기능 매칭은 즉시 노출, 엔티티 제안은 디바운스 후 합류
    setOpen(searchFeatures(q.trim(), 4).length > 0 || suggestions.length > 0);
    setActiveIndex(-1);
    timer.current = setTimeout(() => fetchSuggestions(q), 300);
  }

  function goToRow(row: SuggestRow) {
    setOpen(false);
    if (row.kind === "feature") {
      router.push(row.feature.href);
      return;
    }
    const path = SEARCH_TYPE_META[row.suggestion.entity_type]?.path;
    if (path) router.push(`${path}/${row.suggestion.entity_id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || flatList.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < flatList.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatList.length - 1));
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing && activeIndex >= 0) {
      e.preventDefault();
      goToRow(flatList[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIndex >= 0 && open) {
      goToRow(flatList[activeIndex]);
      return;
    }
    if (query.trim()) {
      setOpen(false);
      router.push(`/?q=${encodeURIComponent(query.trim())}`);
    }
  }

  const grouped = groupByType(suggestions);

  // Build a flat index mapping for keyboard navigation within grouped display
  let flatIdx = 0;

  return (
    <div ref={ref} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dim z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => flatList.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-label="메이플랜드 통합 검색"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
            placeholder="아이템, 몬스터, 맵, 퀘스트, 공략 검색..."
            className={`pixel-input w-full pl-12 pr-4 ${large ? "py-4 text-base" : "py-2.5 text-sm"}`}
          />
        </div>
      </form>
      {open && flatList.length > 0 && (
        <div id={listboxId} role="listbox" aria-label="검색 제안" className="pixel-panel absolute z-50 w-full mt-2 max-h-96 overflow-y-auto">
          {featureMatches.length > 0 && (
            <div role="group" aria-label="기능 · 가이드">
              <div aria-hidden className="px-4 py-1.5 text-xs font-semibold text-maple bg-[color-mix(in_srgb,var(--c-maple)_16%,transparent)] sticky top-0">
                기능 · 가이드
              </div>
              {featureMatches.map((feature) => {
                const currentIdx = flatIdx++;
                const isActive = currentIdx === activeIndex;
                return (
                  <button
                    key={feature.href}
                    id={`${listboxId}-option-${currentIdx}`}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => goToRow({ kind: "feature", feature })}
                    onMouseEnter={() => setActiveIndex(currentIdx)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 border-b border-edge/50 last:border-0 transition-colors ${isActive ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]" : "hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"}`}
                  >
                    <span className="text-xl w-8 text-center flex-shrink-0" aria-hidden>{feature.icon}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-ink block truncate">{feature.label}</span>
                      <span className="text-xs text-dim block truncate">{feature.description}</span>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 bg-[color-mix(in_srgb,var(--c-maple)_18%,transparent)] text-maple">
                      바로가기
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {grouped.map((group) => {
            const colors = SEARCH_TYPE_META[group.type] || { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-700 dark:text-gray-300" };
            return (
              <div key={group.type} role="group" aria-label={group.label}>
                <div aria-hidden className={`px-4 py-1.5 text-xs font-semibold ${colors.text} ${colors.bg} sticky top-0`}>
                  {group.label}
                </div>
                {group.items.map((s) => {
                  const currentIdx = flatIdx++;
                  const isActive = currentIdx === activeIndex;
                  return (
                    <button
                      key={`${s.entity_type}-${s.entity_id}`}
                      id={`${listboxId}-option-${currentIdx}`}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => goToRow({ kind: "entity", suggestion: s })}
                      onMouseEnter={() => setActiveIndex(currentIdx)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 border-b border-edge/50 last:border-0 transition-colors ${isActive ? "bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]" : "hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"}`}
                    >
                      {s.icon_url && (
                        <img src={s.icon_url} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-ink block truncate">
                          {s.name_kr || s.name}
                        </span>
                        {s.name_kr && s.name_kr !== s.name && (
                          <span className="text-xs text-dim block truncate">{s.name}</span>
                        )}
                        {(s.variant_count || 0) > 1 && (
                          <span className="text-[10px] text-dim block">같은 이름의 ID 변형 {s.variant_count}개</span>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${colors.bg} ${colors.text}`}>
                        {SEARCH_TYPE_META[s.entity_type]?.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {open ? `검색 제안 ${flatList.length}개` : ""}
      </span>
    </div>
  );
}
