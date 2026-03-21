"use client";

import { useEffect, useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface BimaePost {
  id: number;
  nickname: string;
  job_class?: string;
  level?: number;
  reason?: string;
  image_url?: string;
  author: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
}

const JOB_GROUPS: { group: string; jobs: string[] }[] = [
  { group: "전사", jobs: ["히어로", "팔라딘", "다크나이트"] },
  { group: "마법사", jobs: ["불독 (F/P)", "썬콜 (I/L)", "비숍"] },
  { group: "궁수", jobs: ["보우마스터", "신궁"] },
  { group: "도적", jobs: ["나이트로드", "섀도어"] },
  { group: "해적", jobs: ["바이퍼", "캡틴"] },
  { group: "시그너스", jobs: ["소울마스터", "플레임위자드", "윈드브레이커", "나이트워커", "스트라이커"] },
];
const JOB_OPTIONS = ["", ...JOB_GROUPS.flatMap((g) => [g.group, ...g.jobs])];
const SORT_OPTIONS = [
  { value: "", label: "최신순" },
  { value: "upvotes", label: "추천순" },
  { value: "downvotes", label: "비추천순" },
  { value: "controversial", label: "논란순" },
];

export default function BimaePage() {
  const [posts, setPosts] = useState<BimaePost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const perPage = 20;

  // form
  const [nickname, setNickname] = useState("");
  const [jobClass, setJobClass] = useState("");
  const [level, setLevel] = useState("");
  const [reason, setReason] = useState("");
  const [author, setAuthor] = useState("");

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      if (sort) params.set("sort", sort);
      const res = await fetch(`${API_BASE}/api/bimae?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setTotal(data.total || 0);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [page, sort]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/bimae`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          job_class: jobClass || null,
          level: level ? Number(level) : null,
          reason: reason.trim() || null,
          author: author.trim() || "익명",
        }),
      });
      if (res.ok) {
        setNickname("");
        setJobClass("");
        setLevel("");
        setReason("");
        setAuthor("");
        setShowForm(false);
        setPage(1);
        fetchPosts();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(postId: number, type: "up" | "down") {
    try {
      const res = await fetch(`${API_BASE}/api/bimae/${postId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: type }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => prev.map((p) => (p.id === postId ? data.post : p)));
      }
    } catch { /* ignore */ }
  }

  function formatDate(iso: string) {
    try {
      const d = new Date(iso + "Z");
      return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">비매유저 박제 게시판</h1>
          <p className="text-sm text-gray-500 mt-1">진짜 비매인지 투표해보세요</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          {showForm ? "취소" : "박제하기"}
        </button>
      </div>

      {/* 등록 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">캐릭터 닉네임 *</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="박제할 캐릭터명"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">직업</label>
              <select
                value={jobClass}
                onChange={(e) => setJobClass(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                <option value="">선택 안함</option>
                {JOB_GROUPS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.jobs.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">레벨</label>
              <input
                type="number"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="ex) 135"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">작성자</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="익명"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">비매 의심 사유</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="왜 비매라고 생각하시나요? (장비, 메소, 행동 등)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !nickname.trim()}
              className="px-6 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "박제 등록"}
            </button>
          </div>
        </form>
      )}

      {/* 정렬 */}
      <div className="flex gap-2 mb-4">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => { setSort(o.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sort === o.value
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* 게시글 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          아직 박제된 유저가 없습니다. 첫 박제를 등록해보세요!
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const total = post.upvotes + post.downvotes;
            const ratio = total > 0 ? Math.round((post.upvotes / total) * 100) : 0;
            return (
              <div key={post.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold text-gray-800">{post.nickname}</span>
                      {post.job_class && (
                        <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">{post.job_class}</span>
                      )}
                      {post.level && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">Lv.{post.level}</span>
                      )}
                    </div>
                    {post.reason && (
                      <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{post.reason}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                      <span>{post.author}</span>
                      <span>{formatDate(post.created_at)}</span>
                    </div>
                  </div>

                  {/* 투표 영역 */}
                  <div className="flex flex-col items-center gap-1 ml-4 min-w-[80px]">
                    <button
                      onClick={() => vote(post.id, "up")}
                      className="w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      <span>{"진짜"}</span>
                      <span className="font-bold">{post.upvotes}</span>
                    </button>
                    <button
                      onClick={() => vote(post.id, "down")}
                      className="w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <span>{"거짓"}</span>
                      <span className="font-bold">{post.downvotes}</span>
                    </button>
                    {total > 0 && (
                      <div className="w-full mt-1">
                        <div className="h-1.5 bg-red-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full transition-all"
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 text-center mt-0.5">
                          비매 {ratio}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            이전
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
