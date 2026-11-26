/** 외부 시세 연동 종료. 계산기는 사용자가 입력한 단가를 사용한다. */
export interface MarketUnitPrice {
  price: number;
  time: string;
  count: number;
  itemCode: number;
}

export function useMarketPrices(names: string[]): Record<string, MarketUnitPrice | null> {
  return Object.fromEntries(names.map((name) => [name, null]));
}
