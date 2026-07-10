"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getEvents, type EventGuideSummary } from "@/lib/api";

function periodLabel(e: EventGuideSummary): string {
  const start = e.period_start ?? "?";
  const end = e.period_end ?? (e.status === "active" ? "진행 중" : "?");
  return `${start} ~ ${end}`;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventGuideSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents()
      .then((d) => setEvents(d.events))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const active = events.filter((e) => e.status === "active");
  const ended = events.filter((e) => e.status === "ended");

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 font-pixel">🗂️ 이벤트 정리</h1>
      <p className="text-dim mb-6">
        진행 중인 이벤트의 핵심 정보를 한 페이지로 요약하고, 끝난 이벤트도 아카이브로 남깁니다.
        다음에 같은 이벤트가 돌아오면 여기서 바로 복습하세요.
      </p>

      {loading ? (
        <div className="text-center py-20 text-dim">
          <div className="w-8 h-8 border-2 border-maple border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          이벤트 정리 로딩 중...
        </div>
      ) : events.length === 0 ? (
        <div className="pixel-panel p-8 text-center text-dim">아직 정리된 이벤트가 없습니다.</div>
      ) : (
        <div className="space-y-6">
          {[{ label: "진행 중", list: active, live: true }, { label: "종료된 이벤트", list: ended, live: false }].map(
            ({ label, list, live }) =>
              list.length > 0 && (
                <section key={label}>
                  <h2 className="font-pixel text-sm text-ink mb-2">
                    {live ? "🔥" : "📦"} {label}
                  </h2>
                  <div className="space-y-2">
                    {list.map((e) => (
                      <Link
                        key={e.slug}
                        href={`/events/${e.slug}`}
                        className={`pixel-card flex items-center gap-3 p-4 group ${live ? "" : "opacity-80"}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-ink group-hover:text-maple transition-colors">
                              {e.title}
                            </span>
                            {e.world && (
                              <span className="font-pixel text-[10px] px-1.5 py-0.5 bg-surface2 border border-edge text-dim">
                                {e.world}
                              </span>
                            )}
                            {live && (
                              <span className="font-pixel text-[10px] px-1.5 py-0.5 bg-maple text-white border border-edge-lo">
                                진행 중
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-dim mt-0.5">{periodLabel(e)}</div>
                        </div>
                        <span className="text-dim shrink-0 group-hover:text-maple transition-colors">→</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )
          )}
        </div>
      )}
    </div>
  );
}
