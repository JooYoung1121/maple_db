"use client";

import { useState, useEffect, useCallback } from "react";

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

interface Comment {
  id: number;
  post_id: number;
  nickname: string;
  content: string;
  upvotes: number;
  created_at: string;
}

interface ExcelCell {
  v?: string;
  hidden?: boolean;
  rowspan?: number;
  colspan?: number;
  bg?: string;
  color?: string;
  bold?: boolean;
  align?: string;
}
interface ExcelSheet {
  name: string;
  ncols: number;
  rows: ExcelCell[][];
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

type View = "list" | "detail" | "write";
type ExcelTab = "table" | "original";

function fmtDate(s: string) {
  if (!s) return "";
  return s.replace("T", " ").slice(0, 16);
}

export default function InfoBoardPage() {
  const [view, setView] = useState<View>("list");
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "upvotes">("newest");
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [excelTab, setExcelTab] = useState<ExcelTab>("table");
  const [tableQuery, setTableQuery] = useState("");

  // write
  const [nickname, setNickname] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excelBase64, setExcelBase64] = useState<string | null>(null);
  const [excelName, setExcelName] = useState<string | null>(null);
  const [excelPreview, setExcelPreview] = useState<{ sheets: ExcelSheet[] } | null>(null);
  const [writeLoading, setWriteLoading] = useState(false);
  const [writeError, setWriteError] = useState("");

  // comments
  const [commentNickname, setCommentNickname] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [commentSort, setCommentSort] = useState<"newest" | "upvotes">("newest");

  // admin
  const [adminPw, setAdminPw] = useState("");
  const [msg, setMsg] = useState("");

  const perPage = 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

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

