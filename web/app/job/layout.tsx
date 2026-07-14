import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "전직 가이드",
  description: "직업별 전직 경로",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
