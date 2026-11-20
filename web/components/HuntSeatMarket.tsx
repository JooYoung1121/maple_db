"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const SOURCE = "https://mashop.kr";
const normalize = (value: string) => value.normalize("NFC").replace(/\s/g, "").toLowerCase();

type Price = { count: number; median: number | null };
type Summary = {
  buy: Price;
  sell: Price;
  completed: Price;
  lastActivityAt: string | null;
  lastCompletedUpdateAt: string | null;
  recentCount: number;
  checkedAt: string;
};

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}/api/hunt-market/${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(response.status === 429
      ? "조회가 몰렸습니다. 잠시 후 다시 눌러 주세요."
      : "메랜샵 정보를 불러오지 못했습니다.");
  }
  return response.json();
}

function elapsed(at: string, checkedAt: string) {
  const minutes = Math.floor((Date.parse(checkedAt) - Date.parse(at)) / 60_000);
  return minutes < 1 ? "방금" : minutes < 60 ? `${minutes}분 전` : `${Math.floor(minutes / 60)}시간 전`;
}

export default function HuntSeatMarket() {
  const [maps, setMaps] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const term = normalize(query);
  const matches = term ? maps?.filter((name) => normalize(name).includes(term)).slice(0, 12) : [];

  async function loadMaps() {
    setBusy(true);
    setError("");
    try {
      setMaps(await get<string[]>("maps"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function lookup(name: string) {
    setSelected(name);
    setResult(null);
    setBusy(true);
    setError("");
    try {
      setResult(await get<Summary>(`summary?name=${encodeURIComponent(name)}`));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const age = result?.lastActivityAt
    ? Date.parse(result.checkedAt) - Date.parse(result.lastActivityAt)
    : null;

  return (
    <section className="pixel-panel space-y-3 p-4" aria-labelledby="hunt-seat-market">
      <h2 id="hunt-seat-market" className="font-pixel font-bold text-ink">사냥터 자리 시세</h2>
      <p className="text-sm text-dim">메랜샵 본섭의 자리 거래글 기준입니다.</p>
      {maps === null ? (
        <button type="button" className="pixel-btn" onClick={loadMaps} disabled={busy}>사냥터 검색 열기</button>
      ) : (
        <>
          <input
            aria-label="자리 시세를 볼 사냥터 이름"
            placeholder="예: 스푸키 월드 입구, 추억의 길5"
            className="w-full rounded border border-edge bg-surface px-3 py-2 text-ink"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {term && !matches?.length && <p className="text-sm text-dim">일치하는 사냥터가 없습니다.</p>}
          {!!matches?.length && <ul className="flex flex-wrap gap-2">{matches.map((name) => (
            <li key={name}>
              <button type="button" className="pixel-btn text-sm" disabled={busy} onClick={() => lookup(name)}>{name}</button>
            </li>
          ))}</ul>}
        </>
      )}
      <div aria-live="polite" className="space-y-2">
        {selected && <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-semibold text-ink">{selected}</h3>
          <button type="button" className="pixel-btn text-xs" onClick={() => lookup(selected)} disabled={busy}>다시 조회</button>
        </div>}
        {busy && <p className="text-sm text-dim">불러오는 중…</p>}
        {error && <p className="text-sm text-dim">{error}</p>}
        {result && <>
          <dl className="grid gap-2 sm:grid-cols-3">
            {([
              ["구매 희망가 · 최근 1시간", result.buy],
              ["판매 희망가 · 최근 1시간", result.sell],
              ["완료 표시 가격 · 최근 24시간", result.completed],
            ] as const).map(([label, price]) => (
              <div key={label} className="rounded bg-surface2 p-3">
                <dt className="text-xs text-dim">{label}</dt>
                <dd className="font-semibold text-ink">
                  {price.median === null ? "가격 기록 없음" : `${price.median.toLocaleString("ko-KR")} 메소`}
                </dd>
                {price.count > 0 && <dd className="text-xs text-dim">게시글 {price.count}건 중앙값</dd>}
              </div>
            ))}
          </dl>
          <p className="text-sm text-ink">
            {result.recentCount >= 2
              ? `게시판 활동 활발 · 최근 2분에 ${result.recentCount}건`
              : result.recentCount === 1
                ? "최근 2분에 기록 1건"
                : age === null
                  ? "확인 가능한 활동 기록 없음"
                  : age >= 15 * 60_000
                    ? "최근 활동이 뜸해요. 게임에서 채널을 몇 곳 확인해 보세요."
                    : "최근 2분에 새 기록 없음"}
          </p>
          <p className="text-xs text-dim">
            {result.lastActivityAt && `마지막 활동 ${elapsed(result.lastActivityAt, result.checkedAt)} · `}
            {result.lastCompletedUpdateAt && `완료 글 최근 갱신 ${elapsed(result.lastCompletedUpdateAt, result.checkedAt)} · `}
            조회 {new Date(result.checkedAt).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" })} (한국 시간)
          </p>
          <p className="text-xs text-dim">완료 가격은 작성자가 완료로 표시한 게시글 기준이며, 빈자리는 게임에서 확인해 주세요.</p>
        </>}
      </div>
      <a className="text-sm text-maple hover:underline" href={selected ? `${SOURCE}/jari/${encodeURIComponent(selected)}` : SOURCE} target="_blank" rel="noreferrer">메랜샵에서 보기 ↗</a>
    </section>
  );
}
