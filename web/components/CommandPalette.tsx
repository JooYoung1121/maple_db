"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import SearchBar from "@/components/SearchBar";

const QUICK_LINKS = [
  { href: "/me", label: "🍄 마이페이지" },
  { href: "/drop-search", label: "🔎 획득 경로" },
  { href: "/weekly", label: "🗞️ 주간 메랜" },
  { href: "/events", label: "🗂️ 이벤트" },
  { href: "/exp", label: "📈 경험치" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input, textarea, select, [contenteditable='true']");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === "/" && !isTyping) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-30 pixel-btn px-3 py-2 text-xs"
        aria-label="통합 검색 열기"
      >
        검색 <span className="hidden sm:inline opacity-70">⌘K</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[80] bg-black/55 p-4 pt-[12vh]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="command-title" className="pixel-panel max-w-2xl mx-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 id="command-title" className="font-pixel text-sm text-maple">어디로 갈까요?</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-dim hover:text-maple px-2 py-1" aria-label="검색 닫기">✕</button>
            </div>
            <SearchBar large />
            <div className="mt-4 flex flex-wrap gap-2" aria-label="빠른 이동">
              {QUICK_LINKS.map((item) => (
                <Link key={item.href} href={item.href} className="pixel-card px-3 py-2 text-xs">{item.label}</Link>
              ))}
            </div>
            <p className="text-[10px] text-dim mt-4">어디서든 / 또는 Ctrl/⌘ + K로 열 수 있습니다.</p>
          </div>
        </div>
      )}
    </>
  );
}
