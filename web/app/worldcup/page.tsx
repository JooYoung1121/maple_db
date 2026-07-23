"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface Candidate {
  id: number;
  name: string;
  img: string;
  fallback_img: string | null;
  sub: string | null;
}

interface StatRow { name: string; wins: number; rate: number }

type Mode = "mob" | "item" | "guild";
type Phase = "select" | "play" | "done";

const MODE_LABEL: Record<Mode, string> = { mob: "몬스터", item: "아이템 · 코디", guild: "추억길드 코디" };

/* 추억길드 코디 월드컵 후보 — 길드원 캐릭터 스크린샷 (정적 자산) */
const GUILD_CANDIDATES: Candidate[] = [
  { id: 1, name: "감튀살", img: "/worldcup-guild/gamtwisal.png", fallback_img: null, sub: null },
  { id: 2, name: "푸두", img: "/worldcup-guild/pudu.png", fallback_img: null, sub: null },
  { id: 3, name: "5300그랜저1", img: "/worldcup-guild/granger1.png", fallback_img: null, sub: null },
  { id: 4, name: "가다로진", img: "/worldcup-guild/gadarojin.png", fallback_img: null, sub: null },
  { id: 5, name: "프라1", img: "/worldcup-guild/pra1.png", fallback_img: null, sub: null },
  { id: 6, name: "프라2", img: "/worldcup-guild/pra2.png", fallback_img: null, sub: null },
  { id: 7, name: "5300그랜저2", img: "/worldcup-guild/granger2.png", fallback_img: null, sub: null },
  { id: 8, name: "프라3", img: "/worldcup-guild/pra3.png", fallback_img: null, sub: null },
  { id: 9, name: "운반비", img: "/worldcup-guild/unbanbi.png", fallback_img: null, sub: null },
  { id: 10, name: "요정주영1", img: "/worldcup-guild/yojeongjuyoung1.png", fallback_img: null, sub: null },
  { id: 11, name: "흥흥흥1", img: "/worldcup-guild/heungx3-1.png", fallback_img: null, sub: null },
  { id: 12, name: "슈쇼슈", img: "/worldcup-guild/syusyosyu.png", fallback_img: null, sub: null },
  { id: 13, name: "scylladb", img: "/worldcup-guild/scylladb.png", fallback_img: null, sub: null },
  { id: 14, name: "후하이", img: "/worldcup-guild/huhai.png", fallback_img: null, sub: null },
  { id: 15, name: "박사야", img: "/worldcup-guild/parksaya.png", fallback_img: null, sub: null },
];

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function roundLabel(remaining: number): string {
  if (remaining === 2) return "결승";
  if (remaining === 4) return "준결승";
  return `${remaining}강`;
}

function CandidateImg({ c, className }: { c: Candidate; className: string }) {
  const [src, setSrc] = useState(c.img);
  useEffect(() => setSrc(c.img), [c.img]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={c.name}
      className={className}
      style={{ imageRendering: "pixelated" }}
      onError={() => { if (c.fallback_img && src !== c.fallback_img) setSrc(c.fallback_img); }}
      loading="lazy"
    />
  );
}

