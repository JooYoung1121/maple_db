import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "경험치 계산기",
  description: "레벨업 경험치 계산",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
