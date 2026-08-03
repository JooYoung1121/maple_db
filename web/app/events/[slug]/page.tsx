"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getEvent, updateEvent, type EventGuide, type EventGuideSection } from "@/lib/api";
import MonsterParkCalc from "./MonsterParkCalc";

// 이벤트별 인터랙티브 위젯 — 새 이벤트에 계산기 등이 필요하면 여기에 slug로 등록한다.
const EVENT_WIDGETS: Record<string, React.ComponentType> = {
  "monster-park-2026": MonsterParkCalc,
};

function SectionBlock({ section }: { section: EventGuideSection }) {
  return (
    <section className="pixel-panel p-4">
      <h2 className="font-pixel text-sm text-ink mb-3">{section.heading}</h2>
      {section.body && (
        <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{section.body}</p>
      )}
      {section.table && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {section.table.headers.map((h) => (
                  <th key={h} className="font-pixel text-xs text-dim text-left px-3 py-2 border-2 border-edge bg-surface2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={`px-3 py-2 border-2 border-edge ${j === row.length - 1 ? "text-maple font-medium" : "text-ink"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.note && <p className="text-[11px] text-dim mt-2 leading-relaxed">※ {section.note}</p>}
    </section>
  );
}

function AdminEditor({ event, onSaved }: { event: EventGuide; onSaved: () => void }) {
  const [pw, setPw] = useState("");
  const [contentJson, setContentJson] = useState(() => JSON.stringify(event.content, null, 2));
  const [status, setStatus] = useState(event.status);
  const [periodEnd, setPeriodEnd] = useState(event.period_end ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    try {
      JSON.parse(contentJson);
    } catch {
      setMsg("content JSON 형식이 올바르지 않습니다.");
      return;
    }
    try {
      await updateEvent(event.slug, {
        slug: event.slug,
        title: event.title,
        world: event.world,
        status,
        period_start: event.period_start,
        period_end: periodEnd || null,
        source_post_id: event.source_post_id,
        content_json: contentJson,
      }, pw);
      setMsg("저장 완료");
      onSaved();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장 실패");
    }
  };

  return (
    <div className="pixel-panel p-4 space-y-2">
      <h3 className="font-pixel text-sm text-ink">정리본 수정 (관리자)</h3>
      <div className="flex flex-wrap gap-2 text-sm">
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder="관리자 비밀번호" className="pixel-input px-3 py-2 w-40" />
        <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "ended")} className="pixel-input px-3 py-2">
          <option value="active">진행 중</option>
          <option value="ended">종료</option>
        </select>
        <input value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
          placeholder="종료일 (YYYY-MM-DD)" className="pixel-input px-3 py-2 w-44" />
      </div>
      <textarea
        value={contentJson}
        onChange={(e) => setContentJson(e.target.value)}
        rows={16}
        className="pixel-input w-full px-3 py-2 font-mono text-xs"
        spellCheck={false}
      />
      <div className="flex items-center gap-3">
        <button onClick={save} className="px-4 py-2 pixel-btn text-sm">저장</button>
        {msg && <span className="text-xs text-maple">{msg}</span>}
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  const params = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);

  const load = useCallback(() => {
    if (!params?.slug) return;
    getEvent(params.slug)
      .then((d) => setEvent(d.event))
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [params?.slug]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="text-center py-20 text-dim">
        <div className="w-8 h-8 border-2 border-maple border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        이벤트 정리 로딩 중...
      </div>
    );
  }
  if (!event) {
    return (
      <div className="max-w-3xl mx-auto pixel-panel p-8 text-center text-dim">
        이벤트 정리를 찾을 수 없습니다. <Link href="/events" className="text-maple underline">목록으로</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/events" className="font-pixel text-xs text-dim hover:text-maple">← 이벤트 정리 목록</Link>
      <div className="flex items-start justify-between mt-2 mb-1">
        <h1 className="text-2xl font-bold font-pixel">{event.title}</h1>
        <button
          onClick={() => setShowAdmin(!showAdmin)}
          className="font-pixel text-xs text-dim hover:text-maple px-2 py-1 shrink-0"
          title="정리본 수정"
        >
          ⚙
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-5 text-xs text-dim">
        {event.world && (
          <span className="font-pixel text-[10px] px-1.5 py-0.5 bg-surface2 border border-edge">{event.world}</span>
        )}
        {event.status === "active" ? (
          <span className="font-pixel text-[10px] px-1.5 py-0.5 bg-maple text-white border border-edge-lo">진행 중</span>
        ) : (
          <span className="font-pixel text-[10px] px-1.5 py-0.5 border-2 border-edge">종료</span>
        )}
        <span>{event.period_start ?? "?"} ~ {event.period_end ?? (event.status === "active" ? "진행 중" : "?")}</span>
        <span>· 정리 갱신 {event.updated_at?.slice(0, 10)}</span>
      </div>

      {showAdmin && (
        <div className="mb-5">
          <AdminEditor event={event} onSaved={load} />
        </div>
      )}

      <div className="space-y-4">
        {/* 핵심 요약 */}
        {event.content.tldr?.length > 0 && (
          <section className="pixel-panel p-4 border-maple">
            <h2 className="font-pixel text-sm text-maple mb-2">⚡ 핵심 요약</h2>
            <ul className="space-y-1.5">
              {event.content.tldr.map((t, i) => (
                <li key={i} className="text-sm text-ink leading-relaxed flex gap-2">
                  <span className="text-maple shrink-0">▸</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 이벤트별 위젯 (계산기 등) */}
        {(() => {
          const Widget = EVENT_WIDGETS[event.slug];
          return Widget ? <Widget /> : null;
        })()}

        {event.content.sections?.map((s, i) => (
          <SectionBlock key={i} section={s} />
        ))}

        {/* 출처·관련 링크 */}
        {event.content.links?.length > 0 && (
          <section className="pixel-panel p-4">
            <h2 className="font-pixel text-sm text-ink mb-2">🔗 출처 · 관련 링크</h2>
            <ul className="space-y-1">
              {event.content.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-maple hover:underline break-all">
                    {l.label} ↗
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-dim mt-3">
              커뮤니티 정리 수치는 유저 실측 기반이라 패치에 따라 달라질 수 있습니다. 잘못된 정보 제보는 길드 디스코드로 부탁드려요.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
