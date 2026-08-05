"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const TOKEN_KEY = "guild_event_tokens"; // {eventId: owner_token}
const NICK_KEY = "guild_event_nick";
const POLL_MS = 5000; // 추첨 연출을 모두가 거의 동시에 보도록 짧은 폴링
const GRACE_SEC = 4; // 연출 종료 후 결과 강조 유지 시간

type DrawMethod = "roulette" | "ladder" | "dice";

interface EventResult {
  type: DrawMethod | "clear";
  winners?: string[];
  note?: string;
  drawn_at?: string;
  drawn_epoch?: number;
  duration?: number;
  cleared_at?: string;
  anim?: {
    order?: string[];
    winner_index?: number;
    columns?: string[];
    rungs?: [number, number][];
    prizes?: string[];
    rows?: number;
    scores?: Record<string, number>;
  };
}

interface GuildEvent {
  id: number;
  title: string;
  description: string | null;
  reward: string | null;
  author: string;
  deadline: string;
  capacity: number | null;
  participants: string[];
  status: "open" | "closed" | "done";
  result: EventResult | null;
  expired: boolean;
  created_at: string;
}

function loadTokens(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || "{}"); } catch { return {}; }
}
function saveToken(id: number, token: string) {
  const t = loadTokens(); t[String(id)] = token;
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch { /* ignore */ }
}

function fmtDeadline(s: string) {
  return s.replace("T", " ");
}

const METHOD_META: Record<DrawMethod, { label: string; emoji: string }> = {
  roulette: { label: "룰렛", emoji: "🎡" },
  ladder: { label: "사다리", emoji: "🪜" },
  dice: { label: "주사위", emoji: "🎲" },
};

const WHEEL_COLORS = ["#e8834a", "#5b8dd9", "#6cb56c", "#c975c9", "#d9b95b", "#d96a6a", "#5bc4c4", "#9a7fd9"];

