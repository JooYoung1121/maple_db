import type { Metadata } from "next";
import Link from "next/link";
import UsageFlow from "@/components/UsageFlow";
import GuideShare from "@/components/GuideShare";
import { MARKET_REQUEST_GUIDE, USAGE_FLOWS } from "@/lib/usageGuide";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://memorymapledb.up.railway.app").replace(/\/$/, "");
const TITLE = "메랜 할 때, 이렇게 써보세요";
const DESCRIPTION = "검색·보스와 사냥 타이머·장비 비교부터 시뮬레이터, 주간 메랜, 놀이터까지. 필요한 기능만 골라 보는 추억길드 메랜DB 사용 안내.";
export const metadata: Metadata = {
  title: TITLE, description: DESCRIPTION,
  alternates: { canonical: `${SITE}/guide` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE}/guide`, type: "website", siteName: "추억길드 메랜DB", images: [{ url: `${SITE}/mascot.png`, alt: "추억길드 메랜DB" }] },
};

const GROUPS = [
  { id: "find", number: "01", title: "플레이하면서 바로 꺼내 쓰기", description: "궁금한 정보와 챙겨야 할 시간을 먼저.", flows: ["search", "timers"] },
  { id: "equipment", number: "02", title: "장비 맞추기 전에 한 번 더", description: "매물을 비교하고, 주문서와 제작은 가상으로 경험해 보세요.", flows: ["market", "scrolls", "crafting"] },
  { id: "together", number: "03", title: "소식도, 길드원과의 이야기도", description: "놓친 소식을 따라잡고 필요한 자료를 나누세요.", flows: ["news", "community"] },
  { id: "rest", number: "04", title: "잠깐 쉬어가는 시간", description: "대기 중이거나 심심할 때 가볍게 한 판.", flows: ["play"] },
];

export default function GuidePage() {
  return <div className="mx-auto max-w-4xl space-y-10 pb-8 sm:space-y-14">
    <header className="relative overflow-hidden rounded-2xl border-2 border-edge bg-surface p-5 sm:p-9">
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-maple/10" />
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <p className="font-pixel text-xs text-maple">추억길드 메랜DB · 사용 안내</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot.png" alt="" width={64} height={64} className="h-14 w-14 object-contain [image-rendering:pixelated] sm:h-16 sm:w-16" />
        </div>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">메랜 할 때,<br /><span className="text-maple">이렇게 써보세요</span></h1>
        <p className="mt-4 max-w-lg text-sm leading-7 text-dim sm:text-base">전부 익힐 필요는 없어요.<br />궁금한 게 생기거나 도움이 필요할 때, 하나씩 꺼내 쓰세요.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-edge bg-surface2 px-3 py-2">필요한 기능만 펼쳐보기</span>
          <span className="rounded-full border border-edge bg-surface2 px-3 py-2">3단계 화면 예시</span>
          <a href="#share" className="rounded-full border border-maple/40 px-3 py-2 text-maple hover:underline">카톡으로 알려주기 ↗</a>
        </div>
      </div>
    </header>

    <section aria-labelledby="guide-start-title">
      <h2 id="guide-start-title" className="text-xl font-bold">처음엔 이 세 가지부터</h2>
      <p className="mt-2 text-sm text-dim">지금 필요한 것을 누르면 사용 흐름이 펼쳐집니다.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">{[
        { id: "search", icon: "🔍", title: "어디서 나오지?", text: "아이템·몬스터·드롭 찾기" },
        { id: "timers", icon: "⏱️", title: "버프 시간 됐나?", text: "보스·사냥 타이머" },
        { id: "market", icon: "💰", title: "이 장비 살 만할까?", text: "매물 검색·옵션 비교" },
      ].map(card => <a key={card.id} href={`#${card.id}`} className="pixel-card flex items-center gap-4 p-4 sm:block sm:p-5">
        <span aria-hidden="true" className="text-3xl">{card.icon}</span><span className="flex-1 sm:mt-4 sm:block"><span className="block font-bold">{card.title}</span><span className="mt-1 block text-xs text-dim">{card.text}</span></span><span className="text-sm text-maple sm:mt-4 sm:block">사용법 보기 →</span>
      </a>)}</div>
    </section>

    <nav aria-label="사용 안내 목차" className="flex flex-wrap gap-2 border-y border-edge/60 py-4">
      {GROUPS.map(group => <a key={group.id} href={`#${group.id}`} className="rounded-lg bg-surface px-3 py-3 text-xs font-semibold hover:text-maple">{group.number} {group.id === "find" ? "검색·타이머" : group.id === "equipment" ? "장비·시뮬레이터" : group.id === "together" ? "소식·커뮤니티" : "놀이터"}</a>)}
      <a href="#market-updates" className="rounded-lg bg-surface px-3 py-3 text-xs text-dim hover:text-maple">매물은 언제 갱신되나요?</a>
    </nav>

    {GROUPS.map(group => <section key={group.id} id={group.id} aria-labelledby={`${group.id}-heading`} className="scroll-mt-24 space-y-4">
      <div className="flex items-start gap-3"><span className="pt-1 font-pixel text-sm text-maple">{group.number}</span><div><h2 id={`${group.id}-heading`} className="text-xl font-bold">{group.title}</h2><p className="mt-1 text-sm leading-relaxed text-dim">{group.description}</p></div></div>
      {group.flows.map(id => <UsageFlow key={id} flow={USAGE_FLOWS.find(flow => flow.id === id)!} />)}
    </section>)}

    <section id="market-updates" aria-labelledby="market-updates-heading" className="scroll-mt-24 space-y-4">
      <div><p className="text-xs font-semibold text-maple">아이템 시세 · 자주 묻는 질문</p><h2 id="market-updates-heading" className="mt-2 text-xl font-bold">매물은 언제 다시 가져오나요?</h2><p className="mt-2 text-sm leading-7 text-dim">화면을 켜두어도 자동 갱신하지 않습니다. 검색 버튼이나 표의 정렬 화살표를 누를 때 결과를 다시 요청합니다.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">{MARKET_REQUEST_GUIDE.map(([action, result, detail]) => <div key={action} className="rounded-xl border border-edge bg-surface p-4"><h3 className="text-sm font-semibold">{action}</h3><p className="mt-2 text-sm font-semibold text-maple">{result}</p><p className="mt-2 text-xs leading-6 text-dim">{detail}</p></div>)}</div>
      <details className="rounded-xl border border-edge bg-surface p-4"><summary className="cursor-pointer text-sm font-semibold">정렬할 때 왜 다시 조회하나요?</summary><p className="mt-3 text-sm leading-7 text-dim">검색 결과는 해당 정렬 기준의 첫 페이지입니다. ‘낮은 가격순’으로 받은 20개만 뒤집으면 전체 매물의 ‘높은 가격순’이 되지 않기 때문에, 바뀐 정렬 조건으로 다시 요청합니다. 검색 결과 위의 조회 시각과 적용 조건을 확인하세요.</p><p className="mt-2 text-sm leading-7 text-dim">같은 조건을 다시 요청하면 서버에 남아 있는 30초 캐시를 사용할 수 있습니다. 캐시 시간이 지나도 기존 화면은 그대로이며, 새 요청이 있어야 다시 조회합니다. 담아둔 매물을 새 가격으로 비교하려면 새로 검색한 뒤 기존 항목을 빼고 다시 담아 주세요.</p></details>
      <p className="text-xs leading-6 text-dim">위 설명은 템차트 매물 검색 기준입니다. 하단의 메팁 집계 시세는 별도 기능입니다. 판매 중인 매물도 이미 팔리거나 취소됐을 수 있으니 거래 전에 게임에서 확인하세요.</p>
    </section>

    <GuideShare url={`${SITE}/guide`} />
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-5 text-sm text-dim"><span>한 번에 전부 말고, 오늘 필요한 기능 하나부터.</span><Link href="/" prefetch={false} className="font-semibold text-maple">메인으로 가기 →</Link></div>
  </div>;
}
