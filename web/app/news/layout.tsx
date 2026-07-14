import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "메랜 공홈 소식",
  description: "메이플랜드 공지 · 이벤트 · 패치노트",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