// ---------------------------------------------------------------------------
// 🎡 룰렛 — 서버가 정한 당첨 칸으로 회전 (모든 시청자 동일 연출)
// ---------------------------------------------------------------------------
function RouletteAnim({ result, elapsed }: { result: EventResult; elapsed: number }) {
  const order = result.anim?.order || [];
  const winnerIndex = result.anim?.winner_index ?? 0;
  const duration = result.duration || 8;
  const [rotation, setRotation] = useState(0);
  const started = useRef(false);

  const sweep = order.length > 0 ? 360 / order.length : 360;
  const finalRotation = 6 * 360 + (360 - (winnerIndex * sweep + sweep / 2));

  useEffect(() => {
    if (started.current || order.length === 0) return;
    started.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => setRotation(finalRotation)));
  }, [order.length, finalRotation]);

  const remain = Math.max(0.4, duration - elapsed);
  const finished = elapsed >= duration;
  const cx = 90, cy = 90, r = 82;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative shrink-0">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <g style={{
            transform: `rotate(${finished ? finalRotation : rotation}deg)`,
            transformOrigin: "90px 90px",
            transition: finished ? "none" : `transform ${remain}s cubic-bezier(0.15, 0.65, 0.2, 1)`,
          }}>
            {order.map((name, i) => {
              const a0 = ((i * sweep - 90) * Math.PI) / 180;
              const a1 = (((i + 1) * sweep - 90) * Math.PI) / 180;
              const large = sweep > 180 ? 1 : 0;
              const mid = ((i + 0.5) * sweep - 90) * (Math.PI / 180);
              return (
                <g key={i}>
                  <path
                    d={`M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`}
                    fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} stroke="#00000022" />
                  <text x={cx + r * 0.62 * Math.cos(mid)} y={cy + r * 0.62 * Math.sin(mid)}
                    fontSize={order.length > 8 ? 8 : 10} fill="#fff" textAnchor="middle" dominantBaseline="middle"
                    transform={`rotate(${(i + 0.5) * sweep}, ${cx + r * 0.62 * Math.cos(mid)}, ${cy + r * 0.62 * Math.sin(mid)})`}>
                    {name.length > 6 ? name.slice(0, 6) : name}
                  </text>
                </g>
              );
            })}
          </g>
          <polygon points="90,4 82,20 98,20" fill="#e8834a" stroke="#00000033" />
          <circle cx={cx} cy={cy} r={14} fill="#ffffff" stroke="#00000033" strokeWidth={2} />
        </svg>
      </div>
      <div className="text-center sm:text-left">
        {finished ? (
          <>
            <div className="font-pixel text-xs text-dim mb-1">🎉 당첨</div>
            {result.winners?.map((w) => (
              <div key={w} className="font-pixel text-lg text-maple">🏆 {w}</div>
            ))}
          </>
        ) : (
          <div className="font-pixel text-sm text-dim animate-pulse">🎡 룰렛 회전 중...</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 🪜 사다리 — 서버가 생성한 사다리를 그대로 그려 전원 동일 연출
// ---------------------------------------------------------------------------
function LadderAnim({ result, elapsed }: { result: EventResult; elapsed: number }) {
  const columns = result.anim?.columns || [];
  const rungs = result.anim?.rungs || [];
  const prizes = result.anim?.prizes || [];
  const rows = result.anim?.rows || 8;
  const duration = result.duration || 7;
  const finished = elapsed >= duration;
  const [go, setGo] = useState(false);
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setGo(true))); }, []);

  const k = columns.length;
  const W = Math.max(240, k * 64), H = 190;
  const colX = (c: number) => 32 + (c * (W - 64)) / Math.max(1, k - 1);
  const rowY = (r: number) => 24 + (r * (H - 54)) / rows;

  const hasRung = (row: number, col: number) => rungs.some(([rr, cc]) => rr === row && cc === col);

  // 각 시작 열의 이동 경로 polyline
  const paths = columns.map((_, start) => {
    let col = start;
    const pts: [number, number][] = [[colX(col), rowY(0)]];
    for (let row = 1; row < rows; row++) {
      pts.push([colX(col), rowY(row)]);
      if (hasRung(row, col)) { col += 1; pts.push([colX(col), rowY(row)]); }
      else if (hasRung(row, col - 1)) { col -= 1; pts.push([colX(col), rowY(row)]); }
    }
    pts.push([colX(col), rowY(rows)]);
    return { start, end: col, pts };
  });

  const remain = Math.max(0.4, duration - elapsed);

  return (
    <div>
      <div className="overflow-x-auto">
        <svg width={W} height={H + 20} viewBox={`0 0 ${W} ${H + 20}`} className="mx-auto block">
          {columns.map((name, c) => (
            <g key={c}>
              <text x={colX(c)} y={14} fontSize={10} textAnchor="middle" fill="currentColor">
                {name.length > 5 ? name.slice(0, 5) : name}
              </text>
              <line x1={colX(c)} y1={rowY(0)} x2={colX(c)} y2={rowY(rows)} stroke="#88888866" strokeWidth={2} />
              <text x={colX(c)} y={H + 14} fontSize={10} textAnchor="middle"
                fill={prizes[c] === "당첨" ? "#e8834a" : "#888888aa"}
                fontWeight={prizes[c] === "당첨" ? 700 : 400}>
                {finished || elapsed > duration * 0.5 ? prizes[c] : "?"}
              </text>
            </g>
          ))}
          {rungs.map(([row, col], i) => (
            <line key={i} x1={colX(col)} y1={rowY(row)} x2={colX(col + 1)} y2={rowY(row)}
              stroke="#88888866" strokeWidth={2} />
          ))}
          {paths.map(({ start, end, pts }) => {
            const isWin = prizes[end] === "당첨";
            const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
            return (
              <path key={start} d={d} fill="none"
                stroke={isWin ? WHEEL_COLORS[start % WHEEL_COLORS.length] : "#88888855"}
                strokeWidth={isWin ? 3 : 1.5}
                pathLength={1} strokeDasharray={1}
                strokeDashoffset={go || finished ? 0 : 1}
                style={{ transition: finished ? "none" : `stroke-dashoffset ${remain}s ease-in-out` }} />
            );
          })}
        </svg>
      </div>
      <div className="text-center mt-1">
        {finished ? (
          <span className="font-pixel text-sm text-maple">🎉 {result.winners?.map((w) => `🏆 ${w}`).join("  ")}</span>
        ) : (
          <span className="font-pixel text-xs text-dim animate-pulse">🪜 사다리 타는 중...</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 🎲 주사위 — 점수 셔플 후 서버 확정 점수로 정착
// ---------------------------------------------------------------------------
function DiceAnim({ result, elapsed }: { result: EventResult; elapsed: number }) {
  const scores = result.anim?.scores || {};
  const names = Object.keys(scores);
  const duration = result.duration || 5;
  const finished = elapsed >= duration - 1;
  const [display, setDisplay] = useState<Record<string, number>>({});

  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => {
      const d: Record<string, number> = {};
      names.forEach((n) => { d[n] = Math.floor(Math.random() * 100) + 1; });
      setDisplay(d);
    }, 90);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const shown = finished ? scores : display;
  const sorted = [...names].sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
  const list = finished ? sorted : names;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {list.map((n) => {
          const isWin = finished && result.winners?.includes(n);
          return (
            <div key={n} className={`flex items-center justify-between px-2 py-1.5 border-2 text-sm ${
              isWin ? "border-maple bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]" : "border-edge bg-surface2"
            }`}>
              <span className="truncate text-ink">{isWin ? "🏆 " : ""}{n}</span>
              <span className={`font-pixel text-sm ${isWin ? "text-maple" : "text-dim"}`}>{shown[n] ?? "?"}</span>
            </div>
          );
        })}
      </div>
      <div className="text-center mt-2">
        {finished ? (
          <span className="font-pixel text-sm text-maple">🎉 {result.winners?.map((w) => `🏆 ${w}`).join("  ")}</span>
        ) : (
          <span className="font-pixel text-xs text-dim animate-pulse">🎲 주사위 굴리는 중...</span>
        )}
      </div>
    </div>
  );
}

function LiveDraw({ result, nowEpoch }: { result: EventResult; nowEpoch: number }) {
  const elapsed = Math.max(0, nowEpoch - (result.drawn_epoch || 0));
  return (
    <div className="mt-3 border-2 border-maple p-3 bg-[color-mix(in_srgb,var(--c-maple)_6%,transparent)]">
      {result.type === "roulette" && <RouletteAnim result={result} elapsed={elapsed} />}
      {result.type === "ladder" && <LadderAnim result={result} elapsed={elapsed} />}
      {result.type === "dice" && <DiceAnim result={result} elapsed={elapsed} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 이벤트 카드
// ---------------------------------------------------------------------------
function EventCard({ ev, nick, isOwner, onChanged, nowEpoch }: {
  ev: GuildEvent; nick: string; isOwner: boolean; onChanged: () => void; nowEpoch: number;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [winnerCount, setWinnerCount] = useState(1);
  const [method, setMethod] = useState<DrawMethod>("roulette");
  const [clearNote, setClearNote] = useState("");
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);

  const joined = nick.trim() !== "" && ev.participants.includes(nick.trim());
  const joinable = ev.status === "open" && !ev.expired &&
    (!ev.capacity || ev.participants.length < ev.capacity);

  // 추첨 연출 표시 여부 — 폴링으로 유입된 시청자도 같은 연출을 이어서 본다
  const isLive = Boolean(
    ev.result && ev.result.type !== "clear" && ev.result.drawn_epoch &&
    nowEpoch - ev.result.drawn_epoch < (ev.result.duration || 8) + GRACE_SEC
  );

  const call = async (path: string, httpMethod: string, body: object) => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/guild/events/${ev.id}${path}`, {
        method: httpMethod,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.detail || "요청 실패");
      return d;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "요청 실패");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const token = loadTokens()[String(ev.id)];

  const join = async () => {
    if (!nick.trim()) { setErr("상단에 닉네임을 먼저 입력하세요."); return; }
    try { localStorage.setItem(NICK_KEY, nick.trim()); } catch { /* ignore */ }
    if (await call("/join", "PATCH", { nickname: nick.trim() })) onChanged();
  };
  const leave = async () => {
    if (await call("/leave", "PATCH", { nickname: nick.trim() })) onChanged();
  };
  const close = async () => {
    if (await call("/close", "POST", { owner_token: token })) onChanged();
  };
  const draw = async () => {
    const d = await call("/draw", "POST", { owner_token: token, winner_count: winnerCount, method });
    if (d) { setShowOwnerPanel(false); onChanged(); }
  };
  const clear = async () => {
    if (await call("/clear", "POST", { owner_token: token, note: clearNote })) onChanged();
  };
  const remove = async () => {
    if (!confirm("이벤트를 삭제할까요? 지원자 명단도 사라집니다.")) return;
    if (await call("", "DELETE", { owner_token: token })) onChanged();
  };

  const statusBadge = ev.status === "done"
    ? <span className="font-pixel text-[10px] px-1.5 py-0.5 border-2 border-edge text-dim">완료</span>
    : ev.status === "closed" || ev.expired
      ? <span className="font-pixel text-[10px] px-1.5 py-0.5 bg-surface2 border border-edge text-dim">지원 마감</span>
      : <span className="font-pixel text-[10px] px-1.5 py-0.5 bg-maple text-white border border-edge-lo">모집 중</span>;

  return (
    <div className={`pixel-card p-4 ${ev.status === "done" && !isLive ? "opacity-75" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-ink">{ev.title}</span>
            {statusBadge}
            {ev.reward && <span className="font-pixel text-[10px] px-1.5 py-0.5 bg-surface2 border border-edge text-maple">🎁 {ev.reward}</span>}
          </div>
          <div className="text-xs text-dim mt-1">
            주최 {ev.author} · 마감 {fmtDeadline(ev.deadline)} ·
            지원 {ev.participants.length}{ev.capacity ? `/${ev.capacity}` : ""}명
          </div>
        </div>
        {isOwner && ev.status !== "done" && (
          <button onClick={() => setShowOwnerPanel(!showOwnerPanel)}
            className="font-pixel text-xs text-dim hover:text-maple shrink-0 px-1" title="주최자 메뉴">⚙</button>
        )}
      </div>

      {ev.description && (
        <p className="text-sm text-ink mt-2 whitespace-pre-line leading-relaxed">{ev.description}</p>
      )}

      {/* 지원자 명단 */}
      {ev.participants.length > 0 && !isLive && (
        <div className="flex flex-wrap gap-1 mt-3">
          {ev.participants.map((p) => {
            const isWinner = ev.status === "done" && ev.result?.winners?.includes(p);
            return (
              <span key={p} className={`text-xs px-2 py-0.5 border ${
                isWinner ? "border-maple bg-maple text-white font-medium" : "border-edge bg-surface2 text-ink"
              }`}>
                {isWinner ? "🏆 " : ""}{p}
              </span>
            );
          })}
        </div>
      )}

      {/* 🔴 실시간 추첨 연출 — 보고 있는 모두에게 동일하게 재생 */}
      {isLive && ev.result && <LiveDraw result={ev.result} nowEpoch={nowEpoch} />}

      {/* 결과 (연출 종료 후) */}
      {ev.result && !isLive && (
        <div className="mt-3 border-2 border-edge bg-surface2 p-2.5 text-sm">
          {ev.result.type === "clear" ? (
            <>✅ <b>클리어 완료</b> ({ev.result.cleared_at}){ev.result.note ? ` — ${ev.result.note}` : ""}</>
          ) : (
            <>{METHOD_META[ev.result.type as DrawMethod]?.emoji || "🎰"} <b>{METHOD_META[ev.result.type as DrawMethod]?.label || "추첨"} 결과</b> ({ev.result.drawn_at}): <span className="text-maple font-medium">{ev.result.winners?.join(", ")}</span></>
          )}
        </div>
      )}

      {/* 참여 버튼 */}
      {ev.status !== "done" && (
        <div className="flex items-center gap-2 mt-3">
          {joined ? (
            ev.status === "open" && (
              <button onClick={leave} disabled={busy}
                className="px-3 py-1.5 border-2 border-edge text-sm text-dim hover:text-ink">지원 취소</button>
            )
          ) : (
            joinable && (
              <button onClick={join} disabled={busy} className="pixel-btn px-4 py-1.5 text-sm">✋ 지원하기</button>
            )
          )}
          {joined && <span className="text-xs text-maple">지원 완료</span>}
        </div>
      )}

      {/* 주최자 패널 */}
      {isOwner && showOwnerPanel && ev.status !== "done" && (
        <div className="mt-3 border-2 border-maple/50 p-3 space-y-2.5">
          <div className="font-pixel text-xs text-maple">주최자 메뉴</div>
          {ev.status === "open" && (
            <button onClick={close} disabled={busy}
              className="px-3 py-1.5 border-2 border-edge text-sm hover:border-maple">⏰ 지원 조기 마감</button>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-dim mr-1">추첨 방식</span>
              {(Object.keys(METHOD_META) as DrawMethod[]).map((m) => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`px-2.5 py-1 border-2 text-xs font-pixel ${
                    method === m ? "border-maple bg-maple text-white" : "border-edge bg-surface2 text-ink hover:border-maple"
                  }`}>
                  {METHOD_META[m].emoji} {METHOD_META[m].label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-dim">당첨 인원</label>
              <input type="number" min={1} max={Math.max(1, ev.participants.length)} value={winnerCount}
                onChange={(e) => setWinnerCount(Math.max(1, Number(e.target.value)))}
                className="pixel-input w-16 px-2 py-1 text-center text-sm" />
              <button onClick={draw} disabled={busy || ev.participants.length === 0}
                className="pixel-btn px-3 py-1.5 text-sm">{METHOD_META[method].emoji} 추첨 시작</button>
              <span className="text-[10px] text-dim">서버 추첨 — 결과 고정 · 보는 사람 모두에게 생중계</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={clearNote} onChange={(e) => setClearNote(e.target.value)} placeholder="완료 메모 (선택)"
              className="pixel-input flex-1 min-w-[140px] px-2 py-1 text-sm" />
            <button onClick={clear} disabled={busy} className="pixel-btn px-3 py-1.5 text-sm">✅ 클리어 처리</button>
          </div>
          <button onClick={remove} disabled={busy} className="text-xs text-red-500 hover:underline">이벤트 삭제</button>
        </div>
      )}
      {isOwner && ev.status === "done" && !isLive && (
        <button onClick={remove} disabled={busy} className="text-xs text-dim hover:text-red-500 hover:underline mt-2">기록 삭제</button>
      )}

      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 페이지
// ---------------------------------------------------------------------------
export default function GuildEventsPage() {
  const [events, setEvents] = useState<GuildEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [nick, setNick] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", reward: "", deadline: "", capacity: "" });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [myTokens, setMyTokens] = useState<Record<string, string>>({});
  const [me, setMe] = useState<string | null>(null);
  const [nowEpoch, setNowEpoch] = useState(() => Math.floor(Date.now() / 1000));
  const epochOffset = useRef(0); // server_epoch - local epoch

  const load = useCallback(() => {
    fetch(`${API_BASE}/api/guild/events`)
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.server_epoch === "number") {
          epochOffset.current = d.server_epoch - Math.floor(Date.now() / 1000);
        }
        setEvents(d.events || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    setMyTokens(loadTokens());
    try { setNick(localStorage.getItem(NICK_KEY) || ""); } catch { /* ignore */ }
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.display_name) {
          setMe(d.user.display_name);
          setNick((prev) => prev || d.user.display_name);
        }
      })
      .catch(() => {});
    const poll = setInterval(load, POLL_MS);
    const clock = setInterval(() => setNowEpoch(Math.floor(Date.now() / 1000) + epochOffset.current), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  const create = async () => {
    setFormErr(null);
    if (!form.title.trim()) { setFormErr("제목을 입력하세요."); return; }
    if (!form.deadline) { setFormErr("지원 마감 일시를 선택하세요."); return; }
    if (!nick.trim() && !me) { setFormErr("주최자 닉네임을 입력하세요 (상단 닉네임 칸)."); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/guild/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description,
          reward: form.reward,
          author: nick.trim() || undefined,
          deadline: form.deadline,
          capacity: form.capacity ? Number(form.capacity) : null,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.detail || "등록 실패");
      if (d.owner_token) saveToken(d.id, d.owner_token);
      setMyTokens(loadTokens());
      try { localStorage.setItem(NICK_KEY, nick.trim()); } catch { /* ignore */ }
      setShowForm(false);
      setForm({ title: "", description: "", reward: "", deadline: "", capacity: "" });
      load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setBusy(false);
    }
  };

  const active = events.filter((e) => e.status !== "done");
  const done = events.filter((e) => e.status === "done");

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 font-pixel">🎪 이벤트 모집</h1>
      <p className="text-dim mb-4 text-sm">
        누구나 이벤트를 열 수 있어요. 마감까지 지원받고, 주최자가 룰렛·사다리·주사위 추첨 또는 클리어 처리로 마무리합니다.
        추첨은 페이지를 보고 있는 모두에게 실시간으로 재생됩니다.
      </p>

      {/* 닉네임 + 새 이벤트 */}
      <div className="pixel-panel p-3 mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          내 닉네임
          <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder={me || "닉네임"}
            className="pixel-input w-36 px-2 py-1.5 text-sm" maxLength={12} />
        </label>
        {me && <span className="text-[11px] text-dim">디스코드 로그인: {me}</span>}
        <button onClick={() => setShowForm(!showForm)} className="pixel-btn px-4 py-1.5 text-sm ml-auto">
          {showForm ? "닫기" : "+ 이벤트 열기"}
        </button>
      </div>

      {/* 생성 폼 */}
      {showForm && (
        <div className="pixel-panel p-4 mb-4 space-y-2.5">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="이벤트 제목 (예: 주말 자쿰 헤딩팟 이벤트)" maxLength={60}
            className="pixel-input w-full px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="설명 — 조건, 일정, 진행 방식 등" rows={3}
            className="pixel-input w-full px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-dim flex items-center gap-2">
              지원 마감
              <input type="datetime-local" value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="pixel-input px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-dim flex items-center gap-2">
              정원
              <input type="number" min={2} max={100} value={form.capacity} placeholder="무제한"
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                className="pixel-input w-20 px-2 py-1.5 text-sm text-center" />
            </label>
            <label className="text-xs text-dim flex items-center gap-2 flex-1 min-w-[160px]">
              보상
              <input value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })}
                placeholder="예: 1등 100만 메소" maxLength={100}
                className="pixel-input flex-1 px-2 py-1.5 text-sm" />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={create} disabled={busy} className="pixel-btn px-4 py-2 text-sm">등록</button>
            {formErr && <span className="text-xs text-red-500">{formErr}</span>}
          </div>
          <p className="text-[10px] text-dim">
            주최자 권한(마감·추첨·삭제)은 이 브라우저에 저장됩니다. 디스코드 로그인 상태로 만들면 다른 기기에서도 주최자로 인식돼요.
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-dim">
          <div className="w-8 h-8 border-2 border-maple border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          이벤트 로딩 중...
        </div>
      ) : events.length === 0 ? (
        <div className="pixel-panel p-8 text-center text-dim">
          아직 열린 이벤트가 없습니다. 첫 이벤트를 열어보세요! 🎉
        </div>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div className="space-y-2">
              {active.map((ev) => (
                <EventCard key={ev.id} ev={ev} nick={nick} nowEpoch={nowEpoch}
                  isOwner={Boolean(myTokens[String(ev.id)]) || (Boolean(me) && ev.author === me)}
                  onChanged={load} />
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div>
              <h2 className="font-pixel text-sm text-dim mb-2">📦 완료된 이벤트</h2>
              <div className="space-y-2">
                {done.map((ev) => (
                  <EventCard key={ev.id} ev={ev} nick={nick} nowEpoch={nowEpoch}
                    isOwner={Boolean(myTokens[String(ev.id)]) || (Boolean(me) && ev.author === me)}
                    onChanged={load} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
