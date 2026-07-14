import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "혼테일 타이머",
  description: "혼테일 공대용 쿨타임 보드 — 비숍 리저렉션, 사망 팅, 파츠별 공무, 버프해제 타이머를 한 화면에서 관리하세요.",
};

export default function BossTimerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
