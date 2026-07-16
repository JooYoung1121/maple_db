"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface Poll {
  id: number;
  question: string;
  options: string[];
  vote_counts: number[];
  created_at: string;
  allow_user_options: boolean;
  allow_multiple: boolean;
  deadline: string | null;
  expired: boolean;
}

export default function CommunityPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set()); // "pollId" 또는 "pollId-optIdx"
  const [voteMessages, setVoteMessages] = useState<Record<number, string>>({});

  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [allowUserOptions, setAllowUserOptions] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // 사용자 선택지 추가
  const [newOptionInputs, setNewOptionInputs] = useState<Record<number, string>>({});

  const fetchPolls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/polls?page=1&per_page=20`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setPolls(data.polls ?? data ?? []);
    } catch {
      setPolls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  const handleVote = async (pollId: number, optionIndex: number, isMultiple: boolean) => {
    const key = isMultiple ? `${pollId}-${optionIndex}` : `${pollId}`;
    try {
      const res = await fetch(`${API_BASE}/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_index: optionIndex }),
      });
      if (res.status === 409) {
        const data = await res.json();
        setVoteMessages((prev) => ({ ...prev, [pollId]: data.detail || "이미 투표하셨습니다" }));
        return;
      }
      if (!res.ok) throw new Error("vote failed");
      setVotedIds((prev) => new Set(prev).add(key));
      setVoteMessages((prev) => ({ ...prev, [pollId]: "투표가 완료되었습니다!" }));
      await fetchPolls();
    } catch {
      setVoteMessages((prev) => ({ ...prev, [pollId]: "투표 중 오류가 발생했습니다" }));
    }
  };

  const handleDelete = async (pollId: number) => {
    if (!confirm("이 투표를 삭제하시겠습니까?")) return;
    try {
      await fetch(`${API_BASE}/api/polls/${pollId}`, { method: "DELETE" });
      await fetchPolls();
    } catch { /* ignore */ }
  };

  const handleAddOption = () => { if (options.length < 10) setOptions([...options, ""]); };
  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  };
  const handleOptionChange = (idx: number, value: string) => {
    const updated = [...options]; updated[idx] = value; setOptions(updated);
  };

  const handleCreatePoll = async () => {
    if (!question.trim()) { setCreateError("질문을 입력해주세요."); return; }
    const filledOptions = options.filter((o) => o.trim());
    if (filledOptions.length < 2) { setCreateError("선택지를 2개 이상 입력해주세요."); return; }
    setCreating(true); setCreateError("");
    try {
      const res = await fetch(`${API_BASE}/api/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          options: filledOptions,
          allow_multiple: allowMultiple,
          allow_user_options: allowUserOptions,
          deadline: deadline || null,
        }),
      });
      if (!res.ok) throw new Error("create failed");
      setQuestion(""); setOptions(["", ""]); setShowForm(false);
      setAllowMultiple(false); setAllowUserOptions(false); setDeadline("");
      await fetchPolls();
    } catch {
      setCreateError("투표 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  // 사용자 선택지 추가
  const handleAddUserOption = async (pollId: number) => {
    const val = (newOptionInputs[pollId] || "").trim();
    if (!val) return;
    try {
      const res = await fetch(`${API_BASE}/api/polls/${pollId}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option: val }),
      });
      if (res.status === 409) {
        setVoteMessages((prev) => ({ ...prev, [pollId]: "이미 존재하는 선택지입니다." }));
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setVoteMessages((prev) => ({ ...prev, [pollId]: data.detail || "선택지 추가 실패" }));
        return;
      }
      setNewOptionInputs((prev) => ({ ...prev, [pollId]: "" }));
      await fetchPolls();
    } catch { /* ignore */ }
  };

  const formatDeadline = (dl: string) => {
    try {
      const d = new Date(dl);
      return d.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return dl; }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 font-pixel text-ink">커뮤니티 투표</h1>

      <div className="space-y-6">
        {/* Create poll */}
        <div className="pixel-panel p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-pixel text-ink">새 투표 만들기</h2>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="pixel-btn font-pixel text-sm px-3 py-1.5"
            >
              {showForm ? "닫기" : "+ 투표 생성"}
            </button>
          </div>

          {showForm && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-ink mb-1 font-pixel">질문</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="투표 질문을 입력하세요"
                  rows={2}
                  className="pixel-input w-full px-3 py-2 text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1 font-pixel">선택지</label>
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`선택지 ${idx + 1}`}
                        className="pixel-input flex-1 px-3 py-1.5 text-sm"
                      />
                      {options.length > 2 && (
                        <button onClick={() => handleRemoveOption(idx)} className="text-dim hover:text-red-500 text-lg leading-none">&times;</button>
                      )}
                    </div>
                  ))}
                </div>
                {options.length < 10 && (
                  <button onClick={handleAddOption} className="mt-2 text-sm text-maple hover:text-maple font-medium">+ 선택지 추가</button>
                )}
              </div>

              {/* 새 옵션들 */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowMultiple}
                    onChange={(e) => setAllowMultiple(e.target.checked)}
                    className="w-4 h-4 rounded border-edge text-maple focus:ring-maple"
                  />
                  복수투표 허용
                </label>
                <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowUserOptions}
                    onChange={(e) => setAllowUserOptions(e.target.checked)}
                    className="w-4 h-4 rounded border-edge text-maple focus:ring-maple"
                  />
                  사용자 선택지 추가 허용
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1 font-pixel">마감일 (선택)</label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="pixel-input w-full px-3 py-1.5 text-sm"
                />
              </div>

              {createError && <p className="text-red-500 text-sm">{createError}</p>}
              <button
                onClick={handleCreatePoll}
                disabled={creating}
                className="pixel-btn font-pixel w-full disabled:opacity-50 py-2"
              >
                {creating ? "생성 중..." : "투표 생성"}
              </button>
            </div>
          )}
        </div>

        {/* Poll list */}
        {loading ? (
          <div className="text-center py-12 text-dim">로딩 중...</div>
        ) : polls.length === 0 ? (
          <div className="text-center py-12 text-dim">등록된 투표가 없습니다.</div>
        ) : (
          <div className="space-y-4">
            {polls.map((poll) => {
              const total = poll.vote_counts.reduce((a, b) => a + b, 0);
              const msg = voteMessages[poll.id];
              const isMultiple = poll.allow_multiple;
              const isExpired = poll.expired;

              return (
                <div key={poll.id} className="pixel-panel p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-ink leading-snug">{poll.question}</h3>
                        {isExpired && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface2 text-dim font-medium">마감됨</span>
                        )}
                        {isMultiple && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">복수투표</span>
                        )}
                        {poll.allow_user_options && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">선택지 추가 가능</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(poll.id)} className="text-xs text-dim hover:text-red-500 shrink-0 transition-colors">삭제</button>
                  </div>

                  {msg && (
                    <p className={`text-sm mb-3 font-medium ${msg.includes("완료") ? "text-green-600" : "text-red-500"}`}>{msg}</p>
                  )}

                  <div className="space-y-2">
                    {poll.options.map((opt, idx) => {
                      const count = poll.vote_counts[idx] ?? 0;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      const voteKey = isMultiple ? `${poll.id}-${idx}` : `${poll.id}`;
                      const hasVoted = votedIds.has(voteKey);
                      const disabled = hasVoted || isExpired;
                      return (
                        <div key={idx}>
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              onClick={() => !disabled && handleVote(poll.id, idx, isMultiple)}
                              disabled={disabled}
                              className={`text-sm px-3 py-1 rounded-full border transition-colors font-medium ${
                                disabled
                                  ? "border-edge text-dim cursor-default"
                                  : "border-maple text-maple hover:bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] cursor-pointer"
                              }`}
                            >
                              {opt}
                            </button>
                            <span className="text-xs text-dim">{count}표 ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                            <div className="h-full bg-maple rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 사용자 선택지 추가 입력 */}
                  {poll.allow_user_options && !isExpired && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={newOptionInputs[poll.id] || ""}
                        onChange={(e) => setNewOptionInputs((prev) => ({ ...prev, [poll.id]: e.target.value }))}
                        placeholder="새 선택지 입력"
                        maxLength={50}
                        className="pixel-input flex-1 px-3 py-1.5 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleAddUserOption(poll.id)}
                      />
                      <button
                        onClick={() => handleAddUserOption(poll.id)}
                        className="text-sm px-3 py-1.5 bg-surface2 text-dim hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] transition-colors font-medium"
                      >
                        추가
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3 text-xs text-dim">
                    <span>총 {total}표 · {new Date(poll.created_at).toLocaleDateString("ko-KR")}</span>
                    {poll.deadline && (
                      <span className="ml-auto">
                        마감: {formatDeadline(poll.deadline)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
