/**
 * 페이지별 사용 가이드 — 콘텐츠 정본은 web/data/pageGuides.json (경로 → 가이드).
 * 이 파일은 타입을 입힌 로더다. JSON이 정본인 이유: 디스코드 챗봇(파이썬)이
 * 같은 파일을 읽어 "○○ 어떻게 써?" 질문에 가이드 요약으로 답하기 때문.
 *
 * 새 페이지에 가이드를 붙이려면:
 *   1) web/data/pageGuides.json 에 "/경로" 항목 추가
 *      ("어떻게 입력하면 → 어떤 결과" 예시를 반드시 한 항목 이상 넣는 것이 규칙)
 *   2) 페이지 헤더에 <PageGuide guide={PAGE_GUIDES["/경로"]} /> 한 줄
 */
import guidesJson from "@/data/pageGuides.json";

export interface GuideItem {
  label?: string;
  text: string;
}

export interface GuideSection {
  heading: string;
  items: GuideItem[];
}

export interface PageGuideContent {
  title: string;
  intro: string;
  sections: GuideSection[];
  tip?: string;
}

export const PAGE_GUIDES = guidesJson as Record<string, PageGuideContent>;

// 기존 페이지들이 쓰는 이름 별칭 (정본은 PAGE_GUIDES)
export const HP_EXP_GUIDE = PAGE_GUIDES["/hp-exp"];
export const NHIT_GUIDE = PAGE_GUIDES["/nhit"];
export const DAMAGE_GUIDE = PAGE_GUIDES["/damage"];
export const SCROLL_GUIDE = PAGE_GUIDES["/scroll"];
export const GEAR_SIM_GUIDE = PAGE_GUIDES["/gear-sim"];
export const EXP_GUIDE = PAGE_GUIDES["/exp"];
export const DROP_SEARCH_GUIDE = PAGE_GUIDES["/drop-search"];
export const MARKET_GUIDE = PAGE_GUIDES["/market"];
