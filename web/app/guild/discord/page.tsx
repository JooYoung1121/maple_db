"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getDiscordStatus,
  getDiscordSettings,
  updateDiscordSettings,
  sendDiscordNotify,
} from "@/lib/api";

export default function DiscordBotPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");

  // 봇 상태
  const [online, setOnline] = useState(false);
  const [botUser, setBotUser] = useState<string | null>(null);

  // 설정
  const [channelId, setChannelId] = useState("");
  const [notifyMapleLand, setNotifyMapleLand] = useState(true);
  const [notifyGuildPost, setNotifyGuildPost] = useState(true);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // 수동 알림
  const [manualMsg, setManualMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // 봇 상태는 비밀번호 없이 조회
  const fetchStatus = useCallback(() => {
    getDiscordStatus()
      .then((d) => {
        setOnline(d.online);
        setBotUser(d.user);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("admin_pw");
    if (saved) {
      setPw(saved);
    }
    fetchStatus();
    const iv = setInterval(fetchStatus, 30_000);
    return () => clearInterval(iv);
  }, [fetchStatus]);

  const handleAuth = async () => {
    setError("");
    try {
      const s = await getDiscordSettings(pw);
      setChannelId(s.channel_id ?? "");
      setNotifyMapleLand(s.notify_maple_land === "true");
      setNotifyGuildPost(s.notify_guild_post === "true");
      setAuthed(true);
      localStorage.setItem("admin_pw", pw);
    } catch {
      setError("비밀번호가 틀렸습니다.");
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaved(false);
    try {
      await updateDiscordSettings(
        {
          channel_id: channelId,
          notify_maple_land: notifyMapleLand ? "true" : "false",
          notify_guild_post: notifyGuildPost ? "true" : "false",
        },
        pw,
      );
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "설정 저장 실패");
    }
  };

  const handleSendNotify = async () => {
    if (!manualMsg.trim()) return;
    setSending(true);
    setSent(false);
    try {
      await sendDiscordNotify(manualMsg.trim(), pw);
      setSent(true);
      setManualMsg("");
      setTimeout(() => setSent(false), 3000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "전송 실패");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">디스코드 봇 관리</h1>

      {/* 봇 상태 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-3">
        <span
          className={`w-3 h-3 rounded-full ${online ? "bg-green-500" : "bg-gray-400"}`}
        />
        <span className="text-sm font-medium text-gray-700">
          {online ? "온라인" : "오프라인"}
        </span>
        {botUser && (
          <span className="text-xs text-gray-400 ml-auto font-mono">{botUser}</span>
        )}
      </div>

      {/* 인증 */}
      {!authed ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="text-sm text-gray-600">설정을 변경하려면 관리자 비밀번호를 입력하세요.</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              placeholder="비밀번호"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
            />
            <button
              onClick={handleAuth}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              확인
            </button>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>
      ) : (
        <>
          {/* 설정 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">봇 설정</h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                알림 채널 ID
              </label>
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-orange-300 outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">메랜 공홈 공지 알림</span>
              <button
                onClick={() => setNotifyMapleLand(!notifyMapleLand)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifyMapleLand ? "bg-orange-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    notifyMapleLand ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">길드 게시판 알림</span>
              <button
                onClick={() => setNotifyGuildPost(!notifyGuildPost)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifyGuildPost ? "bg-orange-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    notifyGuildPost ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            <button
              onClick={handleSaveSettings}
              className="w-full bg-orange-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              {settingsSaved ? "저장 완료!" : "설정 저장"}
            </button>
          </div>

          {/* 수동 알림 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-gray-800">수동 알림 전송</h2>
            <textarea
              value={manualMsg}
              onChange={(e) => setManualMsg(e.target.value)}
              placeholder="디스코드 채널에 전송할 메시지를 입력하세요..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-orange-300 outline-none"
            />
            <button
              onClick={handleSendNotify}
              disabled={sending || !manualMsg.trim() || !online}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sent ? "전송 완료!" : sending ? "전송 중..." : "전송"}
            </button>
            {!online && (
              <p className="text-xs text-red-500">봇이 오프라인 상태에서는 전송할 수 없습니다.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
