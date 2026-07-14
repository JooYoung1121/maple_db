import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "스트리머 · 유튜버",
  description: "메랜 방송 · 영상 · 커뮤니티 모음",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
