import type { Metadata } from "next";
import WeeklyIssueClient from "./IssueClient";

// 서버 컴포넌트 래퍼 — 카톡/디스코드 링크 미리보기용 OG 메타(호별 제목·부제·표지)를 생성한다.
// 컨테이너 안에서 API는 localhost:8000 (next.config rewrites와 동일한 가정)
const INTERNAL_API = process.env.INTERNAL_API_URL || "http://localhost:8000";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://memorymapledb.up.railway.app").replace(/\/$/, "");

export async function generateMetadata(
  { params }: { params: Promise<{ issueNo: string }> }
): Promise<Metadata> {
  const { issueNo } = await params;
  const fallback: Metadata = {
    title: "주간 메랜 — 주간 메이플랜드 신문",
    description: "메이플랜드의 한 주를 신문으로 정리합니다.",
  };
  if (!/^\d+$/.test(issueNo)) return fallback;
  try {
    const res = await fetch(`${INTERNAL_API}/api/weekly-news/${issueNo}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return fallback;
    const { issue } = await res.json();
    const content = typeof issue?.content === "string" ? JSON.parse(issue.content) : issue?.content;
    const title: string = issue?.title || content?.title || `주간 메랜 제${issueNo}호`;
    const description: string =
      content?.subtitle || content?.weather || "메이플랜드의 한 주를 신문으로 정리합니다.";
    const cover = `${SITE}/api/weekly-news/${issueNo}/images/cover`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "article",
        siteName: "주간 메랜",
        url: `${SITE}/weekly/${issueNo}`,
        images: [{ url: cover, alt: title }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [cover],
      },
    };
  } catch {
    return fallback;
  }
}

export default function WeeklyIssuePage() {
  return <WeeklyIssueClient />;
}
