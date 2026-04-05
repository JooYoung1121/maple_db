"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const DISCORD_INVITE = "https://discord.gg/2T7DNt54D";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PostType = "announcement" | "event";

interface GuildPost {
  id: number;
  post_type: PostType;
  title: string;
  content: string | null;
  author: string;
  created_at: string;
}

interface WriteState {
  post_type: PostType;
  title: string;
  content: string;
  author: string;
  password: string;
  loading: boolean;
  error: string;
}

interface DeleteState {
  id: number;
  password: string;
  loading: boolean;
  error: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(s: string) {
  return s.replace("T", " ").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Post Card
// ---------------------------------------------------------------------------

function PostCard({
  post,
  onDelete,
}: {
  post: GuildPost;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  post.post_type === "announcement"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {post.post_type === "announcement" ? "공지" : "이벤트"}
              </span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 dark:text-gray-200 truncate">{post.title}</span>
            </div>
            <div className="text-xs text-gray-400">
              {post.author} · {formatDate(post.created_at)}
            </div>
          </div>
          <span className="text-gray-400 shrink-0 text-sm">{expanded ? "▲" : "▾"}</span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4">
          {post.content ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{post.content}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">내용 없음</p>
          )}
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => onDelete(post.id)}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded"
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Write Modal
// ---------------------------------------------------------------------------

function WriteModal({
  state,
  setState,
  onSubmit,
  onClose,
}: {
  state: WriteState;
  setState: React.Dispatch<React.SetStateAction<WriteState>>;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const update = (field: keyof WriteState, val: string) =>
    setState((s) => ({ ...s, [field]: val, error: "" }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">글 작성</h3>

        <div className="flex gap-2">
          {(["announcement", "event"] as PostType[]).map((t) => (
            <button
              key={t}
              onClick={() => update("post_type", t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                state.post_type === t
                  ? t === "announcement"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-blue-100 text-blue-700"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200"
              }`}
            >
              {t === "announcement" ? "📢 공지사항" : "🎉 이벤트"}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={state.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="제목"
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <textarea
          value={state.content}
          onChange={(e) => update("content", e.target.value)}
          placeholder="내용 (선택)"
          rows={5}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        />
        <input
          type="text"
          value={state.author}
          onChange={(e) => update("author", e.target.value)}
          placeholder="작성자 (기본: 추억길드)"
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <input
          type="password"
          autoComplete="off"
          value={state.password}
          onChange={(e) => update("password", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="관리자 비밀번호"
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        {state.error && <p className="text-sm text-red-500">{state.error}</p>}
        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            disabled={state.loading}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            {state.loading ? "등록 중..." : "등록"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Modal
// ---------------------------------------------------------------------------

function DeleteModal({
  state,
  setState,
  onSubmit,
  onClose,
}: {
  state: DeleteState;
  setState: React.Dispatch<React.SetStateAction<DeleteState | null>>;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">게시글 삭제</h3>
        <input
          type="password"
          autoComplete="off"
          value={state.password}
          onChange={(e) => setState((s) => s ? { ...s, password: e.target.value, error: "" } : s)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="관리자 비밀번호"
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          autoFocus
        />
        {state.error && <p className="text-sm text-red-500">{state.error}</p>}
        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            disabled={state.loading}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            {state.loading ? "삭제 중..." : "삭제"}
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-semibold py-2 rounded-lg text-sm transition-colors">취소</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GuildPage() {
  const [activeTab, setActiveTab] = useState<PostType>("announcement");
  const [posts, setPosts] = useState<GuildPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [writeModal, setWriteModal] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [writeState, setWriteState] = useState<WriteState>({
    post_type: "announcement",
    title: "",
    content: "",
    author: "추억길드",
    password: "",
    loading: false,
    error: "",
  });

  const fetchPosts = useCallback(async (type: PostType) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/guild/posts?post_type=${type}&per_page=50`);
      if (!res.ok) return;
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPosts(activeTab); }, [activeTab, fetchPosts]);

  const handleWrite = async () => {
    if (!writeState.title.trim()) {
      setWriteState((s) => ({ ...s, error: "제목을 입력하세요." }));
      return;
    }
    setWriteState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const res = await fetch(`${API_BASE}/api/guild/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Password": writeState.password },
        body: JSON.stringify({
          post_type: writeState.post_type,
          title: writeState.title,
          content: writeState.content || null,
          author: writeState.author || "추억길드",
        }),
      });
      if (res.ok) {
        setWriteModal(false);
        setWriteState({ post_type: "announcement", title: "", content: "", author: "추억길드", password: "", loading: false, error: "" });
        fetchPosts(activeTab);
      } else {
        const data = await res.json().catch(() => ({}));
        setWriteState((s) => ({ ...s, loading: false, error: (data as { detail?: string }).detail ?? "오류가 발생했습니다." }));
      }
    } catch {
      setWriteState((s) => ({ ...s, loading: false, error: "네트워크 오류가 발생했습니다." }));
    }
  };

  const handleDelete = async () => {
    if (!deleteState) return;
    setDeleteState((s) => s ? { ...s, loading: true, error: "" } : s);
    try {
      const res = await fetch(`${API_BASE}/api/guild/posts/${deleteState.id}`, {
        method: "DELETE",
        headers: { "X-Admin-Password": deleteState.password },
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== deleteState.id));
        setDeleteState(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteState((s) => s ? { ...s, loading: false, error: (data as { detail?: string }).detail ?? "비밀번호가 틀렸습니다." } : s);
      }
    } catch {
      setDeleteState((s) => s ? { ...s, loading: false, error: "네트워크 오류가 발생했습니다." } : s);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">추억길드</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">메이플랜드 추억길드 전용 공간입니다.</p>
      </div>

      {/* Discord + 글쓰기 */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {DISCORD_INVITE ? (
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            디스코드 참여하기
          </a>
        ) : (
          <button
            disabled
            className="flex items-center gap-2 bg-gray-200 text-gray-400 font-semibold px-5 py-2.5 rounded-xl text-sm cursor-not-allowed"
            title="디스코드 링크 준비 중"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            디스코드 (준비 중)
          </button>
        )}
        <button
          onClick={() => setWriteModal(true)}
          className="ml-auto flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
        >
          + 글쓰기
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200 dark:border-gray-700">
        {([["announcement", "📢 공지사항"], ["event", "🎉 이벤트"]] as [PostType, string][]).map(([type, label]) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === type ? "border-orange-500 text-orange-600 bg-white dark:bg-gray-800" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Post list */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">불러오는 중...</p>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">
            {activeTab === "announcement" ? "등록된 공지사항이 없습니다." : "등록된 이벤트가 없습니다."}
          </p>
          <p className="text-gray-300 text-xs mt-1">관리자가 글을 등록하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={(id) => setDeleteState({ id, password: "", loading: false, error: "" })} />
          ))}
        </div>
      )}

      {/* Modals */}
      {writeModal && (
        <WriteModal
          state={writeState}
          setState={setWriteState}
          onSubmit={handleWrite}
          onClose={() => setWriteModal(false)}
        />
      )}
      {deleteState && (
        <DeleteModal
          state={deleteState}
          setState={setDeleteState}
          onSubmit={handleDelete}
          onClose={() => setDeleteState(null)}
        />
      )}
    </div>
  );
}
