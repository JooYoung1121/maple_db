import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "필드보스 채널 | 추억길드 메랜정보",
  description: "필드보스를 잡은 채널·시각을 공유하고 채널 로테이션에 참고하세요.",
};

export default function FieldBossLayout({ children }: { children: React.ReactNode }) {
  return children;
}
