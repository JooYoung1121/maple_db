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
  const [statusChannelId, setStatusChannelId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [channelOk, setChannelOk] = useState<boolean | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [channelHelp, setChannelHelp] = useState<string | null>(null);

  // 설정
  const [channelId, setChannelId] = useState("");
  const [notifyMapleLand, setNotifyMapleLand] = useState(true);
  const [notifyGuildPost, setNotifyGuildPost] = useState(true);
  const [notifyWeeklyNews, setNotifyWeeklyNews] = useState(true);
  const [mentionType, setMentionType] = useState("none");
  const [mentionRoleId, setMentionRoleId] = useState("");
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
        setStatusChannelId(d.channel_id ?? null);
        setChannelName(d.channel_name ?? null);
        setChannelOk(typeof d.channel_ok === "boolean" ? d.channel_ok : null);
        setChannelError(d.channel_error ?? null);
        setChannelHelp(d.channel_help ?? null);
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
      setNotifyWeeklyNews(s.notify_weekly_news !== "false");
      setMentionType(s.mention_type ?? "none");
      setMentionRoleId(s.mention_role_id ?? "");
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
          notify_weekly_news: notifyWeeklyNews ? "true" : "false",
          mention_type: mentionType,
          mention_role_id: mentionRoleId,
        },
        pw,
      );
      setSettingsSaved(true);
      fetchStatus();
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
      ? "bg-[color-mix(in_srgb,var(--c-maple)_18%,transparent)] text-maple"
      : "bg-purple-100 text-purple-700";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-ink font-pixel">디스코드 봇 관리</h1>

      {/* 봇 상태 */}
      <div className="pixel-panel p-5 flex items-center gap-3">
        <span
          className={`w-3 h-3 rounded-full ${online ? "bg-green-500" : "bg-gray-400"}`}
        />
        <span className="text-sm font-medium text-ink">
          {online ? "온라인" : "오프라인"}
        </span>
        {botUser && (
          <span className="text-xs text-dim ml-auto font-mono">{botUser}</span>
        )}
      </div>

      <div className="pixel-panel p-5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-ink">알림 채널</span>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              !statusChannelId
                ? "bg-surface2 text-dim"
                : channelOk
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
            }`}
          >
            {!statusChannelId ? "미설정" : channelOk ? "연결됨" : "오류"}
          </span>
        </div>
        {statusChannelId && (
          <p className="text-xs text-dim font-mono break-all">
            {channelName ? `${channelName} (${statusChannelId})` : statusChannelId}
          </p>
        )}
        {channelError && (
          <p className="text-xs text-red-500 break-words">{channelError}</p>
        )}
        {channelHelp && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {channelHelp}
          </div>
        )}
      </div>

      {/* 인증 */}
      {!authed ? (
        <div className="pixel-panel p-5 space-y-3">
          <p className="text-sm text-dim">설정을 변경하려면 관리자 비밀번호를 입력하세요.</p>
          <div className="flex gap-2">
            <input
              type="password"
              autoComplete="off"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              placeholder="비밀번호"
              className="pixel-input flex-1 px-3 py-2 text-sm"
            />
            <button
              onClick={handleAuth}
              className="pixel-btn px-4 py-2 text-sm font-pixel"
            >
              확인
            </button>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>
      ) : (
        <>
          {/* 설정 */}
          <div className="pixel-panel p-5 space-y-4">
            <h2 className="text-base font-semibold text-ink font-pixel">봇 설정</h2>

            <div>
              <label className="block text-xs font-medium text-dim mb-1">
                알림 채널 ID
              </label>
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="pixel-input w-full px-3 py-2 text-sm font-mono"
              />
              <p className="mt-1 text-[11px] leading-5 text-dim">
                디스코드 개발자 모드에서 텍스트 채널을 우클릭한 뒤 ID를 복사하세요. 봇은 해당 서버에 초대되어 있어야 하고 채널 보기, 메시지 보내기, 임베드 링크 권한이 필요합니다.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-ink">메랜 공홈 공지 알림</span>
              <button
                onClick={() => setNotifyMapleLand(!notifyMapleLand)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifyMapleLand ? "bg-maple" : "bg-gray-300"
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
              <span className="text-sm text-ink">길드 게시판 알림</span>
              <button
                onClick={() => setNotifyGuildPost(!notifyGuildPost)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifyGuildPost ? "bg-maple" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    notifyGuildPost ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-ink">주간 메랜 알림 (발행 리마인더·새 호)</span>
              <button
                onClick={() => setNotifyWeeklyNews(!notifyWeeklyNews)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifyWeeklyNews ? "bg-maple" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    notifyWeeklyNews ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            <div className="border-t border-edge/40 pt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-dim mb-1">
                  알림 멘션
                </label>
                <select
                  value={mentionType}
                  onChange={(e) => setMentionType(e.target.value)}
                  className="pixel-input w-full px-3 py-2 text-sm"
                >
                  <option value="none">멘션 없음</option>
                  <option value="everyone">@everyone (전체)</option>
                  <option value="here">@here (온라인)</option>
                  <option value="role">특정 역할 멘션</option>
                </select>
              </div>

              {mentionType === "role" && (
                <div>
                  <label className="block text-xs font-medium text-dim mb-1">
                    역할 ID
                  </label>
                  <input
                    type="text"
                    value={mentionRoleId}
                    onChange={(e) => setMentionRoleId(e.target.value)}
                    placeholder="디스코드 역할 ID 입력"
                    className="pixel-input w-full px-3 py-2 text-sm font-mono"
                  />
                  <p className="text-[11px] text-dim mt-1">
                    서버 설정 → 역할 → 우클릭 → ID 복사
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleSaveSettings}
              className="pixel-btn w-full py-2 text-sm font-pixel"
            >
              {settingsSaved ? "저장 완료!" : "설정 저장"}
            </button>
          </div>

          {/* 길드 게시글 전송 */}
          <div className="pixel-panel p-5 space-y-3">
            <h2 className="text-base font-semibold text-ink font-pixel">길드 게시글 전송</h2>
            <p className="text-xs text-dim">게시글을 선택하면 내용을 확인할 수 있고, 디스코드 채널로 전송할 수 있습니다.</p>

            {guildPosts.length === 0 ? (
              <p className="text-sm text-dim py-4 text-center">등록된 게시글이 없습니다.</p>
            ) : (
              <div className="divide-y divide-edge/40 border-2 border-edge overflow-hidden max-h-[400px] overflow-y-auto">
                {guildPosts.map((post) => (
                  <div key={post.id}>
                    {/* 제목 행 — 클릭으로 펼치기 */}
                    <button
                      onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] transition-colors ${
                        expandedId === post.id ? "bg-surface2" : ""
                      }`}
                    >
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeBadge(post.post_type)}`}>
                        {typeLabel(post.post_type)}
                      </span>
                      <span className="text-sm text-ink flex-1 truncate">{post.title}</span>
                      <svg
                        className={`w-4 h-4 text-dim shrink-0 transition-transform ${
                          expandedId === post.id ? "rotate-180" : ""
                        }`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* 펼침 — 내용 + 전송 버튼 */}
                    {expandedId === post.id && (
                      <div className="px-3 pb-3 bg-surface2 space-y-2">
                        <div className="text-xs text-dim space-y-1 bg-surface p-3 border-2 border-edge">
                          <p><span className="font-medium text-ink">제목</span> : {post.title}</p>
                          <p><span className="font-medium text-ink">내용</span> : {post.content || "(내용 없음)"}</p>
                          <p><span className="font-medium text-ink">작성자</span> : {post.author}</p>
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
          <div className="pixel-panel p-5 space-y-3">
            <h2 className="text-base font-semibold text-ink font-pixel">수동 알림 전송</h2>
            <textarea
              value={manualMsg}
              onChange={(e) => setManualMsg(e.target.value)}
              placeholder="디스코드 채널에 전송할 메시지를 입력하세요..."
              rows={3}
              className="pixel-input w-full px-3 py-2 text-sm resize-none"
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
