"use client";

import { useState, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const COLORS = [
  "#f97316", "#3b82f6", "#22c55e", "#a855f7",
  "#ec4899", "#eab308", "#14b8a6", "#ef4444",
  "#8b5cf6", "#06b6d4",
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [`M ${cx} ${cy}`, `L ${start.x} ${start.y}`, `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`, "Z"].join(" ");
}

type Tab = "roulette" | "dice";

// ---------------------------------------------------------------------------
// 주사위
// ---------------------------------------------------------------------------

const DICE_DOTS: Record<number, [string, string][]> = {
  1: [["50%", "50%"]],
  2: [["28%", "28%"], ["72%", "72%"]],
  3: [["28%", "28%"], ["50%", "50%"], ["72%", "72%"]],
  4: [["28%", "28%"], ["72%", "28%"], ["28%", "72%"], ["72%", "72%"]],
  5: [["28%", "28%"], ["72%", "28%"], ["50%", "50%"], ["28%", "72%"], ["72%", "72%"]],
  6: [["28%", "20%"], ["28%", "50%"], ["28%", "80%"], ["72%", "20%"], ["72%", "50%"], ["72%", "80%"]],
};

const FACE_ROTATION: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 }, 2: { x: 90, y: 0 }, 3: { x: 0, y: -90 },
  4: { x: 0, y: 90 }, 5: { x: -90, y: 0 }, 6: { x: 0, y: 180 },
};

const FACE_POS = [
  { v: 1, t: "rotateY(0deg) translateZ(30px)" },
  { v: 6, t: "rotateY(180deg) translateZ(30px)" },
  { v: 3, t: "rotateY(90deg) translateZ(30px)" },
  { v: 4, t: "rotateY(-90deg) translateZ(30px)" },
  { v: 2, t: "rotateX(-90deg) translateZ(30px)" },
  { v: 5, t: "rotateX(90deg) translateZ(30px)" },
];

function DiceDots({ value }: { value: number }) {
  return (
    <div className="relative w-full h-full">
      {(DICE_DOTS[value] ?? []).map(([left, top], i) => (
        <div key={i} className="absolute rounded-full bg-gray-800"
          style={{ left, top, width: "22%", height: "22%", transform: "translate(-50%, -50%)" }} />
      ))}
    </div>
  );
}

