"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { getNewsRecentCount } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import { isNewFeature } from "@/lib/newFeatures";
import { SITE_SECTIONS, type SiteSection } from "@/lib/siteFeatures";

interface AuthUser {
  display_name: string;
  avatar_url: string | null;
  guild_member: number;
}

function AuthChip({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/config").then((r) => r.json()).then((d) => setEnabled(!!d.enabled)).catch(() => {});
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setUser(d.user ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    setUser(null);
    setOpen(false);
    onNavigate?.();
  }

  if (user) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={`font-pixel flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-ink hover:text-maple transition-colors ${compact ? "w-full" : ""}`}
        >
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-6 h-6 border-2 border-edge" style={{ imageRendering: "pixelated" }} />
          ) : (
            <span className="w-6 h-6 border-2 border-edge flex items-center justify-center text-[10px]">🍄</span>
          )}
          <span className="max-w-[90px] truncate">{user.display_name}</span>
          {user.guild_member === 1 && <span className="text-[9px] text-maple border border-maple px-0.5">길드</span>}
        </button>
        {open && (
          <div className="pixel-panel absolute top-full right-0 mt-2 py-1 min-w-[130px] z-50 bg-surface">
            <Link
              href="/me"
              onClick={() => { setOpen(false); onNavigate?.(); }}
              className="block px-4 py-2 text-sm text-ink hover:text-maple"
            >
              🍄 마이페이지
            </Link>
            <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-ink hover:text-maple">
              로그아웃
            </button>
          </div>
        )}
      </div>
    );
  }
  if (!enabled) return null;
  return (
    <a
      href={`/api/auth/discord/login?next=${encodeURIComponent(pathname || "/")}`}
      className="font-pixel px-3 py-2 text-[12px] text-dim hover:text-maple transition-colors whitespace-nowrap"
    >
      로그인
    </a>
  );
}

// ─── 좌측 아이콘 레일 (데스크톱) ───
const RAIL_GROUPS: string[][] = [
  ["브레인", "마이"],
  ["정보", "계산기", "전문기술", "가이드"],
  ["커뮤니티", "놀이터"],
  ["유물창고", "추억길드"],
];

function railBtnCls(active: boolean): string {
  return `relative w-10 h-10 my-0.5 flex items-center justify-center border-2 transition-colors shrink-0 ${
    active
      ? "border-maple bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]"
      : "border-transparent hover:border-edge"
  }`;
}

