import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "수수료 계산기",
  description: "거래 수수료 계산",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
