"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MASTERY_BOOK_EVIDENCE, REQUIRED_MASTERY_BOOKS } from "@/data/battleMage";

const KEY = "maple-battlemage-mastery-v1";
export const BOOKS = REQUIRED_MASTERY_BOOKS.flatMap(value => {
  const split = value.lastIndexOf(" ");
  return value.slice(split + 1).split("·").map(tier => ({name: value.slice(0, split), tier, key: `${value.slice(0, split)} ${tier}`}));
});

export default function MasteryChecklist() {
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const sync = () => {
      try {
        const data: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
        setChecked(Array.isArray(data) ? [...new Set(data.filter((v): v is string => typeof v === "string" && BOOKS.some(b => b.key === v)))] : []);
      } catch { setError("기존 기록을 읽지 못했습니다. 새 체크는 다시 저장할 수 있습니다."); }
    };
    sync(); window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function toggle(key: string) {
    const next = checked.includes(key) ? checked.filter(v => v !== key) : [...checked, key];
    try { localStorage.setItem(KEY, JSON.stringify(next)); setChecked(next); setError(""); }
    catch { setError("체크를 저장하지 못했습니다. 브라우저 저장소를 확인하세요."); }
  }
  return <section id="mastery-checklist" className="pixel-panel p-4 space-y-3 scroll-mt-20">
    <h2 className="font-semibold text-ink">내 배메 마북 체크리스트 · {checked.length}/{BOOKS.length}</h2>
    <p className="text-xs text-dim">스킬 상한 확장에 성공한 책을 체크하세요. 브라우저별 개인 기록이며, 마북 사용 성공률과 몬스터 드롭 확률은 서로 다릅니다.</p>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <details>
      <summary className="min-h-11 cursor-pointer py-3 text-sm text-maple">필요 마북과 획득 경로 펼치기</summary>
      <div className="grid gap-3 sm:grid-cols-2">
        {BOOKS.map(book => {
          const evidence = MASTERY_BOOK_EVIDENCE.find(e => e.name === book.name && e.tier === book.tier && ['verified', 'official'].includes(e.evidence));
          return <div key={book.key} className="rounded border border-edge p-3">
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={checked.includes(book.key)} onChange={() => toggle(book.key)} />{book.key}</label>
            <p className="text-xs text-dim">{evidence ? evidence.evidence === "official" ? "공식 근거" : "커뮤니티 몬스터북 확인" : "이 등급의 개별 드롭 근거 미확인"}</p>
            {evidence?.drops.map(drop => drop.mobId && <Link key={drop.mobId} className="mr-3 inline-flex min-h-11 items-center text-xs text-maple underline" href={`/mobs/${drop.mobId}`}>{drop.name} · 출현 맵 →</Link>)}
            <Link className="inline-flex min-h-11 items-center text-xs text-maple underline" href={`/items?q=${encodeURIComponent(book.key.replace('다크 오라', '다크오라').replace('옐로우 오라', '옐로우오라'))}`}>아이템 검색 →</Link>
          </div>;
        })}
      </div>
    </details>
  </section>;
}
