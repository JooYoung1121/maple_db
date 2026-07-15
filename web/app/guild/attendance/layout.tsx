import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "길드 출석부",
  description: "추억길드 출석 체크 — 하루 한 번 출석 도장, 월간 랭킹과 연속 출석 기록.",
};

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
