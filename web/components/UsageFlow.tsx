"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { UsageFlow as Flow } from "@/lib/usageGuide";

export default function UsageFlow({ flow }: { flow: Flow }) {
  const [step, setStep] = useState(0);
  const details = useRef<HTMLDetailsElement>(null);
  const panelId = useId();
  const current = flow.steps[step];

  useEffect(() => {
    const reveal = () => {
      if (window.location.hash === `#${flow.id}` && details.current) details.current.open = true;
    };
    const revealLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (link && link.pathname === window.location.pathname && link.hash === `#${flow.id}` && details.current) details.current.open = true;
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    document.addEventListener("click", revealLink);
    return () => { window.removeEventListener("hashchange", reveal); document.removeEventListener("click", revealLink); };
  }, [flow.id]);

  return <details ref={details} id={flow.id} open={flow.id === "search"} className="group pixel-panel scroll-mt-24">
    <summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:content-none sm:gap-4 sm:p-5 [&::-webkit-details-marker]:hidden">
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-maple/10 text-2xl sm:h-14 sm:w-14">{flow.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug sm:text-lg">{flow.title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-dim sm:text-sm">{flow.description}</span>
      </span>
      <span className="shrink-0 text-xs text-maple"><span className="hidden sm:inline">사용법 </span><span aria-hidden="true" className="inline-block group-open:rotate-180">⌄</span></span>
    </summary>
    <div className="space-y-5 border-t border-edge/60 p-4 sm:p-6">
      <p className="text-xs leading-relaxed text-dim"><span className="font-semibold text-ink">어디에 있나요?</span> {flow.location}</p>
      <div className="grid grid-cols-3 gap-2" aria-label={`${flow.title} 설명 단계`}>
        {flow.steps.map((item, index) => <button type="button" key={item.label} onClick={() => setStep(index)}
          aria-pressed={step === index} aria-controls={panelId}
          className={`min-h-14 rounded-lg border px-2 py-2 text-xs transition-colors sm:text-sm ${step === index ? "border-maple bg-maple/10 font-semibold text-maple" : "border-edge bg-surface2 text-dim hover:border-maple"}`}>
          <span className="mb-1 block font-pixel text-[10px] opacity-75">0{index + 1}</span>{item.label}
        </button>)}
      </div>
      <div id={panelId} className="grid items-start gap-5 lg:grid-cols-2">
        <div aria-live="polite" aria-atomic="true" className="space-y-3 py-2">
          <span className="font-pixel text-xs text-maple">STEP 0{step + 1}</span>
          <h3 className="text-lg font-bold leading-snug">{current.title}</h3>
          <p className="text-sm leading-7 text-dim">{current.text}</p>
          {step < flow.steps.length - 1 && <button type="button" onClick={() => setStep(step + 1)} className="min-h-11 py-2 text-sm font-semibold text-maple">다음: {flow.steps[step + 1].label} →</button>}
        </div>
        <figure className="overflow-hidden rounded-xl border border-edge bg-surface2">
          <div className="flex items-center gap-2 border-b border-edge/60 bg-bg px-4 py-3 text-xs text-dim">
            <span aria-hidden="true" className="flex gap-1"><span className="h-2 w-2 rounded-full bg-mush/60" /><span className="h-2 w-2 rounded-full bg-maple/60" /><span className="h-2 w-2 rounded-full bg-slime/60" /></span>
            <span className="min-w-0 flex-1">{current.screen}</span>
          </div>
          <div className="space-y-2 p-3 sm:p-4">
            {flow.id === "market" && step === 2 ? <div className="space-y-3 text-center">
              <p className="text-xs text-dim">B 장비 − A 장비</p>
              <p className="text-lg font-bold">700만 메소 ÷ DEX 2</p>
              <div className="rounded-lg bg-maple/10 px-3 py-4"><p className="text-xs text-dim">DEX +1당 추가금</p><p className="mt-1 text-2xl font-bold text-maple">350만 메소</p></div>
            </div> : current.rows.map(([label, value], i) => <div key={`${step}-${i}`} className={`rounded-lg border p-3 ${i === 0 ? "border-maple/40 bg-maple/5" : "border-edge/50"}`}>
              <p className="text-[11px] text-dim">{label}</p>
              <p className={`mt-1 break-words font-semibold leading-relaxed ${flow.id === "timers" && step === 1 && i === 0 ? "font-mono text-3xl text-maple" : "text-sm"}`}>{value}</p>
            </div>)}
          </div>
          <figcaption className="border-t border-edge/40 px-4 py-2 text-[11px] leading-relaxed text-dim">사용 흐름을 간단히 재구성한 예시입니다. 실제 화면·매물·현재 시세가 아닙니다.</figcaption>
        </figure>
      </div>
      <p className="rounded-lg bg-bg px-3 py-3 text-xs leading-6 text-dim">💡 {flow.tip}</p>
      <div className="flex flex-wrap gap-2">{flow.links.map((link, index) => <Link key={link.href} href={link.href} prefetch={false}
        className={`pixel-btn inline-flex min-h-11 items-center px-4 py-2 text-sm ${index === 0 ? "bg-maple text-white" : ""}`}>{link.label} →</Link>)}</div>
    </div>
  </details>;
}
