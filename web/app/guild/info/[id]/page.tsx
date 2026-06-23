"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExcelTableView, ExcelSheet } from "../ExcelTableView";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface Comment {
  id: number;
  nickname: string;
  content: string;
  upvotes: number;
  created_at: string;
}
interface PostDetail {
  id: number;
  nickname: string;
  title: string;
  content: string;
  excel_filename: string | null;
  excel_json: { sheets: ExcelSheet[] } | null;
  excel_html: string | null;
  upvotes: number;
  views: number;
  created_at: string;
  comments: Comment[];
}
type ExcelTab = "table" | "original";

function fmtDate(s: string) {
  if (!s) return "";
  return s.replace("T", " ").slice(0, 16);
}

export default function InfoPostDetailPage() {
  const params = useParams();
  const postId = Number(params?.id);

  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [excelTab, setExcelTab] = useState<ExcelTab>("table");
  const [tableQuery, setTableQuery] = useState("");
  const [commentSort, setCommentSort] = useState<"newest" | "upvotes">("newest");

  const [commentNickname, setCommentNickname] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [msg, setMsg] = useState("");

  const fetchDetail = useCallback(async (csort: "newest" | "upvotes") => {
    if (!Number.isFinite(postId)) { setNotFound(true); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/guild/info/posts/${postId}?sort=${csort}`);
      if (res.status === 404) { setNotFound(true); setDetail(null); return; }
      if (!res.ok) throw new Error("fail");
      setDetail(await res.json());
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { fetchDetail("newest"); }, [fetchDetail]);

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 2000); };

  const upvotePost = async () => {
    if (!detail) return;
    const res = await fetch(`${API_BASE}/api/guild/info/posts/${detail.id}/upvote`, { method: "POST" });
    if (res.ok) setDetail({ ...detail, upvotes: (await res.json()).upvotes });
    else if (res.status === 409) flash("이미 추천하셨습니다.");
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) { await navigator.share({ title: detail?.title, url }); return; }
      await navigator.clipboard.writeText(url);
      flash("링크가 복사되었습니다.");
    } catch {
      flash(url);
    }
  };

  const submitComment = async () => {
    if (!detail || !commentNickname.trim() || !commentContent.trim()) return;
    const res = await fetch(`${API_BASE}/api/guild/info/posts/${detail.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: commentNickname.trim(), content: commentContent.trim() }),
    });
    if (res.ok) { setCommentContent(""); fetchDetail(commentSort); }
  };

  const upvoteComment = async (cid: number) => {
    const res = await fetch(`${API_BASE}/api/guild/info/comments/${cid}/upvote`, { method: "POST" });
    if (res.ok) fetchDetail(commentSort);
    else if (res.status === 409) flash("이미 추천한 댓글입니다.");
  };

  const deletePost = async () => {
    if (!detail || !adminPw) { flash("관리자 비밀번호를 입력하세요."); return; }
    const res = await fetch(`${API_BASE}/api/guild/info/posts/${detail.id}`, {
      method: "DELETE", headers: { "X-Admin-Password": adminPw },
    });
    if (res.ok) window.location.href = "/guild/info";
    else flash("삭제 실패 (비밀번호 확인)");
  };

  const changeCommentSort = (s: "newest" | "upvotes") => { setCommentSort(s); fetchDetail(s); };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <Link href="/guild/info" className="font-pixel text-sm text-dim hover:text-maple">← 정보공유 목록</Link>
        {detail && (
          <button onClick={share} className="pixel-btn px-3 py-1.5 text-sm">🔗 공유</button>
        )}
      </div>

      {msg && <div className="mb-3 px-4 py-2 bg-amber-100 text-amber-800 rounded text-sm break-all">{msg}</div>}

      {loading ? (
        <div className="py-10 text-center text-dim">불러오는 중...</div>
      ) : notFound || !detail ? (
        <div className="py-10 text-center text-dim">
          글을 찾을 수 없습니다.
          <div className="mt-3"><Link href="/guild/info" className="text-maple">목록으로</Link></div>
        </div>
      ) : (
        <div>
          <h1 className="font-pixel text-xl font-bold text-ink">{detail.title}</h1>
          <div className="text-sm text-dim mt-1 mb-4">
            {detail.nickname} · {fmtDate(detail.created_at)} · 👁 {detail.views}
          </div>

          {detail.content && <div className="whitespace-pre-wrap mb-5 leading-relaxed">{detail.content}</div>}

          {detail.excel_json && (
            <div className="mb-5">
              <div className="flex gap-2 mb-2 text-sm items-center flex-wrap">
                <button onClick={() => setExcelTab("table")} className={`px-3 py-1 ${excelTab === "table" ? "pixel-btn" : "font-pixel text-dim hover:text-maple"}`}>📋 표 뷰 <span className="opacity-70 text-xs">검색·정리</span></button>
                <button onClick={() => setExcelTab("original")} className={`px-3 py-1 ${excelTab === "original" ? "pixel-btn" : "font-pixel text-dim hover:text-maple"}`}>🎨 원본 <span className="opacity-70 text-xs">엑셀 그대로</span></button>
                {detail.excel_filename && <span className="text-xs text-dim ml-1">{detail.excel_filename}</span>}
              </div>
              {excelTab === "table" ? (
                <>
                  <input value={tableQuery} onChange={(e) => setTableQuery(e.target.value)}
                         placeholder="🔎 표 안에서 검색 (예: 자쿰, 주문서, 25LV)"
                         className="pixel-input w-full sm:w-80 mb-2 px-3 py-1.5 text-sm" />
                  <div className="xl-wrap xl-clean-scroll border-2 border-edge">
                    <ExcelTableView sheet={detail.excel_json.sheets[0]} query={tableQuery} />
                  </div>
                  <div className="text-xs text-dim mt-1">표 뷰: 병합 셀을 펼쳐 모든 행에 상위 항목(LV 등)을 표시하고, 검색이 쉽도록 정리한 화면입니다.</div>
                </>
              ) : (
                <>
                  <div className="xl-wrap border-2 border-edge p-2"
                       dangerouslySetInnerHTML={{ __html: detail.excel_html ?? "" }} />
                  <div className="text-xs text-dim mt-1">원본: 작성자가 만든 엑셀의 색상·병합·레이아웃을 그대로 보존한 화면입니다.</div>
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 my-5">
            <button onClick={upvotePost} className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium">👍 추천 {detail.upvotes}</button>
            <button onClick={share} className="pixel-btn px-4 py-2 font-medium">🔗 공유</button>
          </div>

          <details className="mb-5 text-sm">
            <summary className="cursor-pointer text-dim">관리</summary>
            <div className="flex gap-2 mt-2">
              <input type="password" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} placeholder="관리자 비밀번호"
                     className="pixel-input px-2 py-1" />
              <button onClick={deletePost} className="px-3 py-1 bg-red-500 text-white rounded">글 삭제</button>
            </div>
          </details>

          <div className="border-t-2 border-edge pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-pixel font-bold text-ink">댓글 {detail.comments.length}</h3>
              <div className="flex gap-1 text-xs">
                <button onClick={() => changeCommentSort("newest")} className={`px-2 py-1 ${commentSort === "newest" ? "pixel-btn" : "font-pixel text-dim hover:text-maple"}`}>최신순</button>
                <button onClick={() => changeCommentSort("upvotes")} className={`px-2 py-1 ${commentSort === "upvotes" ? "pixel-btn" : "font-pixel text-dim hover:text-maple"}`}>추천순</button>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {detail.comments.map((c) => (
                <div key={c.id} className="pixel-panel px-3 py-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm font-medium text-ink">{c.nickname}</span>
                    <span className="text-xs text-dim">{fmtDate(c.created_at)}</span>
                  </div>
                  <div className="text-sm mt-1 whitespace-pre-wrap text-ink">{c.content}</div>
                  <button onClick={() => upvoteComment(c.id)} className="text-xs text-rose-500 mt-1">👍 {c.upvotes}</button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <input value={commentNickname} onChange={(e) => setCommentNickname(e.target.value)} placeholder="닉네임"
                     className="pixel-input w-full px-3 py-2 text-sm" />
              <textarea value={commentContent} onChange={(e) => setCommentContent(e.target.value)} placeholder="댓글" rows={2}
                        className="pixel-input w-full px-3 py-2 text-sm" />
              <button onClick={submitComment} className="pixel-btn px-4 py-2 text-sm">댓글 등록</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
