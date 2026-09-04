import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "보스 타이머 (혼테일 · 카오스 자쿰)",
  description: "혼테일·카오스 자쿰 공대용 쿨타임 보드 — 리저렉션, 단체유혹, 공무, 버프해제 타이머를 반복 알림·음성(TTS)·PIP와 함께 공대원과 실시간 공유하세요.",
};

export default function BossTimerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
