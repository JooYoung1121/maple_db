"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface Poll {
  id: number;
  question: string;
  options: string[];
  vote_counts: number[];
  created_at: string;
}

export default function CommunityPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());
  const [voteMessages, setVoteMessages] = useState<Record<number, string>>({});

  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchPolls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/polls?page=1&per_page=10`);
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

  const handleVote = async (pollId: number, optionIndex: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_index: optionIndex }),
      });
      if (res.status === 409) {
        setVoteMessages((prev) => ({ ...prev, [pollId]: "이미 투표하셨습니다" }));
        return;
      }
      if (!res.ok) throw new Error("vote failed");
      setVotedIds((prev) => new Set(prev).add(pollId));
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

  const handleAddOption = () => { if (options.length < 6) setOptions([...options, ""]); };
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
        body: JSON.stringify({ question: question.trim(), options: filledOptions }),
      });
      if (!res.ok) throw new Error("create failed");
      setQuestion(""); setOptions(["", ""]); setShowForm(false);
      await fetchPolls();
    } catch {
      setCreateError("투표 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">커뮤니티 투표</h1>

      <div className="space-y-6">
        {/* Create poll */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">새 투표 만들기</h2>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="text-sm px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors font-medium"
            >
              {showForm ? "닫기" : "+ 투표 생성"}
            </button>
          </div>

          {showForm && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">질문</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="투표 질문을 입력하세요"
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">선택지</label>
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`선택지 ${idx + 1}`}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                      {options.length > 2 && (
                        <button onClick={() => handleRemoveOption(idx)} className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                      )}
                    </div>
                  ))}
                </div>
                {options.length < 6 && (
                  <button onClick={handleAddOption} className="mt-2 text-sm text-orange-500 hover:text-orange-700 font-medium">+ 선택지 추가</button>
                )}
              </div>
              {createError && <p className="text-red-500 text-sm">{createError}</p>}
              <button
                onClick={handleCreatePoll}
                disabled={creating}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors"
              >
                {creating ? "생성 중..." : "투표 생성"}
              </button>
            </div>
          )}
        </div>

        {/* Poll list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">로딩 중...</div>
        ) : polls.length === 0 ? (
          <div className="text-center py-12 text-gray-400">등록된 투표가 없습니다.</div>
        ) : (
          <div className="space-y-4">
            {polls.map((poll) => {
              const total = poll.vote_counts.reduce((a, b) => a + b, 0);
              const hasVoted = votedIds.has(poll.id);
              const msg = voteMessages[poll.id];
              return (
                <div key={poll.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-gray-800 leading-snug">{poll.question}</h3>
                    <button onClick={() => handleDelete(poll.id)} className="text-xs text-gray-400 hover:text-red-500 shrink-0 transition-colors">삭제</button>
                  </div>
                  {msg && (
                    <p className={`text-sm mb-3 font-medium ${msg.includes("이미") || msg.includes("오류") ? "text-red-500" : "text-green-600"}`}>{msg}</p>
                  )}
                  <div className="space-y-2">
                    {poll.options.map((opt, idx) => {
                      const count = poll.vote_counts[idx] ?? 0;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={idx}>
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              onClick={() => !hasVoted && handleVote(poll.id, idx)}
                              disabled={hasVoted}
                              className={`text-sm px-3 py-1 rounded-full border transition-colors font-medium ${
                                hasVoted ? "border-gray-200 text-gray-500 cursor-default" : "border-orange-400 text-orange-600 hover:bg-orange-50 cursor-pointer"
                              }`}
                            >
                              {opt}
                            </button>
                            <span className="text-xs text-gray-400">{count}표 ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">총 {total}표 · {new Date(poll.created_at).toLocaleDateString("ko-KR")}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
