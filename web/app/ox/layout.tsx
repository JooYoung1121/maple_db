import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OX퀴즈 족보",
  description: "메이플랜드 3주년 토요일 OX퀴즈 문제·정답 검색",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
