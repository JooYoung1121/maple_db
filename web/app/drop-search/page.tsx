"use client";

import { useState, useEffect, useCallback } from "react";
import { getItems, getItem } from "@/lib/api";
import type { Item } from "@/lib/types";
import Link from "next/link";

interface DropSource {
  mob_id: number;
  mob_name: string;
  mob_name_kr?: string | null;
  drop_rate: number | null;
}

export default function DropSearchPage() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [dropSources, setDropSources] = useState<DropSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // 아이템 검색 (debounced)
  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearchLoading(true);
      getItems({ q: query, per_page: 20 })
        .then((d) => setSuggestions(d.items))
        .catch(() => setSuggestions([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // 아이템 선택 시 드롭처 조회
  const selectItem = useCallback((item: Item) => {
    setSelectedItem(item);
    setQuery(item.name_kr || item.name);
    setSuggestions([]);
    setLoading(true);
    getItem(item.id)
      .then((d) => setDropSources(d.dropped_by || []))
      .catch(() => setDropSources([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 font-pixel text-ink">드롭 검색</h1>
      <p className="text-dim mb-6">
        아이템 이름을 입력하면 해당 아이템을 드롭하는 몬스터를 찾아줍니다
      </p>

      {/* 검색 입력 */}
      <div className="relative mb-8">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedItem) setSelectedItem(null);
            }}
            placeholder="아이템 이름을 입력하세요 (예: 자쿰 투구, 메이플 클로)"
            className="pixel-input w-full pl-12 pr-4 py-4 text-lg"
          />
          {searchLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-maple border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* 자동완성 드롭다운 */}
        {suggestions.length > 0 && !selectedItem && (
          <div className="pixel-panel absolute z-10 w-full mt-1 max-h-80 overflow-y-auto">
            {suggestions.map((item) => (
              <button
                key={item.id}
                onClick={() => selectItem(item)}
                className="w-full text-left px-4 py-3 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] transition flex items-center gap-3 border-b border-edge/40 last:border-0"
              >
                {item.icon_url && (
                  <img src={item.icon_url} alt="" className="w-8 h-8 object-contain" />
                )}
                <div>
                  <div className="font-medium">{item.name_kr || item.name}</div>
                  <div className="text-xs text-dim">
                    {item.category && <span className="mr-2">{item.category}</span>}
                    {item.level_req > 0 && <span>Lv.{item.level_req}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 선택된 아이템 정보 */}
      {selectedItem && (
        <div className="pixel-panel p-5 mb-6">
          <div className="flex items-center gap-4">
            {selectedItem.icon_url && (
              <img src={selectedItem.icon_url} alt="" className="w-12 h-12 object-contain" />
            )}
            <div>
              <Link href={`/items/${selectedItem.id}`} className="text-lg font-bold hover:text-maple transition">
                {selectedItem.name_kr || selectedItem.name}
              </Link>
              <div className="flex gap-3 text-sm text-dim mt-1">
                {selectedItem.category && <span>{selectedItem.category}</span>}
                {selectedItem.level_req > 0 && <span>Lv.{selectedItem.level_req}+</span>}
                {selectedItem.job_req && <span>{selectedItem.job_req}</span>}
              </div>
              {selectedItem.stats && (
                <div className="text-sm text-dim mt-1">{selectedItem.stats}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 드롭 몬스터 목록 */}
      {selectedItem && (
        <div>
          <h2 className="text-lg font-semibold mb-3 font-pixel text-ink">
            드롭 몬스터 {!loading && <span className="text-maple">({dropSources.length})</span>}
          </h2>

          {loading ? (
            <div className="text-center py-12 text-dim">
              <div className="w-8 h-8 border-2 border-maple border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              검색 중...
            </div>
          ) : dropSources.length === 0 ? (
            <div className="pixel-panel text-center py-12 text-dim">
              드롭 정보가 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {dropSources.map((mob) => (
                <Link
                  key={mob.mob_id}
                  href={`/mobs/${mob.mob_id}`}
                  className="pixel-card flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">👾</span>
                    <span className="font-medium">{mob.mob_name_kr || mob.mob_name}</span>
                  </div>
                  {mob.drop_rate !== null && (
                    <span className={`text-sm font-mono px-2 py-1 rounded ${
                      mob.drop_rate >= 0.1
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : mob.drop_rate >= 0.01
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                          : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    }`}>
                      {(mob.drop_rate * 100).toFixed(2)}%
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 검색 전 안내 */}
      {!selectedItem && suggestions.length === 0 && !query && (
        <div className="text-center py-16 text-dim">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-lg">아이템을 검색해서 드롭 몬스터를 찾아보세요</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {["자쿰 투구", "메이플 클로", "골든 크로우", "아다만티움 방패"].map((name) => (
              <button
                key={name}
                onClick={() => setQuery(name)}
                className="px-3 py-1.5 bg-surface2 rounded-full text-sm hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] hover:text-maple transition"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
