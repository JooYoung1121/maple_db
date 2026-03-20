import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import NavBar from "./NavBar";

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "추억길드 전용 메랜 관련 정보 조회 페이지",
  description: "추억길드 전용 메이플랜드 게임 데이터 통합 검색",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${notoSansKR.variable} font-sans bg-gray-50 text-gray-900 min-h-screen`}>
        <NavBar />
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
