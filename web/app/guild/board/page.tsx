"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface Post {
  id: number;
  nickname: string;
  title: string;
  content: string;
  created_at: string;
  comment_count: number;
}

interface Comment {
  id: number;
  post_id: number;
  nickname: string;
  content: string;
  upvotes: number;
  created_at: string;
}

interface PostDetail extends Post {
  comments: Comment[];
}

type View = "list" | "detail" | "write";

export default function FreeBoardPage() {
  const [view, setView] = useState<View>("list");
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // 글 상세
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [commentSort, setCommentSort] = useState<"newest" | "upvotes">("newest");
  const [detailLoading, setDetailLoading] = useState(false);

  // 글쓰기
  const [nickname, setNickname] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [writeLoading, setWriteLoading] = useState(false);
  const [writeError, setWriteError] = useState("");

  // 댓글
  const [commentNickname, setCommentNickname] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // 관리자
  const [adminPw, setAdminPw] = useState("");
  const [showAdminInput, setShowAdminInput] = useState<string | null>(null);

  // 메시지
  const [msg, setMsg] = useState("");

  const perPage = 20;

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/guild/board/posts?page=${page}&per_page=${perPage}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setPosts(data.posts ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (view === "list") fetchPosts();
  }, [view, fetchPosts]);

  const fetchDetail = useCallback(async (postId: number, sort: "newest" | "upvotes") => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/guild/board/posts/${postId}?sort=${sort}`);
      if (!res.ok) throw new Error("failed");
      const data: PostDetail = await res.json();
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = (postId: number) => {
    setView("detail");
    setCommentSort("newest");
    fetchDetail(postId, "newest");
  };

  const handleSortChange = (sort: "newest" | "upvotes") => {
    setCommentSort(sort);
    if (detail) fetchDetail(detail.id, sort);
  };

  // 글 작성
  const handleWrite = async () => {
    if (!nickname.trim() || !title.trim() || !content.trim()) {
      setWriteError("닉네임, 제목, 내용을 모두 입력해주세요.");
      return;
    }
    setWriteLoading(true);
    setWriteError("");
    try {
      const res = await fetch(`${API_BASE}/api/guild/board/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), title: title.trim(), content: content.trim() }),
      });
      if (!res.ok) throw new Error("failed");
      setTitle("");
      setContent("");
      setView("list");
    } catch {
      setWriteError("글 작성 중 오류가 발생했습니다.");
    } finally {
      setWriteLoading(false);
    }
  };

  // 댓글 작성
  const handleComment = async () => {
    if (!detail || !commentNickname.trim() || !commentContent.trim()) return;
    setCommentLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/guild/board/posts/${detail.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: commentNickname.trim(), content: commentContent.trim() }),
      });
      if (!res.ok) throw new Error("failed");
      setCommentContent("");
      fetchDetail(detail.id, commentSort);
    } catch { /* ignore */ } finally {
      setCommentLoading(false);
    }
  };

  // 댓글 추천
  const handleUpvote = async (commentId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/guild/board/comments/${commentId}/upvote`, { method: "POST" });
      if (res.status === 409) {
        setMsg("이미 추천하셨습니다.");
        setTimeout(() => setMsg(""), 2000);
        return;
      }
      if (!res.ok) throw new Error("failed");
      if (detail) fetchDetail(detail.id, commentSort);
    } catch { /* ignore */ }
  };

  // 글 삭제
  const handleDeletePost = async (postId: number) => {
    if (!adminPw) return;
    try {
      const res = await fetch(`${API_BASE}/api/guild/board/posts/${postId}`, { method: "DELETE", headers: { "X-Admin-Password": adminPw } });
      if (res.status === 403) {
        setMsg("비밀번호가 틀립니다.");
        setTimeout(() => setMsg(""), 2000);
        return;
      }
      if (!res.ok) throw new Error("failed");
      setAdminPw("");
      setShowAdminInput(null);
      setView("list");
    } catch { /* ignore */ }
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId: number) => {
    if (!adminPw) return;
    try {
      const res = await fetch(`${API_BASE}/api/guild/board/comments/${commentId}`, { method: "DELETE", headers: { "X-Admin-Password": adminPw } });
      if (res.status === 403) {
        setMsg("비밀번호가 틀립니다.");
        setTimeout(() => setMsg(""), 2000);
        return;
      }
      if (!res.ok) throw new Error("failed");
      setAdminPw("");
      setShowAdminInput(null);
      if (detail) fetchDetail(detail.id, commentSort);
    } catch { /* ignore */ }
  };

  const totalPages = Math.ceil(total / perPage);

  // ── 글쓰기 뷰 ──
  if (view === "write") {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setView("list")} className="text-sm text-gray-500 hover:text-orange-500 mb-4">&larr; 목록으로</button>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900">글쓰기</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임"
              maxLength={20}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              maxLength={100}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요"
              rows={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>
          {writeError && <p className="text-red-500 text-sm">{writeError}</p>}
          <button
            onClick={handleWrite}
            disabled={writeLoading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {writeLoading ? "작성 중..." : "글 작성"}
          </button>
        </div>
      </div>
    );
  }

  // ── 상세 뷰 ──
  if (view === "detail") {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setView("list")} className="text-sm text-gray-500 hover:text-orange-500 mb-4">&larr; 목록으로</button>

        {msg && (
          <div className="mb-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{msg}</div>
        )}

        {detailLoading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : !detail ? (
          <div className="text-center py-12 text-gray-400">글을 찾을 수 없습니다.</div>
        ) : (
          <div className="space-y-4">
            {/* 글 내용 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{detail.title}</h2>
                  <p className="text-xs text-gray-400 mt-1">{detail.nickname} · {new Date(detail.created_at).toLocaleDateString("ko-KR")}</p>
                </div>
                <div className="shrink-0">
                  {showAdminInput === `post-${detail.id}` ? (
                    <div className="flex gap-1 items-center">
                      <input
                        type="password"
                        autoComplete="off"
                        value={adminPw}
                        onChange={(e) => setAdminPw(e.target.value)}
                        placeholder="비밀번호"
                        className="border border-gray-300 rounded px-2 py-1 text-xs w-20"
                        onKeyDown={(e) => e.key === "Enter" && handleDeletePost(detail.id)}
                      />
                      <button onClick={() => handleDeletePost(detail.id)} className="text-xs text-red-500 hover:text-red-700">확인</button>
                      <button onClick={() => { setShowAdminInput(null); setAdminPw(""); }} className="text-xs text-gray-400">취소</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowAdminInput(`post-${detail.id}`)} className="text-xs text-gray-400 hover:text-red-500">삭제</button>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{detail.content}</div>
            </div>

            {/* 댓글 섹션 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">댓글 ({detail.comments.length})</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleSortChange("newest")}
                    className={`text-xs px-2.5 py-1 rounded-full ${commentSort === "newest" ? "bg-orange-100 text-orange-600 font-medium" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    최신순
                  </button>
                  <button
                    onClick={() => handleSortChange("upvotes")}
                    className={`text-xs px-2.5 py-1 rounded-full ${commentSort === "upvotes" ? "bg-orange-100 text-orange-600 font-medium" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    추천순
                  </button>
                </div>
              </div>

              {/* 댓글 목록 */}
              {detail.comments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">아직 댓글이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {detail.comments.map((c) => (
                    <div key={c.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-800">{c.nickname}</span>
                            <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString("ko-KR")}</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <button
                              onClick={() => handleUpvote(c.id)}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                              추천 {c.upvotes > 0 && c.upvotes}
                            </button>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {showAdminInput === `comment-${c.id}` ? (
                            <div className="flex gap-1 items-center">
                              <input
                                type="password"
                                autoComplete="off"
                                value={adminPw}
                                onChange={(e) => setAdminPw(e.target.value)}
                                placeholder="PW"
                                className="border border-gray-300 rounded px-2 py-1 text-xs w-16"
                                onKeyDown={(e) => e.key === "Enter" && handleDeleteComment(c.id)}
                              />
                              <button onClick={() => handleDeleteComment(c.id)} className="text-xs text-red-500">확인</button>
                              <button onClick={() => { setShowAdminInput(null); setAdminPw(""); }} className="text-xs text-gray-400">취소</button>
                            </div>
                          ) : (
                            <button onClick={() => setShowAdminInput(`comment-${c.id}`)} className="text-xs text-gray-400 hover:text-red-500">삭제</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 댓글 작성 */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <input
                  type="text"
                  value={commentNickname}
                  onChange={(e) => setCommentNickname(e.target.value)}
                  placeholder="닉네임"
                  maxLength={20}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <div className="flex gap-2">
                  <textarea
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder="댓글을 입력하세요"
                    rows={2}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />
                  <button
                    onClick={handleComment}
                    disabled={commentLoading}
                    className="self-end bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {commentLoading ? "..." : "등록"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── 목록 뷰 ──
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">자유게시판</h1>
        <button
          onClick={() => setView("write")}
          className="text-sm px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors font-medium"
        >
          글쓰기
        </button>
      </div>

      {msg && (
        <div className="mb-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{msg}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">게시글이 없습니다. 첫 글을 작성해보세요!</div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => openDetail(post.id)}
              className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-orange-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{post.title}</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {post.nickname} · {new Date(post.created_at).toLocaleDateString("ko-KR")}
                    {post.comment_count > 0 && (
                      <span className="text-orange-500 ml-2">[{post.comment_count}]</span>
                    )}
                  </p>
                </div>
              </div>
            </button>
          ))}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              >
                이전
              </button>
              <span className="text-sm text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
