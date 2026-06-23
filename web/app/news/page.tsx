"use client";

import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { getNews, getNewsPost, getTespiaPatchSummary } from "@/lib/api";
import type { MapleLandPost, TespiaPatchSummary } from "@/lib/types";

type SourceKey = "main" | "tespia";

const SOURCES: { value: SourceKey; label: string; caption: string }[] = [
  { value: "main", label: "본섭 공홈", caption: "maple.land" },
  { value: "tespia", label: "테스피아 2.0", caption: "tespia.maple.land" },
];

const BOARDS = [
  { value: "", label: "전체" },
  { value: "notices", label: "공지사항" },
  { value: "events", label: "이벤트" },
  { value: "devlog", label: "개발일지" },
];

const CATEGORIES = [
  { value: "", label: "전체" },
  { value: "업데이트", label: "업데이트" },
  { value: "점검", label: "점검" },
  { value: "안내", label: "안내" },
  { value: "이벤트", label: "이벤트" },
  { value: "제재", label: "제재" },
];

const CATEGORY_COLORS: Record<string, string> = {
  업데이트: "bg-blue-100 text-blue-700",
  점검: "bg-yellow-100 text-yellow-700",
  안내: "bg-surface2 text-dim",
  이벤트: "bg-green-100 text-green-700",
  제재: "bg-red-100 text-red-600",
  진행중: "bg-green-100 text-green-700",
  종료: "bg-surface2 text-dim",
};

const KEYWORD_GUIDE = [
  {
    label: "패치노트",
    keywords: ["패치노트", "업데이트", "추가", "변경", "개선"],
  },
  {
    label: "점검",
    keywords: ["점검", "무중단 배포", "서버 점검", "예정"],
  },
  {
    label: "이벤트",
    keywords: ["이벤트", "기간", "보상", "진행중", "종료"],
  },
  {
    label: "몬스터/아이템",
    keywords: ["몬스터", "마스터 몬스터", "아이템", "드롭"],
  },
  {
    label: "버그 수정",
    keywords: ["버그 수정", "수정", "오류", "기타 안내"],
  },
  {
    label: "제재",
    keywords: ["제재", "사행성", "홍보", "제재내역"],
  },
];

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const color = CATEGORY_COLORS[category] ?? "bg-surface2 text-dim";
  return (
    <span className={`pixel-badge inline-block text-xs font-medium shrink-0 ${color}`}>
      {category}
    </span>
  );
}

function PostContent({ postId }: { postId: string }) {
  const [post, setPost] = useState<MapleLandPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNewsPost(postId)
      .then((d) => setPost(d.post))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-dim text-sm">
        <div className="w-4 h-4 border-2 border-edge border-t-maple rounded-full animate-spin" />
        불러오는 중...
      </div>
    );
  }

  if (!post) {
    return <p className="text-sm text-dim py-4">내용을 불러올 수 없습니다.</p>;
  }

  const summaryCard = post.summary ? (
    <div className="bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] border-2 border-maple p-4 mb-4">
      <p className="font-pixel text-xs font-bold text-maple mb-2 tracking-wide">
        TL;DR
      </p>
      <div className="text-sm text-ink leading-relaxed whitespace-pre-line">
        {post.summary}
      </div>
    </div>
  ) : null;

  if (post.content_html) {
    return (
      <>
        {summaryCard}
        <div
          className="news-content text-sm text-ink leading-relaxed"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content_html) }}
        />
      </>
    );
  }

  if (post.content) {
    return (
      <>
        {summaryCard}
        <pre className="text-sm text-ink leading-relaxed whitespace-pre-wrap font-sans">
          {post.content}
        </pre>
      </>
    );
  }

  return (
    <a
      href={post.url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-maple underline"
    >
      원문 보기 →
    </a>
  );
}

