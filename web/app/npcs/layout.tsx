import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NPC 도감",
  description: "메이플랜드 NPC 정보",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
