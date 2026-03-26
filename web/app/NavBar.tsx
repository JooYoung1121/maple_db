"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { getNewsRecentCount } from "@/lib/api";

interface NavCategory {
  label: string;
  items: { href: string; label: string }[];
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    label: "정보",
    items: [
      { href: "/items", label: "아이템" },
      { href: "/mobs", label: "몬스터" },
      { href: "/bosses", label: "보스" },
      { href: "/maps", label: "맵" },
      { href: "/npcs", label: "NPC" },
      { href: "/quests", label: "퀘스트" },
      { href: "/skills", label: "스킬" },
    ],
  },
  {
    label: "계산기",
    items: [
      { href: "/scroll", label: "주문서 계산기" },
      { href: "/fee", label: "수수료 계산기" },
      { href: "/exp", label: "경험치 계산기" },
      { href: "/nhit", label: "엔방컷 계산기" },
    ],
  },
  {
    label: "가이드",
    items: [
      { href: "/pq", label: "파티퀘스트" },
    ],
  },
  {
    label: "커뮤니티",
    items: [
      { href: "/bimae", label: "비매박제" },
      { href: "/community", label: "투표 / 룰렛" },
    ],
  },
];

function DropdownMenu({ category, isActive, closeMobileMenu }: {
  category: NavCategory;
  isActive: (href: string) => boolean;
  closeMobileMenu?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const hasActiveChild = category.items.some((item) => isActive(item.href));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          hasActiveChild
            ? "bg-orange-50 text-orange-600"
            : "text-gray-600 hover:text-orange-600 hover:bg-gray-50"
        }`}
      >
        {category.label}
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px] z-50">
          {category.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                setOpen(false);
                closeMobileMenu?.();
              }}
              className={`block px-4 py-2.5 text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-orange-50 text-orange-600 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-orange-600"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [newsBadge, setNewsBadge] = useState(0);

  useEffect(() => {
    function fetchBadge() {
      const lastVisit = localStorage.getItem("news_last_visit") ?? "";
      getNewsRecentCount(lastVisit || undefined)
        .then((d) => setNewsBadge(d.count))
        .catch(() => {});
    }
    fetchBadge();
    // /news 방문 시 localStorage 갱신 → 뱃지 초기화
    window.addEventListener("storage", fetchBadge);
    return () => window.removeEventListener("storage", fetchBadge);
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="text-lg font-bold text-orange-500 shrink-0">
          추억길드 메랜 정보
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive("/") && pathname === "/"
                ? "bg-orange-50 text-orange-600"
                : "text-gray-600 hover:text-orange-600 hover:bg-gray-50"
            }`}
          >
            홈
          </Link>
          {NAV_CATEGORIES.map((cat) => (
            <DropdownMenu key={cat.label} category={cat} isActive={isActive} />
          ))}
          <Link
            href="/news"
            className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive("/news")
                ? "bg-orange-50 text-orange-600"
                : "text-gray-600 hover:text-orange-600 hover:bg-gray-50"
            }`}
          >
            공지
            {newsBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {newsBadge > 99 ? "99+" : newsBadge}
              </span>
            )}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white max-h-[80vh] overflow-y-auto">
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className={`block px-4 py-3 text-sm font-medium ${
              pathname === "/" ? "bg-orange-50 text-orange-600" : "text-gray-600"
            }`}
          >
            홈
          </Link>
          <Link
            href="/news"
            onClick={() => setMenuOpen(false)}
            className={`flex items-center justify-between px-4 py-3 text-sm font-medium border-t border-gray-50 ${
              isActive("/news") ? "bg-orange-50 text-orange-600" : "text-gray-600"
            }`}
          >
            <span>공지</span>
            {newsBadge > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {newsBadge > 99 ? "99+" : newsBadge}
              </span>
            )}
          </Link>
          {NAV_CATEGORIES.map((cat) => (
            <div key={cat.label} className="border-t border-gray-50">
              <button
                onClick={() =>
                  setMobileExpanded(mobileExpanded === cat.label ? null : cat.label)
                }
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium ${
                  cat.items.some((i) => isActive(i.href))
                    ? "text-orange-600"
                    : "text-gray-700"
                }`}
              >
                <span>{cat.label}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    mobileExpanded === cat.label ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mobileExpanded === cat.label && (
                <div className="bg-gray-50">
                  {cat.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`block px-8 py-2.5 text-sm ${
                        isActive(item.href)
                          ? "text-orange-600 font-medium"
                          : "text-gray-600"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
