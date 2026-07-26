"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { resolveWeeklySprites } from "@/lib/api";
import type {
  ResolvedSprite,
  SpriteRef,
  WeeklyArticle,
  WeeklyIssue,
  WeeklySection,
} from "@/lib/types";

const SECTION_ICONS: Record<string, string> = {
  headline: "📰",
  official: "📢",
  community: "💬",
  research: "🔬",
  humor: "🍄",
  economy: "💰",
};

const TAG_COLORS: Record<string, string> = {
  패치: "bg-blue-100 text-blue-700",
  업데이트: "bg-blue-100 text-blue-700",
  이벤트: "bg-green-100 text-green-700",
  점검: "bg-yellow-100 text-yellow-700",
  제재: "bg-red-100 text-red-600",
  논란: "bg-red-100 text-red-600",
  여론: "bg-surface2 text-dim",
  공략: "bg-green-100 text-green-700",
  유머: "bg-surface2 text-dim",
};

function spriteKey(ref: SpriteRef) {
  return `${ref.type}:${ref.id}`;
}

function formatDate(d?: string) {
  return d ? d.replaceAll("-", ".") : "";
}

function formatCount(n?: number) {
  if (n == null) return null;
  return n >= 10000 ? `${(n / 10000).toFixed(1)}만` : n.toLocaleString();
}

function weatherIcon(weather: string) {
  if (weather.includes("천둥")) return "⛈";
  if (weather.includes("비") || weather.includes("소나기")) return "🌧";
  if (weather.includes("눈")) return "🌨";
  if (weather.includes("안개")) return "🌫";
  if (weather.includes("흐림") || weather.includes("구름")) return "☁";
  if (weather.includes("맑")) return "☀";
  return "🌤";
}

function MetricsChips({ article }: { article: WeeklyArticle }) {
  const m = article.metrics;
  if (!m) return null;
  const parts: string[] = [];
  const rec = formatCount(m.recommends);
  const views = formatCount(m.views);
  const comments = formatCount(m.comments);
  if (rec) parts.push(`👍 ${rec}`);
  if (views) parts.push(`👁 ${views}`);
  if (comments) parts.push(`💬 ${comments}`);
  if (!parts.length) return null;
  return (
    <span className="text-[11px] text-dim whitespace-nowrap">{parts.join(" · ")}</span>
  );
}

function IssueImage({
  issueNo,
  slot,
  alt,
  className = "",
  priority = false,
}: {
  issueNo: number;
  slot: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={`/api/weekly-news/${issueNo}/images/${slot}`}
      alt={alt}
      className={`w-full h-auto border-2 border-edge ${className}`}
      style={{ imageRendering: "pixelated" }}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailed(true)}
    />
  );
}

