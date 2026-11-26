import Link from "next/link";
export default function MarketPage() {
  return <div className="mx-auto max-w-4xl space-y-6">
    <h1 className="font-pixel text-2xl font-bold text-ink">아이템 시세</h1>
    <section className="pixel-panel space-y-3 p-4 text-sm text-dim">
      <p>외부 거래소 시세 연동을 종료했습니다. 아이템 가격은 게임 내 경매장에서 확인해 주세요.</p>
      <p>계산기에서는 가격을 직접 입력할 수 있습니다.</p>
      <Link href="/hunt" className="block text-maple hover:underline">메랜샵 사냥터 자리 시세 →</Link>
      <Link href="/charlie" className="block text-maple hover:underline">찰리중사 교환 계산기 →</Link>
    </section>
  </div>;
}