  const fetchDetail = useCallback(async (id: number, csort: "newest" | "upvotes") => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/guild/info/posts/${id}?sort=${csort}`);
      if (!res.ok) throw new Error("fail");
      const data: PostDetail = await res.json();
      setDetail(data);
      setExcelTab("table");
      setTableQuery("");
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = (id: number) => {
    setView("detail");
    setCommentSort("newest");
    fetchDetail(id, "newest");
  };

  // ── 엑셀 파일 선택 → base64 + 미리보기 ──
  const onExcelFile = async (file: File | null) => {
    if (!file) {
      setExcelBase64(null);
      setExcelName(null);
      setExcelPreview(null);
      return;
    }
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
      if (res.ok) {
        const data = await res.json();
        setExcelPreview(data.excel_json);
      } else {
        const e = await res.json().catch(() => ({}));
        setWriteError(e.detail || "엑셀 미리보기 실패");
        setExcelPreview(null);
      }
    } catch {
      setExcelPreview(null);
    }
  };

  const handleWrite = async () => {
    if (!nickname.trim() || !title.trim()) {
      setWriteError("닉네임과 제목을 입력해주세요.");
      return;
    }
    if (!content.trim() && !excelBase64) {
      setWriteError("내용 또는 엑셀을 첨부해주세요.");
      return;
    }
    setWriteLoading(true);
    setWriteError("");
    try {
      const res = await fetch(`${API_BASE}/api/guild/info/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          title: title.trim(),
          content: content.trim(),
          excel_filename: excelName,
          excel_base64: excelBase64,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || "등록 실패");
      }
      const { id } = await res.json();
      setTitle(""); setContent(""); setExcelBase64(null); setExcelName(null); setExcelPreview(null);
      openDetail(id);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setWriteLoading(false);
    }
  };

  const upvotePost = async () => {
    if (!detail) return;
    const res = await fetch(`${API_BASE}/api/guild/info/posts/${detail.id}/upvote`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setDetail({ ...detail, upvotes: d.upvotes });
    } else if (res.status === 409) {
      setMsg("이미 추천하셨습니다.");
      setTimeout(() => setMsg(""), 2000);
    }
  };

  const submitComment = async () => {
    if (!detail || !commentNickname.trim() || !commentContent.trim()) return;
    const res = await fetch(`${API_BASE}/api/guild/info/posts/${detail.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: commentNickname.trim(), content: commentContent.trim() }),
    });
    if (res.ok) {
      setCommentContent("");
      fetchDetail(detail.id, commentSort);
    }
  };

  const upvoteComment = async (cid: number) => {
    if (!detail) return;
    const res = await fetch(`${API_BASE}/api/guild/info/comments/${cid}/upvote`, { method: "POST" });
    if (res.ok) fetchDetail(detail.id, commentSort);
    else if (res.status === 409) {
      setMsg("이미 추천한 댓글입니다.");
      setTimeout(() => setMsg(""), 2000);
    }
  };

  const deletePost = async () => {
    if (!detail) return;
    if (!adminPw) { setMsg("관리자 비밀번호를 입력하세요."); return; }
    const res = await fetch(`${API_BASE}/api/guild/info/posts/${detail.id}`, {
      method: "DELETE",
      headers: { "X-Admin-Password": adminPw },
    });
    if (res.ok) { setView("list"); setDetail(null); }
    else setMsg("삭제 실패 (비밀번호 확인)");
  };

  // ── 렌더링 ──
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">📋 정보공유 게시판</h1>
        {view === "list" && (
          <button
            onClick={() => { setView("write"); setWriteError(""); }}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
          >글쓰기</button>
        )}
        {view !== "list" && (
          <button
            onClick={() => { setView("list"); setDetail(null); }}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm"
          >목록</button>
        )}
      </div>

      {msg && <div className="mb-3 px-4 py-2 bg-amber-100 text-amber-800 rounded text-sm">{msg}</div>}

      {/* 목록 */}
      {view === "list" && (
        <div>
          <div className="flex gap-2 mb-3 text-sm">
            <button onClick={() => setSort("newest")} className={`px-3 py-1 rounded ${sort === "newest" ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>최신순</button>
            <button onClick={() => setSort("upvotes")} className={`px-3 py-1 rounded ${sort === "upvotes" ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>추천순</button>
          </div>
          {loading ? (
            <div className="py-10 text-center text-gray-400">불러오는 중...</div>
          ) : posts.length === 0 ? (
            <div className="py-10 text-center text-gray-400">아직 글이 없습니다. 첫 정보를 공유해보세요!</div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {posts.map((p) => (
                <li key={p.id} onClick={() => openDetail(p.id)}
                    className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {p.has_excel ? "📊 " : ""}{p.title}
                      {p.comment_count > 0 && <span className="ml-2 text-orange-500 text-sm">[{p.comment_count}]</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{p.nickname} · {fmtDate(p.created_at)}</div>
                  </div>
                  <div className="text-xs text-gray-500 text-right shrink-0">
                    <div>👍 {p.upvotes}</div>
                    <div>👁 {p.views}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4 text-sm">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 disabled:opacity-40">이전</button>
              <span className="px-3 py-1">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 disabled:opacity-40">다음</button>
            </div>
          )}
        </div>
      )}

      {/* 글쓰기 */}
      {view === "write" && (
        <div className="space-y-3">
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임"
                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-transparent" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목"
                 className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-transparent" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용 (설명)" rows={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-transparent" />
          <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded p-3">
            <label className="text-sm font-medium">📊 엑셀 첨부 (.xlsx)</label>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => onExcelFile(e.target.files?.[0] ?? null)}
                   className="block mt-2 text-sm" />
            {excelName && <div className="text-xs text-green-600 mt-1">첨부됨: {excelName}</div>}
            {excelPreview && (
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-1">미리보기 (표 뷰)</div>
                <div className="xl-wrap max-h-72 overflow-auto border rounded">
                  <ExcelTableView sheet={excelPreview.sheets[0]} />
                </div>
              </div>
            )}
          </div>
          {writeError && <div className="text-red-500 text-sm">{writeError}</div>}
          <button onClick={handleWrite} disabled={writeLoading}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded font-medium disabled:opacity-50">
            {writeLoading ? "등록 중..." : "등록"}
          </button>
        </div>
      )}

      {/* 상세 */}
      {view === "detail" && (
        detailLoading ? <div className="py-10 text-center text-gray-400">불러오는 중...</div> :
        !detail ? <div className="py-10 text-center text-gray-400">글을 찾을 수 없습니다.</div> :
        <div>
          <h2 className="text-xl font-bold">{detail.title}</h2>
          <div className="text-sm text-gray-500 mt-1 mb-4">
            {detail.nickname} · {fmtDate(detail.created_at)} · 👁 {detail.views}
          </div>

          {detail.content && (
            <div className="whitespace-pre-wrap mb-5 leading-relaxed">{detail.content}</div>
          )}

          {/* 엑셀 2뷰 */}
          {detail.excel_json && (
            <div className="mb-5">
              <div className="flex gap-2 mb-2 text-sm items-center flex-wrap">
                <button onClick={() => setExcelTab("table")} className={`px-3 py-1 rounded ${excelTab === "table" ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>📋 표 뷰 <span className="opacity-70 text-xs">검색·정리</span></button>
                <button onClick={() => setExcelTab("original")} className={`px-3 py-1 rounded ${excelTab === "original" ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>🎨 원본 <span className="opacity-70 text-xs">엑셀 그대로</span></button>
                {detail.excel_filename && <span className="text-xs text-gray-400 ml-1">{detail.excel_filename}</span>}
              </div>
              {excelTab === "table" ? (
                <>
                  <input
                    value={tableQuery}
                    onChange={(e) => setTableQuery(e.target.value)}
                    placeholder="🔎 표 안에서 검색 (예: 자쿰, 주문서, 25LV)"
                    className="w-full sm:w-80 mb-2 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-transparent text-sm"
                  />
                  <div className="xl-wrap xl-clean-scroll border border-gray-200 dark:border-gray-700 rounded">
                    <ExcelTableView sheet={detail.excel_json.sheets[0]} query={tableQuery} />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">표 뷰: 병합 셀을 펼쳐 모든 행에 상위 항목(LV 등)을 표시하고, 검색·정렬이 쉽도록 정리한 화면입니다.</div>
                </>
              ) : (
                <>
                  <div className="xl-wrap border border-gray-200 dark:border-gray-700 rounded p-2"
                       dangerouslySetInnerHTML={{ __html: detail.excel_html ?? "" }} />
                  <div className="text-xs text-gray-400 mt-1">원본: 작성자가 만든 엑셀의 색상·병합·레이아웃을 그대로 보존한 화면입니다.</div>
                </>
              )}
            </div>
          )}

          {/* 추천 */}
          <div className="flex items-center gap-3 my-5">
            <button onClick={upvotePost}
                    className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium">
              👍 추천 {detail.upvotes}
            </button>
          </div>

          {/* 관리자 삭제 */}
          <details className="mb-5 text-sm">
            <summary className="cursor-pointer text-gray-400">관리</summary>
            <div className="flex gap-2 mt-2">
              <input type="password" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} placeholder="관리자 비밀번호"
                     className="px-2 py-1 border rounded bg-transparent" />
              <button onClick={deletePost} className="px-3 py-1 bg-red-500 text-white rounded">글 삭제</button>
            </div>
          </details>

          {/* 댓글 */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">댓글 {detail.comments.length}</h3>
              <div className="flex gap-1 text-xs">
                <button onClick={() => { setCommentSort("newest"); fetchDetail(detail.id, "newest"); }} className={`px-2 py-1 rounded ${commentSort === "newest" ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>최신순</button>
                <button onClick={() => { setCommentSort("upvotes"); fetchDetail(detail.id, "upvotes"); }} className={`px-2 py-1 rounded ${commentSort === "upvotes" ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>추천순</button>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {detail.comments.map((c) => (
                <div key={c.id} className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm font-medium">{c.nickname}</span>
                    <span className="text-xs text-gray-400">{fmtDate(c.created_at)}</span>
                  </div>
                  <div className="text-sm mt-1 whitespace-pre-wrap">{c.content}</div>
                  <button onClick={() => upvoteComment(c.id)} className="text-xs text-rose-500 mt-1">👍 {c.upvotes}</button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <input value={commentNickname} onChange={(e) => setCommentNickname(e.target.value)} placeholder="닉네임"
                     className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-transparent text-sm" />
              <textarea value={commentContent} onChange={(e) => setCommentContent(e.target.value)} placeholder="댓글" rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-transparent text-sm" />
              <button onClick={submitComment} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm">댓글 등록</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderLines(v?: string, hl?: string) {
  const text = v ?? "";
  const lines = text.split("\n");
  return lines.map((line, i, arr) => (
    <span key={i}>
      {hl ? highlight(line, hl) : line}
      {i < arr.length - 1 && <br />}
    </span>
  ));
}

function highlight(line: string, q: string) {
  const lower = line.toLowerCase();
  const ql = q.toLowerCase();
  if (!ql || !lower.includes(ql)) return line;
  const parts: React.ReactNode[] = [];
  let idx = 0;
  while (true) {
    const found = lower.indexOf(ql, idx);
    if (found === -1) { parts.push(line.slice(idx)); break; }
    if (found > idx) parts.push(line.slice(idx, found));
    parts.push(<mark key={found} className="xl-search-hl">{line.slice(found, found + ql.length)}</mark>);
    idx = found + ql.length;
  }
  return <>{parts}</>;
}

interface FlatCell { v?: string; colspan?: number; bold?: boolean; align?: string; }

/** 표 뷰: 병합셀을 펼쳐(세로 병합값을 각 행에 채움) 검색 가능한 평면 표로 렌더. 1행은 헤더로 고정. */
function ExcelTableView({ sheet, query }: { sheet: ExcelSheet; query?: string }) {
  if (!sheet) return null;
  const ncols = sheet.ncols;
  type Carry = { col0: number; col1: number; startRow: number; endRow: number; cell: ExcelCell };
  let carries: Carry[] = [];
  const flat: FlatCell[][] = [];

  for (let r = 0; r < sheet.rows.length; r++) {
    carries = carries.filter((k) => k.endRow >= r);
    const rowOut: FlatCell[] = [];
    let c = 0;
    while (c < ncols) {
      const car = carries.find((k) => c >= k.col0 && c <= k.col1 && k.startRow < r && k.endRow >= r);
      if (car) {
        if (c === car.col0)
          rowOut.push({ v: car.cell.v, colspan: car.col1 - car.col0 + 1, bold: car.cell.bold, align: car.cell.align });
        c = car.col1 + 1;
        continue;
      }
      const cell = sheet.rows[r]?.[c];
      if (!cell || cell.hidden) { c++; continue; }
      const cs = cell.colspan ?? 1;
      const rs = cell.rowspan ?? 1;
      rowOut.push({ v: cell.v, colspan: cs, bold: cell.bold, align: cell.align });
      if (rs > 1) carries.push({ col0: c, col1: c + cs - 1, startRow: r, endRow: r + rs - 1, cell });
      c += cs;
    }
    flat.push(rowOut);
  }

  const header = flat[0] ?? [];
  const body = flat.slice(1);
  const q = (query ?? "").trim();
  const ql = q.toLowerCase();
  const filtered = ql ? body.filter((row) => row.some((cell) => (cell.v ?? "").toLowerCase().includes(ql))) : body;

  return (
    <table className="xl-clean">
      <thead>
        <tr>
          {header.map((cell, ci) => (
            <th key={ci} colSpan={cell.colspan} style={{ textAlign: (cell.align as React.CSSProperties["textAlign"]) || "left" }}>
              {renderLines(cell.v)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filtered.length === 0 ? (
          <tr><td colSpan={ncols} className="text-center text-gray-400 py-4">검색 결과 없음</td></tr>
        ) : (
          filtered.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} colSpan={cell.colspan}
                    style={{ textAlign: (cell.align as React.CSSProperties["textAlign"]) || "left", fontWeight: cell.bold ? 700 : undefined }}>
                  {renderLines(cell.v, q)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
