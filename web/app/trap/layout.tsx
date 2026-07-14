import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "함정 타이머",
  description: "함정 주기 타이머",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
