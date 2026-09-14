"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSkillAcquisitionGuides } from "@/lib/api";
import type { SkillAcquisitionCatalog, SkillAcquisitionGuide } from "@/lib/types";
import { FilterChoices } from "@/components/FilterPanel";
import { useQueryState } from "@/lib/useQueryState";

const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, "");

function GuideCard({ guide, catalog, expanded, onToggle, onGuide }: {
  guide: SkillAcquisitionGuide;
  catalog: SkillAcquisitionCatalog;
  expanded: boolean;
  onToggle: () => void;
  onGuide: (id: string) => void;
}) {
  return <article id={guide.id} className="scroll-mt-24 rounded-xl border border-edge bg-surface p-4 sm:p-5">
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
      <span className="rounded bg-surface2 px-2 py-1 text-maple">Lv. {guide.level}</span>
      <span className="text-dim">{guide.method}</span>
    </div>
    <h2 className="mt-3 text-xl font-bold text-ink">{guide.title}</h2>
    <p className="mt-2 break-keep text-sm text-dim">{guide.jobs.join(" · ")}</p>
    <p className="mt-4 text-sm text-ink"><span className="font-semibold">시작</span> · {guide.start}</p>
    {guide.requirements && <p className="mt-2 text-sm leading-relaxed text-ink"><span className="font-semibold">준비</span> · {guide.requirements}</p>}
    {guide.party && <p className="mt-2 text-sm text-maple">{guide.party}</p>}
    {guide.prerequisites.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="text-dim">선행</span>{guide.prerequisites.map(id => <button key={id} type="button" onClick={() => onGuide(id)} className="min-h-9 rounded border border-edge px-3 text-maple hover:bg-surface2">{catalog.guides.find(g => g.id === id)?.title || id} →</button>)}</div>}
    <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`${guide.id}-steps`} className="mt-4 min-h-11 w-full rounded-lg border border-edge px-4 py-2 text-left text-sm font-semibold text-maple hover:bg-surface2">{expanded ? "진행 순서 접기 −" : `진행 순서 ${guide.steps.length}단계 · 준비물·출처 보기 +`}</button>
    {expanded && <div id={`${guide.id}-steps`} className="mt-4 border-t border-edge pt-4">
      <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-ink">{guide.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
      {guide.notes.map(note => <p key={note} className="mt-3 rounded-lg bg-surface2 p-3 text-sm leading-relaxed text-dim">{note}</p>)}
      {guide.books.map(book => <Link key={book.id} href={book.href} className="mt-4 block text-sm font-semibold text-maple hover:underline">{guide.title} 스킬북 · 드롭 몬스터 보기 →</Link>)}
      {guide.db_quests.length > 0 && <details className="mt-4 rounded-lg border border-edge p-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink">연결된 퀘스트·재료 {guide.db_quests.length}단계</summary>
        <p className="mt-2 text-xs leading-relaxed text-dim">공개 퀘스트 DB에 등록된 단계입니다. 진행 중 얻는 전달품도 포함하며, 위 공식 변경 안내를 우선 적용하세요.</p>
        <div className="mt-3 space-y-4">{guide.db_quests.map(quest => <div key={quest.id}>
          <h3 className="text-sm font-semibold text-ink">{quest.name}</h3>
          {quest.start_npc && <p className="mt-1 text-xs text-dim">시작 NPC · {quest.start_npc}</p>}
          {quest.requirements.length > 0 ? <ul className="mt-2 space-y-2 text-sm">{quest.requirements.map((req, i) => <li key={i}>{req.href ? <Link href={req.href} className="text-maple hover:underline">{req.raw} →</Link> : <span className="text-dim">{req.raw}</span>}</li>)}</ul> : <p className="mt-1 text-xs text-dim">등록된 수집·처치 조건 없음</p>}
        </div>)}</div>
      </details>}
      <div className="mt-4 flex flex-wrap gap-3">{guide.skills.map(skill => <Link key={skill.id} href={`/skills/${skill.id}`} className="text-sm text-maple hover:underline">{skill.skill_name} 효과 보기 →</Link>)}</div>
      <p className="mt-4 text-xs font-semibold text-dim">근거 · {guide.evidence}</p>
      <ul className="mt-2 space-y-2 text-xs">{guide.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" className="text-maple underline">{source.label} ↗</a></li>)}</ul>
    </div>}
  </article>;
}

