"use client";

import { useEffect, useMemo, useState } from "react";
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
};

function spriteKey(ref: SpriteRef) {
  return `${ref.type}:${ref.id}`;
}

function formatDate(d?: string) {
  return d ? d.replaceAll("-", ".") : "";
}

function ArticleCard({
  article,
  spriteMap,
  lead = false,
}: {
  article: WeeklyArticle;
  spriteMap: Map<string, ResolvedSprite>;
  lead?: boolean;
}) {
  const sprites = (article.sprites ?? [])
    .map((r) => spriteMap.get(spriteKey(r)))
    .filter((s): s is ResolvedSprite => Boolean(s));

  return (
    <article className={lead ? "" : "pixel-card p-4"}>
      <div className="flex items-start gap-2 mb-2">
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
          className={`font-pixel font-bold text-ink leading-snug ${
            lead ? "text-lg sm:text-xl" : "text-sm"
          }`}
        >
          {article.title}
        </h3>
      </div>

      {sprites.length > 0 && (
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

      <div className={`text-ink leading-relaxed space-y-2 ${lead ? "text-sm sm:text-base" : "text-sm"}`}>
        {(article.paragraphs ?? []).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {(article.sources?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {article.sources!.map((src, i) => (
            <a
              key={i}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-maple hover:underline"
            >
              출처: {src.label} →
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
}: {
  section: WeeklySection;
  spriteMap: Map<string, ResolvedSprite>;
}) {
  return (
    <section className="pixel-panel p-4">
      <h2 className="font-pixel text-sm font-bold text-maple mb-3 pb-2 border-b-2 border-edge tracking-wide">
        {SECTION_ICONS[section.id] ?? "📌"} {section.heading}
      </h2>
      <div className="space-y-3">
        {section.articles.map((a, i) => (
          <ArticleCard key={i} article={a} spriteMap={spriteMap} />
        ))}
      </div>
    </section>
  );
}

export default function IssueView({ issue }: { issue: WeeklyIssue }) {
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
          {content.weather && <span>☀ {content.weather}</span>}
        </div>
        {content.subtitle && (
          <p className="mt-2 font-pixel text-sm text-ink">“{content.subtitle}”</p>
        )}
      </div>

      {/* 헤드라인 */}
      {headline && headline.articles.length > 0 && (
        <section className="pixel-panel p-5 border-maple">
          <h2 className="font-pixel text-sm font-bold text-maple mb-3 tracking-wide">
            {SECTION_ICONS.headline} {headline.heading}
          </h2>
          <div className="space-y-5">
            {headline.articles.map((a, i) => (
              <ArticleCard key={i} article={a} spriteMap={spriteMap} lead />
            ))}
          </div>
        </section>
      )}

      {/* 나머지 섹션 — 2열 신문 지면 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {rest.map((section) => (
          <SectionBlock key={section.id} section={section} spriteMap={spriteMap} />
        ))}
      </div>

      {content.credits && (
        <p className="text-center text-xs text-dim pt-2">{content.credits}</p>
      )}
    </div>
  );
}
