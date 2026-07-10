"use client";

import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { getNews, getNewsPost } from "@/lib/api";
import type { MapleLandPost } from "@/lib/types";

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

function PostItem({ post, defaultExpanded = false }: { post: MapleLandPost; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

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

export default function NewsPage() {
  const [posts, setPosts] = useState<MapleLandPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const source = "main";
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

  // 디스코드 알림 등에서 ?post={id} 딥링크로 진입 시 해당 글을 상단에 펼쳐서 표시
  const [pinnedPost, setPinnedPost] = useState<MapleLandPost | null>(null);
  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get("post");
    if (!pid) return;
    getNewsPost(pid)
      .then((d) => setPinnedPost(d.post))
      .catch(() => setPinnedPost(null));
  }, []);

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
        <h1 className="font-pixel text-xl font-bold text-ink">메이플랜드 공식 소식</h1>
        <p className="text-sm text-dim mt-1">
          메이플랜드(2.0) 공식 공지 · 이벤트 · 개발일지를 최신순으로 모아봅니다.
        </p>
      </div>

      {/* 버닝 월드 안내 배너 */}
      <div className="pixel-panel p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">🔥</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-pixel text-sm text-maple">버닝 월드 진행 중</span>
              <span className="pixel-badge font-pixel text-[10px] bg-[color-mix(in_srgb,var(--c-mush)_18%,transparent)] text-mush">
                기간한정
              </span>
            </div>
            <p className="text-sm text-dim mt-1.5 leading-relaxed">
              2.0 콘텐츠가 즉시 적용된 이벤트 월드 ·{" "}
              <span className="text-ink">2026.6.19 ~ 9.11</span> 운영 ·{" "}
              Lv.120 미만 <span className="text-ink">경험치 1.5배</span>, 공·마/이속/점프 상시 버프.
              종료 후 <span className="text-ink">월드 리프</span>(본 월드 이전) ~2026.9.25.
            </p>
            <a
              href="https://maple.land/board/events"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-maple hover:underline font-pixel"
            >
              공식 이벤트 페이지 →
            </a>
          </div>
        </div>
      </div>

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
          {pinnedPost && (
            <div>
              <div className="font-pixel text-[10px] text-maple mb-1">📌 알림으로 열어본 글</div>
              <PostItem key={`pinned-${pinnedPost.post_id}`} post={pinnedPost} defaultExpanded />
            </div>
          )}
          {posts
            .filter((post) => post.post_id !== pinnedPost?.post_id)
            .map((post) => (
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
