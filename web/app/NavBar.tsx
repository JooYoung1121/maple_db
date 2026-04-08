"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { getNewsRecentCount } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

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
      { href: "/drop-search", label: "드롭 검색" },
    ],
  },
  {
    label: "계산기",
    items: [
      { href: "/scroll", label: "주문서 계산기" },
      { href: "/exp", label: "경험치 계산기" },
      { href: "/nhit", label: "엔방컷 계산기" },
      { href: "/fee", label: "수수료 계산기" },
    ],
  },
  {
    label: "가이드",
    items: [
      { href: "/pq", label: "파티퀘스트" },
      { href: "/hunt", label: "사냥터 추천" },
      { href: "/job", label: "전직 가이드" },
      { href: "/ship", label: "배 시간표" },
      { href: "/trap", label: "함정 타이머" },
    ],
  },
  {
    label: "커뮤니티",
    items: [
      { href: "/news", label: "메랜 공홈 소식" },
      { href: "/bimae", label: "비매박제" },
      { href: "/community", label: "투표" },
    ],
  },
  {
    label: "놀이터",
    items: [
      { href: "/play", label: "룰렛 · 주사위" },
      { href: "/lotto", label: "로또" },
      { href: "/fortune", label: "오늘의 운세" },
      { href: "/quiz", label: "메이플 퀴즈" },
    ],
  },
  {
    label: "추억길드",
    items: [
      { href: "/guild", label: "공지 · 이벤트" },
      { href: "/guild/members", label: "길드원 명단" },
      { href: "/guild/boss", label: "보스" },
      { href: "/guild/board", label: "자유게시판" },
      { href: "/guild/discord", label: "디스코드 봇" },
    ],
  },
];

function DropdownMenu({ category, isActive, closeMobileMenu, newsBadge = 0 }: {
  category: NavCategory;
  isActive: (href: string) => boolean;
  closeMobileMenu?: () => void;
  newsBadge?: number;
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
        className={`relative flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          hasActiveChild
            ? "bg-orange-50 dark:bg-orange-900/30 text-orange-600"
            : "text-gray-600 dark:text-gray-300 hover:text-orange-600 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
      >
        {category.label}
        {newsBadge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {newsBadge > 99 ? "99+" : newsBadge}
          </span>
        )}
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
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 min-w-[160px] z-50">
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
                  ? "bg-orange-50 dark:bg-orange-900/30 text-orange-600 font-medium"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-orange-600"
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
    // 같은 카테고리 내 형제 링크와 겹치지 않도록
    // 해당 href보다 더 구체적인 형제가 있으면 정확 일치만 허용
    const allHrefs = NAV_CATEGORIES.flatMap((c) => c.items.map((i) => i.href));
    const hasDeeperSibling = allHrefs.some((h) => h !== href && h.startsWith(href + "/"));
    if (hasDeeperSibling) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
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
                ? "bg-orange-50 dark:bg-orange-900/30 text-orange-600"
                : "text-gray-600 dark:text-gray-300 hover:text-orange-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            홈
          </Link>
          {NAV_CATEGORIES.map((cat) => (
            <DropdownMenu key={cat.label} category={cat} isActive={isActive} newsBadge={cat.label === "커뮤니티" ? newsBadge : 0} />
          ))}
          <ThemeToggle />
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-gray-600 dark:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 max-h-[80vh] overflow-y-auto">
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className={`block px-4 py-3 text-sm font-medium ${
              pathname === "/" ? "bg-orange-50 dark:bg-orange-900/30 text-orange-600" : "text-gray-600 dark:text-gray-300"
            }`}
          >
            홈
          </Link>
          {NAV_CATEGORIES.map((cat) => (
            <div key={cat.label} className="border-t border-gray-50 dark:border-gray-700">
              <button
                onClick={() =>
                  setMobileExpanded(mobileExpanded === cat.label ? null : cat.label)
                }
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium ${
                  cat.items.some((i) => isActive(i.href))
                    ? "text-orange-600"
                    : "text-gray-700 dark:text-gray-300"
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
                <div className="bg-gray-50 dark:bg-gray-900">
                  {cat.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`block px-8 py-2.5 text-sm ${
                        isActive(item.href)
                          ? "text-orange-600 font-medium"
                          : "text-gray-600 dark:text-gray-400"
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
