"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getMobs, getNpcs } from "@/lib/api";

/* ── 타입 ── */
interface QuizEntry {
  id: number;
  name: string;
  name_kr: string | null;
  icon_url: string | null;
  type: "mob" | "npc";
}

type Mode = "practice" | "jokbo";
type Category = "all" | "mob" | "npc";

const TIME_LIMIT = 10; // 초

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
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 족보 모드 상태
  const [jokboSearch, setJokboSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // 데이터 로드
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMobs({ per_page: 200 }).then((d) =>
        d.mobs.map((m) => ({ id: m.id, name: m.name, name_kr: m.name_kr ?? m.name, icon_url: m.icon_url, type: "mob" as const }))
      ),
      getNpcs({ per_page: 200 }).then((d) =>
        d.npcs.map((n) => ({ id: n.id, name: n.name, name_kr: n.name_kr ?? n.name, icon_url: n.icon_url, type: "npc" as const }))
      ),
    ])
      .then(([mobs, npcs]) => setEntries([...mobs, ...npcs]))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  // 필터된 목록
  const filtered = useMemo(() => {
    let list = entries;
    if (category !== "all") list = list.filter((e) => e.type === category);
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
    nextQuestion();
  }, [nextQuestion]);

  // 클립보드 복사 (족보 모드)
  const copyName = useCallback((name: string) => {
    navigator.clipboard.writeText(name).then(() => {
      setCopied(name);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        데이터 로딩 중...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">메이플 퀴즈</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        스피드퀴즈 연습 & NPC/몬스터 족보
      </p>

      {/* 모드 & 카테고리 선택 */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setMode("practice")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              mode === "practice" ? "bg-white dark:bg-gray-600 shadow text-orange-600" : "text-gray-500"
            }`}
          >
            연습 모드
          </button>
          <button
            onClick={() => setMode("jokbo")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              mode === "jokbo" ? "bg-white dark:bg-gray-600 shadow text-orange-600" : "text-gray-500"
            }`}
          >
            족보
          </button>
        </div>

        <div className="flex gap-2">
          {(["all", "mob", "npc"] as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                category === c
                  ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600 border border-orange-200 dark:border-orange-800"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
              }`}
            >
              {{ all: "전체", mob: "몬스터", npc: "NPC" }[c]}
              <span className="ml-1 text-xs text-gray-400">
                ({c === "all" ? entries.length : entries.filter((e) => e.type === c).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 연습 모드 ── */}
      {mode === "practice" && (
        <div>
          {!gameStarted ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="text-6xl mb-4">❓</div>
              <h2 className="text-xl font-bold mb-2">스피드퀴즈 연습</h2>
              <p className="text-gray-400 mb-6">
                NPC/몬스터 이미지를 보고 {TIME_LIMIT}초 안에 이름을 맞추세요!
              </p>
              <button
                onClick={startGame}
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-lg transition"
              >
                시작하기
              </button>
            </div>
          ) : (
            <div>
              {/* 스코어보드 */}
              <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 mb-4">
                <div className="flex gap-4 text-sm">
                  <span>정답 <strong className="text-green-500">{score}</strong>/{total}</span>
                  <span>연속 <strong className="text-orange-500">{streak}</strong></span>
                  <span>최고 <strong className="text-purple-500">{bestStreak}</strong></span>
                </div>
                <button
                  onClick={() => { setGameStarted(false); setGameOver(false); }}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  종료
                </button>
              </div>

              {/* 문제 영역 */}
              {currentQ && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  {/* 타이머 바 */}
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-6 overflow-hidden">
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
                        className="w-24 h-24 mx-auto object-contain mb-2"
                      />
                    ) : (
                      <div className="w-24 h-24 mx-auto bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-4xl mb-2">
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
                          <div className="text-sm text-gray-400 mt-1">
                            정답: <strong className="text-white">{currentQ.name_kr || currentQ.name}</strong>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-yellow-500 font-bold text-lg">시간 초과 ⏰</div>
                          <div className="text-sm text-gray-400 mt-1">
                            정답: <strong className="text-white">{currentQ.name_kr || currentQ.name}</strong>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={nextQuestion}
                        className="mt-4 px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition"
                      >
                        다음 문제
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && checkAnswer()}
                        placeholder="이름을 입력하세요"
                        className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                        autoComplete="off"
                      />
                      <button
                        onClick={checkAnswer}
                        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition"
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
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={jokboSearch}
              onChange={(e) => setJokboSearch(e.target.value)}
              placeholder="이름으로 검색... (클릭하면 자동 복사!)"
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* 복사 알림 */}
          {copied && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-bounce">
              &ldquo;{copied}&rdquo; 복사 완료!
            </div>
          )}

          {/* 목록 */}
          <div className="text-sm text-gray-400 mb-2">
            {jokboFiltered.length}개 항목 | 클릭하면 이름이 클립보드에 복사됩니다
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {jokboFiltered.map((entry) => (
              <button
                key={`${entry.type}-${entry.id}`}
                onClick={() => copyName(entry.name_kr || entry.name)}
                className={`flex items-center gap-2 p-3 rounded-xl border transition text-left hover:shadow-sm ${
                  copied === (entry.name_kr || entry.name)
                    ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-600"
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
                    <div className="text-xs text-gray-400 truncate">{entry.name}</div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {jokboFiltered.length === 0 && (
            <div className="text-center py-12 text-gray-400">검색 결과가 없습니다</div>
          )}
        </div>
      )}
    </div>
  );
}
