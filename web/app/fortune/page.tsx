"use client";

import { useState, useEffect, useCallback } from "react";

/* ── 타입 ─────────────────────────────────────────────── */

interface FortuneResult {
  maple_fortune: string;
  real_fortune: string;
  lucky_monster: string;
  lucky_map: string;
  lucky_item: string;
  enhance_luck: number;
  zodiac: string;
  constellation: string;
  job: string;
  cached: boolean;
  remaining: number;
}

/* ── 상수 ─────────────────────────────────────────────── */

const JOBS = [
  { key: "전사", icon: "⚔️", color: "red" },
  { key: "궁수", icon: "🏹", color: "green" },
  { key: "마법사", icon: "🪄", color: "blue" },
  { key: "도적", icon: "🗡️", color: "purple" },
] as const;

const COOLDOWN_SEC = 30;

/* ── 쿠키 헬퍼 ────────────────────────────────────────── */

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/* ── 컴포넌트 ─────────────────────────────────────────── */

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= value ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function FortunePage() {
  const [birthdate, setBirthdate] = useState("");
  const [job, setJob] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FortuneResult | null>(null);
  const [activeTab, setActiveTab] = useState<"maple" | "real">("maple");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  // 쿨다운 타이머 (마운트 시 쿠키 확인)
  useEffect(() => {
    const last = getCookie("fortune_last_request");
    if (last) {
      const elapsed = Math.floor((Date.now() - parseInt(last, 10)) / 1000);
      if (elapsed < COOLDOWN_SEC) setCooldown(COOLDOWN_SEC - elapsed);
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(c - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // 로컬스토리지에서 이전 입력값 복원
  useEffect(() => {
    const saved = localStorage.getItem("fortune_input");
    if (saved) {
      try {
        const { birthdate: b, job: j } = JSON.parse(saved);
        if (b) setBirthdate(b);
        if (j) setJob(j);
      } catch { /* ignore */ }
    }
  }, []);

  const fetchFortune = useCallback(async () => {
    if (!birthdate || !job) {
      setError("생년월일과 직업을 모두 선택해주세요.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    // 입력값 저장
    localStorage.setItem("fortune_input", JSON.stringify({ birthdate, job }));

    try {
      const res = await fetch("/api/fortune-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthdate, job }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          // rate limit — 쿨다운 표시
          const retryAfter = parseInt(res.headers.get("Retry-After") || "30", 10);
          setCooldown(retryAfter);
        }
        setError(data.error || data.detail || "오류가 발생했습니다.");
        return;
      }

      setResult(data);
      setRemaining(data.remaining ?? null);
      setCooldown(COOLDOWN_SEC);
    } catch (e) {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }, [birthdate, job]);

  const disabled = loading || cooldown > 0 || !birthdate || !job;

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">
        오늘의 운세
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        생년월일과 직업을 선택하면 메이플랜드 운세와 현실 운세를 알려드려요.
      </p>

      {/* ── 입력 폼 ──────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-6">
        {/* 생년월일 */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            생년월일
          </label>
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-colors"
          />
        </div>

        {/* 직업 선택 */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            직업
          </label>
          <div className="grid grid-cols-4 gap-2">
            {JOBS.map((j) => (
              <button
                key={j.key}
                onClick={() => setJob(j.key)}
                className={`py-3 rounded-lg text-sm font-bold border-2 transition-all ${
                  job === j.key
                    ? "bg-orange-500 text-white border-orange-500 scale-105 shadow-md"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-orange-300"
                }`}
              >
                <span className="block text-lg mb-0.5">{j.icon}</span>
                {j.key}
              </button>
            ))}
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 제출 버튼 */}
        <button
          onClick={fetchFortune}
          disabled={disabled}
          className={`w-full font-bold py-3 rounded-xl text-base transition-all shadow-md ${
            disabled
              ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              : "bg-orange-500 hover:bg-orange-600 text-white"
          }`}
        >
          {loading
            ? "운세를 점치는 중..."
            : cooldown > 0
              ? `${cooldown}초 후 다시 가능`
              : "운세 보기"}
        </button>

        {/* 잔여 횟수 */}
        {remaining !== null && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
            오늘 남은 횟수: {remaining}회
          </p>
        )}
      </div>

      {/* ── 로딩 애니메이션 ──────────────────────────── */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm mb-6 text-center">
          <div className="inline-block animate-spin text-4xl mb-3">🔮</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            별자리와 메이플 세계의 기운을 읽고 있습니다...
          </p>
        </div>
      )}

      {/* ── 결과 표시 ────────────────────────────────── */}
      {result && !loading && (
        <div className="space-y-4 animate-[fadeIn_0.5s_ease-out]">
          {/* 사용자 정보 배지 */}
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium">
              {result.zodiac}띠
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
              {result.constellation}
            </span>
            <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
              {result.job}
            </span>
            {result.cached && (
              <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs">
                캐시 결과
              </span>
            )}
          </div>

          {/* 탭 */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("maple")}
              className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                activeTab === "maple"
                  ? "bg-orange-500 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              🍁 메이플 운세
            </button>
            <button
              onClick={() => setActiveTab("real")}
              className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
                activeTab === "real"
                  ? "bg-orange-500 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              🌟 현실 운세
            </button>
          </div>

          {/* 운세 내용 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
              {activeTab === "maple" ? result.maple_fortune : result.real_fortune}
            </p>
          </div>

          {/* 행운 아이템 (메이플 탭에서만) */}
          {activeTab === "maple" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                오늘의 행운
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
                  <p className="text-xs text-red-400 mb-1">행운의 몬스터</p>
                  <p className="text-sm font-bold text-red-600 dark:text-red-300">
                    {result.lucky_monster}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                  <p className="text-xs text-green-400 mb-1">행운의 사냥터</p>
                  <p className="text-sm font-bold text-green-600 dark:text-green-300">
                    {result.lucky_map}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
                  <p className="text-xs text-blue-400 mb-1">행운의 아이템</p>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-300">
                    {result.lucky_item}
                  </p>
                </div>
              </div>

              {/* 강화운 */}
              <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300">
                  오늘의 강화운
                </span>
                <StarRating value={result.enhance_luck} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 안내 ──────────────────────────────────────── */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          운세는 AI가 생성하며 재미를 위한 것입니다. 같은 조합으로 하루 최대 3가지 다른 운세를 받을 수 있으며, 매일 자정(KST)에 초기화됩니다. 일일 조회 횟수는 3회로 제한됩니다.
        </p>
      </div>
    </div>
  );
}
