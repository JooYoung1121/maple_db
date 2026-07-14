import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "오늘의 운세",
  description: "메이플 운세 보기",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
