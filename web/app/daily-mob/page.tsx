"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDailyMob, guessDailyMob, solveDailyMob,
  type DailyMobMeta, type DailyMobGuessResult, type DailyMobNumFeedback,
} from "@/lib/api";

/* 피드백 셀 색상: 일치=초록, 근접/부분=노랑, 불일치=기본 */
function cellClass(kind: "match" | "close" | "none"): string {
  if (kind === "match") return "bg-green-500/20 border-green-500 text-green-600 dark:text-green-400";
  if (kind === "close") return "bg-yellow-500/20 border-yellow-500 text-yellow-600 dark:text-yellow-400";
  return "bg-surface2 border-edge text-dim";
}

function numKind(fb: DailyMobNumFeedback): "match" | "close" | "none" {
  if (fb.dir === "match") return "match";
  return fb.close ? "close" : "none";
}

function numArrow(fb: DailyMobNumFeedback): string {
  if (fb.dir === "match") return "";
  return fb.dir === "up" ? " ↑" : " ↓";
}

function fmtNum(n: number): string {
  return n >= 10000 ? `${Math.round(n / 1000)}k` : String(n);
}

function emojiFor(kind: "match" | "close" | "none"): string {
  return kind === "match" ? "🟩" : kind === "close" ? "🟨" : "⬜";
}

interface StoredState {
  guesses: DailyMobGuessResult[];
  solved: boolean;
}

function GuessRow({ r }: { r: DailyMobGuessResult }) {
  const f = r.feedback;
  const cells: { label: string; value: string; kind: "match" | "close" | "none" }[] = [
    { label: "레벨", value: `${r.guess.level}${numArrow(f.level)}`, kind: numKind(f.level) },
    { label: "HP", value: `${fmtNum(r.guess.hp)}${numArrow(f.hp)}`, kind: numKind(f.hp) },
    { label: "EXP", value: `${fmtNum(r.guess.exp)}${numArrow(f.exp)}`, kind: numKind(f.exp) },
    { label: "보스", value: r.guess.is_boss ? "보스" : "일반", kind: f.is_boss ? "match" : "none" },
    { label: "언데드", value: r.guess.is_undead ? "언데드" : "아님", kind: f.is_undead ? "match" : "none" },
    { label: "지역", value: r.guess.region, kind: f.region === "match" ? "match" : f.region === "partial" ? "close" : "none" },
  ];
  return (
    <div className="grid grid-cols-[minmax(110px,1.4fr)_repeat(6,minmax(56px,1fr))] gap-1 min-w-[560px]">
      <div className={`flex items-center gap-1.5 px-2 py-1.5 border-2 ${r.correct ? cellClass("match") : "bg-surface2 border-edge"}`}>
        <img src={r.guess.icon_url} alt="" className="w-7 h-7 object-contain shrink-0 [image-rendering:pixelated]"
          onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <span className="text-xs font-medium text-ink truncate">{r.guess.name}</span>
      </div>
      {cells.map((c) => (
        <div key={c.label} className={`flex items-center justify-center px-1 py-1.5 border-2 text-xs font-medium text-center ${cellClass(c.kind)}`}>
          {c.value}
        </div>
      ))}
    </div>
  );
}

