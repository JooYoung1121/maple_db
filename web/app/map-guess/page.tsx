"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
type Choice = { id: number; name: string };
type Round = { map_id: number; minimap: string; choices: Choice[]; answer_id: number; answer_name: string; hints: string[] };

export default function MapGuessPage() {
  const [round, setRound] = useState<Round | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [hintStep, setHintStep] = useState(0);
  const [score, setScore] = useState(0);
  const [roundNo, setRoundNo] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true); setPicked(null); setHintStep(0);
    fetch(`${API_BASE}/api/playground/map-guess/round`).then((r) => r.json()).then(setRound).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function choose(id: number) {
    if (!round || picked !== null) return;
    setPicked(id);
    if (id === round.answer_id) setScore((s) => s + Math.max(1, 3 - hintStep));
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-end gap-3 mb-5"><div><h1 className="font-pixel text-2xl">🗺️ 미니맵 어디게?</h1><p className="text-sm text-dim mt-1">미니맵의 생김새와 힌트로 장소를 맞혀보세요.</p></div><span className="ml-auto pixel-card px-3 py-2 text-xs">{roundNo}라운드 · <b className="text-maple">{score}점</b></span></div>
      {loading || !round ? <div className="pixel-panel p-12 text-center text-dim">미니맵 펼치는 중…</div> : (
        <div className="pixel-panel p-5">
          <div className="min-h-56 bg-[#20283b] border-2 border-edge flex items-center justify-center p-6 mb-4 overflow-hidden">
            <img src={round.minimap} alt="문제 미니맵" className="max-h-64 max-w-full object-contain [image-rendering:pixelated] drop-shadow-[0_0_8px_rgba(255,255,255,.25)]" />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {round.choices.map((choice) => <button key={choice.id} onClick={() => choose(choice.id)} disabled={picked !== null}
              className={`pixel-card px-4 py-3 text-sm text-left hover:border-maple ${picked !== null && choice.id === round.answer_id ? "border-green-500 bg-green-500/10" : picked === choice.id ? "border-red-500" : ""}`}>{choice.name}</button>)}
          </div>
          <div className="mt-4 border-t border-edge/60 pt-3">
            {round.hints.slice(0, hintStep).map((hint) => <p key={hint} className="text-xs text-dim mt-1">💡 {hint}</p>)}
            {picked === null && hintStep < round.hints.length && <button onClick={() => setHintStep((v) => v + 1)} className="mt-2 px-3 py-1.5 text-xs border-2 border-edge text-dim hover:text-maple">힌트 보기 (-1점)</button>}
            {picked !== null && <div className="flex flex-wrap items-center gap-3 mt-3"><b className={picked === round.answer_id ? "text-green-500" : "text-red-500"}>{picked === round.answer_id ? "정답!" : `정답은 ${round.answer_name}`}</b><button onClick={() => { setRoundNo((n) => n + 1); load(); }} className="pixel-btn px-4 py-2 text-xs">다음 미니맵 →</button></div>}
          </div>
        </div>
      )}
    </div>
  );
}
