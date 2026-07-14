import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이벤트 정리",
  description: "진행 중 이벤트 요약 · 아카이브",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
