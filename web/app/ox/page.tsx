"use client";

import PageGuide from "@/components/PageGuide";
import { PAGE_GUIDES } from "@/lib/pageGuides";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getOxQuiz, type OxQuizItem, type OxQuizMeta } from "@/lib/api";

const CATS = [
  { key: "", label: "전체" },
  { key: "maple", label: "메이플" },
  { key: "general", label: "상식" },
] as const;

/* 서버 search_ox와 같은 규칙: 공백·문장부호 무시, 모든 단어 포함 */
const norm = (s: string) => s.replace(/[^0-9A-Za-z가-힣ㄱ-ㅎ]/g, "").toLowerCase();

function filterItems(items: OxQuizItem[], q: string) {
  const words = q.split(/\s+/).map(norm).filter(Boolean);
  if (!words.length) return items;
  const inQ: OxQuizItem[] = [];
  const inEx: OxQuizItem[] = [];
  for (const it of items) {
    const nq = norm(it.q);
    if (words.every((w) => nq.includes(w))) inQ.push(it);
    else if (words.every((w) => (nq + norm(it.ex)).includes(w))) inEx.push(it);
  }
  return [...inQ, ...inEx];
}

function AnswerBadge({ a }: { a: "O" | "X" }) {
  return (
    <span
      className={`shrink-0 w-12 h-12 flex items-center justify-center font-pixel text-2xl border-2 ${
        a === "O" ? "border-blue-500 text-blue-500 bg-blue-500/10" : "border-red-500 text-red-500 bg-red-500/10"
      }`}
    >
      {a}
    </span>
  );
}

function OxQuizContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<OxQuizItem[]>([]);
  const [meta, setMeta] = useState<OxQuizMeta | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [cat, setCat] = useState("");

  useEffect(() => {
    getOxQuiz()
      .then((d) => { setItems(d.items); setMeta(d.meta); })
      .catch(() => setError(true));
  }, []);

  const results = useMemo(
    () => filterItems(cat ? items.filter((it) => it.cat === cat) : items, q),
    [items, q, cat],
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold font-pixel">⭕ OX퀴즈 족보</h1>
        <PageGuide guide={PAGE_GUIDES["/ox"]} />
      </div>
      <p className="text-sm text-dim mb-4">
        3주년 &lsquo;추억의 이벤트&rsquo; — 매주 <strong className="text-ink">토요일 21시</strong> OX퀴즈 (일요일 21시는 올라올라).
        문제에 나온 단어 몇 개만 입력하면 정답을 찾아드립니다.{" "}
        <Link href="/events/mapleland-3rd-anniversary-2026" className="text-maple hover:underline">3주년 이벤트 정리 →</Link>
      </p>

      {meta?.warning && (
        <div className="pixel-card border-amber-500 p-3 mb-4 text-sm text-ink">
          ⚠️ {meta.warning} <span className="text-dim">🆕 표시 문항만 메랜 실제 출제에서 정답이 확인된 것입니다.</span>
        </div>
      )}

      <div className="pixel-panel p-4 mb-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="문제 일부 입력 (예: 왕도깨비, 길드 마크, 월드컵)"
          className="w-full pixel-input px-4 py-3 text-lg mb-3"
          autoFocus
        />
        <div className="flex flex-wrap items-center gap-2">
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`px-2.5 py-1 text-xs transition-colors ${cat === c.key ? "pixel-btn" : "bg-surface2 font-pixel text-dim hover:text-maple"}`}
            >
              {c.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-dim">
            {items.length ? `${results.length} / ${items.length}문제` : ""}
          </span>
        </div>
      </div>

      {error && <p className="text-center py-8 text-dim">족보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>}
      {!error && !items.length && <p className="text-center py-8 text-dim">불러오는 중...</p>}
      {items.length > 0 && results.length === 0 && (
        <p className="text-center py-8 text-dim">일치하는 문제가 없습니다. 단어를 줄이거나 다른 단어로 검색해보세요.</p>
      )}

      <div className="space-y-2">
        {results.slice(0, 100).map((it) => (
          <div key={it.id} className="pixel-card p-3 flex gap-3">
            <AnswerBadge a={it.a} />
            <div className="min-w-0 flex-1">
              <p className="text-ink font-medium break-keep">
                {it.basis === "observed" && (
                  <span className="mr-1.5 px-1.5 py-0.5 text-[11px] font-pixel bg-maple text-white align-middle">🆕 메랜 {it.seen?.slice(5).replace("-", "/")} 출제</span>
                )}
                {it.q}
              </p>
              {it.ex && <p className="text-sm text-dim mt-1 break-keep">{it.ex}</p>}
              {it.alt && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠ {it.alt.by}: {it.alt.a} — {it.alt.note}
                </p>
              )}
              {it.note && <p className="text-xs text-dim mt-1">※ {it.note}</p>}
              {it.sources?.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-xs text-dim hover:text-maple underline mr-2">
                  제보 {i + 1}
                </a>
              ))}
            </div>
          </div>
        ))}
        {results.length > 100 && (
          <p className="text-center text-xs text-dim py-2">상위 100건만 표시합니다. 단어를 더 입력해 좁혀보세요.</p>
        )}
      </div>

      {meta && (
        <div className="text-xs text-dim mt-6 space-y-1">
          <p>
            🆕 표시가 없는 문항의 정답은 원작(빅뱅 이전) OX 이벤트 해설 기준입니다. 원문 대부분은 해설만 있어
            O/X를 해설에서 판정했고, 메이플랜드는 문제·정답을 바꿔 내기도 하니 참고용으로만 봐주세요.
          </p>
          <p>
            출처:{" "}
            {meta.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-maple underline">{s.label}</a>
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}

export default function OxQuizPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-dim">로딩 중...</div>}>
      <OxQuizContent />
    </Suspense>
  );
}