function Die3D({ value, rollKey }: { value: number; rollKey: number }) {
  const [cubeStyle, setCubeStyle] = useState<React.CSSProperties>({ transform: "rotateX(0deg) rotateY(0deg)", transition: "none" });

  useEffect(() => {
    if (rollKey === 0) return;
    setCubeStyle({ transform: "rotateX(0deg) rotateY(0deg)", transition: "none" });
    const tid = setTimeout(() => {
      const { x, y } = FACE_ROTATION[value] ?? { x: 0, y: 0 };
      setCubeStyle({ transform: `rotateX(${x + 1800}deg) rotateY(${y + 1800}deg)`, transition: "transform 1.6s cubic-bezier(0.15, 0.85, 0.2, 1)" });
    }, 30);
    return () => clearTimeout(tid);
  }, [rollKey, value]);

  return (
    <div style={{ perspective: "150px", width: 60, height: 60 }}>
      <div style={{ width: 60, height: 60, position: "relative", transformStyle: "preserve-3d", ...cubeStyle }}>
        {FACE_POS.map((face) => (
          <div key={face.v} style={{ position: "absolute", width: 60, height: 60, transform: face.t, backfaceVisibility: "hidden" }}
            className="bg-white border-2 border-gray-200 rounded-xl shadow p-1.5">
            <DiceDots value={face.v} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface DiceParticipant { id: number; name: string; dice: number[]; total: number; }
let diceNextId = 1;

function DiceTab() {
  const [diceCount, setDiceCount] = useState(1);
  const [nameInput, setNameInput] = useState("");
  const [participants, setParticipants] = useState<DiceParticipant[]>([]);
  const [rolled, setRolled] = useState(false);
  const [rollKey, setRollKey] = useState(0);
  const [animating, setAnimating] = useState(false);

  const addParticipant = () => {
    const name = nameInput.trim();
    if (!name) return;
    setParticipants((prev) => [...prev, { id: diceNextId++, name, dice: [], total: 0 }]);
    setNameInput("");
    setRolled(false);
  };

  const removeParticipant = (id: number) => { setParticipants((prev) => prev.filter((p) => p.id !== id)); setRolled(false); };

  const rollDice = () => {
    if (participants.length === 0 || animating) return;
    setAnimating(true); setRolled(false);
    setParticipants((prev) => prev.map((p) => {
      const dice = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
      return { ...p, dice, total: dice.reduce((a, b) => a + b, 0) };
    }));
    setRollKey((k) => k + 1);
    setTimeout(() => { setAnimating(false); setRolled(true); }, 1800);
  };

  const sorted = rolled ? [...participants].sort((a, b) => b.total - a.total) : participants;
  const displayList = animating ? participants : sorted;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">참가자 관리</h2>
        <div className="flex gap-2 mb-4">
          <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addParticipant()} placeholder="닉네임 입력"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <button onClick={addParticipant} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">추가</button>
        </div>
        {participants.length > 0 ? (
          <ul className="space-y-1.5 mb-4">
            {participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                <span className="text-sm font-medium text-gray-700">{p.name}</span>
                <button onClick={() => removeParticipant(p.id)} className="text-gray-400 hover:text-red-500 text-lg leading-none transition-colors">×</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 text-center py-3 mb-4">참가자를 추가해주세요.</p>
        )}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">주사위 수 (최대 6개)</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} onClick={() => setDiceCount(n)}
                className={`w-10 h-10 rounded-lg text-sm font-bold border-2 transition-colors ${diceCount === n ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-300 hover:border-orange-300"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={rollDice} disabled={participants.length === 0 || animating}
          className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-base transition-colors shadow-md">
          {animating ? "🎲 굴리는 중..." : "🎲 주사위 굴리기"}
        </button>
        {participants.length > 0 && (
          <button onClick={() => { setParticipants([]); setRolled(false); }}
            className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
            초기화
          </button>
        )}
      </div>

      {(rolled || animating) && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-gray-800">결과 <span className="text-sm font-normal text-gray-400">— 합산 높은 순</span></h2>
          {displayList.map((p, idx) => (
            <div key={p.id} className={`bg-white rounded-xl border-2 p-4 transition-all ${!animating && idx === 0 ? "border-orange-400 bg-orange-50" : "border-gray-200"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {!animating && idx === 0 && <span className="text-lg">🏆</span>}
                  <span className="font-bold text-gray-800">{p.name}</span>
                </div>
                {!animating && <span className={`text-xl font-bold ${idx === 0 ? "text-orange-600" : "text-gray-700"}`}>합계 {p.total}</span>}
              </div>
              <div className="flex gap-3 flex-wrap">
                {p.dice.map((d, i) => <Die3D key={i} value={d} rollKey={rollKey} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 룰렛
// ---------------------------------------------------------------------------

interface Participant { id: number; name: string; weight: number; }
let nextId = 1;

function RouletteTab() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [isFair, setIsFair] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [winners, setWinners] = useState<string[]>([]);
  const rotationRef = useRef(0);
  const [displayRotation, setDisplayRotation] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const totalWeight = participants.reduce((s, p) => s + p.weight, 0);

  const addParticipant = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const weight = isFair ? 1 : Math.floor(Math.random() * 10) + 1;
    setParticipants((prev) => [...prev, { id: nextId++, name: trimmed, weight }]);
    setNameInput("");
  };

  const removeParticipant = (id: number) => setParticipants((prev) => prev.filter((p) => p.id !== id));

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

  const pickWinner = (remaining: Participant[]): Participant => {
    const tw = remaining.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * tw;
    for (const p of remaining) { r -= p.weight; if (r <= 0) return p; }
    return remaining[remaining.length - 1];
  };

  const spinRoulette = () => {
    if (spinning || participants.length < 2) return;
    setSpinning(true); setWinners([]);
    const winner = pickWinner(participants);
    const winnerSlice = slices.find((s) => s.participant.id === winner.id);
    if (!winnerSlice) { setSpinning(false); return; }
    const winnerMid = winnerSlice.startAngle + winnerSlice.sweep / 2;
    const baseExtra = (360 - winnerMid) % 360;
    const fullRotations = 10 * 360;
    const currentRot = rotationRef.current;
    const targetRot = currentRot + fullRotations + baseExtra + (360 - (currentRot % 360));
    rotationRef.current = targetRot;
    setTransitioning(true); setDisplayRotation(targetRot);
    setTimeout(() => { setWinners([winner.name]); setSpinning(false); setTransitioning(false); }, 10000);
  };

  const cx = 100, cy = 100, r = 90;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">참가자 관리</h2>
        <div className="flex gap-2 mb-4">
          <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addParticipant()} placeholder="참가자 이름 입력"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <button onClick={addParticipant} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">추가</button>
        </div>
        {participants.length > 0 ? (
          <ul className="space-y-1.5">
            {participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                <span className="text-sm text-gray-700 font-medium">{p.name}</span>
                <div className="flex items-center gap-3">
                  {!isFair && <span className="text-xs text-orange-500 font-semibold">가중치: {p.weight}</span>}
                  <button onClick={() => removeParticipant(p.id)} className="text-gray-400 hover:text-red-500 text-lg leading-none transition-colors">×</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 text-center py-3">참가자를 추가해주세요.</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">룰렛</h2>
          <div className="flex gap-2">
            <button onClick={() => { setIsFair(true); setParticipants((ps) => ps.map((p) => ({ ...p, weight: 1 }))); }}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${isFair ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              공평 모드
            </button>
            <button onClick={() => { setIsFair(false); setParticipants((ps) => ps.map((p) => ({ ...p, weight: Math.floor(Math.random() * 10) + 1 }))); }}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${!isFair ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              불공평 모드
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 text-2xl leading-none select-none">▼</div>
            <svg width={220} height={220} viewBox="0 0 200 200"
              style={{ transform: `rotate(${displayRotation}deg)`, transition: transitioning ? "transform 10s cubic-bezier(0.2, 0.8, 0.3, 1)" : "none", display: "block" }}>
              {participants.length === 0 ? (
                <circle cx={cx} cy={cy} r={r} fill="#e5e7eb" />
              ) : participants.length === 1 ? (
                <circle cx={cx} cy={cy} r={r} fill={COLORS[0]} />
              ) : (
                slices.map((slice, i) => {
                  const midAngle = slice.startAngle + slice.sweep / 2;
                  const labelPos = polarToCartesian(cx, cy, r * 0.65, midAngle);
                  const shortName = slice.participant.name.length > 5 ? slice.participant.name.slice(0, 5) + "…" : slice.participant.name;
                  return (
                    <g key={slice.participant.id}>
                      <path d={describeSlice(cx, cy, r, slice.startAngle, slice.endAngle)} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={1.5} />
                      {slice.sweep > 20 && (
                        <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle"
                          fontSize={slice.sweep > 60 ? 9 : 7} fill="white" fontWeight="bold" style={{ pointerEvents: "none" }}>
                          {shortName}
                        </text>
                      )}
                    </g>
                  );
                })
              )}
            </svg>
          </div>
          <button onClick={spinRoulette} disabled={spinning || participants.length < 2}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl text-base transition-colors shadow-md">
            {spinning ? "돌아가는 중..." : "🎰 룰렛 돌리기"}
          </button>
          {winners.length > 0 && !spinning && (
            <div className="w-full max-w-sm">
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-2xl p-6 text-center shadow-md">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-sm text-orange-600 font-medium mb-1">당첨!</p>
                {winners.map((w, i) => <p key={i} className="text-2xl font-bold text-orange-700">{w}</p>)}
              </div>
            </div>
          )}
        </div>

        {participants.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {participants.map((p, i) => (
              <div key={p.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
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

export default function PlayPage() {
  const [activeTab, setActiveTab] = useState<Tab>("roulette");

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">놀이터</h1>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(["roulette", "dice"] as Tab[]).map((tab) => {
          const label = tab === "roulette" ? "🎰 룰렛" : "🎲 주사위";
          const isActive = activeTab === tab;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
                isActive ? "border-orange-500 text-orange-600 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === "roulette" && <RouletteTab />}
      {activeTab === "dice" && <DiceTab />}
    </div>
  );
}
