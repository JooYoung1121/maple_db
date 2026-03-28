"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

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

type Tab = "roulette" | "dice" | "pinball" | "ladder";
type GameType = "roulette" | "dice" | "plinko" | "ladder";

interface GameRecord {
  id: number;
  game_type: GameType;
  participants: string[];
  winner: string;
  result: Record<string, unknown> | null;
  created_at: string;
}

async function apiSaveResult(
  game_type: GameType,
  participants: string[],
  winner: string,
  result?: Record<string, unknown> | null,
) {
  try {
    await fetch(`${API_BASE}/api/game-results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_type, participants, winner, result: result ?? null }),
    });
  } catch { /* silently fail */ }
}

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
  { v: 1, t: "rotateY(0deg) translateZ(30px)" }, { v: 6, t: "rotateY(180deg) translateZ(30px)" },
  { v: 3, t: "rotateY(90deg) translateZ(30px)" }, { v: 4, t: "rotateY(-90deg) translateZ(30px)" },
  { v: 2, t: "rotateX(-90deg) translateZ(30px)" }, { v: 5, t: "rotateX(90deg) translateZ(30px)" },
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

function DiceTab({ onResult }: { onResult: (participants: string[], winner: string, result: Record<string, unknown>) => void }) {
  const [diceCount, setDiceCount] = useState(1);
  const [nameInput, setNameInput] = useState("");
  const [participants, setParticipants] = useState<DiceParticipant[]>([]);
  const [rolled, setRolled] = useState(false);
  const [rollKey, setRollKey] = useState(0);
  const [animating, setAnimating] = useState(false);
  const savedRef = useRef(false);

  const addParticipant = () => {
    const name = nameInput.trim();
    if (!name) return;
    setParticipants((prev) => [...prev, { id: diceNextId++, name, dice: [], total: 0 }]);
    setNameInput(""); setRolled(false); savedRef.current = false;
  };
  const removeParticipant = (id: number) => { setParticipants((prev) => prev.filter((p) => p.id !== id)); setRolled(false); savedRef.current = false; };
  const rollDice = () => {
    if (participants.length === 0 || animating) return;
    setAnimating(true); setRolled(false); savedRef.current = false;
    const newParticipants = participants.map((p) => {
      const dice = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
      return { ...p, dice, total: dice.reduce((a, b) => a + b, 0) };
    });
    setParticipants(newParticipants);
    setRollKey((k) => k + 1);
    setTimeout(() => {
      setAnimating(false); setRolled(true);
      if (!savedRef.current && newParticipants.length >= 2) {
        savedRef.current = true;
        const sorted = [...newParticipants].sort((a, b) => b.total - a.total);
        const scores: Record<string, number> = {};
        newParticipants.forEach((p) => { scores[p.name] = p.total; });
        onResult(newParticipants.map((p) => p.name), sorted[0].name, { scores });
      }
    }, 1800);
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
        ) : <p className="text-sm text-gray-400 text-center py-3 mb-4">참가자를 추가해주세요.</p>}
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
          <button onClick={() => { setParticipants([]); setRolled(false); savedRef.current = false; }}
            className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">초기화</button>
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

function RouletteTab({ onResult }: { onResult: (participants: string[], winner: string) => void }) {
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
    setParticipants((prev) => [...prev, { id: nextId++, name: trimmed, weight: isFair ? 1 : Math.floor(Math.random() * 10) + 1 }]);
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
    const targetRot = rotationRef.current + 10 * 360 + baseExtra + (360 - (rotationRef.current % 360));
    rotationRef.current = targetRot;
    setTransitioning(true); setDisplayRotation(targetRot);
    setTimeout(() => { setWinners([winner.name]); setSpinning(false); setTransitioning(false); onResult(participants.map((p) => p.name), winner.name); }, 10000);
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
        ) : <p className="text-sm text-gray-400 text-center py-3">참가자를 추가해주세요.</p>}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">룰렛</h2>
          <div className="flex gap-2">
            <button onClick={() => { setIsFair(true); setParticipants((ps) => ps.map((p) => ({ ...p, weight: 1 }))); }}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${isFair ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>공평 모드</button>
            <button onClick={() => { setIsFair(false); setParticipants((ps) => ps.map((p) => ({ ...p, weight: Math.floor(Math.random() * 10) + 1 }))); }}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${!isFair ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>불공평 모드</button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 text-2xl leading-none select-none">▼</div>
            <svg width={220} height={220} viewBox="0 0 200 200"
              style={{ transform: `rotate(${displayRotation}deg)`, transition: transitioning ? "transform 10s cubic-bezier(0.2, 0.8, 0.3, 1)" : "none", display: "block" }}>
              {participants.length === 0 ? <circle cx={cx} cy={cy} r={r} fill="#e5e7eb" />
                : participants.length === 1 ? <circle cx={cx} cy={cy} r={r} fill={COLORS[0]} />
                : slices.map((slice, i) => {
                  const mid = slice.startAngle + slice.sweep / 2;
                  const lp = polarToCartesian(cx, cy, r * 0.65, mid);
                  const sn = slice.participant.name.length > 5 ? slice.participant.name.slice(0, 5) + "…" : slice.participant.name;
                  return (
                    <g key={slice.participant.id}>
                      <path d={describeSlice(cx, cy, r, slice.startAngle, slice.endAngle)} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={1.5} />
                      {slice.sweep > 20 && <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize={slice.sweep > 60 ? 9 : 7} fill="white" fontWeight="bold" style={{ pointerEvents: "none" }}>{sn}</text>}
                    </g>
                  );
                })}
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
// 핀볼 (lazygyu/roulette — box2d-wasm 고품질 물리 엔진)
// ---------------------------------------------------------------------------

function PinballTab() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm w-full">
        <p className="text-sm text-gray-600 font-medium mb-1">🎯 고품질 물리 엔진 (box2d-wasm)</p>
        <p className="text-xs text-gray-400">게임 내에서 참가자 이름을 직접 입력하세요. 이름/숫자로 가중치, 이름*숫자로 중복 설정 가능.</p>
        <p className="text-xs text-gray-300 mt-1">Powered by <a href="https://github.com/lazygyu/roulette" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400">lazygyu/roulette</a> (MIT)</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm" style={{ width: "100%", maxWidth: 480 }}>
        <iframe
          src="https://lazygyu.github.io/roulette/"
          width="480"
          height="720"
          style={{ display: "block", width: "100%", border: "none" }}
          allow="autoplay"
          title="핀볼"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 사다리 타기
// ---------------------------------------------------------------------------

const LADDER_W = 400; const LADDER_H = 460; const LADDER_TOP_Y = 55; const LADDER_BOTTOM_Y = 415; const LADDER_ROWS = 10; const LADDER_ANIM_MS = 2400;

function ladderColX(n: number): number[] {
  if (n <= 1) return [LADDER_W / 2];
  const margin = 40;
  return Array.from({ length: n }, (_, i) => margin + (i / (n - 1)) * (LADDER_W - margin * 2));
}
function ladderRowY(): number[] {
  return Array.from({ length: LADDER_ROWS }, (_, r) => LADDER_TOP_Y + ((r + 1) / (LADDER_ROWS + 1)) * (LADDER_BOTTOM_Y - LADDER_TOP_Y));
}
function buildLadderBridges(n: number): { row: number; leftCol: number }[] {
  const bridges: { row: number; leftCol: number }[] = [];
  for (let row = 0; row < LADDER_ROWS; row++) {
    const used = new Set<number>();
    for (let col = 0; col < n - 1; col++) {
      if (!used.has(col) && !used.has(col + 1) && Math.random() < 0.45) { bridges.push({ row, leftCol: col }); used.add(col); used.add(col + 1); }
    }
  }
  return bridges;
}
function traceLadderPaths(n: number, bridges: { row: number; leftCol: number }[], colX: number[], rowY: number[]): { points: { x: number; y: number }[]; endCol: number }[] {
  const bset = new Set(bridges.map((b) => `${b.row}-${b.leftCol}`));
  return Array.from({ length: n }, (_, startCol) => {
    let col = startCol;
    const pts: { x: number; y: number }[] = [{ x: colX[col], y: LADDER_TOP_Y }];
    for (let row = 0; row < LADDER_ROWS; row++) {
      const y = rowY[row]; pts.push({ x: colX[col], y });
      if (bset.has(`${row}-${col}`)) { col += 1; pts.push({ x: colX[col], y }); }
      else if (col > 0 && bset.has(`${row}-${col - 1}`)) { col -= 1; pts.push({ x: colX[col], y }); }
    }
    pts.push({ x: colX[col], y: LADDER_BOTTOM_Y });
    return { points: pts, endCol: col };
  });
}
function interpPath(pts: { x: number; y: number }[], t: number): { x: number; y: number } {
  if (pts.length <= 1) return pts[0] ?? { x: 0, y: 0 };
  if (t >= 1) return pts[pts.length - 1];
  const s = t * (pts.length - 1); const idx = Math.floor(s); const frac = s - idx;
  const a = pts[Math.min(idx, pts.length - 1)]; const b = pts[Math.min(idx + 1, pts.length - 1)];
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}
function drawLadder(ctx: CanvasRenderingContext2D, n: number, names: string[], prizes: string[], colX: number[], rowY: number[], bridges: { row: number; leftCol: number }[], dots: { x: number; y: number }[] | null, donePaths: { points: { x: number; y: number }[]; endCol: number }[] | null, winnerCol: number) {
  ctx.clearRect(0, 0, LADDER_W, LADDER_H); ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, LADDER_W, LADDER_H);
  const fs = n > 6 ? 9 : n > 4 ? 10 : 11; const mc = n > 6 ? 3 : n > 4 ? 4 : 5;
  const bw = Math.min(52, Math.max(28, (LADDER_W - 60) / n - 4));
  if (donePaths) { donePaths.forEach((path, i) => { ctx.save(); ctx.strokeStyle = COLORS[i % COLORS.length]; ctx.lineWidth = 3; ctx.globalAlpha = 0.5; ctx.beginPath(); path.points.forEach((pt, j) => { if (j === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); }); ctx.stroke(); ctx.restore(); }); }
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.moveTo(colX[i], LADDER_TOP_Y); ctx.lineTo(colX[i], LADDER_BOTTOM_Y); ctx.stroke(); }
  bridges.forEach(({ row, leftCol }) => { const y = rowY[row]; ctx.beginPath(); ctx.moveTo(colX[leftCol], y); ctx.lineTo(colX[leftCol + 1], y); ctx.stroke(); });
  names.forEach((name, i) => {
    const cx = colX[i]; const label = name.length > mc ? name.slice(0, mc - 1) + "…" : name;
    ctx.strokeStyle = COLORS[i % COLORS.length]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, 32); ctx.lineTo(cx, LADDER_TOP_Y); ctx.stroke();
    ctx.fillStyle = COLORS[i % COLORS.length]; ctx.beginPath(); ctx.roundRect(cx - bw / 2, 4, bw, 26, 5); ctx.fill();
    ctx.fillStyle = "white"; ctx.font = `bold ${fs}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, cx, 17);
  });
  prizes.forEach((prize, j) => {
    const cx = colX[j]; const isWin = j === winnerCol && winnerCol >= 0;
    ctx.strokeStyle = COLORS[j % COLORS.length]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, LADDER_BOTTOM_Y); ctx.lineTo(cx, LADDER_H - 34); ctx.stroke();
    ctx.fillStyle = isWin ? "#f97316" : "#64748b"; ctx.beginPath(); ctx.roundRect(cx - bw / 2, LADDER_H - 34, bw, 26, 5); ctx.fill();
    ctx.fillStyle = "white"; ctx.font = `bold ${Math.min(fs, 10)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(prize, cx, LADDER_H - 21);
  });
  if (dots) { dots.forEach((pos, i) => { ctx.beginPath(); ctx.arc(pos.x, pos.y, 9, 0, Math.PI * 2); ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill(); ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke(); }); }
  if (donePaths) { donePaths.forEach((path, i) => { const last = path.points[path.points.length - 1]; ctx.beginPath(); ctx.arc(last.x, last.y, 9, 0, Math.PI * 2); ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill(); ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke(); }); }
}

interface LadderState { bridges: { row: number; leftCol: number }[]; colX: number[]; rowY: number[]; paths: { points: { x: number; y: number }[]; endCol: number }[]; prizes: string[]; winnerBottomCol: number; winnerName: string; }

function LadderTab({ onResult }: { onResult: (participants: string[], winner: string, result: Record<string, unknown>) => void }) {
  const [participants, setParticipants] = useState<string[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [mode, setMode] = useState<"winner" | "order">("winner");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [resultMap, setResultMap] = useState<Record<string, string>>({});
  const [winnerName, setWinnerName] = useState("");
  const [seed, setSeed] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const ladderRef = useRef<LadderState | null>(null);

  const addParticipant = () => { const name = nameInput.trim(); if (!name || participants.length >= 8) return; setParticipants((prev) => [...prev, name]); setNameInput(""); };
  const removeParticipant = (idx: number) => setParticipants((prev) => prev.filter((_, i) => i !== idx));

  useEffect(() => {
    cancelAnimationFrame(animRef.current); setRunning(false); setDone(false); setResultMap({}); setWinnerName("");
    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (!ctx || !canvas) return;
    if (participants.length < 2) {
      ladderRef.current = null; ctx.clearRect(0, 0, LADDER_W, LADDER_H); ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, LADDER_W, LADDER_H);
      ctx.fillStyle = "#94a3b8"; ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("참가자를 2명 이상 추가하세요", LADDER_W / 2, LADDER_H / 2); return;
    }
    const n = participants.length; const colX = ladderColX(n); const rowY = ladderRowY(); const bridges = buildLadderBridges(n); const paths = traceLadderPaths(n, bridges, colX, rowY);
    let prizes: string[]; let winnerBottomCol: number;
    if (mode === "winner") { prizes = Array(n).fill("꽝"); winnerBottomCol = Math.floor(Math.random() * n); prizes[winnerBottomCol] = "당첨"; }
    else { prizes = Array.from({ length: n }, (_, i) => `${i + 1}등`); winnerBottomCol = 0; }
    const winnerIdx = paths.findIndex((p) => p.endCol === winnerBottomCol);
    const wName = participants[winnerIdx] ?? "";
    ladderRef.current = { bridges, colX, rowY, paths, prizes, winnerBottomCol, winnerName: wName };
    drawLadder(ctx, n, participants, prizes, colX, rowY, bridges, null, null, -1);
  }, [participants, mode, seed]);

  const startLadder = () => {
    if (running || participants.length < 2 || !ladderRef.current) return;
    cancelAnimationFrame(animRef.current);
    const { bridges, colX, rowY, paths, prizes, winnerBottomCol, winnerName: wName } = ladderRef.current;
    const n = participants.length; const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (!ctx) return;
    setRunning(true); setDone(false);
    const startTime = performance.now();
    const frame = (now: number) => {
      const t = Math.min((now - startTime) / LADDER_ANIM_MS, 1);
      drawLadder(ctx, n, participants, prizes, colX, rowY, bridges, paths.map((p) => interpPath(p.points, t)), null, -1);
      if (t < 1) { animRef.current = requestAnimationFrame(frame); }
      else {
        drawLadder(ctx, n, participants, prizes, colX, rowY, bridges, null, paths, winnerBottomCol);
        const map: Record<string, string> = {}; participants.forEach((name, i) => { map[name] = prizes[paths[i].endCol]; });
        setResultMap(map); setWinnerName(wName); setRunning(false); setDone(true); onResult(participants, wName, { mapping: map });
      }
    };
    animRef.current = requestAnimationFrame(frame);
  };

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">참가자 관리 <span className="text-sm font-normal text-gray-400">(최대 8명)</span></h2>
        <div className="flex gap-2 mb-4">
          <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addParticipant()} placeholder="참가자 이름 입력"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <button onClick={addParticipant} disabled={participants.length >= 8}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">추가</button>
        </div>
        {participants.length > 0 ? (
          <ul className="space-y-1.5 mb-4">
            {participants.map((name, i) => (
              <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm font-medium text-gray-700">{name}</span>
                </div>
                <button onClick={() => removeParticipant(i)} className="text-gray-400 hover:text-red-500 text-lg leading-none transition-colors">×</button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-400 text-center py-3 mb-4">참가자를 추가해주세요.</p>}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">모드</p>
          <div className="flex gap-2">
            <button onClick={() => setMode("winner")} className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${mode === "winner" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>당첨자 뽑기</button>
            <button onClick={() => setMode("order")} className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${mode === "order" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>순서 정하기</button>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="overflow-x-auto w-full flex justify-center">
          <canvas ref={canvasRef} width={LADDER_W} height={LADDER_H} className="rounded-xl border border-gray-200 shadow-sm" style={{ maxWidth: LADDER_W }} />
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <button onClick={startLadder} disabled={participants.length < 2 || running}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-base transition-colors shadow-md">
            {running ? "🪜 타는 중..." : "🪜 사다리 타기"}
          </button>
          {participants.length >= 2 && !running && (
            <button onClick={() => setSeed((s) => s + 1)} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">새 사다리</button>
          )}
        </div>
        {done && (
          <div className="w-full space-y-3">
            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-2xl p-5 text-center shadow-md">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-sm text-orange-600 font-medium mb-1">{mode === "winner" ? "당첨자" : "1등"}</p>
              <p className="text-2xl font-bold text-orange-700">{winnerName}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 mb-2">전체 결과</p>
              <div className="space-y-1.5">
                {participants.map((name, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-700">{name}</span>
                    </div>
                    <span className={`font-bold ${resultMap[name] === "당첨" || resultMap[name] === "1등" ? "text-orange-600" : "text-gray-500"}`}>{resultMap[name]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// (공경주 탭 제거됨)

const RACE_W = 400; const RACE_H = 680; const RACE_PEG_R = 5; const RACE_BALL_R = 11; const RACE_GRAVITY = 0.32;
const RACE_FLOOR_Y = RACE_H - 22;

const RACE_PEGS: { x: number; y: number }[] = (() => {
  const pegs: { x: number; y: number }[] = [];
  for (let row = 0; row < 14; row++) {
    const y = 70 + row * 44;
    if (row % 2 === 0) { for (let i = 0; i < 5; i++) pegs.push({ x: 70 + i * 60, y }); }
    else { for (let i = 0; i < 6; i++) pegs.push({ x: 40 + i * 60, y }); }
  }
  return pegs;
})();

interface RaceBall { name: string; color: string; x: number; y: number; vx: number; vy: number; landed: boolean; rank: number; }

const RANK_MEDAL = ["🥇", "🥈", "🥉"];

function drawRaceFrame(ctx: CanvasRenderingContext2D, balls: RaceBall[], landingCount: number) {
  ctx.clearRect(0, 0, RACE_W, RACE_H); ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, RACE_W, RACE_H);
  // Finish line
  ctx.save(); ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 3; ctx.setLineDash([8, 5]);
  ctx.beginPath(); ctx.moveTo(0, RACE_FLOOR_Y); ctx.lineTo(RACE_W, RACE_FLOOR_Y); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
  ctx.fillStyle = "#dc2626"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
  ctx.fillText("FINISH", 6, RACE_FLOOR_Y - 2);
  // Pegs
  RACE_PEGS.forEach((peg) => { ctx.beginPath(); ctx.arc(peg.x, peg.y, RACE_PEG_R, 0, Math.PI * 2); ctx.fillStyle = "#94a3b8"; ctx.fill(); });
  // Balls (active first, then landed on top)
  const active = balls.filter((b) => !b.landed);
  const landed = balls.filter((b) => b.landed);
  [...active, ...landed].forEach((ball) => {
    // Name label above ball
    ctx.fillStyle = ball.color; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    const label = ball.name.length > 4 ? ball.name.slice(0, 4) : ball.name;
    ctx.fillText(label, ball.x, ball.y - RACE_BALL_R);
    // Ball
    ctx.beginPath(); ctx.arc(ball.x, ball.y, RACE_BALL_R, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(ball.x - 3, ball.y - 4, 2, ball.x, ball.y, RACE_BALL_R);
    g.addColorStop(0, ball.color + "cc"); g.addColorStop(1, ball.color);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2; ctx.stroke();
    // Rank badge if landed
    if (ball.landed && ball.rank <= 3) {
      ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(RANK_MEDAL[ball.rank - 1], ball.x, ball.y);
    }
  });
  // Live landing count
  if (landingCount > 0) {
    ctx.fillStyle = "#f97316"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    ctx.fillText(`${landingCount}위 확정`, RACE_W - 8, RACE_FLOOR_Y - 2);
  }
}

function RaceTab({ onResult }: { onResult: (participants: string[], winner: string) => void }) {
  const [participants, setParticipants] = useState<string[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [running, setRunning] = useState(false);
  const [rankList, setRankList] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);

  const addParticipant = () => { const name = nameInput.trim(); if (!name || participants.length >= 8) return; setParticipants((p) => [...p, name]); setNameInput(""); };
  const removeParticipant = (idx: number) => setParticipants((p) => p.filter((_, i) => i !== idx));

  // Draw static preview
  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, RACE_W, RACE_H); ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, RACE_W, RACE_H);
    // Finish line
    ctx.save(); ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 3; ctx.setLineDash([8, 5]);
    ctx.beginPath(); ctx.moveTo(0, RACE_FLOOR_Y); ctx.lineTo(RACE_W, RACE_FLOOR_Y); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
    ctx.fillStyle = "#dc2626"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText("FINISH", 6, RACE_FLOOR_Y - 2);
    RACE_PEGS.forEach((peg) => { ctx.beginPath(); ctx.arc(peg.x, peg.y, RACE_PEG_R, 0, Math.PI * 2); ctx.fillStyle = "#94a3b8"; ctx.fill(); });
    if (participants.length === 0) {
      ctx.fillStyle = "#94a3b8"; ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("참가자를 추가하고 레이스를 시작하세요", RACE_W / 2, 30);
    }
  }, [participants]);

  const startRace = () => {
    if (running || participants.length < 2) return;
    cancelAnimationFrame(animRef.current);
    const n = participants.length;
    // Spread balls across the top
    const balls: RaceBall[] = participants.map((name, i) => {
      const spreadX = (RACE_W - 80) / Math.max(n - 1, 1);
      const baseX = 40 + i * spreadX;
      return { name, color: COLORS[i % COLORS.length], x: baseX + (Math.random() - 0.5) * 20, y: RACE_BALL_R, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 1, landed: false, rank: 0 };
    });
    const landingOrder: string[] = [];
    setRunning(true); setRankList([]);

    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (!ctx) return;

    const frame = () => {
      balls.forEach((ball) => {
        if (ball.landed) return;
        ball.vy += RACE_GRAVITY;
        const sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (sp > 13) { ball.vx = ball.vx / sp * 13; ball.vy = ball.vy / sp * 13; }
        ball.x += ball.vx; ball.y += ball.vy;

        // Peg collisions
        for (const peg of RACE_PEGS) {
          const dx = ball.x - peg.x, dy = ball.y - peg.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minD = RACE_BALL_R + RACE_PEG_R + 0.5;
          if (dist < minD && dist > 0.01) {
            const nx = dx / dist, ny = dy / dist;
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dot * nx) * 0.55; ball.vy = (ball.vy - 2 * dot * ny) * 0.55;
            if (ball.vy < 0.5) ball.vy = 0.5;
            ball.x = peg.x + nx * minD; ball.y = peg.y + ny * minD;
          }
        }

        // Ball-ball collisions
        for (const other of balls) {
          if (other === ball || other.landed) continue;
          const dx = ball.x - other.x, dy = ball.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minD = RACE_BALL_R * 2 + 0.5;
          if (dist < minD && dist > 0.01) {
            const nx = dx / dist, ny = dy / dist;
            const dvx = ball.vx - other.vx, dvy = ball.vy - other.vy;
            const dot = dvx * nx + dvy * ny;
            if (dot < 0) {
              ball.vx -= dot * nx * 0.7; ball.vy -= dot * ny * 0.7;
              other.vx += dot * nx * 0.7; other.vy += dot * ny * 0.7;
            }
            const overlap = (minD - dist) / 2;
            ball.x += nx * overlap; ball.y += ny * overlap;
            other.x -= nx * overlap; other.y -= ny * overlap;
          }
        }

        // Wall
        if (ball.x < RACE_BALL_R) { ball.x = RACE_BALL_R; ball.vx = Math.abs(ball.vx) * 0.7; }
        if (ball.x > RACE_W - RACE_BALL_R) { ball.x = RACE_W - RACE_BALL_R; ball.vx = -Math.abs(ball.vx) * 0.7; }

        // Floor
        if (ball.y >= RACE_FLOOR_Y) {
          ball.y = RACE_FLOOR_Y; ball.landed = true;
          landingOrder.push(ball.name);
          ball.rank = landingOrder.length;
          setRankList([...landingOrder]);
        }
      });

      drawRaceFrame(ctx, balls, landingOrder.length);

      if (landingOrder.length < n) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        setRunning(false);
        onResult(participants, landingOrder[0]);
      }
    };
    animRef.current = requestAnimationFrame(frame);
  };

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">참가자 관리 <span className="text-sm font-normal text-gray-400">(최대 8명)</span></h2>
        <p className="text-xs text-gray-400 mb-4">공이 동시에 낙하 — 먼저 FINISH 라인에 닿는 순서가 순위!</p>
        <div className="flex gap-2 mb-4">
          <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addParticipant()} placeholder="참가자 이름 입력"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <button onClick={addParticipant} disabled={participants.length >= 8}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">추가</button>
        </div>
        {participants.length > 0 ? (
          <ul className="space-y-1.5">
            {participants.map((name, i) => (
              <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm font-medium text-gray-700">{name}</span>
                </div>
                <button onClick={() => removeParticipant(i)} className="text-gray-400 hover:text-red-500 text-lg leading-none transition-colors">×</button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-400 text-center py-3">참가자를 추가해주세요.</p>}
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="overflow-x-auto w-full flex justify-center">
          <canvas ref={canvasRef} width={RACE_W} height={RACE_H} className="rounded-xl border border-gray-200 shadow-sm" style={{ maxWidth: RACE_W }} />
        </div>
        <button onClick={startRace} disabled={participants.length < 2 || running}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl text-base transition-colors shadow-md">
          {running ? "🏁 레이스 중..." : "🏁 레이스 시작!"}
        </button>
        {rankList.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm w-full max-w-sm">
            <p className="text-xs font-semibold text-gray-500 mb-2">순위 현황 {running && <span className="text-orange-500">(진행 중)</span>}</p>
            <ol className="space-y-1.5">
              {rankList.map((name, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-base w-6">{RANK_MEDAL[i] ?? `${i + 1}위`}</span>
                  <span className={`font-bold ${i === 0 ? "text-orange-600" : "text-gray-700"}`}>{name}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 게임 기록
// ---------------------------------------------------------------------------

const GAME_LABELS: Record<string, string> = { roulette: "🎰 룰렛", dice: "🎲 주사위", plinko: "🎯 핀볼", ladder: "🪜 사다리" };

function formatDate(s: string) { return s.replace("T", " ").slice(0, 16); }

interface DeleteState { id: number; password: string; loading: boolean; error: string; }

function GameRecords({ refreshKey }: { refreshKey: number }) {
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch(`${API_BASE}/api/game-results?per_page=20`); if (!res.ok) return; const data = await res.json(); setRecords(data.results ?? []); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) fetchRecords(); }, [open, fetchRecords]);
  useEffect(() => { if (refreshKey > 0 && open) fetchRecords(); }, [refreshKey, open, fetchRecords]);

  const handleDelete = async () => {
    if (!deleteState) return;
    setDeleteState((s) => s ? { ...s, loading: true, error: "" } : s);
    try {
      const res = await fetch(`${API_BASE}/api/game-results/${deleteState.id}`, { method: "DELETE", headers: { "X-Admin-Password": deleteState.password } });
      if (res.ok) { setRecords((prev) => prev.filter((r) => r.id !== deleteState.id)); setDeleteState(null); }
      else { const data = await res.json().catch(() => ({})); setDeleteState((s) => s ? { ...s, loading: false, error: (data as { detail?: string }).detail ?? "비밀번호가 틀렸습니다." } : s); }
    } catch { setDeleteState((s) => s ? { ...s, loading: false, error: "오류가 발생했습니다." } : s); }
  };

  return (
    <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors">
        <span>📋 최근 기록</span><span className="text-gray-400">{open ? "▲" : "▾"}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-5 pb-4">
          {loading ? <p className="text-sm text-gray-400 text-center py-6">불러오는 중...</p>
            : records.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">저장된 기록이 없습니다.</p>
            : (
              <ul className="divide-y divide-gray-100">
                {records.map((r) => {
                  const scores = r.result?.scores as Record<string, number> | undefined;
                  return (
                    <li key={r.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-gray-500">{GAME_LABELS[r.game_type] ?? r.game_type}</span>
                          <span className="text-sm font-bold text-orange-600">{r.winner} 당첨</span>
                          {scores && scores[r.winner] !== undefined && <span className="text-xs text-gray-400">(합계 {scores[r.winner]})</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate">참가: {r.participants.join(", ")} · {formatDate(r.created_at)}</div>
                      </div>
                      <button onClick={() => setDeleteState({ id: r.id, password: "", loading: false, error: "" })} className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded">삭제</button>
                    </li>
                  );
                })}
              </ul>
            )}
        </div>
      )}
      {deleteState && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteState(null)}>
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-800">기록 삭제</h3>
            <p className="text-sm text-gray-500">관리자 비밀번호를 입력하세요.</p>
            <input type="password" value={deleteState.password} onChange={(e) => setDeleteState((s) => s ? { ...s, password: e.target.value } : s)}
              onKeyDown={(e) => e.key === "Enter" && handleDelete()} placeholder="비밀번호"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" autoFocus />
            {deleteState.error && <p className="text-sm text-red-500">{deleteState.error}</p>}
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleteState.loading} className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors">{deleteState.loading ? "확인 중..." : "삭제"}</button>
              <button onClick={() => setDeleteState(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg text-sm transition-colors">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TAB_LABELS: Record<Tab, string> = { roulette: "🎰 룰렛", dice: "🎲 주사위", pinball: "🎯 핀볼", ladder: "🪜 사다리" };

export default function PlayPage() {
  const [activeTab, setActiveTab] = useState<Tab>("roulette");
  const [recordsKey, setRecordsKey] = useState(0);

  const saveResult = async (game_type: GameType, participants: string[], winner: string, result?: Record<string, unknown> | null) => {
    await apiSaveResult(game_type, participants, winner, result);
    setRecordsKey((k) => k + 1);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">놀이터</h1>
      <div className="flex gap-1 mb-6 border-b border-gray-200 flex-wrap">
        {(["roulette", "dice", "pinball", "ladder"] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${activeTab === tab ? "border-orange-500 text-orange-600 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
      {activeTab === "roulette" && <RouletteTab onResult={(p, w) => saveResult("roulette", p, w)} />}
      {activeTab === "dice" && <DiceTab onResult={(p, w, r) => saveResult("dice", p, w, r)} />}
      {activeTab === "pinball" && <PinballTab />}
      {activeTab === "ladder" && <LadderTab onResult={(p, w, r) => saveResult("ladder", p, w, r)} />}
      <GameRecords refreshKey={recordsKey} />
    </div>
  );
}
