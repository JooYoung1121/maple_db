"use client";
import { useEffect, useState } from "react";
import { readVitals, percentile75, VITALS_ENABLED, VITALS_EVENT, VITALS_KEY, type LocalVital } from "@/lib/localVitals";

export default function PerformancePage() {
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState<LocalVital[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = () => { setRows(readVitals()); try { setEnabled(localStorage.getItem(VITALS_ENABLED) === '1'); } catch { setError('저장소를 사용할 수 없습니다.'); } };
    sync(); window.addEventListener(VITALS_EVENT, sync); window.addEventListener('storage', sync);
    return () => { window.removeEventListener(VITALS_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return <div className="max-w-3xl mx-auto space-y-4">
    <h1 className="font-pixel text-xl">내 브라우저 반응성 진단</h1>
    <p className="text-sm leading-relaxed text-dim">선택적으로 켜는 로컬 진단입니다. 서버 전송 없이 최근 200개 지표만 이 브라우저에 보관합니다. 닉네임·검색어·페이지 URL은 기록하지 않습니다. 전체 사용자 통계나 CrUX 결과가 아닙니다.</p>
    <label className="flex items-center gap-2 min-h-11 text-sm"><input type="checkbox" checked={enabled} onChange={e => {
      try { localStorage.setItem(VITALS_ENABLED, e.target.checked ? '1' : '0'); setEnabled(e.target.checked); setError(''); }
      catch { setError('설정을 저장하지 못했습니다.'); }
    }} />로컬 성능 기록 켜기</label>
    <p className="text-xs text-dim">켜고 새로고침한 뒤 다른 페이지에서 클릭·입력을 해 보세요. 탭을 숨기거나 페이지를 떠날 때 값이 확정될 수 있습니다. 상호작용이 없거나 미지원 브라우저이면 INP가 비어 있을 수 있습니다.</p>
    <div className="grid sm:grid-cols-2 gap-3">{(['mobile', 'desktop'] as const).map(screen => {
      const values = rows.filter(r => r.name === 'INP' && r.screen === screen).map(r => r.value);
      const p75 = percentile75(values);
      return <section key={screen} className="pixel-panel p-4"><h2 className="font-semibold">{screen === 'mobile' ? '모바일 너비' : '데스크톱 너비'}</h2><p className="mt-2 text-sm">INP p75: {p75 === null ? '측정 대기' : `${Math.round(p75)}ms`} · {values.length}개 표본</p><p className="text-xs text-dim mt-1">목표 ≤200ms. 적은 로컬 표본으로 사이트 성능 합격을 판정하지 않습니다.</p></section>;
    })}</div>
    <button type="button" className="pixel-btn min-h-11 px-3 text-sm" onClick={() => { try { localStorage.removeItem(VITALS_KEY); setRows([]); setError(''); } catch { setError('기록을 지우지 못했습니다.'); } }}>성능 기록만 지우기</button>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  </div>;
}
