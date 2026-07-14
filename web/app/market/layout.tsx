import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "시세",
  description: "아이템 시세 정보",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
