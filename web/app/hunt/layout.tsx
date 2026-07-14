import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "사냥터 추천",
  description: "레벨별 사냥터 가이드",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
