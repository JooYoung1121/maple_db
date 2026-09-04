"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import HomeTodayBrief from "@/components/HomeTodayBrief";
import { searchAll } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import { CHANGELOG } from "@/lib/changelog";
import { isNewFeature } from "@/lib/newFeatures";
import { SEARCH_TYPE_META, SITE_SECTIONS, searchFeatures } from "@/lib/siteFeatures";

function renderSnippet(snippet: string) {
  const parts = snippet.split(/<\/?b>/);
  return parts.map((part, index) =>
    index % 2 === 1
      ? <b key={index} className="text-maple font-semibold">{part}</b>
      : <span key={index}>{part}</span>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    searchAll(query, undefined, 1, 50)
      .then((data) => {
        setResults(data.results);
        setTotal(data.total);
      })
      .catch(() => {
        setResults([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div>
      <section className="relative py-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {[
            { left: "8%", duration: "9s", delay: "0s", size: 14 },
            { left: "26%", duration: "12s", delay: "3s", size: 10 },
            { left: "52%", duration: "10s", delay: "1.5s", size: 12 },
            { left: "73%", duration: "13s", delay: "5s", size: 9 },
            { left: "90%", duration: "11s", delay: "2.5s", size: 13 },
          ].map((leaf, index) => (
            <img
              key={index}
              src="/leaf.svg"
              alt=""
              className="leaf-fall absolute -top-4"
              style={{
                left: leaf.left,
                width: leaf.size,
                height: leaf.size,
                animationDuration: leaf.duration,
                animationDelay: leaf.delay,
              }}
            />
          ))}
        </div>

        <div className="pixel-panel relative max-w-3xl mx-auto px-6 py-8 text-center">
          <div className="flex items-center justify-center gap-4">
            <img src="/mascot.png" alt="추억길드 마스코트" className="w-16 h-16 sm:w-20 sm:h-20 object-contain [image-rendering:pixelated]" />
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h1 className="font-pixel text-2xl sm:text-4xl leading-tight text-maple drop-shadow-[2px_2px_0_var(--c-border-lo)]">메이플랜드 DB</h1>
                <span className="pixel-badge font-pixel text-[10px] bg-[color-mix(in_srgb,var(--c-maple)_20%,transparent)] text-maple self-start mt-1">2.0</span>
              </div>
              <p className="font-pixel text-[11px] sm:text-xs text-dim mt-2">아이템 · 몬스터 · 맵 · NPC · 퀘스트 한 곳에서</p>
            </div>
          </div>
          <div className="max-w-2xl mx-auto mt-6">
            <SearchBar large />
          </div>
        </div>
      </section>

      {query ? (
        <section className="max-w-3xl mx-auto mt-6" aria-live="polite">
          <h2 className="font-pixel text-base mb-4 text-ink">
            <span className="text-maple">&ldquo;{query}&rdquo;</span> 검색 결과 ({total}건)
          </h2>
          {(() => {
            const featureMatches = searchFeatures(query, 8);
            if (featureMatches.length === 0) return null;
            return (
              <div className="mb-5">
                <h3 className="font-pixel text-[12px] text-maple mb-2">기능 · 가이드 바로가기</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {featureMatches.map((feature) => (
                    <Link key={feature.href} href={feature.href} className="pixel-card group px-3 py-2.5 flex items-center gap-2.5">
                      <span className="text-2xl" aria-hidden>{feature.icon}</span>
                      <span className="min-w-0">
                        <span className="font-pixel text-[12px] text-ink block truncate">{feature.label}</span>
                        <span className="text-[11px] text-dim block truncate">{feature.description}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
          {loading ? (
            <div className="text-center py-12 text-dim font-pixel text-sm">검색 중...</div>
          ) : results.length === 0 ? (
            searchFeatures(query, 1).length === 0 ? (
              <div className="text-center py-12 text-dim font-pixel text-sm">결과가 없습니다</div>
            ) : null
          ) : (
            <div className="space-y-2">
              {results.map((result) => {
                const meta = SEARCH_TYPE_META[result.entity_type];
                return (
                  <Link
                    key={`${result.entity_type}-${result.entity_id}`}
                    href={meta ? `${meta.path}/${result.entity_id}` : "/"}
                    className="pixel-card block px-4 py-3"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="pixel-badge text-[10px] bg-[color-mix(in_srgb,var(--c-maple)_18%,transparent)] text-maple">
                        {meta?.label || result.entity_type}
                      </span>
                      <span className="font-medium text-ink">{result.name_kr || result.name}</span>
                      {result.name_kr && result.name !== result.name_kr && <span className="text-xs text-dim">{result.name}</span>}
                      {(result.variant_count || 0) > 1 && <span className="text-[10px] text-dim">ID 변형 {result.variant_count}개</span>}
                    </div>
                    {result.snippet && <p className="text-sm text-dim mt-1 line-clamp-1">{renderSnippet(result.snippet)}</p>}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <>
          <HomeTodayBrief />
          <section className="max-w-3xl mx-auto mt-8">
            <div className="pixel-panel p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-pixel text-[13px] text-maple flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-maple" />
                  최근 업데이트
                </h2>
                <Link href="/version" className="text-[11px] text-dim hover:text-maple transition-colors">전체 보기 →</Link>
              </div>
              <ul className="space-y-1">
                {CHANGELOG.slice(0, 3).map((entry) => (
                  <li key={entry.version} className="flex items-baseline gap-2 text-sm">
                    <span className="font-pixel text-[10px] text-dim shrink-0">v{entry.version}</span>
                    <span className="truncate">{entry.title}</span>
                    <span className="text-[10px] text-dim ml-auto shrink-0">{entry.date.slice(5).replace("-", "/")}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="max-w-3xl mx-auto space-y-7 mt-8" aria-label="전체 기능">
            {SITE_SECTIONS.map((section) => (
              <div key={section.label}>
                <h2 className="font-pixel text-[13px] text-maple mb-3 px-0.5 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-maple" />
                  {section.label}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {section.items.map((feature) => (
                    <Link key={feature.href} href={feature.href} className="pixel-card group p-4 text-center">
                      <div className="text-3xl mb-2 [image-rendering:pixelated] transition-transform group-hover:scale-110" aria-hidden>{feature.icon}</div>
                      <div className="font-pixel text-[12px] text-ink">
                        {feature.homeLabel || feature.label}
                        {isNewFeature(feature.href) && <span className="font-pixel ml-1 text-[9px] text-mush border border-mush px-1 align-middle">N</span>}
                      </div>
                      <div className="text-[11px] text-dim mt-1 leading-snug">{feature.description}</div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </>
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
