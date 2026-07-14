import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "비매박제",
  description: "비매너 유저 제보",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
