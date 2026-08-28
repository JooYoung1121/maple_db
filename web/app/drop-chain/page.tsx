"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
type Choice = { id: number; name: string };
type Round = { mob: { id: number; name: string; icon_url: string }; item_choices: Choice[]; map_choices: Choice[]; answer_item_id: number; answer_map_id: number };

export default function DropChainPage() {
  const [round, setRound] = useState<Round | null>(null);
  const [item, setItem] = useState<number | null>(null);
  const [map, setMap] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [roundNo, setRoundNo] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true); setItem(null); setMap(null);
    fetch(`${API_BASE}/api/playground/drop-chain/round`).then((r) => r.json()).then(setRound).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  const finished = item !== null && map !== null;

  function pickItem(id: number) { if (item === null) { setItem(id); if (round && id === round.answer_item_id) setScore((s) => s + 1); } }
  function pickMap(id: number) { if (item === round?.answer_item_id && map === null) { setMap(id); if (round && id === round.answer_map_id) setScore((s) => s + 1); } }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-end gap-3 mb-5"><div><h1 className="font-pixel text-2xl">🔗 드랍 연결 퍼즐</h1><p className="text-sm text-dim mt-1">몬스터가 주는 아이템과 만날 수 있는 사냥터를 차례로 연결하세요.</p></div><span className="ml-auto pixel-card px-3 py-2 text-xs">{roundNo}라운드 · <b className="text-maple">{score}점</b></span></div>
      {loading || !round ? <div className="pixel-panel p-12 text-center text-dim">드랍 테이블 섞는 중…</div> : (
        <div className="pixel-panel p-4 sm:p-6">
          <div className="grid lg:grid-cols-[220px_1fr_1fr] gap-4 items-stretch">
            <div className="pixel-card p-5 flex lg:flex-col items-center justify-center gap-3 text-center border-maple">
              <img src={round.mob.icon_url} alt="" className="w-24 h-24 object-contain [image-rendering:pixelated]" /><div><span className="text-[10px] text-dim font-pixel">MONSTER</span><strong className="block mt-1">{round.mob.name}</strong></div>
            </div>
            <div className="border-2 border-edge p-3">
              <h2 className="font-pixel text-xs mb-3"><span className="text-maple">1</span> 어떤 아이템을 드랍할까?</h2>
              <div className="space-y-2">{round.item_choices.map((c) => <button key={c.id} onClick={() => pickItem(c.id)} disabled={item !== null}
                className={`w-full text-left pixel-card px-3 py-2 text-sm ${item !== null && c.id === round.answer_item_id ? "border-green-500 bg-green-500/10" : item === c.id ? "border-red-500" : ""}`}>{c.name}</button>)}</div>
            </div>
            <div className={`border-2 border-edge p-3 transition-opacity ${item === round.answer_item_id ? "opacity-100" : "opacity-45"}`}>
              <h2 className="font-pixel text-xs mb-3"><span className="text-maple">2</span> 어디에서 만날 수 있을까?</h2>
              <div className="space-y-2">{round.map_choices.map((c) => <button key={c.id} onClick={() => pickMap(c.id)} disabled={item !== round.answer_item_id || map !== null}
                className={`w-full text-left pixel-card px-3 py-2 text-sm ${map !== null && c.id === round.answer_map_id ? "border-green-500 bg-green-500/10" : map === c.id ? "border-red-500" : ""}`}>{c.name}</button>)}</div>
            </div>
          </div>
          {item !== null && item !== round.answer_item_id && <div className="mt-4 text-center"><p className="text-red-500 text-sm mb-2">드랍 아이템 연결이 달라요. 정답을 확인하고 다음 문제로!</p><button onClick={() => { setRoundNo((n) => n + 1); load(); }} className="pixel-btn px-4 py-2 text-xs">다음 퍼즐 →</button></div>}
          {finished && <div className="mt-4 text-center"><p className={`text-sm mb-2 ${map === round.answer_map_id ? "text-green-500" : "text-red-500"}`}>{map === round.answer_map_id ? "완벽한 연결! 2점을 획득했습니다." : "아이템은 맞았지만 사냥터 연결이 달라요."}</p><button onClick={() => { setRoundNo((n) => n + 1); load(); }} className="pixel-btn px-4 py-2 text-xs">다음 퍼즐 →</button></div>}
        </div>
      )}
    </div>
  );
}
