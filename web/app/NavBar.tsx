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
    <nav aria-label="주요 메뉴" className="bg-surface border-b-2 border-edge sticky top-0 z-40 shadow-[0_2px_0_var(--c-border-lo)]">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="font-pixel flex items-center gap-2 text-base text-maple shrink-0 hover:text-maple-hi transition-colors">
          <img src="/leaf.svg" alt="" className="w-5 h-5" />
          추억길드 메랜정보
        </Link>

        {/* Desktop */}
        <div className="hidden xl:flex items-center gap-0.5">
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
          {SITE_SECTIONS.map((cat) =>
            cat.items.length === 1 ? (
              // 단독 카테고리(브레인 등)는 드롭다운 대신 바로가기 링크로
              <Link
                key={cat.label}
                href={cat.items[0].href}
                className={`font-pixel relative px-3 py-2 text-[13px] transition-colors ${
                  isActive(cat.items[0].href) ? "text-maple" : "text-dim hover:text-maple"
                }`}
              >
                {cat.items[0].icon} {cat.label}
                {isNewFeature(cat.items[0].href) && (
                  <span className="font-pixel absolute -top-0.5 -right-0.5 text-[9px] text-mush border border-mush px-0.5">N</span>
                )}
              </Link>
            ) : (
              <DropdownMenu key={cat.label} category={cat} isActive={isActive} newsBadge={cat.label === "커뮤니티" ? newsBadge : 0} />
            )
          )}
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
  );
}
