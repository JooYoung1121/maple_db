import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "스킬 시뮬레이터",
  description: "직업별 스킬 트리 SP 배분 시뮬레이터",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
