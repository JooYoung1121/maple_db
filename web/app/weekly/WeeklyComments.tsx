"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface WeeklyComment {
  id: number;
  content: string;
  created_at: string;
  user_id: number;
  display_name: string;
  avatar_url: string | null;
  guild_member: number;
}

interface Me {
  id: number;
  display_name: string;
}

export default function WeeklyComments({ issueNo }: { issueNo: number }) {
  const [comments, setComments] = useState<WeeklyComment[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch(`${API_BASE}/api/weekly-news/${issueNo}/comments`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []))
      .catch(() => {});
  }, [issueNo]);

  useEffect(() => {
    load();
    fetch(`${API_BASE}/api/auth/me`)
      .then((r) => r.json())
      .then((d) => { if (d.user) setMe({ id: d.user.id, display_name: d.user.display_name }); })
      .catch(() => {});
    fetch(`${API_BASE}/api/auth/config`)
      .then((r) => r.json())
      .then((d) => setAuthEnabled(!!d.enabled))
      .catch(() => {});
  }, [load]);

  const submit = useCallback(() => {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setError("");
    fetch(`${API_BASE}/api/weekly-news/${issueNo}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail || "등록 실패");
        setText("");
        load();
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setBusy(false));
  }, [text, busy, issueNo, load]);

  const remove = useCallback((id: number) => {
    fetch(`${API_BASE}/api/weekly-news/comments/${id}`, { method: "DELETE" })
      .then((r) => { if (r.ok) load(); })
      .catch(() => {});
  }, [load]);

  return (
    <div className="pixel-panel p-5 mt-6">
      <h3 className="font-pixel font-bold text-sm mb-3">💬 독자 댓글 {comments.length > 0 && `(${comments.length})`}</h3>

      {comments.length === 0 && (
        <p className="text-sm text-dim mb-3">첫 댓글을 남겨보세요!</p>
      )}
      <div className="space-y-3 mb-4">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            {c.avatar_url ? (
              <img src={c.avatar_url} alt="" className="w-8 h-8 border-2 border-edge shrink-0" style={{ imageRendering: "pixelated" }} />
            ) : (
              <span className="w-8 h-8 border-2 border-edge flex items-center justify-center text-sm shrink-0">🍄</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs">
                <span className="font-semibold text-ink">{c.display_name}</span>
                {c.guild_member === 1 && (
                  <span className="font-pixel ml-1.5 text-[9px] text-maple border border-maple px-1 align-middle">길드</span>
                )}
                <span className="text-dim ml-2">{new Date(c.created_at + "Z").toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                {me?.id === c.user_id && (
                  <button onClick={() => remove(c.id)} className="ml-2 text-[10px] text-dim hover:text-red-500">삭제</button>
                )}
              </p>
              <p className="text-sm text-ink whitespace-pre-wrap break-words">{c.content}</p>
            </div>
          </div>
        ))}
      </div>

      {me ? (
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(); }}
            placeholder={`${me.display_name}님, 이번 호 어땠나요?`}
            className="pixel-input flex-1 px-3 py-2 text-sm"
          />
          <button onClick={submit} disabled={busy || !text.trim()} className="pixel-btn px-4 py-2 text-sm disabled:opacity-50 shrink-0">
            등록
          </button>
        </div>
      ) : authEnabled ? (
        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-edge/60 pt-3">
          <p className="text-sm text-dim">🔐 댓글은 디스코드 로그인 후 남길 수 있어요</p>
          <a href={`/api/auth/discord/login?next=/weekly/${issueNo}`} className="pixel-btn px-4 py-2 text-sm shrink-0">디스코드 로그인</a>
        </div>
      ) : null}
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
