import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "대전 게임 — 오목",
  description: "길드원끼리 방 만들어 오목 대국 — 관전 자유, 방 코드로 초대",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
