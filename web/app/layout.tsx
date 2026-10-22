import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./NavBar";
import { APP_VERSION } from "@/lib/version";
import SiteActivityTracker from "@/components/SiteActivityTracker";
import CommandPalette from "@/components/CommandPalette";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://memorymapledb.up.railway.app"),
  // 페이지별 layout.tsx가 title을 지정하면 "오늘의 몬스터 — 추억길드 메랜DB" 형태로 조합된다.
  // openGraph에 title/description을 넣지 않아야 각 페이지의 title이 og:title로 내려간다.
  title: {
    default: "추억길드 메랜DB — 메이플랜드 정보 조회",
    template: "%s — 추억길드 메랜DB",
  },
  description: "추억길드 전용 메이플랜드 2.0 게임 데이터 통합 검색",
  icons: {
    icon: "/favicon-mascot.png",
    apple: "/apple-touch-mascot.png",
  },
  openGraph: {
    siteName: "추억길드 메랜DB",
    images: ["/mascot.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        {/* 픽셀 디스플레이: 갈무리 (OFL 1.1) · 본문: Pretendard (OFL) */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/galmuri@latest/dist/galmuri.css" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className="bg-bg text-ink min-h-screen flex flex-col"
        style={{ fontFamily: "Pretendard, system-ui, sans-serif" }}
      >
        <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
        <SiteActivityTracker />
        <NavBar />
        <CommandPalette />
        {/* xl 이상: 좌측 아이콘 레일(w-14) 공간 확보 */}
        <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full xl:pl-[15rem]">{children}</main>
        <footer className="border-t-2 border-edge bg-surface mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-dim xl:pl-[15rem]">
            <span className="flex items-center gap-1.5">
              <img src="/leaf.svg" alt="" className="w-3.5 h-3.5 opacity-70" />
              추억길드 전용 메이플랜드 2.0 정보 사이트
            </span>
            <a href="/version" className="font-pixel text-[11px] hover:text-maple transition-colors">
              v{APP_VERSION}
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
