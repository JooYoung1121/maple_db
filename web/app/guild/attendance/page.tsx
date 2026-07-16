"use client";

import { useState, useEffect, useCallback } from "react";
import { checkInAttendance, getAttendanceToday, getAttendanceStats, getGuildMembers } from "@/lib/api";

export default function AttendancePage() {
  const [nickname, setNickname] = useState("");
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [today, setToday] = useState<{ date: string; checked_in: { nickname: string; created_at: string }[] } | null>(null);
  const [stats, setStats] = useState<{ month: string; ranking: { nickname: string; days: number }[]; my_days: string[]; streak: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const refresh = useCallback((nick: string) => {
    getAttendanceToday().then(setToday).catch(() => {});
    getAttendanceStats(undefined, nick || undefined).then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("guild_attendance_nickname") ?? "";
    setNickname(saved);
    refresh(saved);
    getGuildMembers({ per_page: 100 })
      .then((d) => setMemberNames(d.members.map((m) => m.nickname)))
      .catch(() => {});
  }, [refresh]);

  const checkIn = useCallback(() => {
    const nick = nickname.trim();
    if (!nick) { setMessage({ type: "err", text: "닉네임을 입력하세요" }); return; }
    setBusy(true);
    setMessage(null);
    checkInAttendance(nick)
      .then((res) => {
        localStorage.setItem("guild_attendance_nickname", nick);
        setMessage({ type: "ok", text: `${res.nickname}님 출석 완료! (${res.date})` });
        refresh(nick);
      })
      .catch((e) => setMessage({ type: "err", text: String(e.message) }))
      .finally(() => setBusy(false));
  }, [nickname, refresh]);

  const alreadyToday = !!today?.checked_in.some((c) => c.nickname === nickname.trim());

  /* 이번달 달력 그리드 */
  const calendar = (() => {
    if (!stats) return null;
    const [y, m] = stats.month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const startDow = first.getDay();
    const cells: (number | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    const mySet = new Set(stats.my_days.map((d) => Number(d.slice(8, 10))));
    return { cells, mySet };
  })();

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 font-pixel">📋 길드 출석부</h1>
      <p className="text-sm text-dim mb-6">하루 한 번(KST 자정 리셋) 출석 도장을 찍어보세요. 닉네임 기준으로 기록됩니다.</p>

      {/* 출석 체크 */}
      <div className="pixel-panel p-5 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 20))}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && checkIn()}
            placeholder="닉네임"
            list="guild-member-names"
            className="pixel-input px-3 py-2 text-sm w-44"
          />
          <datalist id="guild-member-names">
            {memberNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          <button
            onClick={checkIn}
            disabled={busy || alreadyToday}
            className="pixel-btn px-5 py-2 text-sm disabled:opacity-50"
          >
            {alreadyToday ? "오늘 출석 완료" : "출석하기"}
          </button>
          {stats && stats.streak > 0 && nickname.trim() && (
            <span className="text-sm text-maple font-pixel">🔥 {stats.streak}일 연속</span>
          )}
        </div>
        {message && (
          <p className={`text-sm mt-2 ${message.type === "ok" ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 오늘 출석자 */}
        <div className="pixel-panel p-5">
          <h2 className="font-pixel font-bold text-sm mb-3">
            오늘 출석 {today ? `(${today.checked_in.length}명)` : ""}
          </h2>
          {!today || today.checked_in.length === 0 ? (
            <p className="text-sm text-dim">아직 아무도 출석하지 않았습니다 — 1등을 노려보세요!</p>
          ) : (
            <ul className="space-y-1">
              {today.checked_in.map((c, i) => (
                <li key={c.nickname} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="text-dim mr-2">{i === 0 ? "🥇" : i + 1}</span>
                    {c.nickname}
                  </span>
                  <span className="text-xs text-dim font-mono">{c.created_at.slice(11, 16)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 내 달력 */}
        <div className="pixel-panel p-5">
          <h2 className="font-pixel font-bold text-sm mb-3">
            {stats ? `${Number(stats.month.slice(5))}월` : ""} 내 출석 달력
            {nickname.trim() && stats ? ` — ${stats.my_days.length}일` : ""}
          </h2>
          {!nickname.trim() ? (
            <p className="text-sm text-dim">닉네임을 입력하면 이번 달 출석 현황이 표시됩니다</p>
          ) : calendar ? (
            <div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-dim mb-1">
                {["일", "월", "화", "수", "목", "금", "토"].map((d) => <span key={d}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendar.cells.map((d, i) => (
                  <div
                    key={i}
                    className={`aspect-square flex items-center justify-center text-xs border ${
                      d === null
                        ? "border-transparent"
                        : calendar.mySet.has(d)
                        ? "border-maple bg-maple text-white font-bold"
                        : "border-edge text-dim"
                    }`}
                  >
                    {d ?? ""}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 이번달 랭킹 */}
      <div className="pixel-panel p-5 mt-6">
        <h2 className="font-pixel font-bold text-sm mb-3">이번 달 출석 랭킹</h2>
        {!stats || stats.ranking.length === 0 ? (
          <p className="text-sm text-dim">이번 달 출석 기록이 아직 없습니다</p>
        ) : (
          <div className="space-y-1.5">
            {stats.ranking.map((r, i) => (
              <div key={r.nickname} className="flex items-center gap-3 text-sm">
                <span className="w-7 text-dim">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
                <span className="flex-1 font-medium">{r.nickname}</span>
                <div className="flex-1 h-3 bg-surface2 overflow-hidden hidden sm:block">
                  <div
                    className="h-full bg-maple"
                    style={{ width: `${(r.days / Math.max(stats.ranking[0].days, 1)) * 100}%` }}
                  />
                </div>
                <span className="font-mono w-12 text-right">{r.days}일</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
