import type { Metadata } from "next";
import WeeklyClient from "./WeeklyClient";

// 항상 요청 시 렌더 — 빌드 시점엔 API가 없어 OG 메타가 폴백으로 굳어버리는 것을 방지
export const dynamic = "force-dynamic";

// 서버 컴포넌트 래퍼 — /weekly 공유 시 최신호 제목·부제·표지가 미리보기로 뜨도록 OG 메타 생성
const INTERNAL_API = process.env.INTERNAL_API_URL || "http://localhost:8000";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://memorymapledb.up.railway.app").replace(/\/$/, "");

export async function generateMetadata(): Promise<Metadata> {
  const fallback: Metadata = {
    title: { absolute: "주간 메랜 — 주간 메이플랜드 신문" },
    description: "메이플랜드의 한 주를 신문으로 정리합니다.",
  };
  try {
    const res = await fetch(`${INTERNAL_API}/api/weekly-news/latest`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return fallback;
    const { issue } = await res.json();
    const content = typeof issue?.content === "string" ? JSON.parse(issue.content) : issue?.content;
    const title: string = issue?.title || content?.title || "주간 메랜";
    const description: string =
      content?.subtitle || content?.weather || "메이플랜드의 한 주를 신문으로 정리합니다.";
    const cover = `${SITE}/api/weekly-news/${issue.issue_no}/images/cover`;
    return {
      title: { absolute: title },
      description,
      openGraph: {
        title,
        description,
        type: "article",
        siteName: "주간 메랜",
        url: `${SITE}/weekly`,
        images: [{ url: cover, width: 1200, height: 630, alt: title }],
      },
      twitter: { card: "summary_large_image", title, description, images: [cover] },
    };
  } catch {
    return fallback;
  }
}

export default function WeeklyPage() {
  return <WeeklyClient />;
}
