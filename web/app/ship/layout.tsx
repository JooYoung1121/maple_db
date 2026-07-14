import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "배 시간표",
  description: "정기선 운항 시간",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
