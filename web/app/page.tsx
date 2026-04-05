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

const SECTION_GROUPS = [
  {
    label: "정보",
    items: [
      { href: "/items", label: "아이템", icon: "🗡️", desc: "무기, 방어구, 소비" },
      { href: "/mobs", label: "몬스터", icon: "👾", desc: "일반 몬스터, 보스" },
      { href: "/bosses", label: "보스", icon: "💀", desc: "보스 공략 정보" },
      { href: "/maps", label: "맵", icon: "🗺️", desc: "사냥터, 마을, 던전" },
      { href: "/npcs", label: "NPC", icon: "🧑", desc: "상점, 퀘스트 NPC" },
      { href: "/quests", label: "퀘스트", icon: "📜", desc: "메인, 서브 퀘스트" },
      { href: "/skills", label: "스킬", icon: "✨", desc: "직업별 스킬 정보" },
    ],
  },
  {
    label: "계산기",
    items: [
      { href: "/scroll", label: "주문서", icon: "📖", desc: "강화 시뮬레이터" },
      { href: "/exp", label: "경험치", icon: "📈", desc: "레벨업 계산" },
      { href: "/nhit", label: "엔방컷", icon: "⚔️", desc: "젠컷 계산" },
      { href: "/fee", label: "수수료", icon: "💰", desc: "거래 수수료" },
    ],
  },
  {
    label: "가이드",
    items: [
      { href: "/pq", label: "파티퀘스트", icon: "🏰", desc: "PQ 공략 및 보상" },
    ],
  },
  {
    label: "커뮤니티",
    items: [
      { href: "/bimae", label: "비매박제", icon: "🚫", desc: "비매 유저 신고" },
      { href: "/community", label: "투표", icon: "🗳️", desc: "유저 투표 참여" },
    ],
  },
  {
    label: "놀이터",
    items: [
      { href: "/play", label: "룰렛 · 주사위", icon: "🎰", desc: "룰렛, 주사위 굴리기" },
      { href: "/lotto", label: "로또", icon: "🎱", desc: "랜덤 번호 생성" },
    ],
  },
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
            <p className="text-gray-500 dark:text-gray-400 mt-1">아이템, 몬스터, 맵, NPC, 퀘스트를 한 곳에서 검색하세요</p>
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
                  className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 hover:border-orange-300 dark:hover:border-orange-500 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                      {TYPE_LABELS[r.entity_type] || r.entity_type}
                    </span>
                    <span className="font-medium">{r.name}</span>
                  </div>
                  {r.snippet && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{r.snippet}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        /* Section groups */
        <section className="max-w-3xl mx-auto space-y-8">
          {SECTION_GROUPS.map((group) => (
            <div key={group.label}>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
                {group.label}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.items.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center hover:border-orange-300 dark:hover:border-orange-500 hover:shadow-sm transition"
                  >
                    <div className="text-3xl mb-2">{c.icon}</div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{c.label}</div>
                    <div className="text-xs text-gray-400 mt-1">{c.desc}</div>
                  </Link>
                ))}
              </div>
            </div>
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
