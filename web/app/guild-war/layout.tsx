import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "샤레니안 길드대항전 공략",
  description:
    "메이플랜드 길드대항전(샤레니안 길드퀘스트) 공략 — 스테이지별 플레이 방식 · 인원수별 상자 구역 배분 · 제물 맞추기(야구게임) 솔버 · 분배금 정산기",
};

export default function GuildWarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
