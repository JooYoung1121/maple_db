import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "엔방컷 계산기",
  description: "몬스터 젠컷 계산",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
