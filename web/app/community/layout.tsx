import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "투표",
  description: "유저 투표",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
