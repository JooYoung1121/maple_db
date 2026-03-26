"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Poll {
  id: number;
  question: string;
  options: string[];
  vote_counts: number[];
  created_at: string;
}

type Tab = "vote" | "roulette" | "dice";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = [
  "#f97316", "#3b82f6", "#22c55e", "#a855f7",
  "#ec4899", "#eab308", "#14b8a6", "#ef4444",
  "#8b5cf6", "#06b6d4",
];

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeSlice(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Vote Tab
// ---------------------------------------------------------------------------

function VoteTab() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());
  const [voteMessages, setVoteMessages] = useState<Record<number, string>>({});

  // New poll form state
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

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

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
    } catch {
      // ignore
    }
  };

  const handleAddOption = () => {
    if (options.length < 6) setOptions([...options, ""]);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  };

  const handleOptionChange = (idx: number, value: string) => {
    const updated = [...options];
    updated[idx] = value;
    setOptions(updated);
  };

  const handleCreatePoll = async () => {
    if (!question.trim()) { setCreateError("질문을 입력해주세요."); return; }
    const filledOptions = options.filter((o) => o.trim());
    if (filledOptions.length < 2) { setCreateError("선택지를 2개 이상 입력해주세요."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch(`${API_BASE}/api/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), options: filledOptions }),
      });
      if (!res.ok) throw new Error("create failed");
      setQuestion("");
      setOptions(["", ""]);
      setShowForm(false);
      await fetchPolls();
    } catch {
      setCreateError("투표 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create poll button / form */}
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
                      <button
                        onClick={() => handleRemoveOption(idx)}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none"
                        title="삭제"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < 6 && (
                <button
                  onClick={handleAddOption}
                  className="mt-2 text-sm text-orange-500 hover:text-orange-700 font-medium"
                >
                  + 선택지 추가
                </button>
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
                  <button
                    onClick={() => handleDelete(poll.id)}
                    className="text-xs text-gray-400 hover:text-red-500 shrink-0 transition-colors"
                    title="투표 삭제"
                  >
                    삭제
                  </button>
                </div>

                {msg && (
                  <p className={`text-sm mb-3 font-medium ${msg.includes("이미") || msg.includes("오류") ? "text-red-500" : "text-green-600"}`}>
                    {msg}
                  </p>
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
                              hasVoted
                                ? "border-gray-200 text-gray-500 cursor-default"
                                : "border-orange-400 text-orange-600 hover:bg-orange-50 cursor-pointer"
                            }`}
                          >
                            {opt}
                          </button>
                          <span className="text-xs text-gray-400">{count}표 ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
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
  );
}

// ---------------------------------------------------------------------------
// Dice Tab
// ---------------------------------------------------------------------------

interface DiceParticipant {
  id: number;
  name: string;
  dice: number[];
  total: number;
}

let diceNextId = 1;

function DiceTab() {
  const [diceCount, setDiceCount] = useState(1);
  const [nameInput, setNameInput] = useState("");
  const [participants, setParticipants] = useState<DiceParticipant[]>([]);
  const [rolled, setRolled] = useState(false);

  const addParticipant = () => {
    const name = nameInput.trim();
    if (!name) return;
    setParticipants((prev) => [...prev, { id: diceNextId++, name, dice: [], total: 0 }]);
    setNameInput("");
    setRolled(false);
  };

  const removeParticipant = (id: number) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    setRolled(false);
  };

  const rollDice = () => {
    if (participants.length === 0) return;
    setParticipants((prev) =>
      prev.map((p) => {
        const dice = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
        return { ...p, dice, total: dice.reduce((a, b) => a + b, 0) };
      })
    );
    setRolled(true);
  };

  const sorted = rolled
    ? [...participants].sort((a, b) => b.total - a.total)
    : participants;

  return (
    <div className="space-y-6">
      {/* 참가자 입력 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">참가자 관리</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addParticipant()}
            placeholder="닉네임 입력"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={addParticipant}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            추가
          </button>
        </div>

        {participants.length > 0 ? (
          <ul className="space-y-1.5 mb-4">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5"
              >
                <span className="text-sm font-medium text-gray-700">{p.name}</span>
                <button
                  onClick={() => removeParticipant(p.id)}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none transition-colors"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 text-center py-3 mb-4">참가자를 추가해주세요.</p>
        )}

        {/* 주사위 수 선택 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            주사위 수 (최대 6개)
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setDiceCount(n)}
                className={`w-10 h-10 rounded-lg text-sm font-bold border-2 transition-colors ${
                  diceCount === n
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-600 border-gray-300 hover:border-orange-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 굴리기 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={rollDice}
          disabled={participants.length === 0}
          className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-base transition-colors shadow-md"
        >
          🎲 주사위 굴리기
        </button>
        {participants.length > 0 && (
          <button
            onClick={() => {
              setParticipants([]);
              setRolled(false);
            }}
            className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            초기화
          </button>
        )}
      </div>

      {/* 결과 */}
      {rolled && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-gray-800">
            결과 <span className="text-sm font-normal text-gray-400">— 합산 높은 순</span>
          </h2>
          {sorted.map((p, idx) => (
            <div
              key={p.id}
              className={`bg-white rounded-xl border-2 p-4 transition-all ${
                idx === 0 ? "border-orange-400 bg-orange-50" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {idx === 0 && <span className="text-lg">🏆</span>}
                  <span className="font-bold text-gray-800">{p.name}</span>
                </div>
                <span
                  className={`text-xl font-bold ${
                    idx === 0 ? "text-orange-600" : "text-gray-700"
                  }`}
                >
                  합계 {p.total}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {p.dice.map((d, i) => (
                  <div
                    key={i}
                    className={`w-11 h-11 rounded-lg border-2 flex items-center justify-center font-bold text-lg ${
                      idx === 0
                        ? "bg-orange-100 border-orange-300 text-orange-700"
                        : "bg-gray-50 border-gray-300 text-gray-700"
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roulette Tab
// ---------------------------------------------------------------------------

interface Participant {
  id: number;
  name: string;
  weight: number;
}

let nextId = 1;

function RouletteTab() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [winCount, setWinCount] = useState(1);
  const [isFair, setIsFair] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [winners, setWinners] = useState<string[]>([]);
  const rotationRef = useRef(0);
  const [displayRotation, setDisplayRotation] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const totalWeight = participants.reduce((s, p) => s + p.weight, 0);

  // Recalculate weights when fairness mode changes
  const toggleFair = () => {
    setIsFair((prev) => {
      const nextFair = !prev;
      if (!nextFair) {
        // Switching to unfair: randomize weights
        setParticipants((ps) =>
          ps.map((p) => ({ ...p, weight: Math.floor(Math.random() * 10) + 1 }))
        );
      } else {
        // Switching to fair: reset to 1
        setParticipants((ps) => ps.map((p) => ({ ...p, weight: 1 })));
      }
      return nextFair;
    });
  };

  const rerandomizeWeights = () => {
    setParticipants((ps) =>
      ps.map((p) => ({ ...p, weight: Math.floor(Math.random() * 10) + 1 }))
    );
  };

  const addParticipant = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const weight = isFair ? 1 : Math.floor(Math.random() * 10) + 1;
    setParticipants((prev) => [...prev, { id: nextId++, name: trimmed, weight }]);
    setNameInput("");
  };

  const removeParticipant = (id: number) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  // Build slice angles from participants
  const slices = (() => {
    if (totalWeight === 0) return [];
    let startAngle = 0;
    return participants.map((p) => {
      const sweep = (p.weight / totalWeight) * 360;
      const slice = { participant: p, startAngle, endAngle: startAngle + sweep, sweep };
      startAngle += sweep;
      return slice;
    });
  })();

  // Weighted random pick
  const pickWinner = (remaining: Participant[]): Participant => {
    const tw = remaining.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * tw;
    for (const p of remaining) {
      r -= p.weight;
      if (r <= 0) return p;
    }
    return remaining[remaining.length - 1];
  };

  const spinRoulette = () => {
    if (spinning || participants.length < 2) return;
    setSpinning(true);
    setWinners([]);

    const winner = pickWinner(participants);

    // Find winner's slice
    const winnerSlice = slices.find((s) => s.participant.id === winner.id);
    if (!winnerSlice) {
      setSpinning(false);
      return;
    }

    // The pointer is at top (0 deg). We need winner's slice midpoint to align with top.
    // Pie starts at -90deg (top) in our SVG (we use -90 offset in polarToCartesian).
    // The chart rotates: we want winnerMid + currentRotation + additionalRotation = 360*k
    const winnerMid = winnerSlice.startAngle + winnerSlice.sweep / 2;
    // Target: winnerMid lands at 0 (top). So rotation needed = -winnerMid (mod 360)
    const baseExtra = (360 - winnerMid) % 360;
    const fullRotations = 10 * 360;
    const currentRot = rotationRef.current;
    const targetRot = currentRot + fullRotations + baseExtra + (360 - (currentRot % 360));

    rotationRef.current = targetRot;
    setTransitioning(true);
    setDisplayRotation(targetRot);

    setTimeout(() => {
      setWinners([winner.name]);
      setSpinning(false);
      setTransitioning(false);
    }, 10000);
  };

  const cx = 100;
  const cy = 100;
  const r = 90;

  return (
    <div className="space-y-6">
      {/* Participants input */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">참가자 관리</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addParticipant()}
            placeholder="참가자 이름 입력"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={addParticipant}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            추가
          </button>
        </div>

        {participants.length > 0 ? (
          <ul className="space-y-1.5">
            {participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                <span className="text-sm text-gray-700 font-medium">{p.name}</span>
                <div className="flex items-center gap-3">
                  {!isFair && (
                    <span className="text-xs text-orange-500 font-semibold">가중치: {p.weight}</span>
                  )}
                  <button
                    onClick={() => removeParticipant(p.id)}
                    className="text-gray-400 hover:text-red-500 text-lg leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 text-center py-3">참가자를 추가해주세요.</p>
        )}

        {/* Win count */}
        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">당첨 수</label>
          <input
            type="number"
            min={1}
            max={Math.max(1, participants.length - 1)}
            value={winCount}
            onChange={(e) => setWinCount(Number(e.target.value))}
            className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 text-center"
          />
          <span className="text-xs text-gray-400">명</span>
        </div>
      </div>

      {/* Roulette */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">룰렛</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsFair(true);
                setParticipants((ps) => ps.map((p) => ({ ...p, weight: 1 })));
              }}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isFair
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              공평 모드
            </button>
            <button
              onClick={() => {
                setIsFair(false);
                setParticipants((ps) =>
                  ps.map((p) => ({ ...p, weight: Math.floor(Math.random() * 10) + 1 }))
                );
              }}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                !isFair
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              불공평 모드
            </button>
          </div>
        </div>

        {/* SVG Pie chart */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 text-2xl leading-none select-none">
              ▼
            </div>

            <svg
              width={220}
              height={220}
              viewBox="0 0 200 200"
              style={{
                transform: `rotate(${displayRotation}deg)`,
                transition: transitioning ? "transform 10s cubic-bezier(0.2, 0.8, 0.3, 1)" : "none",
                display: "block",
              }}
            >
              {participants.length === 0 ? (
                <circle cx={cx} cy={cy} r={r} fill="#e5e7eb" />
              ) : participants.length === 1 ? (
                <circle cx={cx} cy={cy} r={r} fill={COLORS[0]} />
              ) : (
                slices.map((slice, i) => {
                  const midAngle = slice.startAngle + slice.sweep / 2;
                  const labelRadius = r * 0.65;
                  const labelPos = polarToCartesian(cx, cy, labelRadius, midAngle);
                  const shortName =
                    slice.participant.name.length > 5
                      ? slice.participant.name.slice(0, 5) + "…"
                      : slice.participant.name;
                  return (
                    <g key={slice.participant.id}>
                      <path
                        d={describeSlice(cx, cy, r, slice.startAngle, slice.endAngle)}
                        fill={COLORS[i % COLORS.length]}
                        stroke="white"
                        strokeWidth={1.5}
                      />
                      {slice.sweep > 20 && (
                        <text
                          x={labelPos.x}
                          y={labelPos.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={slice.sweep > 60 ? 9 : 7}
                          fill="white"
                          fontWeight="bold"
                          style={{ pointerEvents: "none" }}
                        >
                          {shortName}
                        </text>
                      )}
                    </g>
                  );
                })
              )}
            </svg>
          </div>

          <button
            onClick={spinRoulette}
            disabled={spinning || participants.length < 2}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl text-base transition-colors shadow-md"
          >
            {spinning ? "돌아가는 중..." : "🎰 룰렛 돌리기"}
          </button>

          {/* Winners display */}
          {winners.length > 0 && !spinning && (
            <div className="w-full max-w-sm">
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-2xl p-6 text-center shadow-md animate-bounce-in">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-sm text-orange-600 font-medium mb-1">당첨!</p>
                {winners.map((w, i) => (
                  <p key={i} className="text-2xl font-bold text-orange-700">
                    {w}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {participants.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {participants.map((p, i) => (
              <div key={p.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="inline-block w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span>{p.name}</span>
                {!isFair && <span className="text-gray-400">({p.weight})</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<Tab>("vote");

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">커뮤니티</h1>

      {/* Tab buttons */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(["vote", "roulette", "dice"] as Tab[]).map((tab) => {
          const label = tab === "vote" ? "투표" : tab === "roulette" ? "룰렛" : "주사위";
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
                isActive
                  ? "border-orange-500 text-orange-600 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === "vote" && <VoteTab />}
      {activeTab === "roulette" && <RouletteTab />}
      {activeTab === "dice" && <DiceTab />}
    </div>
  );
}
