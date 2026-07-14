import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "오늘의 몬스터",
  description: "매일 바뀌는 몬스터 추리 게임",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
