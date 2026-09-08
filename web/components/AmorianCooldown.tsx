"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AMORIAN_COOLDOWN_EVENT, AMORIAN_COOLDOWN_KEY, SIX_HOURS, formatKst, parseEntry } from "@/lib/amorianCooldown";

export default function AmorianCooldown({ compact = false }: { compact?: boolean }) {
  const [entry, setEntry] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [alarm, setAlarm] = useState(false);
  const [notice, setNotice] = useState("");
  const alerted = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => {
      try { setEntry(parseEntry(localStorage.getItem(AMORIAN_COOLDOWN_KEY))); }
      catch { setError("브라우저 저장소를 사용할 수 없습니다."); }
    };
    sync();
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener("storage", sync);
    window.addEventListener(AMORIAN_COOLDOWN_EVENT, sync);
    return () => {
      clearInterval(tick);
      window.removeEventListener("storage", sync);
      window.removeEventListener(AMORIAN_COOLDOWN_EVENT, sync);
    };
  }, []);

  const ready = entry !== null && now !== null && now >= entry + SIX_HOURS;
  useEffect(() => {
    if (alarm && ready && entry !== alerted.current) {
      setNotice("아모리안 재입장 시간이 되었습니다. 인게임 입장 가능 여부를 확인하세요.");
      alerted.current = entry;
    }
  }, [alarm, ready, entry]);

  function save(value: number | null) {
    if (value !== null && parseEntry(String(value)) === null) {
      setError("현재보다 이전의 올바른 입장 시각을 입력하세요."); return;
    }
    try {
      if (value === null) localStorage.removeItem(AMORIAN_COOLDOWN_KEY);
      else localStorage.setItem(AMORIAN_COOLDOWN_KEY, String(value));
      setEntry(value); setNow(Date.now()); setError(""); setNotice(""); alerted.current = null;
      window.dispatchEvent(new Event(AMORIAN_COOLDOWN_EVENT));
    } catch { setError("저장하지 못했습니다. 브라우저 저장소 설정을 확인하세요."); }
  }

  const seconds = Math.max(0, Math.ceil(((entry || 0) + SIX_HOURS - (now || 0)) / 1000));
  return (
    <section className="pixel-panel p-4 space-y-3" aria-label="아모리안 6시간 재입장">
      <h2 className="font-semibold text-ink">아모리안 6시간 재입장</h2>
      <p className="text-sm" aria-live="off">
        {now === null ? "기록 확인 중…" : entry === null ? "아직 입장 기록이 없습니다." : ready ? "재입장 가능 시간입니다." : `${Math.floor(seconds / 3600)}시간 ${Math.floor(seconds % 3600 / 60)}분 ${seconds % 60}초 남음`}
      </p>
      {entry !== null && <p className="text-xs text-dim">마지막 입장 {formatKst(entry)} → 다음 {formatKst(entry + SIX_HOURS)} (한국 시간)</p>}
      {!compact && <>
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" className="pixel-btn min-h-11 px-3 text-sm" onClick={() => save(Date.now())}>지금 입장 기록</button>
          <label className="text-xs text-dim">직접 입력 (한국 시간)
            <input type="datetime-local" value={input} onChange={e => setInput(e.target.value)} className="pixel-input block min-h-11 max-w-full" />
          </label>
          <button type="button" className="pixel-btn min-h-11 px-3 text-sm" disabled={!input} onClick={() => save(Date.parse(`${input}:00+09:00`))}>시각 저장</button>
          {entry !== null && <button type="button" className="min-h-11 px-3 text-sm text-dim" onClick={() => { if (window.confirm("입장 기록을 지울까요?")) save(null); }}>기록 지우기</button>}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={alarm} onChange={e => setAlarm(e.target.checked)} />이 탭이 열려 있는 동안 재입장 알림</label>
        <p className="text-xs leading-relaxed text-dim">기록은 이 브라우저에만 저장됩니다. 자정 초기화가 아닌 입장 후 6시간 기준이며, 게임 서버와 자동 연동되지 않습니다. 탭을 닫으면 알림이 종료됩니다. <a className="text-maple underline" href="https://maple.land/board/notices/u59poew390cw27yfl21j5fdf" target="_blank" rel="noreferrer">9/4 공식 기준 ↗</a></p>
      </>}
      <p role="status" className="text-sm text-ink">{notice}</p>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <Link href={compact ? "/pq?tab=timer" : "/pq/amorian-solver"} className="inline-flex min-h-11 items-center text-sm text-maple underline">{compact ? "입장 시각 기록하기 →" : "웨딩 파퀘 조합 도우미 →"}</Link>
    </section>
  );
}
