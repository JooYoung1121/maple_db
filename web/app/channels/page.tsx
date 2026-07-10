"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getChannels, getChannelsLive, getCommunityHot, getChannelsAdmin,
  createChannel, updateChannel, deleteChannel, refreshChannelVideos,
  type ChannelEntry, type ChannelVideo, type CommunityHotPost, type ChannelPayload,
} from "@/lib/api";

const CATEGORY_ORDER = ["stream", "youtube", "blog", "community", "discord"] as const;
const CATEGORY_META: Record<string, { label: string; icon: string; desc: string }> = {
  stream: { label: "방송", icon: "📡", desc: "치지직 · SOOP 라이브 채널" },
  youtube: { label: "유튜브", icon: "🎬", desc: "메랜 콘텐츠 · 공략 영상" },
  blog: { label: "블로그", icon: "📝", desc: "공략 · 정보 블로그" },
  community: { label: "커뮤니티", icon: "💬", desc: "갤러리 · 게시판" },
  discord: { label: "디스코드", icon: "🎧", desc: "디스코드 서버" },
};

const EMPTY_FORM: ChannelPayload = {
  category: "stream", name: "", platform: "", url: "", channel_key: "",
  description: "", tags: "", sort_order: 0, is_active: 1,
};

function fmtDate(s: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function LiveBadge({ state }: { state: boolean | null | undefined }) {
  if (state === true) {
    return (
      <span className="font-pixel inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-red-600 text-white border border-edge-lo">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        LIVE
      </span>
    );
  }
  if (state === false) {
    return <span className="font-pixel px-1.5 py-0.5 text-[10px] text-dim border-2 border-edge">OFF</span>;
  }
  return null;
}

/* ── 채널 한 줄 (편성표) ── */
function ChannelRow({ ch, index, live, videos }: {
  ch: ChannelEntry;
  index: number;
  live?: boolean | null;
  videos?: ChannelVideo[];
}) {
  return (
    <div className="pixel-card">
      <a href={ch.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 group">
        <span className="font-pixel text-xs text-maple w-12 shrink-0">
          CH.{String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-ink group-hover:text-maple transition-colors">{ch.name}</span>
            {ch.platform && (
              <span className="font-pixel text-[10px] px-1.5 py-0.5 bg-surface2 border border-edge text-dim">{ch.platform}</span>
            )}
            <LiveBadge state={live} />
          </div>
          {ch.description && <div className="text-xs text-dim truncate mt-0.5">{ch.description}</div>}
        </div>
        {ch.tags && (
          <div className="hidden sm:flex gap-1 shrink-0">
            {ch.tags.split(",").slice(0, 3).map((t) => (
              <span key={t} className="font-pixel text-[10px] text-dim">#{t.trim()}</span>
            ))}
          </div>
        )}
        <span className="text-dim shrink-0">↗</span>
      </a>
      {videos && videos.length > 0 && (
        <div className="border-t-2 border-edge px-3 py-2 space-y-1">
          {videos.map((v) => (
            <a
              key={v.video_id}
              href={v.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs group/video"
            >
              <span className="font-pixel text-[10px] text-mush shrink-0">NEW</span>
              <span className="flex-1 min-w-0 truncate text-dim group-hover/video:text-maple transition-colors">
                {v.title}
              </span>
              <span className="text-[10px] text-dim shrink-0">{fmtDate(v.published_at)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 관리자 패널 ── */
function AdminPanel({ onChanged }: { onChanged: () => void }) {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<ChannelEntry[]>([]);
  const [form, setForm] = useState<ChannelPayload>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (password: string) => {
    const d = await getChannelsAdmin(password);
    setItems(d.channels);
  }, []);

  const login = async () => {
    try {
      await load(pw);
      setAuthed(true);
      setMsg(null);
    } catch {
      setMsg("비밀번호가 틀립니다.");
    }
  };

  const submit = async () => {
    try {
      if (editId !== null) await updateChannel(editId, form, pw);
      else await createChannel(form, pw);
      setForm(EMPTY_FORM);
      setEditId(null);
      await load(pw);
      onChanged();
      setMsg("저장 완료");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장 실패");
    }
  };

  const remove = async (id: number) => {
    if (!confirm("이 채널을 삭제할까요?")) return;
    try {
      await deleteChannel(id, pw);
      await load(pw);
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const refreshVideos = async () => {
    setMsg("영상 수집 중...");
    try {
      const r = await refreshChannelVideos(pw);
      setMsg(`영상 수집 완료 (${r.updated_channels}개 채널)`);
      onChanged();
    } catch {
      setMsg("영상 수집 실패");
    }
  };

  if (!authed) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          placeholder="관리자 비밀번호"
          className="px-3 py-2 pixel-input text-sm w-44"
        />
        <button onClick={login} className="px-4 py-2 pixel-btn text-sm">확인</button>
        {msg && <span className="text-xs text-red-500">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-pixel text-sm text-ink">채널 관리</h3>
        <button onClick={refreshVideos} className="px-3 py-1.5 pixel-card font-pixel text-xs text-dim">
          유튜브 영상 지금 수집
        </button>
      </div>
      {msg && <p className="text-xs text-maple">{msg}</p>}

      {/* 입력 폼 */}
      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="pixel-input px-3 py-2"
        >
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>{CATEGORY_META[c].label}</option>
          ))}
        </select>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="이름 *" className="pixel-input px-3 py-2" />
        <input value={form.platform ?? ""} onChange={(e) => setForm({ ...form, platform: e.target.value })}
          placeholder="플랫폼 (치지직/SOOP/유튜브...)" className="pixel-input px-3 py-2" />
        <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="URL *" className="pixel-input px-3 py-2" />
        <input value={form.channel_key ?? ""} onChange={(e) => setForm({ ...form, channel_key: e.target.value })}
          placeholder="채널 키 (치지직 채널ID/SOOP ID — LIVE 표시용)" className="pixel-input px-3 py-2" />
        <input value={form.tags ?? ""} onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="태그 (쉼표 구분)" className="pixel-input px-3 py-2" />
        <input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="한 줄 설명" className="pixel-input px-3 py-2 sm:col-span-2" />
        <div className="flex items-center gap-3">
          <input type="number" value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
            placeholder="정렬" className="pixel-input px-3 py-2 w-24" title="정렬 순서" />
          <label className="flex items-center gap-1 text-xs text-dim">
            <input type="checkbox" checked={form.is_active === 1}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })} />
            노출
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={submit} className="flex-1 px-4 py-2 pixel-btn text-sm">
            {editId !== null ? "수정 저장" : "채널 추가"}
          </button>
          {editId !== null && (
            <button onClick={() => { setEditId(null); setForm(EMPTY_FORM); }}
              className="px-3 py-2 pixel-card font-pixel text-xs text-dim">
              취소
            </button>
          )}
        </div>
      </div>

      {/* 목록 */}
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {items.map((ch) => (
          <div key={ch.id} className={`flex items-center gap-2 text-xs px-2 py-1.5 pixel-card ${ch.is_active ? "" : "opacity-50"}`}>
            <span className="font-pixel text-[10px] text-dim w-16 shrink-0">{CATEGORY_META[ch.category]?.label ?? ch.category}</span>
            <span className="flex-1 truncate text-ink">{ch.name}</span>
            <span className="text-dim truncate hidden sm:block max-w-40">{ch.channel_key ?? ""}</span>
            <button
              onClick={() => {
                setEditId(ch.id);
                setForm({
                  category: ch.category, name: ch.name, platform: ch.platform ?? "", url: ch.url,
                  channel_key: ch.channel_key ?? "", description: ch.description ?? "",
                  tags: ch.tags ?? "", sort_order: ch.sort_order, is_active: ch.is_active,
                });
              }}
              className="font-pixel text-[10px] text-dim hover:text-maple shrink-0"
            >
              수정
            </button>
            <button onClick={() => remove(ch.id)} className="font-pixel text-[10px] text-red-500 shrink-0">삭제</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelEntry[]>([]);
  const [videos, setVideos] = useState<Record<string, ChannelVideo[]>>({});
  const [live, setLive] = useState<Record<string, boolean | null>>({});
  const [hot, setHot] = useState<CommunityHotPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);

  const load = useCallback(() => {
    getChannels()
      .then((d) => {
        setChannels(d.channels);
        setVideos(d.videos);
      })
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
    // 라이브 상태·인기글은 비차단 로드
    getChannelsLive().then((d) => setLive(d.live)).catch(() => {});
    getCommunityHot().then((d) => setHot(d.posts)).catch(() => setHot([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, ChannelEntry[]>();
    for (const ch of channels) {
      const list = map.get(ch.category) ?? [];
      list.push(ch);
      map.set(ch.category, list);
    }
    return map;
  }, [channels]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-2">
        <h1 className="text-2xl font-bold font-pixel">📺 메랜 채널 가이드</h1>
        <button
          onClick={() => setShowAdmin(!showAdmin)}
          className="font-pixel text-xs text-dim hover:text-maple px-2 py-1"
          title="채널 관리"
        >
          ⚙ 관리
        </button>
      </div>
      <p className="text-dim mb-6">
        메이플랜드 스트리머 · 유튜브 · 블로그 · 커뮤니티를 한 곳에서. 라이브 중인 채널은 <span className="font-pixel text-[11px] text-red-500">LIVE</span> 표시가 켜집니다.
      </p>

      {showAdmin && (
        <div className="pixel-panel p-4 mb-6">
          <AdminPanel onChanged={load} />
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-dim">
          <div className="w-8 h-8 border-2 border-maple border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          채널 정보 로딩 중...
        </div>
      ) : channels.length === 0 ? (
        <div className="pixel-panel p-8 text-center text-dim">등록된 채널이 없습니다.</div>
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.map((cat) => {
            const list = grouped.get(cat);
            if (!list || list.length === 0) return null;
            const meta = CATEGORY_META[cat];
            return (
              <section key={cat} className="pixel-panel p-4">
                <div className="flex items-baseline gap-2 mb-3">
                  <h2 className="font-pixel text-sm text-ink">{meta.icon} {meta.label}</h2>
                  <span className="text-xs text-dim">{meta.desc}</span>
                </div>
                <div className="space-y-1.5">
                  {list.map((ch, i) => (
                    <ChannelRow
                      key={ch.id}
                      ch={ch}
                      index={i}
                      live={cat === "stream" ? live[String(ch.id)] : undefined}
                      videos={cat === "youtube" ? videos[String(ch.id)] : undefined}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {/* 디시 인기글 위젯 */}
          {hot.length > 0 && (
            <section className="pixel-panel p-4">
              <div className="flex items-baseline gap-2 mb-3">
                <h2 className="font-pixel text-sm text-ink">🔥 이번 주 갤러리 인기글</h2>
                <span className="text-xs text-dim">디시 메이플랜드 갤러리 · 최근 7일</span>
              </div>
              <div className="space-y-1">
                {hot.map((p) => (
                  <a
                    key={p.url}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-2 py-1.5 pixel-card text-sm group"
                  >
                    {p.is_recommended === 1 && (
                      <span className="font-pixel text-[10px] text-maple shrink-0">개념</span>
                    )}
                    <span className="flex-1 min-w-0 truncate text-ink group-hover:text-maple transition-colors">
                      {p.title}
                    </span>
                    <span className="font-pixel text-[10px] text-dim shrink-0">
                      추천 {p.recommends ?? 0} · 조회 {p.views ?? 0}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <p className="text-[11px] text-dim">
            채널 추천이나 등록 요청은 길드 디스코드로 알려주세요. 외부 링크는 각 플랫폼에서 열립니다.
          </p>
        </div>
      )}
    </div>
  );
}
