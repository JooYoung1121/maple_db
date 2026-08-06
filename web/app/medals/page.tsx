"use client";

import { useState } from "react";
import Link from "next/link";

/* ── 훈장 데이터 ──
 * 탐험가 훈장 스탯은 메이플랜드 정상화 수치 (maplelandzzul.gg/titles 기준, 원작 v92보다 하향).
 * 기부왕·레벨 훈장은 원작(GMS v92) 수치가 그대로 유지됨을 DB 대조로 확인.
 * 아이콘: maplestory.io GMS v92.
 */
interface Medal {
  id: number;
  name: string;
  level: number;
  stats: string;
  condition: string;
  note?: string;
}

const EXPLORER_STEPS: { tier: string; medals: Medal[] }[] = [
  {
    tier: "1단계 — 지역 탐험",
    medals: [
      { id: 1142127, name: "초보 탐험가", level: 15, stats: "HP+25 · MP+25", condition: "빅토리아 아일랜드 각 지역 순회 방문" },
      { id: 1142128, name: "슬리피우드 탐험가", level: 50, stats: "HP+35 · MP+35", condition: "슬리피우드 던전 일대 순회" },
      { id: 1142113, name: "엘나스 산맥 탐험가", level: 50, stats: "HP+40 · MP+40", condition: "엘나스 산맥 일대 순회" },
      { id: 1142114, name: "루더스 호수 탐험가", level: 40, stats: "HP+40 · MP+40", condition: "루더스 호수 11개 맵 순회" },
      { id: 1142115, name: "해저 탐험가", level: 40, stats: "HP+40 · MP+40", condition: "아쿠아로드 일대 순회" },
      { id: 1142116, name: "무릉도원 탐험가", level: 50, stats: "HP+40 · MP+40", condition: "무릉도원 일대 순회" },
      { id: 1142118, name: "미나르 숲 탐험가", level: 70, stats: "HP+40 · MP+40", condition: "리프레 순회 + 중급 보스 전투", note: "요구 레벨 60부터 진행 가능" },
      { id: 1142117, name: "니할사막 탐험가", level: 70, stats: "HP+40 · MP+40", condition: "히든맵 입장 + 연계 퀘스트" },
    ],
  },
  {
    tier: "2단계 — 대륙 통합",
    medals: [
      { id: 1142112, name: "빅토리아 탐험가", level: 50, stats: "HP+45 · MP+45", condition: "빅토리아 계열 탐험가 훈장 통합" },
      { id: 1142119, name: "오시리아 탐험가", level: 70, stats: "올스탯+1 · HP+50 · MP+50", condition: "오시리아 6개 지역 탐험가 훈장 전부 수집" },
    ],
  },
  {
    tier: "3단계 — 최종",
    medals: [
      { id: 1142120, name: "메이플 탐험가", level: 70, stats: "올스탯+1 · HP+60 · MP+60", condition: "빅토리아 + 오시리아 탐험가 동시 달성" },
    ],
  },
];

const DONOR_ACTIVE: Medal[] = [
  { id: 1142016, name: "페리온 기부왕", level: 0, stats: "STR+10 · HP+20", condition: "페리온 달리어 신관 기부 1위" },
  { id: 1142014, name: "헤네시스 기부왕", level: 0, stats: "DEX+10 · HP+20 · 이속+10", condition: "헤네시스 기부 1위" },
  { id: 1142015, name: "엘리니아 기부왕", level: 0, stats: "INT+10 · HP+20", condition: "엘리니아 기부 1위" },
  { id: 1142017, name: "커닝시티 기부왕", level: 0, stats: "LUK+10 · HP+20 · 이속+10", condition: "커닝시티 기부 1위" },
  { id: 1142018, name: "슬리피우드 기부왕", level: 0, stats: "올스탯+10 · HP+50 · 이속+10 · 점프+10", condition: "슬리피우드 기부 1위" },
  { id: 1142030, name: "리스항구 기부왕", level: 0, stats: "올스탯+10 · HP+100", condition: "리스항구 기부 1위" },
];

