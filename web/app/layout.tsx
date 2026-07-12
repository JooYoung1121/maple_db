import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./NavBar";
import { APP_VERSION } from "@/lib/version";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://memorymapledb.up.railway.app"),
  title: "추억길드 전용 메랜 관련 정보 조회 페이지",
  description: "추억길드 전용 메이플랜드 2.0 게임 데이터 통합 검색",
  icons: {
    icon: "/favicon-mascot.png",
    apple: "/apple-touch-mascot.png",
  },
  openGraph: {
    siteName: "추억길드 메랜DB",
    title: "추억길드 전용 메랜 관련 정보 조회 페이지",
    description: "추억길드 전용 메이플랜드 2.0 게임 데이터 통합 검색",
    images: ["/logo.png"],
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
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">{children}</main>
        <footer className="border-t-2 border-edge bg-surface mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-dim">
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