function PostItem({ post }: { post: MapleLandPost }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pixel-card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] transition-colors"
      >
        <CategoryBadge category={post.category} />
        <span className="flex-1 text-sm font-medium text-ink leading-snug">
          {post.title}
          {post.updated_at && (
            <span className="ml-1.5 inline-block align-middle text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              수정됨
            </span>
          )}
        </span>
        <span className="text-xs text-dim shrink-0 mt-0.5">{post.published_at ?? ""}</span>
        <svg
          className={`w-4 h-4 text-dim shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-edge/40 px-4 py-4">
          <PostContent postId={post.post_id} />
          {post.url && (
            <div className="mt-4 pt-3 border-t border-edge/40">
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-maple hover:underline"
              >
                {post.source === "tespia" ? "tespia.maple.land" : "maple.land"} 원문 보기 →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TespiaSummaryPanel({ enabled }: { enabled: boolean }) {
  const [patches, setPatches] = useState<TespiaPatchSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    getTespiaPatchSummary(8)
      .then((d) => setPatches(d.patches || []))
      .catch(() => setPatches([]))
      .finally(() => setLoading(false));
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/30 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-sky-600 text-white">
              TEST
            </span>
            <h2 className="text-sm font-bold text-sky-900 dark:text-sky-100">테스피아 2.0 최신 패치 요약</h2>
          </div>
          <p className="text-xs text-sky-700/80 dark:text-sky-300/80 mt-1">
            테스트 서버 변경점은 본섭 반영 전 수치가 바뀔 수 있습니다.
          </p>
        </div>
        <a
          href="https://tespia.maple.land/board/notices"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-sky-700 dark:text-sky-300 hover:underline shrink-0"
        >
          원문 목록
        </a>
      </div>

      {loading ? (
        <div className="text-sm text-sky-600 dark:text-sky-300 py-3">요약 불러오는 중...</div>
      ) : patches.length === 0 ? (
        <div className="text-sm text-sky-600 dark:text-sky-300 py-3">수집된 테스피아 패치노트가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {patches.slice(0, 4).map((patch) => (
            <div key={patch.post_id} className="bg-surface border border-sky-100 dark:border-sky-900 rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {patch.version && (
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-200">
                    {patch.version}
                  </span>
                )}
                <a
                  href={patch.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-ink hover:text-sky-600"
                >
                  {patch.title}
                </a>
                <span className="text-xs text-dim">{patch.published_at}</span>
              </div>
              {patch.summary_lines.length > 0 && (
                <ul className="space-y-1">
                  {patch.summary_lines.slice(0, 4).map((line) => (
                    <li key={line} className="text-xs text-dim flex gap-2">
                      <span className="text-sky-500 shrink-0">-</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewsPage() {
  const [posts, setPosts] = useState<MapleLandPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<SourceKey>("main");
  const [board, setBoard] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKeywordGuide, setShowKeywordGuide] = useState(false);

  const PER_PAGE = 20;

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNews({ source, board, category, q: query || undefined, page, per_page: PER_PAGE });
      setPosts(data.posts);
      setTotal(data.total);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [source, board, category, query, page]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // /news 방문 시 배지 초기화
  useEffect(() => {
    localStorage.setItem("news_last_visit", new Date().toISOString());
    // NavBar 배지 갱신을 위해 storage 이벤트 발생
    window.dispatchEvent(new Event("storage"));
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(inputVal);
    setPage(1);
  }

  function handleBoardChange(v: string) {
    setBoard(v);
    setPage(1);
  }

  function handleSourceChange(v: SourceKey) {
    setSource(v);
    setBoard("");
    setCategory("");
    setPage(1);
  }

  function handleCategoryChange(v: string) {
    setCategory(v);
    setPage(1);
  }

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* 헤더 */}
      <div>
        <h1 className="font-pixel text-xl font-bold text-ink">메이플랜드 공식 소식</h1>
        <p className="text-sm text-dim mt-1">
          본섭 공홈 공지와 Mapleland 2.0 테스피아 공지를 나눠서 확인합니다.
        </p>
      </div>

      {/* 소스 탭 */}
      <div className="grid grid-cols-2 gap-2">
        {SOURCES.map((item) => (
          <button
            key={item.value}
            onClick={() => handleSourceChange(item.value)}
            className={`text-left px-4 py-3 transition-colors ${
              source === item.value
                ? "border-2 border-maple bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple"
                : "pixel-card text-dim hover:border-maple"
            }`}
          >
            <span className="block text-sm font-bold">{item.label}</span>
            <span className="block text-xs opacity-70 mt-0.5">{item.caption}</span>
          </button>
        ))}
      </div>

      <TespiaSummaryPanel enabled={source === "tespia"} />

      {/* 검색 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="제목 · 내용 검색..."
          className="pixel-input flex-1 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="pixel-btn px-4 py-2 text-sm font-medium"
        >
          검색
        </button>
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setInputVal(""); setPage(1); }}
            className="px-3 py-2 text-sm text-dim border-2 border-edge hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
          >
            초기화
          </button>
        )}
      </form>

      {/* 보드 탭 */}
      <div className="flex gap-2 flex-wrap">
        {BOARDS.map((b) => (
          <button
            key={b.value}
            onClick={() => handleBoardChange(b.value)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              board === b.value
                ? "pixel-btn"
                : "font-pixel text-dim hover:text-maple"
            }`}
          >
            {b.label}
          </button>
        ))}
        <div className="w-px bg-edge mx-1" />
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => handleCategoryChange(c.value)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              category === c.value
                ? "pixel-btn"
                : "font-pixel text-dim hover:text-maple"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 결과 수 */}
      <div className="flex items-center justify-between text-sm text-dim">
        <span>총 {total.toLocaleString()}건</span>
        <button
          onClick={() => setShowKeywordGuide((v) => !v)}
          className="text-maple hover:underline text-xs"
        >
          {showKeywordGuide ? "키워드 가이드 닫기 ▲" : "검색 키워드 가이드 ▼"}
        </button>
      </div>

      {/* 키워드 가이드 */}
      {showKeywordGuide && (
        <div className="bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] border-2 border-maple p-4 space-y-3">
          <p className="font-pixel text-sm font-medium text-maple">검색 키워드 가이드</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {KEYWORD_GUIDE.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-dim mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.keywords.map((kw) => (
                    <button
                      key={kw}
                      onClick={() => {
                        setInputVal(kw);
                        setQuery(kw);
                        setPage(1);
                        setShowKeywordGuide(false);
                      }}
                      className="text-xs px-2 py-0.5 border-2 border-maple text-maple rounded-full hover:bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] transition-colors"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 포스트 목록 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-edge border-t-maple rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-dim text-sm">
          {query ? `"${query}" 검색 결과가 없습니다.` : "공지가 없습니다. 잠시 후 다시 확인해 주세요."}
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <PostItem key={post.post_id} post={post} />
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1 pt-2">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-2 py-1 text-sm text-dim disabled:opacity-30 hover:text-maple"
          >
            «
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2 py-1 text-sm text-dim disabled:opacity-30 hover:text-maple"
          >
            ‹
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
            const p = start + i;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1 text-sm ${
                  p === page ? "pixel-btn font-medium" : "text-dim hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-2 py-1 text-sm text-dim disabled:opacity-30 hover:text-maple"
          >
            ›
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="px-2 py-1 text-sm text-dim disabled:opacity-30 hover:text-maple"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}
