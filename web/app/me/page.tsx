"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface MeUser {
  id: number;
  discord_id: string;
  username: string;
  global_name: string | null;
  avatar_url: string | null;
  guild_member: number;
  guild_nick: string | null;
  guild_roles: string[];
  site_nickname: string | null;
  display_name: string;
}

interface BrainChar {
  level: number;
  job?: string;
  subJob?: string;
  nickname?: string;
}

export default function MyPage() {
  const [user, setUser] = useState<MeUser | null | undefined>(undefined);
  const [brainChar, setBrainChar] = useState<BrainChar | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [nick, setNick] = useState("");
  const [nickBusy, setNickBusy] = useState(false);
  const [nickMsg, setNickMsg] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/config`).then((r) => r.json()).then((d) => setAuthEnabled(!!d.enabled)).catch(() => {});
    fetch(`${API_BASE}/api/auth/me`)
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user ?? null);
        if (d.user) {
          setNick(d.user.site_nickname || "");
          if (d.settings?.brain_char) setBrainChar(d.settings.brain_char);
        }
      })
      .catch(() => setUser(null));
  }, []);

  const saveNick = useCallback(() => {
    if (nickBusy) return;
    setNickBusy(true);
    setNickMsg("");
    fetch(`${API_BASE}/api/auth/me/nickname`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: nick }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail || "저장 실패");
        setNickMsg("저장됐어요! 댓글·게시판 닉네임에 바로 반영됩니다.");
        return fetch(`${API_BASE}/api/auth/me`).then((rr) => rr.json());
      })
      .then((d) => { if (d?.user) setUser(d.user); })
      .catch((e) => setNickMsg(String(e.message || e)))
      .finally(() => setNickBusy(false));
  }, [nick, nickBusy]);

  const logout = useCallback(async () => {
    try { await fetch(`${API_BASE}/api/auth/logout`, { method: "POST" }); } catch { /* ignore */ }
    window.location.href = "/";
  }, []);

  if (user === undefined) {
    return <div className="max-w-2xl mx-auto text-sm text-dim py-10 text-center">불러오는 중…</div>;
  }

  if (user === null) {
    return (
      <div className="max-w-md mx-auto">
        <div className="pixel-panel p-8 text-center mt-10">
          <h1 className="font-pixel text-xl font-bold mb-2">🍄 마이페이지</h1>
          <p className="text-sm text-dim mb-5">
            디스코드로 로그인하면 캐릭터·브레인 지도·댓글 닉네임이<br />계정에 저장되고 어느 기기에서든 유지됩니다.
          </p>
          {authEnabled ? (
            <a href="/api/auth/discord/login?next=/me" className="pixel-btn px-6 py-3 text-sm inline-block">
              디스코드로 로그인
            </a>
          ) : (
            <p className="text-xs text-dim">로그인 기능이 아직 설정되지 않았습니다.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="font-pixel text-2xl font-bold">🍄 마이페이지</h1>

      {/* 프로필 */}
      <div className="pixel-panel p-5">
        <div className="flex items-center gap-4">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-16 h-16 border-2 border-edge" style={{ imageRendering: "pixelated" }} />
          ) : (
            <span className="w-16 h-16 border-2 border-edge flex items-center justify-center text-3xl">🍄</span>
          )}
          <div>
            <p className="font-pixel text-lg font-bold text-ink">
              {user.display_name}
              {user.guild_member === 1 && (
                <span className="font-pixel ml-2 text-[10px] text-maple border border-maple px-1 align-middle">추억길드</span>
              )}
            </p>
            <p className="text-xs text-dim">디스코드: {user.global_name || user.username} (@{user.username})</p>
            {user.guild_nick && <p className="text-xs text-dim">길드 서버 별명: {user.guild_nick}</p>}
            {user.guild_roles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {user.guild_roles.map((r) => (
                  <span key={r} className="text-[10px] px-1.5 py-0.5 border border-edge text-dim">{r}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 표시 닉네임 */}
      <div className="pixel-panel p-5">
        <h2 className="font-pixel font-bold text-sm mb-1">✏️ 사이트 표시 닉네임</h2>
        <p className="text-xs text-dim mb-3">댓글·게시판·출석부에 표시되는 이름이에요. 비워두면 디스코드 이름(길드 서버 별명 우선)을 씁니다.</p>
        <div className="flex gap-2">
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value.slice(0, 12))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) saveNick(); }}
            placeholder={user.guild_nick || user.global_name || user.username}
            className="pixel-input flex-1 px-3 py-2 text-sm"
          />
          <button onClick={saveNick} disabled={nickBusy} className="pixel-btn px-4 py-2 text-sm disabled:opacity-50 shrink-0">
            {nickBusy ? "저장 중…" : "저장"}
          </button>
        </div>
        {nickMsg && <p className="text-xs text-maple mt-2">{nickMsg}</p>}
      </div>

      {/* 내 캐릭터 (브레인) */}
      <div className="pixel-panel p-5">
        <h2 className="font-pixel font-bold text-sm mb-3">⭐ 내 캐릭터</h2>
        {brainChar ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-ink">
              {brainChar.nickname && <span className="font-semibold">{brainChar.nickname} · </span>}
              Lv.{brainChar.level}{(brainChar.subJob || brainChar.job) ? ` ${brainChar.subJob || brainChar.job}` : ""}
            </p>
            <Link href="/brain" className="pixel-btn px-4 py-2 text-sm shrink-0">🧠 브레인에서 보기</Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-dim">아직 캐릭터를 설정하지 않았어요.</p>
            <Link href="/brain" className="pixel-btn px-4 py-2 text-sm shrink-0">🧠 브레인에서 설정</Link>
          </div>
        )}
      </div>

      {/* 바로가기 + 알림 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/my-maple" className="pixel-card p-4 block hover:border-maple transition-colors">
          <p className="font-pixel font-bold text-sm">🍁 내 메랜</p>
          <p className="text-xs text-dim mt-1">목표·즐겨찾기·최근 사용 기능</p>
        </Link>
        <div className="pixel-card p-4 opacity-70">
          <p className="font-pixel font-bold text-sm">🔔 알림 설정</p>
          <p className="text-xs text-dim mt-1">준비 중 — 새 주간 메랜·공지 디스코드 알림</p>
        </div>
      </div>

      <div className="text-right">
        <button onClick={logout} className="text-sm text-dim hover:text-red-500 font-pixel">로그아웃</button>
      </div>
    </div>
  );
}
