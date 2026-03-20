"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { searchSuggest } from "@/lib/api";
import type { SearchSuggestion } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  item: "아이템",
  mob: "몬스터",
  map: "맵",
  npc: "NPC",
  quest: "퀘스트",
  blog: "블로그",
};

const TYPE_PATHS: Record<string, string> = {
  item: "/items",
  mob: "/mobs",
  map: "/maps",
  npc: "/npcs",
  quest: "/quests",
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  item: { bg: "bg-blue-100", text: "text-blue-700" },
  mob: { bg: "bg-red-100", text: "text-red-700" },
  map: { bg: "bg-green-100", text: "text-green-700" },
  npc: { bg: "bg-purple-100", text: "text-purple-700" },
  quest: { bg: "bg-yellow-100", text: "text-yellow-700" },
  blog: { bg: "bg-gray-100", text: "text-gray-700" },
};

interface GroupedSuggestions {
  type: string;
  label: string;
  items: SearchSuggestion[];
}

function groupByType(suggestions: SearchSuggestion[]): GroupedSuggestions[] {
  const order = ["item", "mob", "map", "npc", "quest", "blog"];
  const map = new Map<string, SearchSuggestion[]>();
  for (const s of suggestions) {
    const list = map.get(s.entity_type) || [];
    list.push(s);
    map.set(s.entity_type, list);
  }
  return order
    .filter((t) => map.has(t))
    .map((t) => ({ type: t, label: TYPE_LABELS[t] || t, items: map.get(t)! }));
}

export default function SearchBar({ large = false }: { large?: boolean }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Flat list for keyboard navigation
  const flatList = suggestions;

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
      setOpen(data.suggestions.length > 0);
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
    timer.current = setTimeout(() => fetchSuggestions(q), 300);
  }

  function goTo(s: SearchSuggestion) {
    setOpen(false);
    const path = TYPE_PATHS[s.entity_type];
    if (path) router.push(`${path}/${s.entity_id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || flatList.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < flatList.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatList.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      goTo(flatList[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIndex >= 0 && open) {
      goTo(flatList[activeIndex]);
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
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="아이템, 몬스터, 맵, NPC, 퀘스트 검색..."
            className={`w-full pl-12 pr-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent ${large ? "py-4 text-lg" : "py-2.5 text-sm"}`}
          />
        </div>
      </form>
      {open && grouped.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-96 overflow-y-auto">
          {grouped.map((group) => {
            const colors = TYPE_COLORS[group.type] || { bg: "bg-gray-100", text: "text-gray-700" };
            return (
              <div key={group.type}>
                <div className={`px-4 py-1.5 text-xs font-semibold ${colors.text} ${colors.bg} sticky top-0`}>
                  {group.label}
                </div>
                {group.items.map((s) => {
                  const currentIdx = flatIdx++;
                  const isActive = currentIdx === activeIndex;
                  return (
                    <button
                      key={`${s.entity_type}-${s.entity_id}`}
                      onClick={() => goTo(s)}
                      onMouseEnter={() => setActiveIndex(currentIdx)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 border-b border-gray-50 last:border-0 transition-colors ${isActive ? "bg-orange-50" : "hover:bg-orange-50"}`}
                    >
                      {s.icon_url && (
                        <img src={s.icon_url} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-gray-800 block truncate">
                          {s.name_kr || s.name}
                        </span>
                        {s.name_kr && s.name_kr !== s.name && (
                          <span className="text-xs text-gray-400 block truncate">{s.name}</span>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${colors.bg} ${colors.text}`}>
                        {TYPE_LABELS[s.entity_type]}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
