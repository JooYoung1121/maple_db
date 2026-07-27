"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExcelTableView, ExcelSheet } from "./ExcelTableView";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface PostListItem {
  id: number;
  nickname: string;
  title: string;
  upvotes: number;
  views: number;
  created_at: string;
  has_excel: number;
  comment_count: number;
}

type View = "list" | "write";

function fmtDate(s: string) {
  if (!s) return "";
  return s.replace("T", " ").slice(0, 16);
}

export default function InfoBoardPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "upvotes">("newest");
  const [loading, setLoading] = useState(true);

  // write
  const [nickname, setNickname] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excelBase64, setExcelBase64] = useState<string | null>(null);
  const [excelName, setExcelName] = useState<string | null>(null);
  const [excelPreview, setExcelPreview] = useState<{ sheets: ExcelSheet[] } | null>(null);
  const [writeLoading, setWriteLoading] = useState(false);
  const [writeError, setWriteError] = useState("");

  const perPage = 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // 로그인 시 닉네임 프리필 (강제 아님 — 병행 모드)
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.display_name) setNickname((prev) => prev || d.user.display_name);
      })
      .catch(() => {});
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/guild/info/posts?page=${page}&per_page=${perPage}&sort=${sort}`);
      const data = await res.json();
      setPosts(data.posts ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [page, sort]);

  useEffect(() => {
    if (view === "list") fetchPosts();
  }, [view, fetchPosts]);

  const onExcelFile = async (file: File | null) => {
    if (!file) { setExcelBase64(null); setExcelName(null); setExcelPreview(null); return; }
    const b64: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    setExcelBase64(b64);
    setExcelName(file.name);
    try {
      const res = await fetch(`${API_BASE}/api/guild/info/excel/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excel_base64: b64 }),
      });
      if (res.ok) setExcelPreview((await res.json()).excel_json);
      else { setWriteError((await res.json().catch(() => ({}))).detail || "엑셀 미리보기 실패"); setExcelPreview(null); }
    } catch { setExcelPreview(null); }
  };

  const handleWrite = async () => {
    if (!nickname.trim() || !title.trim()) { setWriteError("닉네임과 제목을 입력해주세요."); return; }
    if (!content.trim() && !excelBase64) { setWriteError("내용 또는 엑셀을 첨부해주세요."); return; }
    setWriteLoading(true);
    setWriteError("");
    try {
      const res = await fetch(`${API_BASE}/api/guild/info/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(), title: title.trim(), content: content.trim(),
          excel_filename: excelName, excel_base64: excelBase64,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "등록 실패");
      const { id } = await res.json();
      router.push(`/guild/info/${id}`);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setWriteLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-pixel text-2xl font-bold text-ink">📋 정보공유 게시판</h1>
        {view === "list" ? (
          <button onClick={() => { setView("write"); setWriteError(""); }}
                  className="pixel-btn px-4 py-2 text-sm font-medium">글쓰기</button>
        ) : (
          <button onClick={() => setView("list")} className="pixel-btn px-4 py-2 text-sm">목록</button>
        )}
      </div>

      {view === "list" && (
        <div>
          <div className="flex gap-2 mb-3 text-sm">
            <button onClick={() => setSort("newest")} className={`px-3 py-1 ${sort === "newest" ? "pixel-btn" : "font-pixel text-dim hover:text-maple"}`}>최신순</button>
            <button onClick={() => setSort("upvotes")} className={`px-3 py-1 ${sort === "upvotes" ? "pixel-btn" : "font-pixel text-dim hover:text-maple"}`}>추천순</button>
          </div>
          {loading ? (
            <div className="py-10 text-center text-dim">불러오는 중...</div>
          ) : posts.length === 0 ? (
            <div className="py-10 text-center text-dim">아직 글이 없습니다. 첫 정보를 공유해보세요!</div>
          ) : (
            <ul className="divide-y divide-edge/40 border-2 border-edge overflow-hidden">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link href={`/guild/info/${p.id}`} className="px-4 py-3 hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-ink">
                        {p.has_excel ? "📊 " : ""}{p.title}
                        {p.comment_count > 0 && <span className="ml-2 text-maple text-sm">[{p.comment_count}]</span>}
                      </div>
                      <div className="text-xs text-dim mt-0.5">{p.nickname} · {fmtDate(p.created_at)}</div>
                    </div>
                    <div className="text-xs text-dim text-right shrink-0">
                      <div>👍 {p.upvotes}</div>
                      <div>👁 {p.views}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4 text-sm">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="pixel-btn px-3 py-1 disabled:opacity-40">이전</button>
              <span className="px-3 py-1 text-ink">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="pixel-btn px-3 py-1 disabled:opacity-40">다음</button>
            </div>
          )}
        </div>
      )}

      {view === "write" && (
        <div className="space-y-3">
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임"
                 className="pixel-input w-full px-3 py-2" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목"
                 className="pixel-input w-full px-3 py-2" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용 (설명)" rows={6}
                    className="pixel-input w-full px-3 py-2" />
          <div className="border-2 border-edge p-3">
            <label className="text-sm font-medium text-ink">📊 엑셀 첨부 (.xlsx)</label>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => onExcelFile(e.target.files?.[0] ?? null)} className="block mt-2 text-sm" />
            {excelName && <div className="text-xs text-green-600 mt-1">첨부됨: {excelName}</div>}
            {excelPreview && (
              <div className="mt-3">
                <div className="text-xs text-dim mb-1">미리보기 (표 뷰)</div>
                <div className="xl-wrap max-h-72 overflow-auto border-2 border-edge">
                  <ExcelTableView sheet={excelPreview.sheets[0]} />
                </div>
              </div>
            )}
          </div>
          {writeError && <div className="text-red-500 text-sm">{writeError}</div>}
          <button onClick={handleWrite} disabled={writeLoading}
                  className="pixel-btn px-5 py-2 font-medium disabled:opacity-50">
            {writeLoading ? "등록 중..." : "등록"}
          </button>
        </div>
      )}
    </div>
  );
}