export default function DailyMobPage() {
  const [meta, setMeta] = useState<DailyMobMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [guesses, setGuesses] = useState<DailyMobGuessResult[]>([]);
  const [solved, setSolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [guessError, setGuessError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [streak, setStreak] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const storageKey = meta ? `daily_mob_${meta.date}` : null;

  // 메타 로드 + 저장 상태 복원
  useEffect(() => {
    getDailyMob()
      .then((m) => {
        setMeta(m);
        try {
          const raw = localStorage.getItem(`daily_mob_${m.date}`);
          if (raw) {
            const st: StoredState = JSON.parse(raw);
            setGuesses(st.guesses ?? []);
            setSolved(st.solved ?? false);
          }
          const sraw = localStorage.getItem("daily_mob_streak");
          if (sraw) {
            const s = JSON.parse(sraw);
            // 어제 또는 오늘 풀었으면 연속 유지, 아니면 0부터
            const last = new Date(s.last_date);
            const today = new Date(m.date);
            const diff = Math.round((today.getTime() - last.getTime()) / 86400000);
            setStreak(diff <= 1 ? s.streak : 0);
          }
        } catch { /* 저장 상태 손상 시 새로 시작 */ }
      })
      .catch(() => setError("퍼즐을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  // 자정(KST) 카운트다운
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const kstNow = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
      const next = new Date(kstNow);
      next.setHours(24, 0, 0, 0);
      const ms = next.getTime() - kstNow.getTime();
      const h = Math.floor(ms / 3600000);
      const mnt = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(mnt).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const persist = useCallback((next: StoredState) => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* 저장 실패 무시 */ }
    }
  }, [storageKey]);

  const guessedNames = useMemo(() => new Set(guesses.map((g) => g.guess.name)), [guesses]);

  // 자동완성 후보
  const suggestions = useMemo(() => {
    if (!meta || !input.trim() || solved) return [];
    const q = input.replace(/\s/g, "").toLowerCase();
    return meta.pool
      .filter((p) => !guessedNames.has(p.name) && p.name.replace(/\s/g, "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [meta, input, solved, guessedNames]);

  const submitGuess = useCallback(async (name: string) => {
    if (!name.trim() || submitting || solved) return;
    setSubmitting(true);
    setGuessError(null);
    try {
      const r = await guessDailyMob(name);
      setGuesses((prev) => {
        const next = [...prev, r];
        persist({ guesses: next, solved: r.correct });
        if (r.correct) {
          setSolved(true);
          solveDailyMob(next.length).catch(() => {});
          // 연속 기록 갱신
          try {
            const sraw = localStorage.getItem("daily_mob_streak");
            let nextStreak = 1;
            if (sraw) {
              const s = JSON.parse(sraw);
              const last = new Date(s.last_date);
              const today = new Date(r.date);
              const diff = Math.round((today.getTime() - last.getTime()) / 86400000);
              nextStreak = diff === 1 ? s.streak + 1 : diff === 0 ? s.streak : 1;
            }
            localStorage.setItem("daily_mob_streak", JSON.stringify({ last_date: r.date, streak: nextStreak }));
            setStreak(nextStreak);
          } catch { /* 무시 */ }
        }
        return next;
      });
      setInput("");
    } catch (e) {
      setGuessError(e instanceof Error ? e.message : "추측에 실패했습니다.");
    } finally {
      setSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [submitting, solved, persist]);

  const share = useCallback(() => {
    if (!meta) return;
    const rows = guesses.map((g) => {
      const f = g.feedback;
      return [
        emojiFor(numKind(f.level)),
        emojiFor(numKind(f.hp)),
        emojiFor(numKind(f.exp)),
        emojiFor(f.is_boss ? "match" : "none"),
        emojiFor(f.is_undead ? "match" : "none"),
        emojiFor(f.region === "match" ? "match" : f.region === "partial" ? "close" : "none"),
      ].join("");
    });
    const text = `오늘의 몬스터 #${meta.puzzle_no} — ${guesses.length}번 만에 성공!\n${rows.join("\n")}\n`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [meta, guesses]);

  if (loading) {
    return (
      <div className="text-center py-20 text-dim">
        <div className="w-8 h-8 border-2 border-maple border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        오늘의 퍼즐 로딩 중...
      </div>
    );
  }
  if (error || !meta) {
    return <div className="pixel-panel p-8 text-center text-dim max-w-2xl mx-auto">{error ?? "오류가 발생했습니다."}</div>;
  }

  const answerRow = guesses.find((g) => g.correct);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 font-pixel">👾 오늘의 몬스터 <span className="text-maple">#{meta.puzzle_no}</span></h1>
      <p className="text-dim mb-4">
        매일 자정(KST)에 바뀌는 몬스터를 추리해보세요. 레벨·HP·EXP·보스·언데드·지역 힌트가 주어집니다.
      </p>

      {/* 상태 바 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pixel-panel px-4 py-2.5 mb-4 text-sm">
        <span className="text-dim">시도 <strong className="text-ink">{guesses.length}</strong></span>
        <span className="text-dim">연속 성공 <strong className="text-maple">{streak}</strong>일</span>
        <span className="text-dim">
          오늘 <strong className="text-ink">{meta.stats.solvers}</strong>명 성공
          {meta.stats.avg_attempts != null && <> · 평균 <strong className="text-ink">{meta.stats.avg_attempts}</strong>번</>}
        </span>
        <span className="ml-auto font-pixel text-xs text-dim">다음 퍼즐까지 {countdown}</span>
      </div>

      {/* 입력 */}
      {!solved && (
        <div className="relative mb-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const exact = suggestions.find((s) => s.name === input.trim());
                  submitGuess(exact ? exact.name : suggestions[0]?.name ?? input);
                }
              }}
              placeholder="몬스터 이름을 입력하세요..."
              className="flex-1 px-4 py-3 pixel-input"
              autoComplete="off"
              disabled={submitting}
            />
            <button
              onClick={() => submitGuess(suggestions[0]?.name ?? input)}
              disabled={submitting || !input.trim()}
              className="px-6 py-3 pixel-btn disabled:opacity-50"
            >
              추측
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 pixel-panel max-h-64 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => submitGuess(s.name)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-surface2 transition-colors"
                >
                  <img
                    src={`https://maplestory.io/api/gms/92/mob/${s.id}/icon`}
                    alt=""
                    className="w-6 h-6 object-contain [image-rendering:pixelated]"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                  <span className="text-ink">{s.name}</span>
                </button>
              ))}
            </div>
          )}
          {guessError && <p className="text-xs text-red-500 mt-1">{guessError}</p>}
        </div>
      )}

      {/* 정답 배너 */}
      {solved && answerRow?.answer && (
        <div className="pixel-panel p-6 mb-4 text-center border-green-500">
          <img
            src={answerRow.answer.icon_url}
            alt={answerRow.answer.name}
            className="w-20 h-20 mx-auto object-contain [image-rendering:pixelated] mb-2"
          />
          <div className="font-pixel text-lg text-green-500 mb-1">정답: {answerRow.answer.name}</div>
          <p className="text-sm text-dim mb-4">{guesses.length}번 만에 맞췄습니다! 내일 자정에 새 퍼즐이 열립니다.</p>
          <button onClick={share} className="px-6 py-2 pixel-btn">
            {copied ? "복사 완료!" : "결과 공유 📋"}
          </button>
        </div>
      )}

      {/* 추측 기록 */}
      {guesses.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-cols-[minmax(110px,1.4fr)_repeat(6,minmax(56px,1fr))] gap-1 min-w-[560px] mb-1">
            {["몬스터", "레벨", "HP", "EXP", "보스", "언데드", "지역"].map((h) => (
              <div key={h} className="font-pixel text-[10px] text-dim text-center py-1">{h}</div>
            ))}
          </div>
          <div className="space-y-1">
            {[...guesses].reverse().map((g, i) => (
              <GuessRow key={`${g.guess.id}-${i}`} r={g} />
            ))}
          </div>
        </div>
      )}

      {guesses.length === 0 && (
        <div className="pixel-panel p-8 text-center text-dim">
          <div className="text-5xl mb-3">❓</div>
          <p className="text-sm">
            첫 추측을 입력해보세요. <span className="text-green-500">초록</span>은 일치,{" "}
            <span className="text-yellow-500">노랑</span>은 근접(레벨 ±5, HP/EXP ±25%, 지역 부분 일치),{" "}
            화살표는 정답이 더 높은지(↑) 낮은지(↓)를 뜻합니다.
          </p>
        </div>
      )}
    </div>
  );
}
