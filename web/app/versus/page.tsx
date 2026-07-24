"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const SIZE = 15;
const POLL_MS = 1500;

interface Seat { client_id: string; nickname: string }
interface OmokState {
  game: string;
  board: string;
  turn: "B" | "W";
  seats: { B: Seat | null; W: Seat | null };
  winner: "B" | "W" | "draw" | null;
  last_move: [number, number] | null;
  move_count: number;
  rematch: string[];
  log: { at: number; text: string }[];
}
interface Member { client_id: string; nickname: string }

function VersusContent() {
  const searchParams = useSearchParams();
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<OmokState | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const clientIdRef = useRef("");
  const codeRef = useRef<string | null>(null);
  const versionRef = useRef(0);
  codeRef.current = code;
  versionRef.current = version;
  const nicknameRef = useRef("");
  nicknameRef.current = nickname;

  /* 초기화 — 클라이언트 ID·닉네임·URL 방코드 */
  useEffect(() => {
    let cid = localStorage.getItem("boss_timer_client_id");
    if (!cid) {
      cid = Math.random().toString(36).slice(2, 12);
      localStorage.setItem("boss_timer_client_id", cid);
    }
    clientIdRef.current = cid;
    setNickname(localStorage.getItem("boss_timer_nickname") || localStorage.getItem("codi_nickname") || "");
    const urlCode = (searchParams.get("room") || "").toUpperCase();
    if (urlCode.length === 6) {
      join(urlCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (nickname) localStorage.setItem("boss_timer_nickname", nickname);
  }, [nickname]);

  const applyRes = useCallback((res: { code: string; version: number; changed?: boolean; state?: OmokState | null; members?: Member[] }) => {
    setCode(res.code);
    setVersion(res.version);
    if (res.state) setState(res.state);
    if (res.members) setMembers(res.members);
  }, []);

  const create = useCallback(() => {
    setBusy(true); setError("");
    fetch(`${API_BASE}/api/versus/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "omok", nickname: nicknameRef.current || "익명", client_id: clientIdRef.current }),
    })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).detail || "실패"); return r.json(); })
      .then(applyRes)
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setBusy(false));
  }, [applyRes]);

  const join = useCallback((c: string) => {
    const cd = c.trim().toUpperCase();
    if (cd.length !== 6) { setError("6자리 방 코드를 입력하세요"); return; }
    setBusy(true); setError("");
    fetch(`${API_BASE}/api/versus/rooms/${cd}?since=0&client_id=${clientIdRef.current}&nickname=${encodeURIComponent(nicknameRef.current || "익명")}`)
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).detail || "실패"); return r.json(); })
      .then(applyRes)
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setBusy(false));
  }, [applyRes]);

  /* 폴링 */
  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => {
      const c = codeRef.current;
      if (!c) return;
      fetch(`${API_BASE}/api/versus/rooms/${c}?since=${versionRef.current}&client_id=${clientIdRef.current}&nickname=${encodeURIComponent(nicknameRef.current || "익명")}`)
        .then(async (r) => { if (!r.ok) throw new Error((await r.json()).detail || ""); return r.json(); })
        .then(applyRes)
        .catch((e) => {
          if (String(e.message).includes("찾을 수 없")) { setError("방이 만료되었습니다"); setCode(null); setState(null); }
        });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [code, applyRes]);

  const action = useCallback((act: Record<string, unknown>) => {
    const c = codeRef.current;
    if (!c) return;
    fetch(`${API_BASE}/api/versus/rooms/${c}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientIdRef.current, nickname: nicknameRef.current || "익명", action: act }),
    })
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).detail || "실패"); return r.json(); })
      .then(applyRes)
      .catch((e) => setError(String(e.message || e)));
  }, [applyRes]);

  const mySeat = state && (["B", "W"] as const).find((s) => state.seats[s]?.client_id === clientIdRef.current);
  const isSpectator = state && !mySeat;
  const bothSeated = state && state.seats.B && state.seats.W;

  /* ── 로비 ── */
  if (!code || !state) {
    return (
      <div className="max-w-xl mx-auto">
        <h1 className="font-pixel text-2xl font-bold mb-1">⚔️ 대전 게임 — 오목</h1>
        <p className="text-sm text-dim mb-6">방을 만들어 코드를 공유하면 1:1 대국, 나머지는 자유 관전. (같은그림찾기·끝말잇기 준비 중)</p>
        <div className="pixel-panel p-5 space-y-3">
          <input
            type="text" value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 12))}
            placeholder="내 닉네임"
            className="w-full pixel-input px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button onClick={create} disabled={busy} className="pixel-btn px-4 py-2 text-sm disabled:opacity-50">방 만들기 (흑선)</button>
            <input
              type="text" value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && join(joinCode)}
              placeholder="방 코드"
              className="pixel-input px-3 py-2 text-sm font-mono w-28 uppercase"
            />
            <button onClick={() => join(joinCode)} disabled={busy} className="px-4 py-2 text-sm font-pixel border-2 border-edge text-dim hover:text-maple hover:border-maple transition-colors disabled:opacity-50">참여</button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="pixel-panel p-4 mt-4 text-xs text-dim space-y-1">
          <p>· 참여하면 자동으로 <span className="text-ink">관전</span>부터 시작 — 빈 자리(흑/백)에 앉으면 플레이어</p>
          <p>· 대국 중 자리를 뜨면 기권 처리 · 5목 이상 완성 시 승리 · 재대결 시 흑백 교대</p>
          <p>· 방은 마지막 조작 후 6시간 뒤 자동 삭제됩니다</p>
        </div>
      </div>
    );
  }

  /* ── 대국 화면 ── */
  const board = state.board;
  const myTurn = mySeat && state.turn === mySeat && bothSeated && !state.winner;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h1 className="font-pixel text-xl font-bold">⚫⚪ 오목</h1>
        <span className="font-mono font-bold tracking-widest">{code}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/versus?room=${code}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
          className="pixel-btn px-3 py-1.5 text-xs"
        >
          {copied ? "복사됨!" : "초대 링크"}
        </button>
        <span className="text-xs text-dim">👥 {members.length}명 접속 (관전 {Math.max(0, members.length - (state.seats.B ? 1 : 0) - (state.seats.W ? 1 : 0))})</span>
        <button onClick={() => { if (mySeat) action({ type: "stand" }); setCode(null); setState(null); }} className="ml-auto px-3 py-1.5 text-xs font-pixel border-2 border-edge text-dim hover:text-red-500 hover:border-red-400 transition-colors">
          나가기
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-4">
        {/* 바둑판 */}
        <div className="pixel-panel p-3">
          {/* 상태 배너 */}
          <div className="text-center mb-2 text-sm">
            {state.winner ? (
              <span className="font-pixel text-maple">
                {state.winner === "draw" ? "무승부!" : `🏆 ${state.winner === "B" ? "흑" : "백"} (${state.seats[state.winner]?.nickname ?? "?"}) 승리!`}
              </span>
            ) : !bothSeated ? (
              <span className="text-dim">상대를 기다리는 중 — 초대 링크를 공유하세요</span>
            ) : (
              <span>
                <span className={state.turn === "B" ? "font-semibold" : "text-dim"}>⚫ {state.seats.B?.nickname}</span>
                <span className="text-dim mx-2">vs</span>
                <span className={state.turn === "W" ? "font-semibold" : "text-dim"}>⚪ {state.seats.W?.nickname}</span>
                {myTurn && <span className="text-maple ml-2 font-pixel text-xs">내 차례!</span>}
              </span>
            )}
          </div>
          <div
            className="mx-auto"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
              maxWidth: 560,
              background: "#c9974f",
              border: "3px solid #6b4a1f",
              imageRendering: "pixelated",
            }}
          >
            {Array.from({ length: SIZE * SIZE }, (_, i) => {
              const x = i % SIZE, y = Math.floor(i / SIZE);
              const cell = board[i];
              const isLast = state.last_move && state.last_move[0] === x && state.last_move[1] === y;
              return (
                <button
                  key={i}
                  onClick={() => myTurn && cell === "." && action({ type: "place", x, y })}
                  disabled={!myTurn || cell !== "."}
                  className="relative aspect-square"
                  style={{ background: "transparent" }}
                >
                  {/* 격자선 */}
                  <span className="absolute left-0 right-0 top-1/2 h-px bg-[#6b4a1f]/70" />
                  <span className="absolute top-0 bottom-0 left-1/2 w-px bg-[#6b4a1f]/70" />
                  {cell !== "." && (
                    <span
                      className={`absolute inset-[12%] rounded-full ${cell === "B" ? "bg-black" : "bg-white"} ${isLast ? "ring-2 ring-red-500" : ""}`}
                      style={{ boxShadow: "1px 1px 0 rgba(0,0,0,.4)" }}
                    />
                  )}
                  {cell === "." && myTurn && (
                    <span className={`absolute inset-[20%] rounded-full opacity-0 hover:opacity-40 ${state.turn === "B" ? "bg-black" : "bg-white"}`} />
                  )}
                </button>
              );
            })}
          </div>
          {state.winner && mySeat && (
            <div className="text-center mt-3">
              <button onClick={() => action({ type: "rematch" })} className="pixel-btn px-4 py-2 text-sm">
                🔄 재대결 {state.rematch.length > 0 ? `(${state.rematch.length}/2)` : ""}
              </button>
            </div>
          )}
        </div>

        {/* 사이드: 좌석 · 로그 */}
        <div className="space-y-3">
          <div className="pixel-panel p-4">
            <h2 className="font-pixel text-xs text-maple mb-2">좌석</h2>
            {(["B", "W"] as const).map((s) => (
              <div key={s} className="flex items-center gap-2 text-sm py-1">
                <span>{s === "B" ? "⚫" : "⚪"}</span>
                {state.seats[s] ? (
                  <span className="flex-1 truncate">{state.seats[s]!.nickname}{state.seats[s]!.client_id === clientIdRef.current && " (나)"}</span>
                ) : (
                  <button onClick={() => action({ type: "sit", seat: s })} disabled={!!mySeat}
                    className="pixel-btn px-2.5 py-1 text-xs disabled:opacity-40">
                    앉기
                  </button>
                )}
              </div>
            ))}
            {mySeat && !state.winner && state.move_count > 0 && (
              <button onClick={() => action({ type: "stand" })} className="mt-1 text-[11px] text-dim hover:text-red-500">기권하기</button>
            )}
            {isSpectator && <p className="text-[11px] text-dim mt-1.5">👀 관전 중 — 빈 자리에 앉으면 대국 참여</p>}
          </div>
          <div className="pixel-panel p-4">
            <h2 className="font-pixel text-xs text-maple mb-2">기록</h2>
            <div className="space-y-0.5 max-h-56 overflow-y-auto">
              {[...(state.log || [])].reverse().map((l, i) => (
                <p key={`${l.at}-${i}`} className={`text-[11px] ${i === 0 ? "text-ink" : "text-dim"}`}>{l.text}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

export default function VersusPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-dim">로딩 중...</div>}>
      <VersusContent />
    </Suspense>
  );
}
