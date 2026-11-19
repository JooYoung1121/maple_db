"use client";

import { useEffect, useRef, useState } from "react";

export default function GuideShare({ url }: { url: string }) {
  const [status, setStatus] = useState("");
  const [fallback, setFallback] = useState("");
  const fallbackInput = useRef<HTMLTextAreaElement>(null);
  const message = `길드원분들, 우리 사이트 사용 안내 정리했어요! 🍁

🔍 아이템·몬스터·드롭 정보 검색
⏱️ 보스·사냥 타이머, 파티 공유
💰 장비 매물 검색·비교, 교체·보석작 비용 계산
🎲 주문서·제작 시뮬레이터
📰 메랜 공지 모아보기·주간 메랜
💬 게시판·정보공유, 🎮 추억틀 등 놀이터

전부 익힐 필요 없이 필요한 것만 골라 쓰시면 됩니다.
「메랜 할 때, 이렇게 써보세요」
${url}`;

  useEffect(() => { if (fallback) { fallbackInput.current?.focus(); fallbackInput.current?.select(); } }, [fallback]);
  async function copy(text: string, kind: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFallback(""); setStatus(`${kind} 복사했습니다. 카톡 대화창에 붙여넣어 주세요.`);
    } catch {
      setFallback(text); setStatus("자동 복사가 지원되지 않습니다. 아래 선택된 내용을 직접 복사해 주세요.");
    }
  }

  return <section id="share" aria-labelledby="guide-share-title" className="pixel-panel scroll-mt-24 p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold text-maple">길드원에게 알려주기</p><h2 id="guide-share-title" className="mt-2 text-xl font-bold">카톡에는 링크 하나면 충분해요</h2><p className="mt-2 text-sm leading-relaxed text-dim">짧은 소개글을 복사해서 함께 보내세요.</p></div>
      <span aria-hidden="true" className="text-4xl">💌</span>
    </div>
    <div className="mt-5 flex flex-wrap gap-2">
      <button type="button" onClick={() => copy(message, "소개글을")} className="pixel-btn min-h-11 bg-maple px-4 py-2 text-sm text-white">카톡 소개글 복사</button>
      <button type="button" onClick={() => copy(url, "안내 링크를")} className="pixel-btn min-h-11 px-4 py-2 text-sm">안내 링크만 복사</button>
    </div>
    <p role="status" className="mt-2 min-h-5 text-xs text-maple">{status}</p>
    {fallback && <label className="mt-2 block text-xs text-dim">직접 복사할 내용<textarea ref={fallbackInput} readOnly value={fallback} onFocus={e => e.target.select()} rows={8} className="mt-2 w-full rounded border border-edge bg-surface2 p-3 text-sm text-ink" /></label>}
    <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm text-dim">보낼 소개글 미리보기</summary><p className="whitespace-pre-wrap break-words rounded-lg bg-bg p-4 text-sm leading-7">{message}</p></details>
  </section>;
}
