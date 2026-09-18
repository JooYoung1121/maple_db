"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getQuestSpecialistGuide,
  type SpecialistChain,
  type SpecialistDeliverQuest,
  type SpecialistKillQuest,
  type SpecialistMobSynergy,
} from "@/lib/api";

/**
 * 퀘스트 스페셜리스트 훈장(1142002) 가이드.
 * 훈장 조건·레벨 제한 퀘스트는 수기 큐레이션(WZ·커뮤니티 인증글 출처 명기),
 * 전달형/연계/몹 시너지는 mapledb_quests 기반 API(/api/quests/specialist/guide)로 자동 생성.
 */

// 레벨 구간을 지나치면 수락 자체가 불가능해지는 퀘스트 — 디시 인증글(no=3965312) 기준.
const LEVEL_WINDOW_QUESTS: [string, string][] = [
  ["만지와 비밀조직", "Lv.18~29"],
  ["바이런의 추천서", "Lv.29→30 (30 달성 전 수락)"],
  ["잃어버린 사진기용 삼각대 · 요정의 뿔피리 다시 구하기 · 잃어버린 사진첩 · 잃어버린 여행권/자유여행권 조각", "Lv.30~"],
  ["알카드노/제뉴미스트의 망토 다시 받기", "Lv.30~ (드랭의 노트 완료 전까지 · 맥스 레벨 제한 없음 확인)"],
  ["동화책 6종 (효녀 심청·흥부와 놀부·해와 달·콩쥐팥쥐·의좋은 형제·금도끼 은도끼)", "Lv.35~45 시작"],
  ["제비가 잃어버린 박씨", "Lv.37~"],
  ["잃어버린 네펜데스 즙 · 네펜데스 주스", "Lv.40~ (나팔찌를 버리면 영구 진행 불가 — 주의)"],
  ["영화 배우", "Lv.40"],
  ["행방불명된 수송선", "Lv.50~"],
  ["파파픽시의 전설 · 미네르바 여신의 기록(일기장)", "Lv.51~70"],
  ["해적 5종 (해적 퇴치·바다의 무법자·해적의 고지도·태상의 약재·데비존)", "Lv.55~100"],
  ["잃어버린 균열 조각 2종", "Lv.60~"],
  ["구겨진 종이조각 다시 찾기", "Lv.65~"],
  ["해독된 통신문2 (완료 직후 '암호화된 통신문'을 버리고 3 수락 시 히든 '해독된 통신문' 발생)", "Lv.70~"],
  ["잃어버린 안장 · 잃어버린 향수", "Lv.70~ (모험가 3차 전직)"],
  ["배척받은 연구와 알카드노 · 키니의 프랑켄로이드 연구 · 유레테의 부탁 4종 · 로미오의 청혼 7종", "Lv.70~85"],
  ["유레테의 보답", "Lv.70~100"],
  ["드랭의 노트 다시 얻기 3종", "Lv.75~"],
  ["잃어버린 메달", "Lv.80~"],
  ["사악한 힘의 파괴", "Lv.105~ (다크 타키온 획득 시)"],
  ["타타모의 제안", "Lv.120~"],
  ["메이플 용사 스킬북", "Lv.120~ (모험가 4차 전직)"],
];