const DONOR_OTHERS: Medal[] = [
  { id: 1142019, name: "노틸러스 기부왕", level: 0, stats: "STR+10 · DEX+10 · HP+50", condition: "" },
  { id: 1142020, name: "엘나스 기부왕", level: 0, stats: "INT+10 · LUK+3 · 명중+5 · HP+10", condition: "" },
  { id: 1142021, name: "아쿠아리움 기부왕", level: 0, stats: "STR+10 · DEX+10 · 회피+10", condition: "" },
  { id: 1142031, name: "오르비스 기부왕", level: 0, stats: "DEX+5 · 명중+10 · HP+40", condition: "" },
  { id: 1142022, name: "루디브리엄 기부왕", level: 0, stats: "LUK+10 · 회피+5 · HP+20", condition: "" },
  { id: 1142023, name: "지구방위본부 기부왕", level: 0, stats: "STR+10 · DEX+10 · 명중+10", condition: "" },
  { id: 1142024, name: "아랫마을 기부왕", level: 0, stats: "올스탯+10 · 명중+5 · 회피+5 · HP+30", condition: "" },
  { id: 1142025, name: "리프레 기부왕", level: 0, stats: "STR+5 · 명중+5 · HP+40", condition: "" },
  { id: 1142026, name: "무릉 기부왕", level: 0, stats: "명중+10 · HP+30", condition: "" },
  { id: 1142027, name: "백초마을 기부왕", level: 0, stats: "DEX+5 · 회피+10 · HP+30", condition: "" },
  { id: 1142028, name: "아리안트 기부왕", level: 0, stats: "LUK+8 · 명중+5 · HP+30", condition: "" },
  { id: 1142029, name: "마가티아 기부왕", level: 0, stats: "INT+8 · 명중+10 · HP+30", condition: "" },
];

const LEVEL_MEDALS: Medal[] = [
  { id: 1142107, name: "초보 모험가", level: 8, stats: "HP+50 · MP+50", condition: "레벨 달성" },
  { id: 1142108, name: "주니어 모험가", level: 30, stats: "HP+100 · MP+100", condition: "레벨 달성" },
  { id: 1142109, name: "베테랑 모험가", level: 70, stats: "올스탯+1 · HP+150 · MP+150", condition: "레벨 달성" },
  { id: 1142110, name: "마스터 모험가", level: 120, stats: "올스탯+2 · HP+200 · MP+200", condition: "레벨 달성" },
];

const ETC_MEDALS: Medal[] = [
  { id: 1142032, name: "저주를 푼 자의 훈장", level: 0, stats: "올스탯+4 · 이속+10 · 점프+5", condition: "할로윈 이벤트 최종 보상 (가면 수집 → 퍼즐 → NPC 순회)", note: "기간 한정 이벤트 훈장" },
];

/* 무릉도장 수행자 훈장 — 층별 보스 대표만 발췌 (8/7 출시, 실제 지급 조건 확인 중) */
const DOJO_PREVIEW: Medal[] = [
  { id: 1142033, name: "마노 수행자", level: 0, stats: "명중+1", condition: "마노 100회 처치 (원작 · 메랜 확인 중)" },
  { id: 1142048, name: "구미호 수행자", level: 0, stats: "명중+6 · 회피+5 · 이속+5", condition: "구미호 100회 처치 (원작 · 메랜 확인 중)" },
  { id: 1142063, name: "파풀라투스 수행자", level: 0, stats: "물/마방+15 · 명중+7 · 회피+7 · 이속+7 · HP+50", condition: "파풀라투스 100회 처치 (원작 · 메랜 확인 중)" },
  { id: 1142064, name: "무릉도장 정복자", level: 0, stats: "공+5 · 마력+5 · 물/마방+15 · 명중+7 · 회피+7 · 이속+7 · HP+50", condition: "무공 100회 처치 (원작 · 메랜 확인 중)" },
];

function iconUrl(id: number) {
  return `https://maplestory.io/api/gms/92/item/${id}/icon`;
}

function MedalCard({ m }: { m: Medal }) {
  return (
    <Link href={`/items/${m.id}`} className="pixel-card flex items-center gap-3 px-3 py-2.5 hover:border-maple transition-colors">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconUrl(m.id)} alt="" className="w-9 h-9 object-contain shrink-0" loading="lazy" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-semibold truncate">{m.name}</span>
          {m.level > 0 && <span className="text-[11px] text-dim shrink-0">Lv.{m.level}</span>}
        </span>
        <span className="block text-xs text-skill">{m.stats}</span>
        {m.condition && <span className="block text-xs text-dim mt-0.5">{m.condition}</span>}
        {m.note && <span className="block text-[11px] text-dim">※ {m.note}</span>}
      </span>
    </Link>
  );
}

