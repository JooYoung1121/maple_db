"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const TOKEN_KEY = "guild_event_tokens"; // {eventId: owner_token}
const NICK_KEY = "guild_event_nick";

interface EventResult {
  type: "roulette" | "clear";
  winners?: string[];
  note?: string;
  drawn_at?: string;
  cleared_at?: string;
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
  owner_token?: string;
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

// ---------------------------------------------------------------------------
// 추첨 연출: 이름 셔플 후 당첨자 공개
// ---------------------------------------------------------------------------
function DrawReveal({ participants, winners, onDone }: { participants: string[]; winners: string[]; onDone: () => void }) {
  const [display, setDisplay] = useState(participants[0] || "");
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let tick = 0;
    timer.current = setInterval(() => {
      tick += 1;
      setDisplay(participants[Math.floor(Math.random() * participants.length)]);
      if (tick > 25) {
        if (timer.current) clearInterval(timer.current);
        setRevealed(true);
        setTimeout(onDone, 2500);
      }
    }, 100);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div className="pixel-panel p-8 text-center min-w-[280px]">
        {!revealed ? (
          <>
            <div className="font-pixel text-sm text-dim mb-3">🎰 추첨 중...</div>
            <div className="font-pixel text-2xl text-maple animate-pulse">{display}</div>
          </>
        ) : (
          <>
            <div className="font-pixel text-sm text-dim mb-3">🎉 당첨!</div>
            {winners.map((w) => (
              <div key={w} className="font-pixel text-2xl text-maple">{w}</div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 이벤트 카드
// ---------------------------------------------------------------------------
function EventCard({ ev, nick, isOwner, onChanged }: {
  ev: GuildEvent; nick: string; isOwner: boolean; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [winnerCount, setWinnerCount] = useState(1);
  const [clearNote, setClearNote] = useState("");
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);
  const [drawAnim, setDrawAnim] = useState<string[] | null>(null);

  const joined = nick.trim() !== "" && ev.participants.includes(nick.trim());
  const joinable = ev.status === "open" && !ev.expired &&
    (!ev.capacity || ev.participants.length < ev.capacity);

  const call = async (path: string, method: string, body: object) => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`${API_BASE}/api/guild/events/${ev.id}${path}`, {
        method,
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
    const d = await call("/draw", "POST", { owner_token: token, winner_count: winnerCount });
    if (d?.result?.winners) setDrawAnim(d.result.winners);
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
    <div className={`pixel-card p-4 ${ev.status === "done" ? "opacity-75" : ""}`}>
      {drawAnim && (
        <DrawReveal participants={ev.participants} winners={drawAnim}
          onDone={() => { setDrawAnim(null); onChanged(); }} />
      )}
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
      {ev.participants.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {ev.participants.map((p) => {
            const isWinner = ev.result?.winners?.includes(p);
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

      {/* 결과 */}
      {ev.result && (
        <div className="mt-3 border-2 border-edge bg-surface2 p-2.5 text-sm">
          {ev.result.type === "roulette" ? (
            <>🎰 <b>룰렛 추첨 결과</b> ({ev.result.drawn_at}): <span className="text-maple font-medium">{ev.result.winners?.join(", ")}</span></>
          ) : (
            <>✅ <b>클리어 완료</b> ({ev.result.cleared_at}){ev.result.note ? ` — ${ev.result.note}` : ""}</>
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
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-dim">당첨 인원</label>
            <input type="number" min={1} max={Math.max(1, ev.participants.length)} value={winnerCount}
              onChange={(e) => setWinnerCount(Math.max(1, Number(e.target.value)))}
              className="pixel-input w-16 px-2 py-1 text-center text-sm" />
            <button onClick={draw} disabled={busy || ev.participants.length === 0}
              className="pixel-btn px-3 py-1.5 text-sm">🎰 룰렛 추첨</button>
            <span className="text-[10px] text-dim">서버 추첨 — 결과 고정, 재추첨 불가</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={clearNote} onChange={(e) => setClearNote(e.target.value)} placeholder="완료 메모 (선택)"
              className="pixel-input flex-1 min-w-[140px] px-2 py-1 text-sm" />
            <button onClick={clear} disabled={busy} className="pixel-btn px-3 py-1.5 text-sm">✅ 클리어 처리</button>
          </div>
          <button onClick={remove} disabled={busy} className="text-xs text-red-500 hover:underline">이벤트 삭제</button>
        </div>
      )}
      {isOwner && ev.status === "done" && (
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

  const load = useCallback(() => {
    fetch(`${API_BASE}/api/guild/events`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => setEvents([]))
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
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
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
        누구나 이벤트를 열 수 있어요. 마감까지 지원받고, 주최자가 룰렛 추첨 또는 클리어 처리로 마무리합니다.
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
                <EventCard key={ev.id} ev={ev} nick={nick}
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
                  <EventCard key={ev.id} ev={ev} nick={nick}
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
