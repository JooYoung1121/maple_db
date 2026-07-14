import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "추억길드",
  description: "길드 공지 · 명단 · 보스 · 게시판",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
