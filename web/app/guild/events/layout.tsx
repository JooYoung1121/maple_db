import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이벤트 모집 | 추억길드 메랜정보",
  description: "길드원이 직접 이벤트를 열고 지원받고, 마감 후 룰렛 추첨·클리어 처리까지.",
};

export default function GuildEventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
