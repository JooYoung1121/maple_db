"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getDiscordStatus,
  getDiscordSettings,
  updateDiscordSettings,
  sendDiscordNotify,
  sendDiscordGuildPost,
} from "@/lib/api";

interface GuildPost {
  id: number;
  post_type: string;
  title: string;
  content: string | null;
  author: string;
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

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

  // 길드 게시글 전송
  const [guildPosts, setGuildPosts] = useState<GuildPost[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sendingPostId, setSendingPostId] = useState<number | null>(null);
  const [sentPostId, setSentPostId] = useState<number | null>(null);

  const fetchStatus = useCallback(() => {
    getDiscordStatus()
      .then((d) => {
        setOnline(d.online);
        setBotUser(d.user);
      })
      .catch(() => {});
  }, []);

  const fetchGuildPosts = useCallback(() => {
    fetch(`${API_BASE}/api/guild/posts?per_page=50`)
      .then((r) => r.json())
      .then((d) => setGuildPosts(d.posts ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("admin_pw");
    if (saved) setPw(saved);
    fetchStatus();
    fetchGuildPosts();
    const iv = setInterval(fetchStatus, 30_000);
    return () => clearInterval(iv);
  }, [fetchStatus, fetchGuildPosts]);

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

  const handleSendGuildPost = async (postId: number) => {
    setSendingPostId(postId);
    setSentPostId(null);
    try {
      await sendDiscordGuildPost(postId, pw);
      setSentPostId(postId);
      setTimeout(() => setSentPostId(null), 3000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "전송 실패");
    } finally {
      setSendingPostId(null);
    }
  };

  const typeLabel = (t: string) => (t === "announcement" ? "공지" : "이벤트");
  const typeBadge = (t: string) =>
    t === "announcement"
      ? "bg-orange-100 text-orange-700"
      : "bg-purple-100 text-purple-700";

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

          {/* 길드 게시글 전송 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-gray-800">길드 게시글 전송</h2>
            <p className="text-xs text-gray-500">게시글을 선택하면 내용을 확인할 수 있고, 디스코드 채널로 전송할 수 있습니다.</p>

            {guildPosts.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">등록된 게시글이 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                {guildPosts.map((post) => (
                  <div key={post.id}>
                    {/* 제목 행 — 클릭으로 펼치기 */}
                    <button
                      onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                        expandedId === post.id ? "bg-gray-50" : ""
                      }`}
                    >
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeBadge(post.post_type)}`}>
                        {typeLabel(post.post_type)}
                      </span>
                      <span className="text-sm text-gray-800 flex-1 truncate">{post.title}</span>
                      <svg
                        className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${
                          expandedId === post.id ? "rotate-180" : ""
                        }`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* 펼침 — 내용 + 전송 버튼 */}
                    {expandedId === post.id && (
                      <div className="px-3 pb-3 bg-gray-50 space-y-2">
                        <div className="text-xs text-gray-500 space-y-1 bg-white rounded-lg p-3 border border-gray-100">
                          <p><span className="font-medium text-gray-600">제목</span> : {post.title}</p>
                          <p><span className="font-medium text-gray-600">내용</span> : {post.content || "(내용 없음)"}</p>
                          <p><span className="font-medium text-gray-600">작성자</span> : {post.author}</p>
                        </div>
                        <button
                          onClick={() => handleSendGuildPost(post.id)}
                          disabled={!online || sendingPostId === post.id}
                          className="w-full bg-blue-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sentPostId === post.id
                            ? "전송 완료!"
                            : sendingPostId === post.id
                            ? "전송 중..."
                            : "디스코드로 전송"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 수동 알림 (자유 텍스트) */}
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