const sourceLinks = [
  { label: "디시 메랜갤 — 퀘스트 스페셜리스트 인증 및 정보 (2026-09-15, 완주 실측)", href: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3965312" },
  { label: "WZ 데이터 — 칭호 도전: 퀘스트 스페셜리스트 (quest 29001)", href: "https://wcr2.kennysoft.kr/Quest/29001.html" },
];

function num(n: number) {
  return n.toLocaleString("ko-KR");
}

function Badge({ children }: { children: string }) {
  return (
    <span className="pixel-badge inline-flex font-pixel bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] px-2.5 py-1 text-xs text-amber-900 dark:text-maple">
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-ink font-pixel">{children}</h2>;
}

function QuestTablesSection({ deliverQuests, killQuests }: {
  deliverQuests: SpecialistDeliverQuest[];
  killQuests: SpecialistKillQuest[];
}) {
  const [tab, setTab] = useState<"deliver" | "kill">("deliver");
  const [maxLevel, setMaxLevel] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const quests: (SpecialistDeliverQuest | SpecialistKillQuest)[] =
    tab === "deliver" ? deliverQuests : killQuests;
  const filtered = useMemo(
    () => (maxLevel === null ? quests : quests.filter((q) => q.min_level <= maxLevel)),
    [quests, maxLevel],
  );
  const visible = showAll ? filtered : filtered.slice(0, 30);
  const cols = tab === "deliver"
    ? "grid-cols-[0.6fr_1.4fr_1fr_2fr_0.8fr]"
    : "grid-cols-[0.6fr_1.3fr_1.4fr_1.6fr_0.8fr]";
  return (
    <section className="pixel-panel p-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setTab("deliver"); setShowAll(false); }}
          className={`min-h-11 border-2 px-4 py-2 text-sm font-bold font-pixel ${tab === "deliver" ? "border-maple text-maple bg-surface2" : "border-edge text-ink hover:border-maple"}`}
        >
          🎒 전달형 — 즉시 완료 ({num(deliverQuests.length)})
        </button>
        <button
          type="button"
          onClick={() => { setTab("kill"); setShowAll(false); }}
          className={`min-h-11 border-2 px-4 py-2 text-sm font-bold font-pixel ${tab === "kill" ? "border-maple text-maple bg-surface2" : "border-edge text-ink hover:border-maple"}`}
        >
          ⚔️ 처치형 — 사냥 동선에 ({num(killQuests.length)})
        </button>
      </div>
      <p className="mt-2 text-sm text-dim">
        {tab === "deliver"
          ? "요구 조건이 전부 「미리 구할 수 있는 아이템」뿐이라, 거래·사냥으로 준비해 두면 수락 즉시 완료됩니다. 퀘스트 진행 중에만 얻는 전용 아이템(4031번대)이 섞인 퀘스트는 제외했습니다."
          : "몬스터 처치가 포함된 퀘스트입니다. 사냥 나가기 전에 해당 레벨대 처치 퀘스트를 전부 수락해 두고, 「함께 전달」 아이템도 미리 챙기면 한 번의 사냥으로 끝납니다."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-dim">내 레벨로 필터:</span>
        {[null, 30, 50, 70, 100].map((lv) => (
          <button
            key={String(lv)}
            type="button"
            onClick={() => setMaxLevel(lv)}
            className={`border-2 px-3 py-1 min-h-9 ${maxLevel === lv ? "border-maple text-maple" : "border-edge text-ink hover:border-maple"}`}
          >
            {lv === null ? "전체" : `~Lv.${lv}`}
          </button>
        ))}
        <span className="text-dim">{num(filtered.length)}개 표시</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[680px] overflow-hidden border-2 border-edge">
          <div className={`grid ${cols} gap-2 bg-surface2 px-3 py-1.5 font-pixel text-xs text-dim`}>
            <span>레벨</span><span>퀘스트</span>
            {tab === "deliver" ? <span>시작 NPC</span> : <span>처치 몹</span>}
            {tab === "deliver" ? <span>준비물</span> : <span>함께 전달</span>}
            <span>EXP</span>
          </div>
          {visible.map((q) => (
            <div key={q.quest_id} className={`grid ${cols} gap-2 border-t border-edge/40 px-3 py-2 text-sm`}>
              <span className="text-dim">{q.min_level > 0 ? `Lv.${q.min_level}` : "-"}</span>
              <span className="font-medium text-ink">
                {q.name}
                {q.repeatable ? <span className="ml-1 text-xs text-amber-900 dark:text-maple">(반복)</span> : null}
                {tab === "kill" && <span className="block text-xs font-normal text-dim">{q.start_npc || ""}</span>}
              </span>
              {tab === "deliver" ? (
                <span className="text-dim">{(q as SpecialistDeliverQuest).start_npc || "-"}</span>
              ) : (
                <span className="text-dim">
                  {(q as SpecialistKillQuest).mobs.map((m) => `${m.name} ${num(m.count)}마리`).join(" · ")}
                </span>
              )}
              {tab === "deliver" ? (
                <span className="text-dim">
                  {(q as SpecialistDeliverQuest).items.map((it) => `${it.name} ${num(it.count)}개`).join(" · ")}
                </span>
              ) : (
                <span className="text-dim">
                  {(() => {
                    const kq = q as SpecialistKillQuest;
                    const prep = kq.items.filter((it) => it.preparable && it.count > 0);
                    const questOnly = kq.items.length - prep.length;
                    const parts = prep.map((it) => `${it.name} ${num(it.count)}개`);
                    if (questOnly > 0) parts.push(`퀘스트 진행품 ${questOnly}종`);
                    return parts.length ? parts.join(" · ") : "-";
                  })()}
                </span>
              )}
              <span className="text-dim">{q.exp ? num(q.exp) : "-"}</span>
            </div>
          ))}
        </div>
      </div>
      {filtered.length > 30 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 min-h-11 w-full border-2 border-edge px-4 py-2 text-sm font-semibold text-maple hover:bg-surface2"
        >
          {showAll ? "접기 −" : `${num(filtered.length - 30)}개 더 보기 +`}
        </button>
      )}
    </section>
  );
}

function ChainCard({ chain }: { chain: SpecialistChain }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="border-2 border-edge p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-pixel text-sm text-amber-900 dark:text-maple">{chain.quest_count}퀘 연계</span>
        <span className="text-xs text-dim">Lv.{chain.min_level}+ · 합계 EXP {num(chain.total_exp)}</span>
      </div>
      <h3 className="mt-1 text-sm font-bold text-ink">{chain.title}</h3>
      {chain.prep_items.length > 0 && (
        <p className="mt-2 text-sm leading-6 text-dim">
          <span className="font-semibold text-ink">미리 준비:</span>{" "}
          {chain.prep_items.map((it) => `${it.name} ${num(it.count)}개`).join(" · ")}
        </p>
      )}
      {chain.mob_kills.length > 0 && (
        <p className="mt-1 text-sm leading-6 text-dim">
          <span className="font-semibold text-ink">처치:</span>{" "}
          {chain.mob_kills.map((m) => `${m.name} ${num(m.count)}마리`).join(" · ")}
        </p>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 min-h-9 border-2 border-edge px-3 py-1 text-xs font-semibold text-maple hover:bg-surface2"
      >
        {open ? "퀘스트 목록 접기 −" : `퀘스트 ${chain.quest_count}개 순서 보기 +`}
      </button>
      {open && (
        <ol className="mt-2 grid gap-1 text-sm text-ink md:grid-cols-2">
          {chain.quests.map((q, i) => (
            <li key={q.quest_id} className="bg-surface2 border border-edge/60 px-2 py-1">
              {i + 1}. {q.name} <span className="text-xs text-dim">{q.min_level > 0 ? `Lv.${q.min_level}` : ""}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export default function QuestSpecialistPage() {
  const [deliverOnly, setDeliverOnly] = useState<SpecialistDeliverQuest[]>([]);
  const [killQuests, setKillQuests] = useState<SpecialistKillQuest[]>([]);
  const [chains, setChains] = useState<SpecialistChain[]>([]);
  const [mobSynergy, setMobSynergy] = useState<SpecialistMobSynergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [chainCount, setChainCount] = useState(10);

  useEffect(() => {
    getQuestSpecialistGuide()
      .then((d) => {
        setDeliverOnly(d.deliver_only);
        setKillQuests(d.kill_quests);
        setChains(d.chains);
        setMobSynergy(d.mob_synergy);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>훈장</Badge>
          <Badge>퀘스트 800개</Badge>
          <Badge>Lv.30+</Badge>
        </div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl font-pixel">퀘스트 스페셜리스트 가이드</h1>
        <p className="max-w-3xl text-sm leading-6 text-dim">
          NPC <strong className="text-ink">달리어</strong>의 칭호 도전에서 <strong className="text-ink">이벤트 퀘스트를 제외한 800개</strong>를
          완료하면 얻는 훈장입니다. 옵션은 <strong className="text-ink">올스탯 +3 · 회피 +10 · 점프 +10</strong>(GMS v92 데이터 기준).
          도전 진행 중에는 다른 칭호 도전을 받을 수 없습니다.
        </p>
      </section>

      <section className="pixel-panel p-5">
        <SectionTitle>전략 요약</SectionTitle>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink">
          <li>· 전체 퀘스트 풀은 히든 포함 약 1,050개(커뮤니티 집계) — <strong>히든퀘 없이도 800 달성 가능</strong>하지만, 사실상 깰 수 있는 퀘스트 대부분을 소화해야 합니다.</li>
          <li>· 그래서 <strong>레벨 구간을 지나치면 영영 못 깨는 퀘스트</strong>를 놓치지 않는 것이 최우선입니다(아래 표).</li>
          <li>· 전달형 퀘스트 {num(deliverOnly.length)}개는 준비물만 사두면 <strong>수락 즉시 완료</strong> — 거래소에서 미리 모아 한 번에 돌면 카운트가 가장 빠르게 오릅니다.</li>
          <li>· 부머랭 스텝 훈련서·저주받은 인형 등 준비물이 비싼 퀘스트는 적당히 건너뛰어도 800은 채워집니다(완주자 실측).</li>
          <li>· 초보자 퀘스트를 건너뛰었어도 지장 없습니다.</li>
        </ul>
      </section>

      <section className="pixel-panel p-5">
        <SectionTitle>레벨 제한 퀘스트 — 지나치면 못 깹니다</SectionTitle>
        <p className="mt-1 text-sm text-dim">
          완주자 인증글(디시 메랜갤, 2026-09-15) 기준 수기 정리. 육성 중이라면 해당 구간에서 반드시 먼저 수락해 두세요.
        </p>
        <div className="mt-3 overflow-hidden border-2 border-edge">
          <div className="grid grid-cols-[2fr_1.2fr] gap-2 bg-surface2 px-3 py-1.5 font-pixel text-xs text-dim">
            <span>퀘스트</span><span>가능 구간 · 조건</span>
          </div>
          {LEVEL_WINDOW_QUESTS.map(([name, window]) => (
            <div key={name} className="grid grid-cols-[2fr_1.2fr] gap-2 border-t border-edge/40 px-3 py-2 text-sm">
              <span className="text-ink">{name}</span>
              <span className="text-dim">{window}</span>
            </div>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="py-16 text-center text-dim">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-maple border-t-transparent" />
          퀘스트 데이터 분석 중...
        </div>
      ) : (
        <>
          <QuestTablesSection deliverQuests={deliverOnly} killQuests={killQuests} />

          <section className="pixel-panel p-5">
            <SectionTitle>연계 퀘스트 준비물 총량 ({num(chains.length)}묶음)</SectionTitle>
            <p className="mt-1 text-sm text-dim">
              선행 관계로 이어진 3개 이상 연계를 묶고, 체인 전체의 준비물·처치 수를 합산했습니다.
              「미리 준비」 목록을 다 들고 가면 체인을 끊김 없이 완주할 수 있습니다(퀘스트 진행 중 얻는 전용 아이템은 제외된 수치).
            </p>
            <div className="mt-3 grid gap-3">
              {chains.slice(0, chainCount).map((chain) => (
                <ChainCard key={chain.title} chain={chain} />
              ))}
            </div>
            {chainCount < chains.length && (
              <button
                type="button"
                onClick={() => setChainCount((n) => n + 10)}
                className="mt-3 min-h-11 w-full border-2 border-edge px-4 py-2 text-sm font-semibold text-maple hover:bg-surface2"
              >
                연계 묶음 더 보기 ({num(chains.length - chainCount)}개 남음) +
              </button>
            )}
          </section>

          <section className="pixel-panel p-5">
            <SectionTitle>몹 시너지 — 한 번 잡을 때 같이 진행</SectionTitle>
            <p className="mt-1 text-sm text-dim">
              같은 몬스터 처치를 요구하는 퀘스트끼리 묶었습니다. 사냥 전에 해당 퀘스트를 전부 수락해 두면 한 번의 사냥으로 여러 카운트를 올립니다.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {mobSynergy.slice(0, 16).map((m) => (
                <div key={`${m.id}-${m.name}`} className="border-2 border-edge p-3 text-sm">
                  <p className="font-bold text-ink">
                    {m.name} <span className="text-xs font-normal text-dim">— {m.quests.length}개 퀘스트</span>
                  </p>
                  <p className="mt-1 leading-6 text-dim">
                    {m.quests.map((q) => `${q.name}(${num(q.count)})`).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="pixel-panel p-5">
        <SectionTitle>주의사항 · 알려진 함정</SectionTitle>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink">
          <li className="bg-surface2 border-2 border-edge px-3 py-2">네펜데스 주스 재료 진행 중 <strong>나팔찌를 버리면 해당 퀘스트를 영구히 못 깹니다.</strong></li>
          <li className="bg-surface2 border-2 border-edge px-3 py-2">「해독된 통신문2」 완료 직후 암호화된 통신문을 버리고 3을 수락하면 히든 퀘스트 「해독된 통신문」이 추가로 발생합니다(완주자 검증).</li>
          <li className="bg-surface2 border-2 border-edge px-3 py-2">표지판(999마리) 같은 대형 처치 퀘스트도 완료 시 1개로 카운트됩니다 — 시간 대비 효율을 따져 후순위로.</li>
          <li className="bg-surface2 border-2 border-edge px-3 py-2">남은 장벽: 트리스탄의 후계자(마왕 발록 200회), 폐허 너머에(핑크빈 처치), 아이스버드(나리케인의 징표) — 엔드 콘텐츠와 연동됩니다.</li>
        </ul>
        <p className="mt-3 text-xs text-dim">
          퀘스트별 상세는 <Link href="/quest-roadmap" className="text-amber-900 dark:text-maple underline">퀘스트 로드맵</Link>,{" "}
          <Link href="/quests" className="text-amber-900 dark:text-maple underline">퀘스트 검색</Link>에서 확인하세요.
        </p>
      </section>

      <section className="pixel-panel p-5">
        <SectionTitle>참고한 자료</SectionTitle>
        <div className="mt-3 flex flex-wrap gap-2">
          {sourceLinks.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="border-2 border-edge px-3 py-2 text-sm text-ink transition-colors hover:border-maple hover:text-maple"
            >
              {s.label}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