function SkillQuestsContent() {
  const { filterValues, setFilterValues } = useQueryState();
  const [catalog, setCatalog] = useState<SkillAcquisitionCatalog | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState(filterValues.q || "");
  const [openGuides, setOpenGuides] = useState<Set<string>>(new Set());
  useEffect(() => { setQuery(filterValues.q || ""); }, [filterValues.q]);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    getSkillAcquisitionGuides().then(data => { if (!cancelled) setCatalog(data); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [retry]);
  const guides = useMemo(() => {
    const tokens = (filterValues.q || "").toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return (catalog?.guides || []).filter(guide => {
      if (filterValues.job && !guide.jobs.includes(filterValues.job)) return false;
      if (filterValues.family && !guide.jobs.some(job => catalog?.job_groups[filterValues.family]?.includes(job))) return false;
      if (filterValues.method && guide.method !== filterValues.method) return false;
      if (filterValues.guide && guide.id !== filterValues.guide) return false;
      const haystack = normalize([guide.title, ...guide.jobs, guide.start, guide.requirements, ...guide.steps, ...guide.notes, ...guide.db_quests.flatMap(q => [q.name, ...q.requirements.map(r => r.raw)])].join(" "));
      return tokens.every(token => haystack.includes(normalize(token)));
    });
  }, [catalog, filterValues]);
  function update(key: string, value: string) {
    setFilterValues({ ...filterValues, guide: "", [key]: value, ...(key === "family" ? { job: "" } : {}) });
  }
  function showGuide(id: string) {
    setOpenGuides(previous => new Set([...previous, id]));
    setFilterValues({ guide: id });
  }
  if (error) return <div role="alert" className="pixel-panel p-8 text-center"><p>스킬 획득 가이드를 불러오지 못했습니다.</p><button className="mt-4 min-h-11 text-maple" onClick={() => setRetry(v => v + 1)}>다시 시도</button></div>;
  if (!catalog) return <p className="py-12 text-center text-dim">스킬 획득 가이드를 불러오는 중…</p>;
  const jobs = filterValues.family ? catalog.job_groups[filterValues.family] || [] : Object.values(catalog.job_groups).flat();
  return <div>
    <p className="text-sm font-semibold text-maple">직업별 성장 가이드</p>
    <h1 className="mt-2 font-pixel text-2xl font-bold text-ink sm:text-3xl">스킬 획득 퀘스트</h1>
    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-dim">어디서 시작하고, 무엇을 모으고, 누구와 함께 가야 하는지 찾아보세요. 직업을 선택하면 공통 선행 퀘스트도 함께 표시합니다.</p>
    <div className="mt-5 flex flex-wrap gap-2">{["제네시스", "리저렉션", "용사의 의지"].map(name => <button key={name} onClick={() => setFilterValues({ q: name })} className="min-h-11 rounded-full border border-edge bg-surface px-4 text-sm text-ink hover:border-maple">{name}</button>)}<Link href="/skills" className="px-4 py-3 text-sm text-maple hover:underline">전체 스킬 효과 →</Link></div>
    <div className="mt-5 space-y-5 rounded-xl border border-edge bg-surface p-4 sm:p-5">
      <form onSubmit={e => { e.preventDefault(); setFilterValues({ ...filterValues, guide: "", q: query }); }} className="flex flex-wrap gap-2">
        <label htmlFor="skill-guide-query" className="w-full text-sm font-semibold text-ink">스킬·NPC·재료 검색</label>
        <input id="skill-guide-query" value={query} onChange={e => setQuery(e.target.value)} placeholder="예: 생명의 뿌리, 샤모스, 리저렉션" className="min-h-11 min-w-0 flex-1 rounded-lg border border-edge bg-surface2 px-3 text-sm text-ink" />
        <button type="submit" className="min-h-11 rounded-lg bg-maple px-5 text-sm font-bold text-white">검색</button>
      </form>
      <FilterChoices label="직업군" value={filterValues.family || ""} options={Object.keys(catalog.job_groups).map(job => ({ value: job, label: job }))} onChange={v => update("family", v)} />
      <FilterChoices label="직업" value={filterValues.job || ""} options={jobs.map(job => ({ value: job, label: job }))} onChange={v => update("job", v)} />
      <FilterChoices label="획득 방식" value={filterValues.method || ""} options={["퀘스트", "공통 선행", "스킬북", "상한 확장"].map(method => ({ value: method, label: method }))} onChange={v => update("method", v)} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge pt-3 text-sm"><p className="text-dim">{filterValues.job || filterValues.family || "전체 직업"} · {filterValues.method || "모든 획득 방식"}{filterValues.q ? ` · “${filterValues.q}”` : ""}</p><button className="min-h-10 text-maple" onClick={() => setFilterValues({})}>필터 초기화</button></div>
    </div>
    <details className="mt-4 rounded-lg border border-edge p-3 text-xs leading-relaxed text-dim"><summary className="cursor-pointer">수록 범위와 출처 · {catalog.reviewed_at} 정리</summary><p className="mt-2">{catalog.scope}</p><p className="mt-2">{catalog.notice}</p>{!catalog.quest_database_available && <p className="mt-2">현재 퀘스트 재료 DB 연결이 없어 공략 본문을 표시하고 있습니다.</p>}<p className="mt-2">시그너스 세부 시험과 배틀메이지의 나머지 스킬 획득 조건은 추가 검증이 필요합니다. <Link href="/battle-mage" className="text-maple underline">배틀메이지 가이드</Link></p></details>
    <div aria-live="polite" className="mb-4 mt-6 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-ink">가이드 <strong>{guides.length}</strong>개</p>{filterValues.guide && <button className="min-h-10 text-sm text-maple" onClick={() => setFilterValues({})}>전체 가이드로 돌아가기</button>}</div>
    {guides.length ? <div className="grid items-start gap-4 lg:grid-cols-2">{guides.map(guide => <GuideCard key={guide.id} guide={guide} catalog={catalog} expanded={openGuides.has(guide.id) || filterValues.guide === guide.id} onGuide={showGuide} onToggle={() => { if (filterValues.guide === guide.id) { setOpenGuides(new Set()); setFilterValues({ q: guide.title }); } else setOpenGuides(previous => { const next = new Set(previous); if (next.has(guide.id)) next.delete(guide.id); else next.add(guide.id); return next; }); }} />)}</div> : <div className="rounded-xl border border-dashed border-edge p-10 text-center"><p className="text-dim">조건에 맞는 가이드가 없습니다.</p><button onClick={() => setFilterValues({})} className="mt-4 text-maple">모든 직업·획득 방식 보기</button></div>}
  </div>;
}

export default function SkillQuestsPage() {
  return <Suspense fallback={<p className="py-12 text-center text-dim">가이드 불러오는 중…</p>}><SkillQuestsContent /></Suspense>;
}
