"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getQuizPool, getQuizScores, submitQuizScore, type QuizPoolEntry, type QuizScore } from "@/lib/api";

/* ── 타입 ── */
interface QuizEntry {
  id: number;
  name: string;
  name_kr: string | null;
  icon_url: string | null;
  type: "mob" | "npc";
}

type Mode = "practice" | "jokbo";
type Category = "all" | "mob" | "npc" | "silhouette";

const CATEGORY_LABELS: Record<string, string> = { all: "전체", mob: "몬스터", npc: "NPC", silhouette: "실루엣" };

function Leaderboard({ scores, questionCount }: { scores: QuizScore[]; questionCount: number }) {
  return (
    <div className="pixel-panel p-4">
      <h3 className="font-pixel text-sm mb-3 text-ink">🏆 명예의 전당 ({questionCount}문제)</h3>
      {scores.length === 0 ? (
        <p className="text-sm text-dim text-center py-4">아직 기록이 없습니다. 첫 기록의 주인공이 되어보세요!</p>
      ) : (
        <div className="space-y-1">
          {scores.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 text-sm px-2 py-1.5 pixel-card">
              <span className={`w-6 text-center font-pixel ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-dim"}`}>
                {i + 1}
              </span>
              <span className="font-medium text-ink flex-1 truncate">{s.nickname}</span>
              <span className="text-xs text-dim">{CATEGORY_LABELS[s.category] ?? s.category}</span>
              <span className="text-xs text-dim">연속 {s.best_streak}</span>
              <strong className="text-maple w-14 text-right">{s.score}/{s.total}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TIME_LIMIT = 10; // 초
const QUESTION_COUNTS = [10, 20, 30] as const;

// 현대 KMS 표기 유입 정리: "[★] 버푼" → "버푼" (스타포스 필드 접두어 등)
function cleanKmsName(s: string | null | undefined): string | null {
  if (!s) return null;
  const cleaned = s.replace(/\[[^\]]*\]\s*/g, "").trim();
  return cleaned || null;
}

// maplestory.io 아이콘이 4x4 투명 스프라이트/404인 엔티티 (2026-07 전수 스캔 결과)
// 오브젝트형 NPC(책장·벽·무덤 등)와 아이콘 없는 보스. 런타임 onLoad 검사로도 이중 방어.
const BROKEN_ICONS = new Set<string>([
  "mob-8810018", "mob-8820014", // 혼테일, 핑크빈
  "npc-2012023", "npc-2012027", "npc-2012028", "npc-2012029", "npc-2012031",
  "npc-2012032", "npc-2012033", "npc-2103000", "npc-2103001", "npc-2103002",
  "npc-2103003", "npc-2103004", "npc-2103005", "npc-2103006", "npc-2103008",
  "npc-2103009", "npc-2103010", "npc-2103011", "npc-2103012", "npc-2111010",
  "npc-2111011", "npc-2111012", "npc-2111013", "npc-2111014", "npc-2111015",
  "npc-2111017", "npc-2111018", "npc-2111019", "npc-2111020", "npc-2111021",
  "npc-2111022", "npc-2111023", "npc-2111024", "npc-2112007", "npc-2112013",
  "npc-2121001", "npc-2121002", "npc-2121003", "npc-2121004", "npc-2121006",
  "npc-2121007", "npc-2121008", "npc-2121009", "npc-2121010", "npc-2121011",
  "npc-9100001", "npc-9100002", "npc-9100003", "npc-9100004", // 마네키네코 404
]);

export default function QuizPage() {
  const [mode, setMode] = useState<Mode>("practice");
  const [category, setCategory] = useState<Category>("all");
  const [entries, setEntries] = useState<QuizEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // 연습 모드 상태
  const [currentQ, setCurrentQ] = useState<QuizEntry | null>(null);
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [result, setResult] = useState<"correct" | "wrong" | "timeout" | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 기록 상태
  const [nickname, setNickname] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [scores, setScores] = useState<QuizScore[]>([]);

  // 족보 모드 상태
  const [jokboSearch, setJokboSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // 데이터 로드 (경량 풀 API + 24시간 localStorage 캐시)
  useEffect(() => {
    const CACHE_KEY = "quiz_pool_v1";
    const CACHE_TTL = 24 * 60 * 60 * 1000;

    const toEntries = (pool: { mobs: QuizPoolEntry[]; npcs: QuizPoolEntry[] }): QuizEntry[] => [
      ...pool.mobs
        // 900만번대는 튜토리얼·퀘스트·이벤트 특수몹 (일반몹 스프라이트 재사용, 예: 죽음의 공포=플라이아이)
        .filter((m) => m.id < 9000000 && !BROKEN_ICONS.has(`mob-${m.id}`))
        .map((m) => ({
          id: m.id, name: m.name, name_kr: cleanKmsName(m.name_kr) ?? m.name,
          icon_url: `https://maplestory.io/api/gms/92/mob/${m.id}/icon`, type: "mob" as const,
        })),
      ...pool.npcs
        // 한국어명이 없거나 결측 플레이스홀더('스트링 없음')인 NPC는 출제 불가
        .filter((n) => {
          const kr = (n.name_kr ?? "").trim();
          return kr && kr !== "스트링 없음" && n.name !== "No String." && !BROKEN_ICONS.has(`npc-${n.id}`);
        })
        .map((n) => ({
          id: n.id, name: n.name, name_kr: cleanKmsName(n.name_kr) ?? n.name,
          icon_url: `https://maplestory.io/api/gms/92/npc/${n.id}/icon`, type: "npc" as const,
        })),
    ];

    // 1) 캐시 히트 시 즉시 표시
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { at, pool } = JSON.parse(cached);
        if (Date.now() - at < CACHE_TTL && pool?.mobs?.length) {
          setEntries(toEntries(pool));
          setLoading(false);
          return;
        }
      }
    } catch { /* 캐시 손상 시 네트워크 로드로 진행 */ }

    // 2) 네트워크 로드
    setLoading(true);
    getQuizPool()
      .then((pool) => {
        setEntries(toEntries(pool));
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), pool }));
        } catch { /* 저장 실패는 무시 */ }
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  // 리더보드 로드 (시작 화면·결과 화면에서)
  useEffect(() => {
    if (gameStarted && !gameOver) return;
    getQuizScores({ total: questionCount, limit: 20 })
      .then((d) => setScores(d.scores))
      .catch(() => setScores([]));
  }, [gameStarted, gameOver, questionCount]);

  // 닉네임 기억
  useEffect(() => {
    const saved = localStorage.getItem("quiz_nickname");
    if (saved) setNickname(saved);
  }, []);

  // 필터된 목록 (실루엣 모드는 몬스터만 출제)
  const filtered = useMemo(() => {
    let list = entries;
    if (category === "silhouette") list = list.filter((e) => e.type === "mob");
    else if (category !== "all") list = list.filter((e) => e.type === category);
    return list;
  }, [entries, category]);

  // 족보 필터
  const jokboFiltered = useMemo(() => {
    if (!jokboSearch) return filtered;
    const q = jokboSearch.toLowerCase().replace(/\s/g, "");
    return filtered.filter(
      (e) =>
        (e.name_kr || e.name).toLowerCase().replace(/\s/g, "").includes(q) ||
        e.name.toLowerCase().replace(/\s/g, "").includes(q)
    );
  }, [filtered, jokboSearch]);

  // 랜덤 문제 뽑기
  const nextQuestion = useCallback(() => {
    if (filtered.length === 0) return;
    const rand = filtered[Math.floor(Math.random() * filtered.length)];
    setCurrentQ(rand);
    setAnswer("");
    setResult(null);
    setTimeLeft(TIME_LIMIT);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [filtered]);

  // 이미지가 깨진 문제는 카운트 없이 자동 교체 (풀에서도 제거)
  const skipBrokenQuestion = useCallback(() => {
    if (!currentQ || result) return;
    const bad = currentQ;
    setEntries((prev) => prev.filter((e) => !(e.type === bad.type && e.id === bad.id)));
    const candidates = filtered.filter((e) => !(e.type === bad.type && e.id === bad.id));
    if (candidates.length === 0) return;
    const rand = candidates[Math.floor(Math.random() * candidates.length)];
    setCurrentQ(rand);
    setAnswer("");
    setTimeLeft(TIME_LIMIT);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [currentQ, result, filtered]);

  // 타이머
  useEffect(() => {
    if (!gameStarted || gameOver || result) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setResult("timeout");
          setStreak(0);
          setTotal((t) => t + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameStarted, gameOver, result, currentQ]);

  // 정답 확인
  const checkAnswer = useCallback(() => {
    if (!currentQ || result) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const correct = (currentQ.name_kr || currentQ.name).replace(/\s/g, "").toLowerCase();
    const userAns = answer.replace(/\s/g, "").toLowerCase();

    if (correct === userAns) {
      setResult("correct");
      setScore((s) => s + 1);
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      setResult("wrong");
      setStreak(0);
    }
    setTotal((t) => t + 1);
  }, [currentQ, answer, result]);

  // 게임 시작
  const startGame = useCallback(() => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setTotal(0);
    setStreak(0);
    setBestStreak(0);
    setSubmitState("idle");
    nextQuestion();
  }, [nextQuestion]);

  // 기록 등록
  const saveScore = useCallback(async () => {
    const nick = nickname.trim();
    if (!nick || submitState === "saving" || submitState === "done") return;
    setSubmitState("saving");
    try {
      await submitQuizScore({ nickname: nick, score, total: questionCount, best_streak: bestStreak, category });
      localStorage.setItem("quiz_nickname", nick);
      setSubmitState("done");
      const d = await getQuizScores({ total: questionCount, limit: 20 });
      setScores(d.scores);
    } catch {
      setSubmitState("error");
    }
  }, [nickname, score, questionCount, bestStreak, category, submitState]);

  // 클립보드 복사 (족보 모드)
  const copyName = useCallback((name: string) => {
    navigator.clipboard.writeText(name).then(() => {
      setCopied(name);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  if (loading) {
    return (
      <div className="text-center py-20 text-dim">
        <div className="w-8 h-8 border-2 border-maple border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        데이터 로딩 중...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 font-pixel">메이플 퀴즈</h1>
      <p className="text-dim mb-6">
        스피드퀴즈 연습 & NPC/몬스터 족보
      </p>

      {/* 모드 & 카테고리 선택 */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex bg-surface2 p-1">
          <button
            onClick={() => setMode("practice")}
            className={`px-4 py-2 text-sm transition ${
              mode === "practice" ? "pixel-btn" : "font-pixel text-dim hover:text-maple"
            }`}
          >
            연습 모드
          </button>
          <button
            onClick={() => setMode("jokbo")}
            className={`px-4 py-2 text-sm transition ${
              mode === "jokbo" ? "pixel-btn" : "font-pixel text-dim hover:text-maple"
            }`}
          >
            족보
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["all", "mob", "npc", "silhouette"] as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-2 text-sm transition ${
                category === c
                  ? "pixel-btn"
                  : "pixel-card font-pixel text-dim"
              }`}
            >
              {{ all: "전체", mob: "몬스터", npc: "NPC", silhouette: "실루엣" }[c]}
              <span className="ml-1 text-xs text-dim">
                ({c === "all"
                  ? entries.length
                  : entries.filter((e) => e.type === (c === "silhouette" ? "mob" : c)).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 연습 모드 ── */}
      {mode === "practice" && (
        <div>
          {!gameStarted ? (
            <div className="space-y-4">
              <div className="text-center py-12 pixel-panel">
                <div className="text-6xl mb-4">❓</div>
                <h2 className="text-xl font-bold mb-2 font-pixel">스피드퀴즈 연습</h2>
                <p className="text-dim mb-6">
                  NPC/몬스터 이미지를 보고 {TIME_LIMIT}초 안에 이름을 맞추세요!
                </p>
                <div className="mb-6">
                  <div className="font-pixel text-xs text-dim mb-2">문제 수</div>
                  <div className="flex justify-center gap-2">
                    {QUESTION_COUNTS.map((n) => (
                      <button
                        key={n}
                        onClick={() => setQuestionCount(n)}
                        className={`px-5 py-2 transition ${
                          questionCount === n ? "pixel-btn" : "pixel-card font-pixel text-dim"
                        }`}
                      >
                        {n}문제
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={startGame}
                  className="px-8 py-3 pixel-btn text-lg transition"
                >
                  시작하기
                </button>
              </div>
              <Leaderboard scores={scores} questionCount={questionCount} />
            </div>
          ) : gameOver ? (
            <div className="space-y-4">
              <div className="text-center py-10 pixel-panel">
                <div className="text-5xl mb-3">{score === questionCount ? "👑" : score >= questionCount * 0.7 ? "🎉" : "💪"}</div>
                <h2 className="text-xl font-bold mb-1 font-pixel">퀴즈 종료!</h2>
                <p className="text-3xl font-bold text-maple my-3">
                  {score} <span className="text-lg text-dim">/ {questionCount}</span>
                </p>
                <p className="text-sm text-dim mb-6">
                  정답률 {Math.round((score / questionCount) * 100)}% · 최고 연속 {bestStreak}
                </p>

                {submitState === "done" ? (
                  <p className="text-green-500 font-pixel text-sm mb-4">기록 등록 완료! ✅</p>
                ) : (
                  <div className="flex justify-center gap-2 mb-4">
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && saveScore()}
                      placeholder="닉네임 (12자 이내)"
                      maxLength={12}
                      className="px-4 py-2 pixel-input w-44"
                    />
                    <button
                      onClick={saveScore}
                      disabled={!nickname.trim() || submitState === "saving"}
                      className="px-5 py-2 pixel-btn transition disabled:opacity-50"
                    >
                      {submitState === "saving" ? "저장 중..." : "기록 등록"}
                    </button>
                  </div>
                )}
                {submitState === "error" && (
                  <p className="text-red-500 text-xs mb-3">등록에 실패했습니다. 다시 시도해주세요.</p>
                )}

                <div className="flex justify-center gap-2">
                  <button onClick={startGame} className="px-6 py-2 pixel-btn transition">
                    다시 하기
                  </button>
                  <button
                    onClick={() => { setGameStarted(false); setGameOver(false); }}
                    className="px-6 py-2 pixel-card font-pixel text-dim transition"
                  >
                    처음으로
                  </button>
                </div>
              </div>
              <Leaderboard scores={scores} questionCount={questionCount} />
            </div>
          ) : (
            <div>
              {/* 스코어보드 */}
              <div className="flex items-center justify-between pixel-panel px-4 py-3 mb-4">
                <div className="flex gap-4 text-sm">
                  <span className="font-pixel text-xs text-dim self-center">
                    {Math.min(total + (result ? 0 : 1), questionCount)}/{questionCount}
                  </span>
                  <span>정답 <strong className="text-green-500">{score}</strong></span>
                  <span>연속 <strong className="text-maple">{streak}</strong></span>
                  <span>최고 <strong className="text-purple-500">{bestStreak}</strong></span>
                </div>
                <button
                  onClick={() => { setGameStarted(false); setGameOver(false); }}
                  className="text-sm text-dim hover:text-maple"
                >
                  종료
                </button>
              </div>

              {/* 문제 영역 */}
              {currentQ && (
                <div className="pixel-panel p-6">
                  {/* 타이머 바 */}
                  <div className="w-full h-2 bg-surface2 rounded-full mb-6 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        timeLeft > 5 ? "bg-green-500" : timeLeft > 2 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${(timeLeft / TIME_LIMIT) * 100}%` }}
                    />
                  </div>

                  {/* 이미지 또는 이름 표시 */}
                  <div className="text-center mb-6">
                    {currentQ.icon_url ? (
                      <img
                        src={currentQ.icon_url}
                        alt="?"
                        className={`w-24 h-24 mx-auto object-contain mb-2 transition-[filter] duration-300 ${
                          category === "silhouette" && !result ? "brightness-0 dark:brightness-0 dark:invert" : ""
                        }`}
                        onError={skipBrokenQuestion}
                        onLoad={(e) => {
                          const t = e.currentTarget;
                          if (t.naturalWidth < 12 || t.naturalHeight < 12) skipBrokenQuestion();
                        }}
                      />
                    ) : (
                      <div className="w-24 h-24 mx-auto bg-surface2 border-2 border-edge flex items-center justify-center text-4xl mb-2">
                        {currentQ.type === "mob" ? "👾" : "🧑"}
                      </div>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      currentQ.type === "mob"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-600"
                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                    }`}>
                      {currentQ.type === "mob" ? "몬스터" : "NPC"}
                    </span>
                  </div>

                  {/* 결과 표시 */}
                  {result ? (
                    <div className="text-center mb-4">
                      {result === "correct" ? (
                        <div className="text-green-500 font-bold text-lg">정답! ✅</div>
                      ) : result === "wrong" ? (
                        <div>
                          <div className="text-red-500 font-bold text-lg">오답 ❌</div>
                          <div className="text-sm text-dim mt-1">
                            정답: <strong className="text-ink">{currentQ.name_kr || currentQ.name}</strong>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-yellow-500 font-bold text-lg">시간 초과 ⏰</div>
                          <div className="text-sm text-dim mt-1">
                            정답: <strong className="text-ink">{currentQ.name_kr || currentQ.name}</strong>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => (total >= questionCount ? setGameOver(true) : nextQuestion())}
                        className="mt-4 px-6 py-2 pixel-btn transition"
                      >
                        {total >= questionCount ? "결과 보기 🏁" : "다음 문제"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && checkAnswer()}
                        placeholder="이름을 입력하세요"
                        className="flex-1 px-4 py-3 pixel-input"
                        autoComplete="off"
                      />
                      <button
                        onClick={checkAnswer}
                        className="px-6 py-3 pixel-btn transition"
                      >
                        확인
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 족보 모드 ── */}
      {mode === "jokbo" && (
        <div>
          {/* 검색 */}
          <div className="relative mb-4">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={jokboSearch}
              onChange={(e) => setJokboSearch(e.target.value)}
              placeholder="이름으로 검색... (클릭하면 자동 복사!)"
              className="w-full pl-12 pr-4 py-3 pixel-input"
            />
          </div>

          {/* 복사 알림 */}
          {copied && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-bounce">
              &ldquo;{copied}&rdquo; 복사 완료!
            </div>
          )}

          {/* 목록 */}
          <div className="text-sm text-dim mb-2">
            {jokboFiltered.length}개 항목 | 클릭하면 이름이 클립보드에 복사됩니다
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {jokboFiltered.map((entry) => (
              <button
                key={`${entry.type}-${entry.id}`}
                onClick={() => copyName(entry.name_kr || entry.name)}
                className={`flex items-center gap-2 p-3 transition text-left ${
                  copied === (entry.name_kr || entry.name)
                    ? "border-2 border-green-400 bg-green-50 dark:bg-green-900/20"
                    : "pixel-card"
                }`}
              >
                {entry.icon_url ? (
                  <img src={entry.icon_url} alt="" className="w-8 h-8 object-contain shrink-0" />
                ) : (
                  <span className="text-lg shrink-0">{entry.type === "mob" ? "👾" : "🧑"}</span>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{entry.name_kr || entry.name}</div>
                  {entry.name_kr && entry.name !== entry.name_kr && (
                    <div className="text-xs text-dim truncate">{entry.name}</div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {jokboFiltered.length === 0 && (
            <div className="text-center py-12 text-dim">검색 결과가 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}
