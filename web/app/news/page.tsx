"use client";

import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { getNews, getNewsPost } from "@/lib/api";
import type { MapleLandPost } from "@/lib/types";

const BOARDS = [
  { value: "", label: "전체" },
  { value: "notices", label: "공지사항" },
  { value: "events", label: "이벤트" },
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
  안내: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
  이벤트: "bg-green-100 text-green-700",
  제재: "bg-red-100 text-red-600",
  진행중: "bg-green-100 text-green-700",
  종료: "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
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
  const color = CATEGORY_COLORS[category] ?? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400";
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${color}`}>
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
      <div className="flex items-center gap-2 py-6 text-gray-400 text-sm">
        <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-orange-400 rounded-full animate-spin" />
        불러오는 중...
      </div>
    );
  }

  if (!post) {
    return <p className="text-sm text-gray-400 py-4">내용을 불러올 수 없습니다.</p>;
  }

  const summaryCard = post.summary ? (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 mb-4">
      <p className="text-xs font-bold text-orange-500 mb-2 tracking-wide">
        TL;DR
      </p>
      <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
        {post.summary}
      </div>
    </div>
  ) : null;

  if (post.content_html) {
    return (
      <>
        {summaryCard}
        <div
          className="news-content text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content_html) }}
        />
      </>
    );
  }

  if (post.content) {
    return (
      <>
        {summaryCard}
        <pre className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
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
      className="text-sm text-orange-500 underline"
    >
      원문 보기 →
    </a>
  );
}

function PostItem({ post }: { post: MapleLandPost }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-gray-50 dark:bg-gray-900 transition-colors"
      >
        <CategoryBadge category={post.category} />
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">{post.title}</span>
        <span className="text-xs text-gray-400 shrink-0 mt-0.5">{post.published_at ?? ""}</span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4">
          <PostContent postId={post.post_id} />
          {post.url && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-orange-500 hover:underline"
              >
                maple.land 원문 보기 →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewsPage() {
  const [posts, setPosts] = useState<MapleLandPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
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
      const data = await getNews({ board, category, q: query || undefined, page, per_page: PER_PAGE });
      setPosts(data.posts);
      setTotal(data.total);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [board, category, query, page]);

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

  function handleCategoryChange(v: string) {
    setCategory(v);
    setPage(1);
  }

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">메이플랜드 공식 공지</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          maple.land 공지사항 · 이벤트를 자동으로 수집합니다.
        </p>
      </div>

      {/* 검색 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="제목 · 내용 검색..."
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
        >
          검색
        </button>
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setInputVal(""); setPage(1); }}
            className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:bg-gray-900"
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
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              board === b.value
                ? "bg-orange-500 text-white"
                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-orange-300"
            }`}
          >
            {b.label}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => handleCategoryChange(c.value)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              category === c.value
                ? "bg-orange-500 text-white"
                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-orange-300"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 결과 수 */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>총 {total.toLocaleString()}건</span>
        <button
          onClick={() => setShowKeywordGuide((v) => !v)}
          className="text-orange-500 hover:underline text-xs"
        >
          {showKeywordGuide ? "키워드 가이드 닫기 ▲" : "검색 키워드 가이드 ▼"}
        </button>
      </div>

      {/* 키워드 가이드 */}
      {showKeywordGuide && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-orange-700">검색 키워드 가이드</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {KEYWORD_GUIDE.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{group.label}</p>
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
                      className="text-xs px-2 py-0.5 bg-white dark:bg-gray-800 border border-orange-200 text-orange-600 rounded-full hover:bg-orange-100 transition-colors"
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
          <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-orange-400 rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
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
            className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:text-orange-500"
          >
            «
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:text-orange-500"
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
                className={`px-3 py-1 text-sm rounded-lg ${
                  p === page ? "bg-orange-500 text-white font-medium" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-700"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:text-orange-500"
          >
            ›
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400 disabled:opacity-30 hover:text-orange-500"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}
