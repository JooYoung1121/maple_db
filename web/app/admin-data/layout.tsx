import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "관리자 데이터",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminDataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