export default function MedalsPage() {
  const [showOtherDonors, setShowOtherDonors] = useState(false);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-pixel text-2xl font-bold mb-1">🎖️ 훈장 가이드</h1>
      <p className="text-sm text-dim mb-4">
        캐릭터 이름 아래에 표시되는 장착형 훈장 — 획득 조건과 스탯 정리.
        탐험가 훈장 스탯은 <span className="text-maple">메이플랜드 정상화 수치</span>(원작보다 하향)를 반영했습니다.
      </p>

      {/* 탐험가 트리 */}
      <section className="mb-8">
        <h2 className="font-pixel text-lg font-semibold mb-1 text-ink">🧭 탐험가 훈장 트리</h2>
        <p className="text-xs text-dim mb-3">
          지역 순회 방문으로 획득 — 1단계 지역 훈장을 모아 대륙 통합, 최종적으로 메이플 탐험가까지 이어집니다.
        </p>
        {EXPLORER_STEPS.map((step) => (
          <div key={step.tier} className="mb-4">
            <h3 className="text-xs font-pixel text-maple mb-1.5">{step.tier}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {step.medals.map((m) => <MedalCard key={m.id} m={m} />)}
            </div>
          </div>
        ))}
      </section>

      {/* 기부왕 */}
      <section className="mb-8">
        <h2 className="font-pixel text-lg font-semibold mb-1 text-ink">💰 기부왕 훈장</h2>
        <p className="text-xs text-dim mb-3">
          마을 신관 NPC에게 기부한 최고액 1위에게 지급 — <span className="text-ink">매월 초기화</span>되며 1위를 뺏기면 훈장도 사라집니다. (2.0에서 6/1부터 활성)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DONOR_ACTIVE.map((m) => <MedalCard key={m.id} m={m} />)}
        </div>
        <button
          onClick={() => setShowOtherDonors(!showOtherDonors)}
          className="mt-2 px-3 py-1.5 text-xs font-pixel border-2 border-edge text-dim hover:text-maple hover:border-maple transition-colors"
        >
          {showOtherDonors ? "▲ 접기" : "▼ 그 외 마을 12곳 (메랜 활성 여부 미확인)"}
        </button>
        {showOtherDonors && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {DONOR_OTHERS.map((m) => <MedalCard key={m.id} m={m} />)}
          </div>
        )}
      </section>

      {/* 레벨 훈장 */}
      <section className="mb-8">
        <h2 className="font-pixel text-lg font-semibold mb-1 text-ink">📈 모험가 (레벨) 훈장</h2>
        <p className="text-xs text-dim mb-3">레벨 달성 시 획득하는 기본 훈장.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {LEVEL_MEDALS.map((m) => <MedalCard key={m.id} m={m} />)}
        </div>
      </section>

      {/* 이벤트/기타 */}
      <section className="mb-8">
        <h2 className="font-pixel text-lg font-semibold mb-1 text-ink">🎃 이벤트 · 기타</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ETC_MEDALS.map((m) => <MedalCard key={m.id} m={m} />)}
        </div>
      </section>

      {/* 무릉도장 */}
      <section className="mb-8">
        <h2 className="font-pixel text-lg font-semibold mb-1 text-ink">🥋 무릉도장 수행자 훈장 <span className="text-xs font-normal text-dim">(8/7 업데이트 · 지급 확인 중)</span></h2>
        <p className="text-xs text-dim mb-3">
          원작에는 층별 보스마다 수행자 훈장 32종 + 정복자 훈장이 있습니다. 메랜 실제 지급 여부·횟수·기간을 확인 중입니다. <Link href="/dojo" className="text-maple underline">무릉도장 전체 공략 보기</Link> (대표 발췌)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DOJO_PREVIEW.map((m) => <MedalCard key={m.id} m={m} />)}
        </div>
      </section>

      <div className="pixel-panel p-4">
        <p className="text-[11px] text-dim leading-relaxed">
          ※ 탐험가 훈장 수치는 메이플랜드 라이브(정상화) 기준 — 출처: maplelandzzul.gg/titles · 디시 메랜갤 정리글.
          기부왕·레벨 훈장은 원작(GMS v92) 수치가 유지됨을 확인했습니다.
          아이템 카드를 누르면 상세 페이지로 이동합니다 (상세의 스탯은 원작 기준일 수 있음).
          실측과 다른 수치는 정보공유 게시판으로 제보해 주세요.
        </p>
      </div>
    </div>
  );
}
