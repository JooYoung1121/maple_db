"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchAll } from "@/lib/api";
import type { SearchResult } from "@/lib/types";

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

export default function SearchBar({ large = false }: { large?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(q: string) {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const data = await searchAll(q, undefined, 1, 8);
        setResults(data.results);
        setOpen(data.results.length > 0);
      } catch {
        setResults([]);
      }
    }, 300);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      setOpen(false);
      router.push(`/?q=${encodeURIComponent(query.trim())}`);
    }
  }

  function goTo(r: SearchResult) {
    setOpen(false);
    const path = TYPE_PATHS[r.entity_type];
    if (path) router.push(`${path}/${r.entity_id}`);
  }

  return (
    <div ref={ref} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="아이템, 몬스터, 맵, NPC, 퀘스트 검색..."
            className={`w-full pl-12 pr-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent ${large ? "py-4 text-lg" : "py-2.5 text-sm"}`}
          />
        </div>
      </form>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={`${r.entity_type}-${r.entity_id}-${i}`}
              onClick={() => goTo(r)}
              className="w-full text-left px-4 py-3 hover:bg-orange-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
            >
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                {TYPE_LABELS[r.entity_type] || r.entity_type}
              </span>
              <span className="font-medium text-gray-800">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
