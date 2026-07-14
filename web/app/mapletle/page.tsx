"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getMapletle, guessMapletle, solveMapletle,
  type MapletleMeta, type MapletleGuess,
} from "@/lib/api";

interface StoredState {
  guesses: MapletleGuess[];
  solved: boolean;
}

function simColor(sim: number | null): string {
  if (sim === null) return "text-dim";
  if (sim >= 75) return "text-red-500";
  if (sim >= 65) return "text-maple";
  if (sim >= 55) return "text-yellow-500";
  if (sim >= 45) return "text-ink";
  return "text-dim";
}

function GuessRow({ g, index, highlight = false }: { g: MapletleGuess; index: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 text-sm ${highlight ? "pixel-panel border-maple" : "pixel-card"}`}>
      <span className="font-pixel text-[10px] text-dim w-8">#{index}</span>
      <span className={`flex-1 truncate font-medium ${g.correct ? "text-green-500" : "text-ink"}`}>{g.word}</span>
      <span className={`font-pixel text-xs w-16 text-right ${simColor(g.similarity)}`}>
        {g.correct ? "정답!" : g.similarity !== null ? g.similarity.toFixed(1) : "—"}
      </span>
      <span className="text-xs text-dim w-28 text-right truncate">{g.band}</span>
    </div>
  );
}

export default function MapletlePage() {
  const [meta, setMeta] = useState<MapletleMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [guesses, setGuesses] = useState<MapletleGuess[]>([]);
  const [solved, setSolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [guessError, setGuessError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [regState, setRegState] = useState<"idle" | "saving" | "done">("idle");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMapletle()
      .then((m) => {
        setMeta(m);
        try {
          const raw = localStorage.getItem(`mapletle_${m.date}_${m.puzzle_no}`);
          if (raw) {
            const st: StoredState = JSON.parse(raw);
            setGuesses(st.guesses ?? []);
            setSolved(st.solved ?? false);
          }
          const savedNick = localStorage.getItem("daily_mob_nickname");
          if (savedNick) setNickname(savedNick);
          if (localStorage.getItem(`mapletle_reg_${m.date}_${m.puzzle_no}`)) setRegState("done");
        } catch { /* 저장 손상 시 새로 시작 */ }
      })
      .catch(() => setError("퍼즐을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((next: StoredState) => {
    if (!meta) return;
    try { localStorage.setItem(`mapletle_${meta.date}_${meta.puzzle_no}`, JSON.stringify(next)); } catch { /* 무시 */ }
  }, [meta]);

  const bestSim = useMemo(
    () => Math.max(0, ...guesses.filter((g) => g.similarity !== null).map((g) => g.similarity as number)),
    [guesses]
  );
  const sortedGuesses = useMemo(
    () => [...guesses].sort((a, b) => (b.similarity ?? -1) - (a.similarity ?? -1)),
    [guesses]
  );
  const lastGuess = guesses[guesses.length - 1];

  const submitGuess = useCallback(async () => {
    const word = input.trim();
    if (!word || submitting || solved) return;
    if (guesses.some((g) => g.word.replace(/\s/g, "") === word.replace(/\s/g, ""))) {
      setGuessError("이미 시도한 단어예요!");
      return;
    }
    setSubmitting(true);
    setGuessError(null);
    try {
      const r = await guessMapletle(word);
      setGuesses((prev) => {
        const next = [...prev, r];
        persist({ guesses: next, solved: r.correct });
        return next;
      });
      if (r.correct) setSolved(true);
      setInput("");
    } catch (e) {
      setGuessError(e instanceof Error ? e.message : "추측에 실패했습니다.");
    } finally {
      setSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, submitting, solved, guesses, persist]);

  const registerRank = useCallback(async (nick: string) => {
    if (!meta || regState !== "idle") return;
    setRegState("saving");
    try {
      await solveMapletle(guesses.length, nick.trim());
      try {
        localStorage.setItem(`mapletle_reg_${meta.date}_${meta.puzzle_no}`, "1");
        if (nick.trim()) localStorage.setItem("daily_mob_nickname", nick.trim());
      } catch { /* 무시 */ }
      setRegState("done");
      const m = await getMapletle();
      setMeta(m);
    } catch {
      setRegState("idle");
    }
  }, [meta, regState, guesses.length]);

  const share = useCallback(() => {
    if (!meta) return;
    const text = `메랜틀 #${meta.puzzle_no} — ${guesses.length}트 만에 정답! (최고 유사도 여정: ${bestSim.toFixed(1)})\n${(process.env.NEXT_PUBLIC_SITE_URL || "https://memorymapledb.up.railway.app")}/mapletle`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [meta, guesses.length, bestSim]);

  if (loading) {
    return (
      <div className="text-center py-20 text-dim">
        <div className="w-8 h-8 border-2 border-maple border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        오늘의 단어 로딩 중...
      </div>
    );
  }
  if (error || !meta) {
    return <div className="pixel-panel p-8 text-center text-dim max-w-2xl mx-auto">{error ?? "오류가 발생했습니다."}</div>;
  }

  const answer = guesses.find((g) => g.correct)?.answer;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 font-pixel">🌡️ 메랜틀 <span className="text-maple">#{meta.puzzle_no}</span></h1>
      <p className="text-dim mb-1">
        오늘의 비밀 단어는 <strong className="text-ink">메이플랜드의 몬스터 또는 아이템 이름</strong>({meta.secret_len}글자)!
        아무 단어나 입력하면 <strong className="text-ink">의미가 얼마나 가까운지</strong> 알려드려요.
      </p>
      <p className="font-pixel text-[11px] text-dim mb-4">
        꼬맨틀처럼 유사도(0~100)를 보고 점점 다가가세요. 예: &quot;불&quot; → &quot;용&quot; → &quot;드래곤&quot; → ?
      </p>

      {!meta.enabled && (
        <div className="pixel-panel p-4 mb-4 text-sm text-dim">
          ⚠️ 유사도 서비스가 아직 준비되지 않았습니다. 정답 판정만 가능해요.
        </div>
      )}

      {/* 상태 바 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pixel-panel px-4 py-2.5 mb-4 text-sm">
        <span className="text-dim">시도 <strong className="text-ink">{guesses.length}</strong></span>
        <span className="text-dim">최고 유사도 <strong className="text-maple">{bestSim > 0 ? bestSim.toFixed(1) : "—"}</strong></span>
        <span className="text-dim">
          오늘 <strong className="text-ink">{meta.stats.solvers}</strong>명 성공
          {meta.stats.avg_attempts != null && <> · 평균 <strong className="text-ink">{meta.stats.avg_attempts}</strong>트</>}
        </span>
      </div>

      {/* 입력 */}
      {!solved && (
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitGuess()}
              placeholder="단어를 입력하세요 (자유 입력)..."
              className="flex-1 px-4 py-3 pixel-input"
              autoComplete="off"
              disabled={submitting}
            />
            <button
              onClick={submitGuess}
              disabled={submitting || !input.trim()}
              className="px-6 py-3 pixel-btn disabled:opacity-50"
            >
              {submitting ? "..." : "추측"}
            </button>
          </div>
          {guessError && <p className="text-xs text-red-500 mt-1">{guessError}</p>}
        </div>
      )}

      {/* 정답 배너 */}
      {solved && (
        <div className="pixel-panel p-6 mb-4 text-center border-green-500">
          <div className="text-4xl mb-2">🎉</div>
          <div className="font-pixel text-lg text-green-500 mb-1">정답: {answer}</div>
          <p className="text-sm text-dim mb-4">{guesses.length}트 만에 맞췄습니다! 내일 자정에 새 단어가 나옵니다.</p>
          {regState === "done" ? (
            <p className="font-pixel text-xs text-green-500 mb-3">오늘의 랭킹 등록 완료! ✅</p>
          ) : (
            <div className="flex flex-wrap justify-center gap-2 mb-3">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && registerRank(nickname)}
                placeholder="닉네임 (12자 이내)"
                maxLength={12}
                className="px-3 py-2 pixel-input w-40 text-sm"
              />
              <button onClick={() => registerRank(nickname)} disabled={regState === "saving"}
                className="px-4 py-2 pixel-btn text-sm disabled:opacity-50">
                {regState === "saving" ? "등록 중..." : "랭킹 등록"}
              </button>
              <button onClick={() => registerRank("")} disabled={regState === "saving"}
                className="px-3 py-2 pixel-card font-pixel text-xs text-dim disabled:opacity-50">
                익명으로
              </button>
            </div>
          )}
          <button onClick={share} className="px-6 py-2 pixel-btn">
            {copied ? "복사 완료!" : "결과 공유 📋"}
          </button>
        </div>
      )}

      {/* 마지막 추측 */}
      {lastGuess && !solved && (
        <div className="mb-3">
          <div className="font-pixel text-[10px] text-dim mb-1">방금 추측</div>
          <GuessRow g={lastGuess} index={guesses.length} highlight />
        </div>
      )}

      {/* 추측 목록 (유사도 순) */}
      {sortedGuesses.length > 0 && (
        <div className="space-y-1 mb-4">
          <div className="font-pixel text-[10px] text-dim">전체 추측 (유사도 순)</div>
          {sortedGuesses.map((g) => (
            <GuessRow key={g.word} g={g} index={guesses.findIndex((x) => x.word === g.word) + 1} />
          ))}
        </div>
      )}

      {guesses.length === 0 && (
        <div className="pixel-panel p-8 text-center text-dim mb-4">
          <div className="text-5xl mb-3">🌡️</div>
          <p className="text-sm">
            아무 단어로 시작해보세요. 유사도가 높을수록(🔥) 정답의 의미에 가까워진 겁니다.
            정답은 몬스터/아이템 이름을 <strong className="text-ink">정확히</strong> 입력해야 인정돼요.
          </p>
        </div>
      )}

      {/* 오늘의 랭킹 */}
      {meta.ranking.length > 0 && (
        <div className="pixel-panel p-4">
          <h2 className="font-pixel text-sm text-ink mb-2">🏆 오늘의 랭킹 <span className="text-xs text-dim">(시도 횟수 순)</span></h2>
          <div className="space-y-1">
            {meta.ranking.map((r, i) => (
              <div key={`${r.nickname}-${i}`} className="flex items-center gap-2 text-sm px-2 py-1 pixel-card">
                <span className={`w-6 text-center font-pixel ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-dim"}`}>{i + 1}</span>
                <span className="flex-1 truncate text-ink">{r.nickname}</span>
                <span className="font-pixel text-xs text-maple">{r.attempts}트</span>
                <span className="font-pixel text-[10px] text-dim">{r.solved_at}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-dim mt-4">
        유사도는 AI 임베딩(단어 의미 벡터) 기반이라 사람의 직관과 다를 수 있습니다. 놀이용 수치예요!
      </p>
    </div>
  );
}