function SideRail({ isActive, newsBadge }: { isActive: (href: string) => boolean; newsBadge: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => { setOpen(null); }, [pathname]);
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setOpen(null);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const byLabel = new Map(SITE_SECTIONS.map((s) => [s.label, s]));
  const openSection = open ? byLabel.get(open) : null;

  return (
    <aside
      ref={railRef}
      aria-label="카테고리 레일"
      className="hidden xl:flex fixed left-0 top-14 bottom-0 w-14 bg-surface border-r-2 border-edge z-30 flex-col items-center py-2 overflow-y-auto"
    >
      <Link href="/" title="홈" aria-label="홈" className={railBtnCls(pathname === "/")}>
        <span className="text-lg leading-none">🏠</span>
      </Link>
      {RAIL_GROUPS.map((group, gi) => (
        <div key={gi} className="w-full flex flex-col items-center">
          <div className="w-6 border-t border-edge/70 my-1.5" />
          {group.map((label) => {
            const sec = byLabel.get(label);
            if (!sec) return null;
            const active = sec.items.some((i) => isActive(i.href));
            const hasNew = sec.items.some((i) => isNewFeature(i.href));
            const badge = label === "커뮤니티" ? newsBadge : 0;
            const inner = (
              <>
                <span className="text-lg leading-none">{sec.icon}</span>
                {badge > 0 && (
                  <span className="font-pixel absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 bg-mush text-white text-[8px] flex items-center justify-center border border-edge-lo">
                    {badge > 99 ? "99" : badge}
                  </span>
                )}
                {badge === 0 && hasNew && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-mush rounded-full" />
                )}
              </>
            );
            if (sec.items.length === 1) {
              return (
                <Link key={label} href={sec.items[0].href} title={label} aria-label={label} className={railBtnCls(active)}>
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={label}
                title={label}
                aria-label={label}
                aria-expanded={open === label}
                onClick={(e) => {
                  if (open === label) { setOpen(null); return; }
                  const top = (e.currentTarget as HTMLElement).getBoundingClientRect().top;
                  setFlyoutTop(Math.max(60, Math.min(top, window.innerHeight - 420)));
                  setOpen(label);
                }}
                className={railBtnCls(active || open === label)}
              >
                {inner}
              </button>
            );
          })}
        </div>
      ))}

      {/* 플라이아웃 */}
      {openSection && (
        <div
          className="pixel-panel fixed left-14 ml-1.5 py-1 min-w-[190px] max-h-[75vh] overflow-y-auto bg-surface z-50"
          style={{ top: flyoutTop }}
        >
          <p className="font-pixel text-[11px] text-dim px-4 pt-2 pb-1 border-b border-edge/50">
            {openSection.icon} {openSection.label}
          </p>
          {openSection.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(null)}
              className={`block px-4 py-2 text-sm transition-colors ${
                isActive(item.href)
                  ? "text-maple font-semibold bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)]"
                  : "text-ink hover:text-maple hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
              }`}
            >
              <span className="mr-1.5">{item.icon}</span>
              {item.label}
              {isNewFeature(item.href) && (
                <span className="font-pixel ml-1.5 text-[9px] text-mush border border-mush px-1 align-middle">N</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}

function DropdownMenu({ category, isActive, closeMobileMenu, newsBadge = 0 }: {
  category: SiteSection;
  isActive: (href: string) => boolean;
  closeMobileMenu?: () => void;
  newsBadge?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = `nav-${category.label.replace(/\s/g, "-")}`;

  const hasActiveChild = category.items.some((item) => isActive(item.href));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
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
        <div id={menuId} role="menu" className="pixel-panel absolute top-full left-0 mt-2 py-1 min-w-[190px] z-50">
          {category.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              aria-current={isActive(item.href) ? "page" : undefined}
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
              {isNewFeature(item.href) && (
                <span className="font-pixel ml-1.5 text-[9px] text-mush border border-mush px-1 align-middle">N</span>
              )}
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
    const allHrefs = SITE_SECTIONS.flatMap((c) => c.items.map((i) => i.href));
    const hasDeeperSibling = allHrefs.some((h) => h !== href && h.startsWith(href + "/"));
    if (hasDeeperSibling) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
    <nav aria-label="주요 메뉴" className="bg-surface border-b-2 border-edge sticky top-0 z-40 shadow-[0_2px_0_var(--c-border-lo)]">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="font-pixel flex items-center gap-2 text-base text-maple shrink-0 hover:text-maple-hi transition-colors">
          <img src="/leaf.svg" alt="" className="w-5 h-5" />
          추억길드 메랜정보
        </Link>

        {/* Desktop — 카테고리는 좌측 레일로 이동, 상단은 계정·테마만 */}
        <div className="hidden xl:flex items-center gap-1">
          <AuthChip />
          <ThemeToggle />
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-1 xl:hidden">
          <AuthChip compact />
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 text-dim hover:text-maple"
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
          >
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
        <div id="mobile-navigation" className="xl:hidden border-t-2 border-edge bg-surface max-h-[80vh] overflow-y-auto">
          <Link
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
            className={`font-pixel block px-4 py-3 text-[13px] ${
              pathname === "/" ? "text-maple" : "text-dim"
            }`}
          >
            홈
          </Link>
          {SITE_SECTIONS.map((cat) =>
            cat.items.length === 1 ? (
              <Link
                key={cat.label}
                href={cat.items[0].href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(cat.items[0].href) ? "page" : undefined}
                className={`font-pixel block border-t border-edge/60 px-4 py-3 text-[13px] ${
                  isActive(cat.items[0].href) ? "text-maple" : "text-ink"
                }`}
              >
                {cat.items[0].icon} {cat.label}
                {isNewFeature(cat.items[0].href) && (
                  <span className="font-pixel ml-1.5 text-[9px] text-mush border border-mush px-1 align-middle">N</span>
                )}
              </Link>
            ) : (
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
                aria-expanded={mobileExpanded === cat.label}
                aria-controls={`mobile-${cat.label.replace(/\s/g, "-")}`}
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
                <div id={`mobile-${cat.label.replace(/\s/g, "-")}`} className="bg-bg">
                  {cat.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={isActive(item.href) ? "page" : undefined}
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
            )
          )}
        </div>
      )}
    </nav>
    <SideRail isActive={isActive} newsBadge={newsBadge} />
    </>
  );
}
