"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getNeoTokyo } from "@/lib/api";
import type { NeoTokyoData } from "@/lib/neoTokyo";

function Source({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="text-maple underline underline-offset-2">{children} ↗</a>;
}

export default function NeoTokyoPage() {
  const [data, setData] = useState<NeoTokyoData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [mobId, setMobId] = useState(9400253);
  const [dropQuery, setDropQuery] = useState("");
  useEffect(() => {
    let active = true; setError(false);
    getNeoTokyo().then(d => { if (active) setData(d); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [retry]);
  if (error) return <div className="pixel-panel p-6" role="alert">정보를 불러오지 못했습니다. <button onClick={() => setRetry(v => v + 1)} className="text-maple underline">다시 시도</button></div>;
  if (!data) return <p className="text-center py-12 text-dim">네오도쿄 정보를 불러오는 중…</p>;
  const selected = data.monsters.find(m => m.id === mobId)!;
  const query = dropQuery.replace(/\s/g, "");
  const matches = data.monsters.flatMap(m => m.reference_drops.filter(d => d.name.replace(/\s/g, "").includes(query)).map(d => ({ ...d, mob: m.name, mobId: m.id, source: m.reference_drop_source! })));
  const drops = query ? matches : selected.reference_drops.map(d => ({ ...d, mob: selected.name, mobId: selected.id, source: selected.reference_drop_source! }));
  return <div className="mx-auto max-w-5xl space-y-6 pb-8">
    <header className="pixel-panel p-5 sm:p-8 space-y-4">
      <p className="font-pixel text-xs text-maple">{data.updated_at} · 공식 패치노트 {data.patch_revision}</p>
      <h1 className="font-pixel text-2xl sm:text-3xl text-ink">미래를 구하는 여행, 네오도쿄</h1>
      <p className="text-sm leading-7 text-dim">{data.summary}</p>
      <div className="flex flex-wrap gap-2 text-xs"><span className="pixel-card px-3 py-2">Part. 1 출시</span><span className="pixel-card px-3 py-2">Lv. {data.min_level} 이상</span><span className="pixel-card px-3 py-2">일반 몬스터 8종 · 보스 4종</span></div>
      <p className="text-xs text-dim"><Source href={data.source}>공식 패치노트</Source> · <Source href={data.official_image}>입장·지역 안내 이미지</Source></p>
    </header>
    <nav aria-label="네오도쿄 목차" className="flex flex-wrap gap-2">{[["entry","입장"],["maps","사냥터·지역"],["monsters","몬스터"],["drops","드롭"],["crafting","제작·크리스탈 일비"],["quests","퀘스트"],["patch","오늘의 패치"]].map(([id,label]) => <a key={id} href={`#${id}`} className="pixel-card px-3 py-2 text-sm hover:text-maple">{label}</a>)}</nav>
    <section id="entry" className="pixel-panel p-5 scroll-mt-24">
      <h2 className="font-pixel text-lg">입장부터 확인하세요</h2>
      <p className="text-sm text-maple mt-3">121레벨 이상만 입장할 수 있습니다. 120레벨 이하 캐릭터는 입장할 수 없습니다.</p>
      <ol className="list-decimal pl-5 mt-4 space-y-3 text-sm">{data.entry.map(s => <li key={s}>{s}</li>)}</ol>
      <p className="mt-4 text-sm text-dim">이번에 열리지 않은 Part. 2: {data.locked_areas.join(" · ")}</p>
    </section>
    <section id="maps" className="scroll-mt-24 space-y-3">
      <h2 className="font-pixel text-lg">사냥터와 지역</h2>
      <p className="text-sm text-dim">공식 공개 맵 18곳과 입구 카무나입니다. 본섭 출현 위치·젠 수·시간당 경험치가 검증되기 전까지 사냥 효율 순위를 매기지 않습니다. 이름은 공식 기준, 도감 ID는 원작 이름 대조 기준입니다.</p>
      <div className="grid sm:grid-cols-2 gap-3">{data.areas.map(a => <article className="pixel-panel p-4" key={a.name}>
        <h3 className="font-bold text-maple">{a.name}</h3><ul className="mt-3 space-y-2 text-sm">{a.maps.map(m => <li key={m.name}>{m.id ? <Link href={`/maps/${m.id}`} className="underline underline-offset-2">{m.name}</Link> : m.name}{m.name.includes("시나리오") && <span className="ml-2 text-xs text-dim">스토리 전용</span>}</li>)}</ul>
      </article>)}</div>
      <p className="text-xs text-dim">원작과 메랜 전용 맵이 섞여 있어 정확한 연결이 확인된 도감만 링크합니다. 현재는 미니맵·몬스터 배치 정보를 확인 중입니다.</p>
    </section>
    <section id="monsters" className="scroll-mt-24 space-y-3">
      <h2 className="font-pixel text-lg">몬스터 · 공식 이름과 레벨</h2>
      <p className="text-sm text-dim">시나리오 보스와 일반 보스는 서로 다릅니다. 특히 베르가모트(시나리오)는 난이도가 낮으며, 격파 후 퀘스트를 완료해야 일반 보스에 도전할 수 있습니다. 보스 수치는 아직 미공개입니다.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{data.monsters.map(m => <article id={`mob-${m.id}`} key={m.id} className="pixel-panel p-4 scroll-mt-24">
        <Link href={`/mobs/${m.id}`} className="font-bold hover:text-maple">{m.name} →</Link>
        <p className="text-sm text-maple mt-2">{m.boss ? "보스 · 레벨 미공개" : `Lv. ${m.level} · 공식 확인`}</p>
        <p className="text-xs text-dim mt-2">HP·EXP: 본섭 실측 확인 중</p>
        {m.reference_stats && <details className="mt-3 text-xs"><summary className="cursor-pointer text-dim">원작 v62 참고 수치 보기</summary><p className="mt-2 text-dim">메이플랜드 확정값이 아닙니다.</p><p className="mt-2">HP {m.reference_stats.hp.toLocaleString()} · EXP {m.reference_stats.exp.toLocaleString()}</p><p className="mt-1">물방 {m.reference_stats.defense.toLocaleString()} · 마방 {m.reference_stats.magic_defense.toLocaleString()}</p></details>}
      </article>)}</div>
    </section>
    <section id="drops" className="pixel-panel p-5 scroll-mt-24 space-y-4">
      <h2 className="font-pixel text-lg">드롭 아이템 · 원작 참고</h2>
      <p className="text-sm leading-6 text-dim">아래 목록은 메이플노트의 과거 메이플 데이터입니다. 메이플랜드 확정 드롭이 아니며 확률은 표시하지 않습니다. 본섭에서 드롭되지 않거나 조건이 다를 수 있습니다. 크리스탈 일비 등의 제작 해금과 몬스터 드롭은 별개입니다.</p>
      <div className="grid sm:grid-cols-2 gap-3"><label className="text-xs text-dim">몬스터 선택<select aria-label="드롭 몬스터 선택" value={mobId} onChange={e => { setMobId(Number(e.target.value)); setDropQuery(""); }} className="pixel-input w-full mt-1 p-2">{data.monsters.filter(m => !m.boss).map(m => <option value={m.id} key={m.id}>{m.name}</option>)}</select></label><label className="text-xs text-dim">전체 8종의 참고 드롭 검색<input aria-label="참고 드롭 검색" value={dropQuery} onChange={e => setDropQuery(e.target.value)} placeholder="은화, 나노 플랜트, 드래곤…" className="pixel-input w-full mt-1 p-2" /></label></div>
      {!query && <p className="text-xs"><Source href={selected.reference_drop_source!}>{selected.name} 참고 원문</Source></p>}
      {!drops.length ? <p className="text-sm text-dim">참고 목록에서 찾지 못했습니다. 본섭에서 드롭되지 않는다는 뜻은 아닙니다.</p> : <ul className="grid sm:grid-cols-2 gap-2">{drops.map(d => <li key={`${d.mobId}-${d.item_id}`} className="pixel-card p-3 text-sm"><span>{d.name}</span><span className="block text-xs text-dim mt-1">원작 참고 · 확률 미확인{query && <> · <Source href={d.source}>{d.mob}</Source></>}</span></li>)}</ul>}
      <p className="text-xs text-dim">보스 드롭은 시나리오/일반 분리와 실제 보상 검증이 필요해 등록을 보류했습니다.</p>
    </section>
    <section id="crafting" className="scroll-mt-24 space-y-3">
      <h2 className="font-pixel text-lg">추가된 메이커 제작 품목</h2>
      <p className="text-sm text-dim">공식 발표: 신규 지역에서 특정 조건을 달성하면 메이커로 제작할 수 있습니다.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{data.items.map(i => <article key={i.name} className="pixel-panel p-4"><h3 className="font-bold">{i.id ? <Link href={`/items/${i.id}`} className="hover:text-maple">{i.name} →</Link> : i.name}</h3><p className="mt-2 text-xs text-maple">제작 추가 · 공식 확인</p><p className="mt-2 text-xs leading-5 text-dim">{i.note}</p></article>)}</div>
      <article className="pixel-panel p-5 border-maple/60"><h3 className="font-pixel text-sm text-maple">크리스탈 일비: 은화 2,500개는 제조법 안내 비용</h3><p className="text-sm leading-7 mt-3">11/27 게임 화면에서 {data.crystal_ilbi.manual_location}의 {data.crystal_ilbi.manual_npc}가 은화 {data.crystal_ilbi.manual_cost.toLocaleString()}개를 받고 제조 매뉴얼을 적어 주겠다고 안내하는 장면을 확인했습니다.</p><p className="text-sm text-dim mt-2">{data.crystal_ilbi.note}</p><p className="mt-3 text-xs"><Source href={data.crystal_ilbi.manual_source}>게임 화면 제보</Source> · <Link href="/maker" className="text-maple underline">메이커 가이드</Link></p></article>
    </section>
    <section id="quests" className="pixel-panel p-5 scroll-mt-24">
      <h2 className="font-pixel text-lg">퀘스트 진행 순서</h2>
      <p className="text-sm text-dim mt-3">공식 안내에 나온 진행 흐름입니다. 개별 퀘스트명·선행 조건·필요 아이템 수량·경험치 보상은 아직 검증 중입니다.</p>
      <ol className="list-decimal pl-5 mt-5 space-y-5">{data.quest_steps.map(s => <li key={s.title}><h3 className="text-sm font-bold">{s.title}</h3><p className="text-sm leading-6 text-dim mt-1">{s.description}</p><p className="text-xs mt-2"><Source href={s.source || data.source}>{s.status === "community" ? "게임 화면 제보" : "공식 안내"}</Source></p></li>)}</ol>
      <p className="text-xs text-dim mt-5">현재의 일반 퀘스트 완료 개수·퀘스트 스페셜리스트 계산에는 미확인 퀘스트를 추가하지 않았습니다.</p>
    </section>
    <section id="patch" className="pixel-panel p-5 scroll-mt-24"><h2 className="font-pixel text-lg">오늘 패치에서 함께 바뀐 내용</h2><ul className="list-disc pl-5 mt-4 space-y-3 text-sm">{data.other_changes.map(s => <li key={s}>{s}</li>)}</ul><p className="text-xs mt-4"><Source href={data.source}>전체 변경 사항 읽기</Source></p></section>
    <details className="pixel-panel p-5 text-xs text-dim"><summary className="cursor-pointer font-bold text-sm">정보 확인 기준과 남은 확인 항목</summary><ul className="list-disc pl-5 mt-4 space-y-3">{data.notes.map(s => <li key={s}>{s}</li>)}</ul></details>
  </div>;
}
