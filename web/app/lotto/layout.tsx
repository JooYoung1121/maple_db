import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로또",
  description: "랜덤 번호 생성",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
