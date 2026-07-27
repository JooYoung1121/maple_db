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
  spawn_maps?: {
    map_id: number;
    map_name: string;
    map_name_kr?: string | null;
    spawn_name?: string | null;
  }[];
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
      <h1 className="text-2xl font-bold mb-2 font-pixel text-ink">🔎 아이템 획득 경로</h1>
      <p className="text-dim mb-6">
        아이템을 고르면 드롭 몬스터와 그 몬스터가 출현하는 맵까지 한 번에 이어서 보여줍니다.
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
                    <span className="mr-2 text-dim">ID {item.id}</span>
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
            <div className="pixel-panel text-center py-10 text-dim">
              <p>등록된 드롭 정보가 없습니다.</p>
              <p className="text-xs mt-2">퀘스트 보상이나 메이커 제작 아이템일 수 있어요.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/quests" className="pixel-card px-3 py-2 text-sm">퀘스트 검색</Link>
                <Link href="/maker" className="pixel-card px-3 py-2 text-sm">메이커 확인</Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {dropSources.map((mob) => (
                <article key={mob.mob_id} className="pixel-card px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/mobs/${mob.mob_id}`} className="flex items-center gap-3 hover:text-maple">
                      <span className="text-2xl" aria-hidden>👾</span>
                      <span>
                        <span className="font-medium block">{mob.mob_name_kr || mob.mob_name}</span>
                        <span className="text-[10px] text-dim">몬스터 ID {mob.mob_id}</span>
                      </span>
                    </Link>
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
                  </div>
                  {(mob.spawn_maps || []).length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-edge/60">
                      <p className="text-[11px] text-dim mb-2">출현 맵 {(mob.spawn_maps || []).length}곳</p>
                      <div className="flex flex-wrap gap-2">
                        {(mob.spawn_maps || []).slice(0, 6).map((map) => (
                          <Link key={map.map_id} href={`/maps/${map.map_id}`} className="px-2 py-1 text-xs bg-surface2 border border-edge hover:text-maple">
                            🗺️ {map.map_name_kr || map.spawn_name || map.map_name}
                          </Link>
                        ))}
                        {(mob.spawn_maps || []).length > 6 && (
                          <span className="px-2 py-1 text-xs text-dim">+{(mob.spawn_maps || []).length - 6}곳</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 pt-3 border-t border-edge/60 text-xs text-dim">출현 맵 정보 없음 · 몬스터 상세에서 추가 정보를 확인하세요.</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 검색 전 안내 */}
      {!selectedItem && suggestions.length === 0 && !query && (
        <div className="text-center py-16 text-dim">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-lg">아이템 → 몬스터 → 출현 맵 순서로 찾아보세요</p>
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
