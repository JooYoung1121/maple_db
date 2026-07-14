import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "보스 도감",
  description: "메이플랜드 보스 정보",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
