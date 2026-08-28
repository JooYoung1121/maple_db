"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const METRIC_LABEL: Record<string, string> = { level: "레벨", hp: "HP", exp: "EXP" };

type Mob = { id: number; name: string; level: number; hp: number; exp: number; icon_url: string };
type Round = { metric: "level" | "hp" | "exp"; left: Mob; right: Mob; answer_id: number };

export default function HighLowPage() {
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [error, setError] = useState("");

  const nextRound = useCallback(() => {
    setLoading(true); setPicked(null); setError("");
    fetch(`${API_BASE}/api/playground/highlow/round`)
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).detail || "문제를 불러오지 못했습니다"); return r.json(); })
      .then(setRound).catch((e) => setError(String(e.message || e))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setBest(Number(localStorage.getItem("highlow_best") || 0));
    nextRound();
  }, [nextRound]);

  function choose(id: number) {
    if (!round || picked !== null) return;
    setPicked(id);
    if (id === round.answer_id) {
      const next = streak + 1;
      setStreak(next);
      if (next > best) { setBest(next); localStorage.setItem("highlow_best", String(next)); }
    } else setStreak(0);
  }

  const value = (mob: Mob) => round ? mob[round.metric].toLocaleString("ko-KR") : "";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div><h1 className="font-pixel text-2xl">📈 메랜 하이로우</h1><p className="text-sm text-dim mt-1">둘 중 수치가 더 높은 몬스터를 고르세요.</p></div>
        <div className="ml-auto flex gap-2 text-xs"><span className="pixel-card px-3 py-2">🔥 연속 {streak}</span><span className="pixel-card px-3 py-2 text-maple">🏆 최고 {best}</span></div>
      </div>
      {error && <div className="pixel-panel p-4 text-red-500 text-sm">{error}</div>}
      {loading && <div className="pixel-panel p-12 text-center text-dim">다음 대결 준비 중…</div>}
      {!loading && round && (
        <div className="pixel-panel p-4 sm:p-6">
          <h2 className="font-pixel text-center text-maple mb-5">누가 {METRIC_LABEL[round.metric]}가 더 높을까?</h2>
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-4">
            {[round.left, round.right].map((mob, index) => {
              const correct = picked !== null && mob.id === round.answer_id;
              const wrong = picked === mob.id && mob.id !== round.answer_id;
              return (
                <button key={mob.id} onClick={() => choose(mob.id)} disabled={picked !== null}
                  className={`pixel-card p-4 sm:p-7 min-w-0 hover:border-maple transition-all ${correct ? "border-green-500 bg-green-500/10" : wrong ? "border-red-500 bg-red-500/10" : ""}`}>
                  <img src={mob.icon_url} alt="" className="w-20 h-20 sm:w-28 sm:h-28 mx-auto object-contain [image-rendering:pixelated]" />
                  <strong className="block mt-3 text-sm sm:text-lg truncate">{mob.name}</strong>
                  <span className="block text-xs text-dim mt-1">Lv.{mob.level}</span>
                  {picked !== null && <span className={`block font-pixel mt-3 text-sm ${correct ? "text-green-500" : "text-dim"}`}>{METRIC_LABEL[round.metric]} {value(mob)}</span>}
                </button>
              );
            }).reduce<React.ReactNode[]>((items, card, index) => index === 0 ? [card, <div key="vs" className="self-center font-pixel text-maple text-sm sm:text-xl">VS</div>] : [...items, card], [])}
          </div>
          {picked !== null && (
            <div className="text-center mt-5"><p className={`font-pixel text-sm mb-3 ${picked === round.answer_id ? "text-green-500" : "text-red-500"}`}>{picked === round.answer_id ? "정답! 연승을 이어갑니다." : "아쉽다! 연승은 다시 0부터."}</p><button onClick={nextRound} className="pixel-btn px-5 py-2 text-sm">다음 대결 →</button></div>
          )}
        </div>
      )}
    </div>
  );
}
