import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "스킬 정보",
  description: "직업별 스킬 · 레벨별 효과",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
