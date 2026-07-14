import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "놀이터 — 룰렛 · 주사위",
  description: "룰렛 · 주사위 · 핀볼 · 사다리",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
