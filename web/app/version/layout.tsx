import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "버전 노트",
  description: "사이트 업데이트 내역",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
