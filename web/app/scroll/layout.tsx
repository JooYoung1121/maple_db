import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "주문서 계산기",
  description: "주문서 강화 시뮬레이터",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
