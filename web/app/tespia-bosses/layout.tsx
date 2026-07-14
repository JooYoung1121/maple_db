import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "2.0 보스 가이드",
  description: "카오스 자쿰 · 카오스 혼테일 · 핑크빈 · 마왕 발록",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
