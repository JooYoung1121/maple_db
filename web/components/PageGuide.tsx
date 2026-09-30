"use client";

import { useCallback, useEffect, useState } from "react";
import type { PageGuideContent } from "@/lib/pageGuides";

/**
 * 페이지 사용 가이드 — 우측 슬라이드 패널.
 * 트리거 버튼("사용 가이드")과 패널이 한 몸이라 페이지 헤더에 한 줄로 붙인다:
 *   <PageGuide guide={HP_EXP_GUIDE} autoOpenKey="hp-exp" />
 * autoOpenKey를 주면 첫 방문 시 자동으로 열린다 (localStorage guide_seen_<key>).
 */
export default function PageGuide({
  guide,
  autoOpenKey,
}: {
  guide: PageGuideContent;
  autoOpenKey?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!autoOpenKey) return;
    try {
      const key = `guide_seen_${autoOpenKey}`;
      if (!window.localStorage.getItem(key)) {
        window.localStorage.setItem(key, new Date().toISOString());
        setOpen(true);
      }
    } catch {
      /* 저장소 접근 불가 환경에서는 자동 오픈 생략 */
    }
  }, [autoOpenKey]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pixel-btn px-3 py-1.5 text-xs"
        aria-haspopup="dialog"
      >
        ❔ 사용 가이드
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={close}
          aria-hidden
        />
      )}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={guide.title}
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform overflow-y-auto border-l-2 border-edge bg-surface p-6 shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-pixel text-base font-bold text-ink">{guide.title}</h2>
          <button
            onClick={close}
            aria-label="가이드 닫기"
            className="pixel-btn px-2 py-1 text-sm leading-none"
          >
            ✕
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-dim">{guide.intro}</p>

        {guide.sections.map((section) => (
          <section key={section.heading} className="mt-5">
            <h3 className="font-pixel text-sm font-bold text-maple">{section.heading}</h3>
            <ul className="mt-2 space-y-2">
              {section.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-dim">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-maple" aria-hidden />
                  <span>
                    {item.label && (
                      <span className="font-semibold text-ink">{item.label} — </span>
                    )}
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {guide.tip && (
          <div className="mt-6 rounded-lg border border-maple/50 bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] p-3">
            <p className="text-xs font-semibold text-ink">💡 알아두면 좋아요</p>
            <p className="mt-1 text-xs leading-relaxed text-dim">{guide.tip}</p>
          </div>
        )}
      </aside>
    </>
  );
}
