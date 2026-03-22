"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import SearchBar from "@/components/SearchBar";
import { searchAll } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  item: "아이템", mob: "몬스터", map: "맵", npc: "NPC", quest: "퀘스트", blog: "블로그",
};
const TYPE_PATHS: Record<string, string> = {
  item: "/items", mob: "/mobs", map: "/maps", npc: "/npcs", quest: "/quests",
};
const CATEGORIES = [
  { href: "/items", label: "아이템", icon: "🗡️", desc: "무기, 방어구, 소비, 기타" },
  { href: "/mobs", label: "몬스터", icon: "👾", desc: "일반 몬스터, 보스" },
  { href: "/maps", label: "맵", icon: "🗺️", desc: "사냥터, 마을, 던전" },
  { href: "/npcs", label: "NPC", icon: "🧑", desc: "상점, 퀘스트 NPC" },
  { href: "/quests", label: "퀘스트", icon: "📜", desc: "메인, 서브 퀘스트" },
];

function HomeContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    setLoading(true);
    searchAll(q, undefined, 1, 50)
      .then((d) => { setResults(d.results); setTotal(d.total); })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div>
      {/* Hero */}
      <section className="text-center py-12">
        <div className="flex items-center justify-center gap-4 mb-2">
          <img src="/mascot.png" alt="추억길드 마스코트" className="w-20 h-20 object-contain drop-shadow-md" />
          <div>
            <h1 className="text-4xl font-bold">
              <span className="text-orange-500">메이플랜드</span> DB
            </h1>
            <p className="text-gray-500 mt-1">아이템, 몬스터, 맵, NPC, 퀘스트를 한 곳에서 검색하세요</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-6">
          <SearchBar large />
        </div>
      </section>

      {/* Search results */}
      {q ? (
        <section className="max-w-3xl mx-auto">
          <h2 className="text-lg font-semibold mb-4">
            &ldquo;{q}&rdquo; 검색 결과 ({total}건)
          </h2>
          {loading ? (
            <div className="text-center py-12 text-gray-400">검색 중...</div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-gray-400">결과가 없습니다</div>
          ) : (
            <div className="space-y-2">
              {results.map((r, i) => (
                <Link
                  key={`${r.entity_type}-${r.entity_id}-${i}`}
                  href={`${TYPE_PATHS[r.entity_type] || "/"}/${r.entity_id}`}
                  className="block bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-orange-300 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                      {TYPE_LABELS[r.entity_type] || r.entity_type}
                    </span>
                    <span className="font-medium">{r.name}</span>
                  </div>
                  {r.snippet && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{r.snippet}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        /* Category cards */
        <section className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-orange-300 hover:shadow-sm transition"
            >
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="font-semibold text-gray-800">{c.label}</div>
              <div className="text-xs text-gray-400 mt-1">{c.desc}</div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="text-center py-12">로딩 중...</div>}>
      <HomeContent />
    </Suspense>
  );
}
