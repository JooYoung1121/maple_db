import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "메랜 이상형 월드컵",
  description: "몬스터·아이템 이상형 월드컵 — 최애를 가리고 전체 통계로 비교",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
