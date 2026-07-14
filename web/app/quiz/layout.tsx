import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "메이플 퀴즈",
  description: "스피드퀴즈 연습 · 실루엣 퀴즈",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