function ArticleCard({
  article,
  spriteMap,
  issueNo,
  lead = false,
}: {
  article: WeeklyArticle;
  spriteMap: Map<string, ResolvedSprite>;
  issueNo: number;
  lead?: boolean;
}) {
  const sprites = (article.sprites ?? [])
    .map((r) => spriteMap.get(spriteKey(r)))
    .filter((s): s is ResolvedSprite => Boolean(s));
  const paragraphs = article.paragraphs ?? [];

  return (
    <article>
      <div className="flex items-start gap-2 mb-1.5 flex-wrap">
        {article.tag && (
          <span
            className={`pixel-badge inline-block text-xs font-medium shrink-0 ${
              TAG_COLORS[article.tag] ?? "bg-surface2 text-dim"
            }`}
          >
            {article.tag}
          </span>
        )}
        <h3
          className={`font-pixel font-bold text-ink leading-snug flex-1 min-w-0 ${
            lead ? "text-lg sm:text-xl" : "text-sm"
          }`}
        >
          {article.title}
        </h3>
        <MetricsChips article={article} />
      </div>

      {article.card_slot && (
        <div className="mb-2">
          <IssueImage issueNo={issueNo} slot={article.card_slot} alt={article.title} />
        </div>
      )}

      {sprites.length > 0 && !article.card_slot && (
        <div className="flex items-end gap-2 mb-2">
          {sprites.map((s) => (
            <img
              key={spriteKey(s)}
              src={s.icon_url}
              alt={s.name}
              title={s.name}
              className={lead ? "h-12 w-auto" : "h-8 w-auto"}
              style={{ imageRendering: "pixelated" }}
              loading="lazy"
            />
          ))}
        </div>
      )}

      <div className="text-ink space-y-2">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className={
              lead && i === 0
                ? "text-base sm:text-lg font-medium leading-relaxed border-l-4 border-maple pl-3"
                : "text-sm leading-relaxed"
            }
          >
            {p}
          </p>
        ))}
      </div>

      {(article.sources?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
          {article.sources!.map((src, i) => (
            <a
              key={i}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex py-1 text-xs text-dim hover:text-maple hover:underline"
            >
              ↗ {src.label}
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

function SectionBlock({
  section,
  spriteMap,
  issueNo,
}: {
  section: WeeklySection;
  spriteMap: Map<string, ResolvedSprite>;
  issueNo: number;
}) {
  return (
    <section id={`sec-${section.id}`} className="pixel-panel p-4 scroll-mt-20">
      <h2 className="font-pixel text-sm font-bold text-maple mb-1 pb-2 border-b-2 border-edge tracking-wide">
        {SECTION_ICONS[section.id] ?? "📌"} {section.heading}
      </h2>
      <div className="divide-y divide-edge/60">
        {section.articles.map((a, i) => (
          <div key={i} className="py-3 first:pt-2 last:pb-0">
            <ArticleCard article={a} spriteMap={spriteMap} issueNo={issueNo} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function IssueView({
  issue,
  topNavigation,
  bottomNavigation,
}: {
  issue: WeeklyIssue;
  topNavigation?: ReactNode;
  bottomNavigation?: ReactNode;
}) {
  const content = issue.content;
  const [spriteMap, setSpriteMap] = useState<Map<string, ResolvedSprite>>(new Map());

  const allRefs = useMemo(() => {
    const refs: SpriteRef[] = [];
    const seen = new Set<string>();
    for (const section of content?.sections ?? []) {
      for (const article of section.articles) {
        for (const ref of article.sprites ?? []) {
          const key = spriteKey(ref);
          if (!seen.has(key)) {
            seen.add(key);
            refs.push(ref);
          }
        }
      }
    }
    return refs;
  }, [content]);

  useEffect(() => {
    if (!allRefs.length) return;
    resolveWeeklySprites(allRefs)
      .then((d) => {
        setSpriteMap(new Map(d.sprites.map((s) => [spriteKey(s), s])));
      })
      .catch(() => setSpriteMap(new Map()));
  }, [allRefs]);

  if (!content) {
    return <p className="text-sm text-dim py-4">이 호의 내용을 불러올 수 없습니다.</p>;
  }

  const headline = content.sections.find((s) => s.id === "headline");
  const rest = content.sections.filter((s) => s.id !== "headline");
  const tldr = content.tldr ?? [];

  return (
    <div className="space-y-4">
      {/* 마스트헤드 */}
      <div className="pixel-panel p-5 text-center">
        <p className="text-xs text-dim mb-1 tracking-widest">MAPLELAND WEEKLY</p>
        <h1 className="font-pixel text-2xl sm:text-3xl font-bold text-maple mb-2">
          주간 메랜
        </h1>
        <div className="border-t-2 border-b-2 border-edge py-1.5 text-xs text-dim flex items-center justify-center gap-3 flex-wrap">
          <span className="font-pixel font-bold text-ink">제{issue.issue_no}호</span>
          <span>
            {formatDate(issue.week_start)} ~ {formatDate(issue.week_end)}
          </span>
          {content.weather && (
            <span>{weatherIcon(content.weather)} {content.weather}</span>
          )}
        </div>
        {content.subtitle && (
          <p className="mt-2 font-pixel text-sm text-ink">“{content.subtitle}”</p>
        )}
      </div>

      {topNavigation}

      {/* 표지 */}
      {content.cover && (
        <IssueImage
          issueNo={issue.issue_no}
          slot="cover"
          alt={content.subtitle || "표지"}
          priority
        />
      )}

      {/* 섹션 점프 칩 */}
      <nav className="flex flex-wrap gap-1.5 justify-center">
        {content.sections.map((s) => (
          <a
            key={s.id}
            href={`#sec-${s.id}`}
            className="pixel-badge text-xs bg-surface2 text-dim hover:text-maple"
          >
            {SECTION_ICONS[s.id] ?? "📌"} {s.heading}
          </a>
        ))}
      </nav>

      {/* 이번 호 한눈에 (TL;DR) */}
      {tldr.length > 0 && (
        <div className="bg-[color-mix(in_srgb,var(--c-maple)_12%,transparent)] border-2 border-maple p-4">
          <p className="font-pixel text-xs font-bold text-maple mb-2 tracking-wide">
            ⚡ 이번 호 한눈에
          </p>
          <ul className="space-y-1">
            {tldr.map((line, i) => (
              <li key={i} className="text-sm text-ink leading-relaxed flex gap-2">
                <span className="text-maple shrink-0">▸</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 헤드라인 */}
      {headline && headline.articles.length > 0 && (
        <section id="sec-headline" className="pixel-panel p-5 border-maple scroll-mt-20">
          <h2 className="font-pixel text-sm font-bold text-maple mb-3 tracking-wide">
            {SECTION_ICONS.headline} {headline.heading}
          </h2>
          <div className="space-y-5">
            {headline.articles.map((a, i) => (
              <ArticleCard key={i} article={a} spriteMap={spriteMap} issueNo={issue.issue_no} lead />
            ))}
          </div>
        </section>
      )}

      {/* 나머지 섹션 — 신문식 다단 컬럼 (그리드와 달리 열 높이 차이로 빈 공간이 생기지 않음) */}
      <div className="md:columns-2 md:gap-4">
        {rest.map((section) => (
          <div key={section.id} className="mb-4 md:break-inside-avoid">
            <SectionBlock section={section} spriteMap={spriteMap} issueNo={issue.issue_no} />
          </div>
        ))}
      </div>

      {content.credits && (
        <p className="text-center text-xs text-dim pt-2">{content.credits}</p>
      )}

      {bottomNavigation}
    </div>
  );
}
