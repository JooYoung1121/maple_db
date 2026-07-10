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
      { href: "/skill-sim", label: "스킬 시뮬레이터" },
    ],
  },
  {
    label: "전문기술",
    items: [
      { href: "/maker", label: "메이커" },
    ],
  },
  {
    label: "가이드",
    items: [
      { href: "/pq", label: "파티퀘스트" },
      { href: "/hunt", label: "사냥터 추천" },
      { href: "/leveling", label: "직업별 사냥터" },
      { href: "/tespia-bosses", label: "2.0 보스" },
      { href: "/events", label: "이벤트 정리" },
      { href: "/job", label: "전직 가이드" },
      { href: "/ship", label: "배 시간표" },
      { href: "/trap", label: "함정 타이머" },
    ],
  },
  {
    label: "커뮤니티",
    items: [
      { href: "/news", label: "공홈 · 테스피아 소식" },
      { href: "/weekly", label: "주간 메랜" },
      { href: "/channels", label: "스트리머 · 유튜버" },
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
      { href: "/daily-mob", label: "오늘의 몬스터" },
    ],
  },
  {
    label: "추억길드",
    items: [
      { href: "/guild", label: "공지 · 이벤트" },
      { href: "/guild/members", label: "길드원 명단" },
      { href: "/guild/boss", label: "보스" },
      { href: "/guild/board", label: "자유게시판" },
      { href: "/guild/info", label: "정보공유" },
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
        className={`font-pixel relative flex items-center gap-1 px-3 py-2 text-[13px] transition-colors ${
          hasActiveChild
            ? "text-maple"
            : "text-dim hover:text-maple"
        }`}
      >
        {category.label}
        {newsBadge > 0 && (
          <span className="font-pixel absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-mush text-white text-[9px] flex items-center justify-center border border-edge-lo">
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
        <div className="pixel-panel absolute top-full left-0 mt-2 py-1 min-w-[170px] z-50">
          {category.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                setOpen(false);
                closeMobileMenu?.();
              }}
              className={`block px-4 py-2 text-sm transition-colors ${
                isActive(item.href)
                  ? "text-maple font-semibold bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]"
                  : "text-ink hover:text-maple hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
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
    <nav className="bg-surface border-b-2 border-edge sticky top-0 z-40 shadow-[0_2px_0_var(--c-border-lo)]">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="font-pixel flex items-center gap-2 text-base text-maple shrink-0 hover:text-maple-hi transition-colors">
          <img src="/leaf.svg" alt="" className="w-5 h-5" />
          추억길드 메랜정보
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-0.5">
          <Link
            href="/"
            className={`font-pixel px-3 py-2 text-[13px] transition-colors ${
              isActive("/") && pathname === "/"
                ? "text-maple"
                : "text-dim hover:text-maple"
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
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-dim hover:text-maple">
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
        <div className="md:hidden border-t-2 border-edge bg-surface max-h-[80vh] overflow-y-auto">
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className={`font-pixel block px-4 py-3 text-[13px] ${
              pathname === "/" ? "text-maple" : "text-dim"
            }`}
          >
            홈
          </Link>
          {NAV_CATEGORIES.map((cat) => (
            <div key={cat.label} className="border-t border-edge/60">
              <button
                onClick={() =>
                  setMobileExpanded(mobileExpanded === cat.label ? null : cat.label)
                }
                className={`font-pixel w-full flex items-center justify-between px-4 py-3 text-[13px] ${
                  cat.items.some((i) => isActive(i.href))
                    ? "text-maple"
                    : "text-ink"
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
                <div className="bg-bg">
                  {cat.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`block px-8 py-2.5 text-sm ${
                        isActive(item.href)
                          ? "text-maple font-semibold"
                          : "text-dim"
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
