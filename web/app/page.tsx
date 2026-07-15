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

/* FTS 스니펫의 <b>…</b> 마커를 실제 하이라이트로 렌더 (innerHTML 미사용) */
function renderSnippet(snippet: string) {
  const parts = snippet.split(/<\/?b>/);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <b key={i} className="text-maple font-semibold">{part}</b>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
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
      { href: "/drop-search", label: "드롭 검색", icon: "🔍", desc: "아이템 드롭처 역검색" },
    ],
  },
  {
    label: "계산기",
    items: [
      { href: "/scroll", label: "주문서", icon: "📖", desc: "강화 시뮬레이터" },
      { href: "/exp", label: "경험치", icon: "📈", desc: "레벨업 계산" },
      { href: "/nhit", label: "엔방컷", icon: "⚔️", desc: "젠컷 계산" },
      { href: "/fee", label: "수수료", icon: "💰", desc: "거래 수수료" },
      { href: "/skill-sim", label: "스킬 시뮬레이터", icon: "✨", desc: "직업별 스킬 빌드 설계" },
      { href: "/gear-sim", label: "장비 세팅", icon: "🧰", desc: "장비 조합 스탯 · 데미지 시뮬" },
    ],
  },
  {
    label: "가이드",
    items: [
      { href: "/pq", label: "파티퀘스트", icon: "🏰", desc: "PQ 공략 및 보상" },
      { href: "/hunt", label: "사냥터 추천", icon: "🎯", desc: "레벨별 사냥터 가이드" },
      { href: "/leveling", label: "직업별 사냥터", icon: "🗺️", desc: "직업·레벨 구간별 육성 루트" },
      { href: "/tespia-bosses", label: "2.0 보스", icon: "⚔️", desc: "카오스 자쿰 · 핑크빈 · 무릉도장" },
      { href: "/events", label: "이벤트 정리", icon: "🗂️", desc: "진행 중 이벤트 요약 · 아카이브" },
      { href: "/job", label: "전직 가이드", icon: "📋", desc: "직업별 전직 경로" },
      { href: "/ship", label: "배 시간표", icon: "🚢", desc: "정기선 운항 시간" },
      { href: "/trap", label: "트랩 타이머", icon: "⏱️", desc: "트랩 주기 타이머" },
      { href: "/boss-timer", label: "혼테일 타이머", icon: "🐉", desc: "리저 · 공무 · 버프해제 쿨타임 보드" },
    ],
  },
  {
    label: "커뮤니티",
    items: [
      { href: "/news", label: "메랜 공홈 소식", icon: "📰", desc: "메이플랜드 공지/이벤트" },
      { href: "/channels", label: "스트리머 · 유튜버", icon: "📺", desc: "메랜 방송 · 영상 · 커뮤니티 모음" },
      { href: "/bimae", label: "비매박제", icon: "🚫", desc: "비매 유저 신고" },
      { href: "/community", label: "투표", icon: "🗳️", desc: "유저 투표 참여" },
    ],
  },
  {
    label: "놀이터",
    items: [
      { href: "/play", label: "룰렛 · 주사위", icon: "🎰", desc: "룰렛, 주사위 굴리기" },
      { href: "/lotto", label: "로또", icon: "🎱", desc: "랜덤 번호 생성" },
      { href: "/fortune", label: "오늘의 운세", icon: "🔮", desc: "메이플 운세 보기" },
      { href: "/quiz", label: "메이플 퀴즈", icon: "❓", desc: "스피드퀴즈 · 실루엣 퀴즈" },
      { href: "/daily-mob", label: "오늘의 몬스터", icon: "👾", desc: "매일 바뀌는 몬스터 추리" },
      { href: "/mapletle", label: "추억틀", icon: "🌡️", desc: "단어 유사도로 메랜 단어 추리" },
      { href: "/museum", label: "이세계 도감", icon: "🗃️", desc: "메랜에 없는 몹·아이템 구경" },
    ],
  },
  {
    label: "추억길드",
    items: [
      { href: "/guild", label: "공지 · 이벤트", icon: "📢", desc: "길드 공지사항" },
      { href: "/guild/members", label: "길드원 명단", icon: "👥", desc: "길드원 정보" },
      { href: "/guild/boss", label: "보스", icon: "🐉", desc: "보스 파티 · 기록" },
      { href: "/guild/board", label: "자유게시판", icon: "💬", desc: "길드원 소통" },
      { href: "/guild/discord", label: "디스코드 봇", icon: "🤖", desc: "봇 설정 · 알림" },
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
      {/* Hero — 필드가이드 표지 */}
      <section className="relative py-8 sm:py-10">
        {/* 단풍잎 흩날림 (reduced-motion이면 숨김) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {[
            { left: "8%", dur: "9s", delay: "0s", size: 14 },
            { left: "26%", dur: "12s", delay: "3s", size: 10 },
            { left: "52%", dur: "10s", delay: "1.5s", size: 12 },
            { left: "73%", dur: "13s", delay: "5s", size: 9 },
            { left: "90%", dur: "11s", delay: "2.5s", size: 13 },
          ].map((l, i) => (
            <img
              key={i}
              src="/leaf.svg"
              alt=""
              className="leaf-fall absolute -top-4"
              style={{ left: l.left, width: l.size, height: l.size, animationDuration: l.dur, animationDelay: l.delay }}
            />
          ))}
        </div>

        <div className="pixel-panel relative max-w-3xl mx-auto px-6 py-8 text-center">
          <div className="flex items-center justify-center gap-4">
            <img src="/mascot.png" alt="추억길드 마스코트" className="w-16 h-16 sm:w-20 sm:h-20 object-contain [image-rendering:pixelated]" />
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h1 className="font-pixel text-2xl sm:text-4xl leading-tight text-maple drop-shadow-[2px_2px_0_var(--c-border-lo)]">
                  메이플랜드 DB
                </h1>
                <span className="pixel-badge font-pixel text-[10px] bg-[color-mix(in_srgb,var(--c-maple)_20%,transparent)] text-maple self-start mt-1">
                  2.0
                </span>
              </div>
              <p className="font-pixel text-[11px] sm:text-xs text-dim mt-2">
                아이템 · 몬스터 · 맵 · NPC · 퀘스트 한 곳에서
              </p>
            </div>
          </div>
          <div className="max-w-2xl mx-auto mt-6">
            <SearchBar large />
          </div>
        </div>
      </section>

      {/* Search results */}
      {q ? (
        <section className="max-w-3xl mx-auto mt-6">
          <h2 className="font-pixel text-base mb-4 text-ink">
            <span className="text-maple">&ldquo;{q}&rdquo;</span> 검색 결과 ({total}건)
          </h2>
          {loading ? (
            <div className="text-center py-12 text-dim font-pixel text-sm">검색 중...</div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-dim font-pixel text-sm">결과가 없습니다</div>
          ) : (
            <div className="space-y-2">
              {results.map((r, i) => (
                <Link
                  key={`${r.entity_type}-${r.entity_id}-${i}`}
                  href={`${TYPE_PATHS[r.entity_type] || "/"}/${r.entity_id}`}
                  className="pixel-card block px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="pixel-badge text-[10px] bg-[color-mix(in_srgb,var(--c-maple)_18%,transparent)] text-maple">
                      {TYPE_LABELS[r.entity_type] || r.entity_type}
                    </span>
                    <span className="font-medium text-ink">{r.name_kr || r.name}</span>
                    {r.name_kr && r.name !== r.name_kr && (
                      <span className="text-xs text-dim">{r.name}</span>
                    )}
                  </div>
                  {r.snippet && (
                    <p className="text-sm text-dim mt-1 line-clamp-1">{renderSnippet(r.snippet)}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        /* Section groups */
        <section className="max-w-3xl mx-auto space-y-7 mt-8">
          {SECTION_GROUPS.map((group) => (
            <div key={group.label}>
              <h2 className="font-pixel text-[13px] text-maple mb-3 px-0.5 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-maple" />
                {group.label}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.items.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="pixel-card group p-4 text-center"
                  >
                    <div className="text-3xl mb-2 [image-rendering:pixelated] transition-transform group-hover:scale-110">{c.icon}</div>
                    <div className="font-pixel text-[12px] text-ink">{c.label}</div>
                    <div className="text-[11px] text-dim mt-1 leading-snug">{c.desc}</div>
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
