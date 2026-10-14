"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface BossInfo {
  id: number;
  name: string;
  level: number | null;
  icon_url: string | null;
  respawn_min: number | null;
  maps?: string[];
}

interface Report {
  id: number;
  channel: number;
  killed_at: string;
  reporter: string | null;
}

interface ReportsData {
  boss_id: number;
  respawn_min: number | null;
  channels: Record<string, Report>;
  recent: Report[];
  server_now: string;
}

const RESPAWN_OVERRIDE_KEY = "field_boss_respawn_override";
const MAX_CHANNEL = 999; // 서버 검증값과 동일 — 메랜 2.0 채널 수(241+)가 늘어도 수용

function fmtClock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtElapsed(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분 전`;
}

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function FieldBossPage() {
  const [bosses, setBosses] = useState<BossInfo[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [data, setData] = useState<ReportsData | null>(null);
  const [respawnOverride, setRespawnOverride] = useState<Record<number, number>>({});
  const [reportTarget, setReportTarget] = useState<number | null>(null); // 채널 번호
  const [channelInput, setChannelInput] = useState("");
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const clockOffset = useRef(0); // server_now - client now

  // 설정 로드
  useEffect(() => {
    try {
      const o = JSON.parse(localStorage.getItem(RESPAWN_OVERRIDE_KEY) || "{}");
      if (o && typeof o === "object") setRespawnOverride(o);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/field-boss/bosses`)
      .then((r) => r.json())
      .then((d) => {
        setBosses(d.bosses || []);
        if (d.bosses?.length) {
          const saved = Number(localStorage.getItem("field_boss_selected"));
          const found = d.bosses.find((b: BossInfo) => b.id === saved);
          setSelected(found ? found.id : d.bosses[0].id);
        }
      })
      .catch(() => setBosses([]));
  }, []);

  const load = useCallback(() => {
    if (!selected) return;
    fetch(`${API_BASE}/api/field-boss/reports?boss_id=${selected}`)
      .then((r) => r.json())
      .then((d: ReportsData) => {
        clockOffset.current = new Date(d.server_now).getTime() - Date.now();
        setData(d);
      })
      .catch(() => {});
  }, [selected]);

  // 선택 변경·30초 폴링·1초 시계
  useEffect(() => {
    load();
    const poll = setInterval(load, 30000);
    return () => clearInterval(poll);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const boss = useMemo(() => bosses.find((b) => b.id === selected) || null, [bosses, selected]);
  const respawnMin = selected != null
    ? (respawnOverride[selected] ?? boss?.respawn_min ?? null)
    : null;

  const selectBoss = (id: number) => {
    setSelected(id);
    setData(null);
    setReportTarget(null);
    try { localStorage.setItem("field_boss_selected", String(id)); } catch { /* ignore */ }
  };

  /* 채널 직접 선택 — 이미 기록이 있는 채널이면 그 카드를 선택(중복 생성 없음), 없으면 새로 선택해 제보 */
  const pickChannel = () => {
    const ch = Math.floor(Number(channelInput));
    if (!Number.isFinite(ch) || ch < 1 || ch > MAX_CHANNEL) {
      setMsg(`채널 번호는 1~${MAX_CHANNEL} 사이로 입력하세요.`);
      return;
    }
    setMsg(null);
    setReportTarget(ch);
    setMinutesAgo(0);
    setChannelInput("");
  };

  const saveRespawnOverride = (min: number | null) => {
    if (selected == null) return;
    const next = { ...respawnOverride };
    if (min == null || (boss && min === boss.respawn_min)) delete next[selected];
    else next[selected] = min;
    setRespawnOverride(next);
    try { localStorage.setItem(RESPAWN_OVERRIDE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const submit = async (channel: number, mins: number) => {
    if (!selected) return;
    setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/field-boss/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ boss_id: selected, channel, minutes_ago: mins }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "제보 실패");
      }
      setReportTarget(null);
      setMinutesAgo(0);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "제보 실패");
    }
  };

  // 셀 상태: killed(빨강, 카운트다운) → soon(노랑, 잔여 10% 이내) → spawned(초록) / unknown 주기는 경과만
  const cellState = (r: Report | undefined) => {
    if (!r) return { kind: "empty" as const };
    const serverNow = now + clockOffset.current;
    const elapsed = serverNow - new Date(r.killed_at).getTime();
    if (elapsed < 0 || elapsed > 12 * 3600_000) return { kind: "empty" as const };
    if (respawnMin == null) return { kind: "info" as const, r, elapsed };
    const total = respawnMin * 60000;
    const remain = total - elapsed;
    if (remain > total * 0.1) return { kind: "dead" as const, r, elapsed, remain };
    if (remain > 0) return { kind: "soon" as const, r, elapsed, remain };
    return { kind: "spawned" as const, r, elapsed };
  };

  /* 보드에 표시할 채널 — 기록이 있는 채널 + 지금 선택한 채널만 (채널 수가 241+로 가변이라 고정 그리드 대신 직접 등록) */
  const boardChannels = useMemo(() => {
    const chans = Object.keys(data?.channels ?? {})
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 1);
    if (reportTarget != null && !chans.includes(reportTarget)) chans.push(reportTarget);
    return chans.sort((a, b) => a - b);
  }, [data, reportTarget]);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 font-pixel">👑 필드보스 채널</h1>
      <p className="text-dim mb-4 text-sm">
        보스를 잡으면 채널을 눌러 기록하세요. 모두에게 실시간 공유되어 채널 로테이션에 참고할 수 있습니다.
        (기록은 24시간 뒤 자동으로 내려갑니다)
      </p>

      {/* 보스 선택 */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {bosses.map((b) => (
          <button
            key={b.id}
            onClick={() => selectBoss(b.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border-2 text-sm transition-colors ${
              b.id === selected
                ? "border-maple bg-maple text-white"
                : "border-edge bg-surface2 text-ink hover:border-maple"
            }`}
          >
            {b.icon_url && <img src={b.icon_url} alt="" className="w-5 h-5 object-contain" />}
            <span className="font-pixel text-xs">{b.name}</span>
            {b.level ? <span className={`text-[10px] ${b.id === selected ? "text-white/80" : "text-dim"}`}>Lv{b.level}</span> : null}
          </button>
        ))}
      </div>

      {boss && (
        <div className="pixel-panel p-3 mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            {boss.icon_url && <img src={boss.icon_url} alt={boss.name} className="w-9 h-9 object-contain" />}
            <div>
              <div className="font-pixel text-sm text-ink">{boss.name}</div>
              <div className="text-[11px] text-dim">
                Lv.{boss.level ?? "?"}
                {boss.maps && boss.maps.length > 0 && <> · 📍 {boss.maps.join(" · ")}</>}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-dim">
            젠 주기
            <input
              type="number"
              min={1}
              max={720}
              value={respawnMin ?? ""}
              placeholder="미확정"
              onChange={(e) => {
                const v = e.target.value.trim();
                saveRespawnOverride(v === "" ? null : Math.max(1, Math.min(720, Number(v))));
              }}
              className="pixel-input w-20 px-2 py-1 text-center"
            />
            분
            {boss.respawn_min != null && respawnOverride[boss.id] != null && (
              <button onClick={() => saveRespawnOverride(null)} className="text-maple hover:underline">기본값</button>
            )}
          </label>
          <span className="text-[11px] text-dim">
            {boss.respawn_min == null && respawnMin == null
              ? "젠 주기 미확정 — 경과 시간만 표시합니다. 아는 주기가 있다면 직접 입력하세요 (이 브라우저에만 저장)"
              : respawnOverride[boss.id] != null
                ? "직접 입력한 주기 기준 (이 브라우저에만 저장)"
                : "커뮤니티/원작 참고값 기준"}
          </span>
        </div>
      )}

      {/* 채널 보드 — 메랜 2.0 채널이 241+로 가변이라 고정 그리드 대신 '기록 있는 채널만' 표시.
          새 채널은 번호 직접 입력으로 선택 (같은 번호는 기존 카드 선택 — 중복 생성 없음) */}
      <div className="pixel-panel p-3 mb-2 max-w-xl">
        <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b-2 border-edge">
          <span className="font-pixel text-xs text-ink">CH</span>
          <input
            type="number"
            min={1}
            max={MAX_CHANNEL}
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && pickChannel()}
            placeholder="채널 번호"
            className="pixel-input w-24 px-2 py-1.5 text-sm text-center"
          />
          <button onClick={pickChannel} className="pixel-btn text-xs px-3 py-1.5">채널 선택</button>
          <span className="text-[11px] text-dim">번호를 입력해 바로 기록 — 이미 등록된 채널은 기존 카드가 선택됩니다 (CH 1~{MAX_CHANNEL})</span>
        </div>
        {boardChannels.length === 0 ? (
          <p className="text-xs text-dim py-3 text-center">
            아직 기록된 채널이 없어요 — 위에 채널 번호를 입력해 첫 처치 기록을 남겨보세요.
          </p>
        ) : (
        <div className="grid grid-cols-6 gap-1.5">
          {boardChannels.map((ch) => {
            const st = cellState(data?.channels?.[String(ch)]);
            const isSel = reportTarget === ch;
            const style =
              st.kind === "dead" ? "border-red-500/70 bg-red-500/10"
              : st.kind === "soon" ? "border-amber-500/80 bg-amber-500/10"
              : st.kind === "spawned" ? "border-green-600/70 bg-green-600/10"
              : st.kind === "info" ? "border-sky-500/50 bg-surface2"
              : "border-edge bg-surface2 hover:border-maple";
            return (
              <button
                key={ch}
                onClick={() => { setReportTarget(isSel ? null : ch); setMinutesAgo(0); }}
                className={`border-2 px-1 py-1.5 text-center transition-colors ${style} ${isSel ? "ring-2 ring-maple" : ""}`}
                title={st.kind !== "empty" ? `${fmtClock(st.r.killed_at)} 처치 · ${st.r.reporter || "익명"}` : "기록 없음"}
              >
                <div className="font-pixel text-xs text-ink leading-none">CH {ch}</div>
                <div className="font-pixel text-[9px] mt-1 leading-none min-h-[10px]">
                  {st.kind === "dead" && <span className="text-red-500">{fmtCountdown(st.remain)}</span>}
                  {st.kind === "soon" && <span className="text-amber-500">곧 젠</span>}
                  {st.kind === "spawned" && <span className="text-green-600">젠 추정</span>}
                  {st.kind === "info" && <span className="text-sky-600">{fmtElapsed(st.elapsed)}</span>}
                  {st.kind === "empty" && <span className="text-dim">-</span>}
                </div>
              </button>
            );
          })}
        </div>
        )}

        {/* 선택한 채널 액션 바 */}
        {reportTarget != null && (() => {
          const st = cellState(data?.channels?.[String(reportTarget)]);
          return (
            <div className="mt-2 border-t-2 border-edge pt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-pixel text-xs text-ink">CH {reportTarget}</span>
              {st.kind !== "empty" ? (
                <span className="text-[11px] text-dim">
                  {fmtClock(st.r.killed_at)} 처치 · {fmtElapsed(st.elapsed)} · {st.r.reporter || "익명"}
                </span>
              ) : (
                <span className="text-[11px] text-dim">기록 없음</span>
              )}
              <span className="mx-1 text-edge">|</span>
              <button onClick={() => submit(reportTarget, 0)} className="pixel-btn text-xs px-2.5 py-1">⚔️ 방금 처치</button>
              <span className="flex items-center gap-1 text-xs text-dim">
                <input
                  type="number" min={0} max={180} value={minutesAgo}
                  onChange={(e) => setMinutesAgo(Math.max(0, Math.min(180, Number(e.target.value))))}
                  className="pixel-input w-14 px-1 py-0.5 text-center"
                />
                <button onClick={() => submit(reportTarget, minutesAgo)} className="pixel-btn text-xs px-2 py-1">분 전 처치</button>
              </span>
              <button onClick={() => setReportTarget(null)} className="text-xs text-dim hover:text-ink px-1">✕ 닫기</button>
            </div>
          );
        })()}
      </div>
      {msg && <p className="text-xs text-red-500 mb-2">{msg}</p>}
      <p className="text-[11px] text-dim mb-6">
        🔴 리젠 대기 · 🟡 곧 젠 · 🟢 젠 추정 · 🔵 경과 시간(주기 미확정) — 카드를 누르면 처치 기록을 남길 수 있어요.
        같은 채널에 다시 기록하면 최신 기록이 우선됩니다 (중복 카드가 생기지 않아요).
        <span className="block mt-0.5">기록이 있는 채널만 표시됩니다 · 새 채널은 위 입력창에 번호를 넣어 등록하세요 (메랜 2.0 채널 수 가변 대응, 기록은 24시간 뒤 자동 정리)</span>
      </p>

      {/* 최근 제보 */}
      {data && data.recent.length > 0 && (
        <div className="pixel-panel p-4">
          <h2 className="font-pixel text-sm text-ink mb-2">📜 최근 제보</h2>
          <ul className="space-y-1 text-sm">
            {data.recent.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-dim">
                <span className="font-pixel text-xs text-ink w-14 shrink-0">CH {r.channel}</span>
                <span>{fmtClock(r.killed_at)} 처치</span>
                <span className="text-[11px]">· {r.reporter || "익명"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
