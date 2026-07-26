import type { Metadata } from "next";
import WeeklyArchiveClient from "./WeeklyArchiveClient";

export const metadata: Metadata = {
  title: { absolute: "주간 메랜 과월호 — 전체 발행 목록" },
  description: "주간 메랜의 지난 발행본을 표지와 발행 주차로 찾아봅니다.",
};

export default function WeeklyArchivePage() {
  return <WeeklyArchiveClient />;
}