export default function WorldcupPage() {
  const [phase, setPhase] = useState<Phase>("select");
  const [mode, setMode] = useState<Mode>("mob");
  const [pool, setPool] = useState<Candidate[]>([]);      // 현재 라운드 대기열
  const [nextPool, setNextPool] = useState<Candidate[]>([]); // 다음 라운드 진출자
  const [pairIdx, setPairIdx] = useState(0);
  const [roundSize, setRoundSize] = useState(32);
  const [champion, setChampion] = useState<Candidate | null>(null);
  const [runnerUp, setRunnerUp] = useState<Candidate | null>(null);
  const [stats, setStats] = useState<{ total: number; top: StatRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const start = useCallback(async (m: Mode, size: number) => {
    setBusy(true);
    try {
      let cands: Candidate[];
      if (m === "guild") {
        // 길드 모드: 정적 후보에서 2의 거듭제곱 수만큼 랜덤 진출
        const pool = shuffled(GUILD_CANDIDATES);
        const bracket = 2 ** Math.floor(Math.log2(pool.length));
        cands = pool.slice(0, bracket);
        if (cands.length < 2) throw new Error("후보 부족");
      } else {
        const res = await fetch(`${API_BASE}/api/worldcup/candidates?mode=${m}&count=${size}`);
        const d = await res.json();
        cands = (d.candidates || []).filter((c: Candidate) => c.name);
        if (cands.length < 8) throw new Error("후보 부족");
      }
      const even = cands.length % 2 === 0 ? cands : cands.slice(0, cands.length - 1);
      setMode(m);
      setPool(even);
      setNextPool([]);
      setPairIdx(0);
      setRoundSize(even.length);
      setChampion(null);
      setRunnerUp(null);
      setPhase("play");
    } catch {
      alert("후보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }, []);

  const pick = useCallback((winner: Candidate, loser: Candidate) => {
    const isFinal = pool.length === 2 && nextPool.length === 0 && pairIdx === 0;
    if (isFinal) {
      setChampion(winner);
      setRunnerUp(loser);
      setPhase("done");
      // 결과 저장 (실패 무시)
      fetch(`${API_BASE}/api/game-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_type: `worldcup_${mode}`,
          participants: [winner.name, loser.name],
          winner: winner.name,
          result: { winner_id: winner.id, runner_up_id: loser.id, runner_up: loser.name, round_size: roundSize },
        }),
      }).catch(() => {})
        .finally(() => {
          fetch(`${API_BASE}/api/worldcup/stats?mode=${mode}`)
            .then((r) => r.json()).then(setStats).catch(() => {});
        });
      return;
    }
    const advanced = [...nextPool, winner];
    if (pairIdx * 2 + 2 >= pool.length) {
      // 라운드 종료 → 다음 라운드
      setPool(advanced);
      setNextPool([]);
      setPairIdx(0);
    } else {
      setNextPool(advanced);
      setPairIdx(pairIdx + 1);
    }
  }, [pool, nextPool, pairIdx, mode, roundSize]);

  const a = pool[pairIdx * 2];
  const b = pool[pairIdx * 2 + 1];
  const remaining = pool.length;

  const shareText = champion
    ? `🏆 메랜 ${MODE_LABEL[mode]} 이상형 월드컵 (${roundSize}강)\n우승: ${champion.name}\n준우승: ${runnerUp?.name ?? "-"}\n나도 하기 → ${typeof window !== "undefined" ? window.location.origin : ""}/worldcup`
    : "";

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="font-pixel text-2xl font-bold mb-1">🏆 메랜 이상형 월드컵</h1>
      <p className="text-sm text-dim mb-6">
        몬스터·아이템을 1:1로 붙여 최애를 가립니다. 우승 결과는 전체 통계에 집계돼요.
      </p>

      {phase === "select" && (
        <div className="space-y-4">
          <div className="pixel-panel p-5 border-maple/60">
            <h2 className="font-pixel text-lg font-semibold mb-2">👑 추억길드 코디 월드컵</h2>
            <p className="text-xs text-dim mb-3">
              길드원들의 실제 코디 {GUILD_CANDIDATES.length}종 등록 — 매판 랜덤 {2 ** Math.floor(Math.log2(GUILD_CANDIDATES.length))}강으로 진행됩니다. 최고의 코디왕을 가려주세요!
            </p>
            <button onClick={() => start("guild", 0)} disabled={busy} className="pixel-btn px-4 py-2 text-sm disabled:opacity-50">
              {2 ** Math.floor(Math.log2(GUILD_CANDIDATES.length))}강 시작
            </button>
          </div>
          {(["mob", "item"] as Mode[]).map((m) => (
            <div key={m} className="pixel-panel p-5">
              <h2 className="font-pixel text-lg font-semibold mb-2">{m === "mob" ? "👾" : "🎩"} {MODE_LABEL[m]} 월드컵</h2>
              <p className="text-xs text-dim mb-3">
                {m === "mob" ? "메이플랜드 몬스터 중 랜덤 진출 — 최애 몬스터를 뽑아보세요" : "장비·코디 아이템 중 랜덤 진출 — 감성 코디템을 가려보세요"}
              </p>
              <div className="flex gap-2">
                {[16, 32].map((size) => (
                  <button
                    key={size}
                    onClick={() => start(m, size)}
                    disabled={busy}
                    className="pixel-btn px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {size}강 시작
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {phase === "play" && a && b && (
        <div>
          <div className="text-center mb-4">
            <span className="font-pixel text-lg text-maple">{roundLabel(remaining)}</span>
            <span className="text-sm text-dim ml-2">{pairIdx + 1} / {Math.floor(pool.length / 2)} 경기</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[[a, b], [b, a]].slice(0, 1).flat().map((c, i) => {
              const other = c === a ? b : a;
              return (
                <button
                  key={`${c.id}-${i}`}
                  onClick={() => pick(c, other)}
                  className="pixel-panel p-5 flex flex-col items-center gap-3 hover:border-maple transition-colors group"
                >
                  <div className="h-40 flex items-center justify-center">
                    <CandidateImg c={c} className="max-h-40 max-w-full object-contain group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-center">
                    <span className="block font-semibold">{c.name}</span>
                    {c.sub && <span className="block text-xs text-dim">{c.sub}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-center text-xs text-dim mt-4">더 마음에 드는 쪽을 클릭!</p>
          <div className="text-center mt-2">
            <button onClick={() => setPhase("select")} className="text-xs text-dim hover:text-red-500">처음으로</button>
          </div>
        </div>
      )}

      {phase === "done" && champion && (
        <div className="text-center">
          <p className="font-pixel text-xl text-maple mb-3">🏆 우승!</p>
          <div className="pixel-panel inline-block px-10 py-6 mb-3">
            <div className="h-44 flex items-center justify-center">
              <CandidateImg c={champion} className="max-h-44 object-contain" />
            </div>
            <p className="font-bold text-lg mt-2">{champion.name}</p>
            {runnerUp && <p className="text-xs text-dim mt-1">준우승: {runnerUp.name}</p>}
          </div>
          <div className="flex items-center justify-center gap-2 mb-8">
            <button
              onClick={() => { navigator.clipboard.writeText(shareText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
              className="pixel-btn px-4 py-2 text-sm"
            >
              {copied ? "복사됨!" : "결과 공유 복사"}
            </button>
            <button onClick={() => start(mode, roundSize)} className="px-4 py-2 text-sm font-pixel border-2 border-edge text-dim hover:text-maple hover:border-maple transition-colors">
              다시 하기
            </button>
            <button onClick={() => setPhase("select")} className="px-4 py-2 text-sm font-pixel border-2 border-edge text-dim hover:text-maple hover:border-maple transition-colors">
              모드 선택
            </button>
          </div>

          {stats && stats.total > 0 && (
            <div className="pixel-panel p-5 text-left">
              <h2 className="font-pixel text-sm font-semibold mb-3">
                📊 {MODE_LABEL[mode]} 월드컵 명예의 전당 <span className="text-dim font-normal">(총 {stats.total}판)</span>
              </h2>
              <div className="space-y-1.5">
                {stats.top.map((row, i) => (
                  <div key={row.name} className="flex items-center gap-2 text-sm">
                    <span className="font-pixel text-xs w-6 text-dim">{i + 1}위</span>
                    <span className="flex-1 truncate">{row.name}</span>
                    <span className="text-xs text-dim">우승 {row.wins}회 · {row.rate}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
