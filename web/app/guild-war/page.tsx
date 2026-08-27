"use client";

import { useState } from "react";
import OfferingSolver from "./OfferingSolver";
import SettlementTool from "./SettlementTool";
import { GW_BOX_COUNT, GW_BOX_DROPS } from "./dropData";

type Tab = "guide" | "drops" | "boxes" | "offering" | "settle";

const TABS: { key: Tab; label: string }[] = [
  { key: "guide", label: "공략 가이드" },
  { key: "drops", label: "드랍테이블" },
  { key: "boxes", label: "상자 배분" },
  { key: "offering", label: "제물 맞추기" },
  { key: "settle", label: "분배 정산" },
];

export default function GuildWarPage() {
  const [activeTab, setActiveTab] = useState<Tab>("guide");

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="font-pixel text-2xl font-bold mb-1">⚔️ 샤레니안 길드대항전</h1>
      <p className="text-sm text-dim mb-6">
        페리온 유적발굴단 캠프에서 시작하는 길드퀘스트 · 공략 · 보너스 상자 배분 · 제물 솔버 · 분배금 정산
      </p>

      <div className="flex gap-1 mb-6 bg-surface2 p-1 w-fit max-w-full overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm whitespace-nowrap transition-colors ${
              activeTab === t.key ? "pixel-btn" : "font-pixel text-dim hover:text-maple"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "guide" && <GuideTab goTab={setActiveTab} />}
      {activeTab === "drops" && <DropTab goTab={setActiveTab} />}
      {activeTab === "boxes" && <BoxTab />}
      {activeTab === "offering" && <OfferingSolver />}
      {activeTab === "settle" && <SettlementTool />}
    </div>
  );
}

/* ---------------------------------- 가이드 탭 ---------------------------------- */

const STAGES: { icon: string; name: string; goal: string; tips: string[]; link?: { tab: Tab; label: string } }[] = [
  {
    icon: "💎",
    name: "준비 — 수호석 착용",
    goal: "입장 직후 보라색 수정을 기본공격으로 부숴 「수호석」을 얻고 전원 착용",
    tips: [
      "수호석을 착용하지 않으면 진행 중 자동으로 사망하니 입장하면 가장 먼저 챙긴다.",
      "수호석은 마지막 왕의 회랑에서 문을 여는 열쇠로도 쓰이므로 버리지 말 것.",
    ],
  },
  {
    icon: "🚪",
    name: "샤레니안 성문 — 석상 순서 맞추기",
    goal: "반짝인 석상을 순서대로 기본공격으로 1대씩 타격 (4개 → 5개 → 6개, 3라운드)",
    tips: [
      "순서를 틀리면 처음부터 다시. 암기 잘하는 2명이 좌/우를 나눠 담당하고 나머지는 대기하는 게 정석.",
      "타격은 반드시 기본공격(스킬 X)으로 한 대씩만.",
    ],
  },
  {
    icon: "🗡️",
    name: "기사의 홀 — 롱기누스의 창 수집",
    goal: "신념의 방 점프맵에서 3개, 서약의 방 잠긴 구역에서 1개 수집",
    tips: [
      "신념의 방은 난이도가 다른 점프맵 3개. 꼭대기의 창을 기본공격으로 떨어뜨린 뒤 점프하며 주워야 한다.",
      "용맹의 방 몬스터가 떨어뜨린 녹슨 열쇠로 다음 구역을 열고, 법사가 텔레포트로 상자에서 은색 열쇠를 꺼낸다.",
      "은색 열쇠를 받은 도적이 다크사이트로 골렘 구간을 지나 서약의 방을 열어 마지막 창을 가져온다.",
    ],
  },
  {
    icon: "⚖️",
    name: "정의의 방 — 롱기누스의 창 봉헌",
    goal: "4개 점프맵 꼭대기의 제단에 창을 하나씩 내려놓기",
    tips: [
      "왼쪽 두 번째 구간은 헤이스트가 필요하고, 맨 오른쪽 구간은 텔레포트가 필요하다.",
      "발판 구간의 메이플랜드 확인 순서는 2 → 1 → 5 → 2 → 2 → 1 → 2. 창 4개를 모두 올리면 다음 구역이 열린다.",
    ],
  },
  {
    icon: "⛲",
    name: "현자의 분수 — 제물 맞추기 (야구게임)",
    goal: "석상 4개 앞에 제물을 하나씩 놓고 정답 조합 추리 (기회 7번)",
    tips: [
      "용맹의 훈장·지혜의 두루마리는 중앙 몬스터가 드랍하고, 술은 왼쪽 술 저장고 상자, 음식은 오른쪽 점프맵 접시에서 얻는다.",
      "제물을 놓고 길드마스터가 석상 NPC에게 말을 걸면 「올바른/틀린」 개수를 알려준다.",
      "같은 제물이 여러 번 정답일 수 있다. 7번 실패하면 몬스터가 다시 나오고 새 조합으로 처음부터 재시작한다.",
    ],
    link: { tab: "offering", label: "제물 맞추기 솔버 열기 →" },
  },
  {
    icon: "🌊",
    name: "지하수로·수로의 미로 — 유품 수집",
    goal: "네 갈래 방에서 신발·하의·상의·왕관을 하나씩 획득",
    tips: [
      "30레벨 이하 길드원은 전용 방에서 악마 슬라임 20마리를 처치해야 하므로 이 단계에 반드시 필요하다.",
      "다른 방은 퍼펫골렘·가고일 처치와 점프맵으로 구성된다. 상단 가고일은 원거리 또는 광역 공격 담당이 유리하다.",
      "한 번 다음 구역으로 넘어가면 되돌아가기 까다로우므로 각 방에서 유품을 챙겼는지 확인한다.",
    ],
  },
  {
    icon: "🪦",
    name: "샤렌 3세의 무덤 — 유품 배치",
    goal: "해골 위에 신발 → 하의 → 상의 → 왕관 순서로 내려놓기",
    tips: ["순서가 틀리면 인정되지 않는다. 한 명이 순서대로 놓는 게 안전하다."],
  },
  {
    icon: "🗝️",
    name: "왕의 회랑 — 수호석 봉헌",
    goal: "문 앞에 수호석을 버려서 개방",
    tips: [
      "장비창에서 수호석 귀고리를 바닥으로 직접 드래그해야 한다. 단순 장착 해제만 하면 문은 열리지 않는다.",
      "봉헌자는 사망한다. 누구나 담당할 수 있지만 보통 앞 단계의 30레벨 이하 캐릭터가 맡는다.",
    ],
  },
  {
    icon: "👑",
    name: "에레고스의 왕좌 — 보스전",
    goal: "왕좌의 보석 「루비안」을 타격해 에레고스와 석상들을 소환, 처치",
    tips: [
      "주변 석상들이 1/1·저주·디스펠 등 방해 효과를 사용하므로 함께 정리하는 편이 안전하다.",
      "에레고스는 언데드라 힐 공격이 유효하다. 저레벨·저체력 캐릭터는 즉사 주의.",
      "처치 후 나온 루비안은 길드장/부길마가 획득해 NPC와 대화해야 보물창고로 이동한다.",
    ],
  },
  {
    icon: "📦",
    name: "보너스 — 샤렌 3세의 보물창고",
    goal: "제한시간 안에 기본공격으로 상자를 부숴 보상 획득",
    tips: [
      "시간이 짧아서(커뮤니티 기준 18초/상자 24개) 인원별 담당 구역을 미리 정해두는 게 핵심.",
      "상자에서 60% 주문서·고가 주문서·4차 마스터리북(확률)이 나온다.",
    ],
    link: { tab: "boxes", label: "인원수별 상자 배분도 보기 →" },
  },
];

const SOURCES: [string, string][] = [
  ["메이플랜드 공식 — 2025년 2월 28일 길드대항전 업데이트", "https://maple.land/board/notices/uxdrissgrm738d5h5bhxvt6m"],
  [
    "디시 메이플랜드 갤러리 — 길드대항전 가이드",
    "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=2246415",
  ],
  ["디시 메이플랜드 갤러리 — 드롭테이블", "https://m.dcinside.com/board/mapleland/2225091"],
  [
    "디시 메이플랜드 갤러리 — 보상맵 리액터 목록/확률",
    "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=1235530",
  ],
  ["인벤 몬스터 DB — 에레고스", "https://maple.inven.co.kr/dataninfo/monster/detail.php?code=9300028"],
  ["MapleRoyals — 구형 샤레니안 GPQ 단계별 교차검증", "https://royals.ms/forum/threads/gpq-guild-pq-guide.199116/"],
];

function GuideTab({ goTab }: { goTab: (t: Tab) => void }) {
  return (
    <div className="space-y-4">
      <section className="border-2 border-maple bg-maple/10 p-4 text-sm leading-relaxed">
        <b className="font-pixel text-xs text-maple">범위 안내</b>
        <p className="mt-1 text-dim">
          이 페이지는 <b className="text-ink">페리온 샤레니안 유적 길드대항전</b>만 다룹니다. 마스테리아의
          크림슨우드 성채 파티퀘스트와는 별개의 콘텐츠입니다.
        </p>
      </section>
      {/* 한눈에 보기 */}
      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-sm text-ink">📌 한눈에 보기</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div className="pixel-card p-3">
            <b>입장</b>
            <p className="text-xs text-dim mt-1 leading-relaxed">
              페리온 <b className="text-ink">유적발굴단 캠프</b> · NPC 슈앵에게 길드장/부길마가 「탐사대 등록」 →
              3분 대기 후 샤레니안 진입
            </p>
          </div>
          <div className="pixel-card p-3">
            <b>인원</b>
            <p className="text-xs text-dim mt-1 leading-relaxed">
              길드장 또는 부길마 포함 <b className="text-ink">같은 길드원 6~30인</b> ·{" "}
              <b className="text-ink">Lv.10~30 길드원 1인 필수</b>
            </p>
          </div>
          <div className="pixel-card p-3">
            <b>필수 스킬</b>
            <p className="text-xs text-dim mt-1 leading-relaxed">
              텔레포트 법사 1 · 다크사이트+헤이스트 도적 1 · 원거리/광역 공격 담당 1
            </p>
          </div>
          <div className="pixel-card p-3">
            <b>소요 시간</b>
            <p className="text-xs text-dim mt-1 leading-relaxed">
              제한시간 90분 · 숙련 길드 기준 1판 <b className="text-ink">20~30분</b> — 보통 여러 트라이를 연달아
              돈다
            </p>
          </div>
          <div className="pixel-card p-3">
            <b>보스</b>
            <p className="text-xs text-dim mt-1 leading-relaxed">
              에레고스 (Lv115 · HP 170만 · 언데드 · 전 속성 반감)
            </p>
          </div>
          <div className="pixel-card p-3">
            <b>핵심 보상</b>
            <p className="text-xs text-dim mt-1 leading-relaxed">
              보너스 상자의 <b className="text-ink">4차 마스터리북</b>(어콤30 등) · 60% 주문서 · 소비 아이템
            </p>
          </div>
        </div>
      </section>

      {/* 진행 순서 */}
      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-sm text-ink">🗺️ 진행 순서</h2>
        <ol className="space-y-3">
          {STAGES.map((s, i) => (
            <li key={i} className="pixel-card p-3">
              <div className="flex items-baseline gap-2">
                <span className="font-pixel text-xs text-maple shrink-0">{i === 0 ? "준비" : `${i}단계`}</span>
                <b className="text-sm">
                  {s.icon} {s.name}
                </b>
              </div>
              <p className="text-xs text-ink mt-1.5">{s.goal}</p>
              <ul className="mt-1.5 space-y-0.5">
                {s.tips.map((tip, j) => (
                  <li key={j} className="text-xs text-dim leading-relaxed">
                    · {tip}
                  </li>
                ))}
              </ul>
              {s.link && (
                <button
                  type="button"
                  onClick={() => goTab(s.link!.tab)}
                  className="mt-2 text-xs font-pixel text-maple hover:underline"
                >
                  {s.link.label}
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* 보스 상세 */}
      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-sm text-ink">👑 보스 — 에레고스</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              <tr className="border-b border-edge/40">
                <td className="py-1.5 text-dim w-28">기본 정보</td>
                <td>Lv 115 · HP 1,700,000 · 경험치 150,000</td>
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-1.5 text-dim">속성</td>
                <td>얼음·불·전기·성·독 전부 반감 · 언데드(힐 공격 유효)</td>
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-1.5 text-dim">석상 기믹</td>
                <td>주변 석상이 1/1 · 저주 · 디스펠 등 방해 효과 사용 — 함께 정리하면 안전</td>
              </tr>
              <tr>
                <td className="py-1.5 text-dim">드랍</td>
                <td>루비안(진행용 퀘스트 아이템) · 획득 후 NPC와 대화해 보물창고 입장</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 보상 */}
      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-sm text-ink">🎁 보상</h2>
        <p className="text-sm text-dim leading-relaxed">
          보너스 상자에서 물약·60% 주문서 23종·4차 마스터리북 13종이 확률로 나온다. 어콤30 등 일부 마북은
          길드대항전에서만 수급되어 고가에 거래된다. 전체 아이템과 확률·판당 기대치는 드랍테이블 탭에 정리해뒀다.
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          <button type="button" onClick={() => goTab("drops")} className="font-pixel text-maple hover:underline">
            드랍테이블 탭 →
          </button>
          <button type="button" onClick={() => goTab("settle")} className="font-pixel text-maple hover:underline">
            분배 정산 탭 →
          </button>
        </div>
      </section>

      {/* 준비물 체크리스트 */}
      <section className="pixel-panel p-5 space-y-2">
        <h2 className="font-pixel text-sm text-ink">✅ 출발 전 체크리스트</h2>
        <ul className="text-sm text-dim space-y-1 leading-relaxed">
          <li>☐ 길드장 또는 부길마 참석 + 같은 길드원 6인 이상</li>
          <li>☐ Lv.10~30 길드원 1인 — 지하수로의 악마 슬라임 전용 방 담당</li>
          <li>☐ 텔레포트 법사 · 다크사이트+헤이스트 도적 · 원거리/광역 공격 담당</li>
          <li>☐ 보스전 물약 (제물 4종은 퀘스트 안에서 드랍으로 조달되므로 사전 파밍 불필요)</li>
          <li>☐ 상자 배분 담당 구역 미리 정하기 (상자 배분 탭 참고)</li>
        </ul>
      </section>

      {/* 출처 */}
      <section className="pixel-panel p-5 space-y-2">
        <h2 className="font-pixel text-sm text-ink">📚 참고 출처</h2>
        <ul className="text-xs text-dim space-y-1">
          {SOURCES.map(([label, url]) => (
            <li key={url}>
              ·{" "}
              <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-maple underline">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-dim/70 leading-relaxed">
          보너스 맵 제한시간·상자 수, 마스터리북 확률 등 일부 수치는 커뮤니티 집계라 소스 간 차이가 있다. 실제
          진행과 다른 부분이 있으면 길드 게시판으로 제보해 주세요.
        </p>
      </section>
    </div>
  );
}

/* ---------------------------------- 드랍테이블 탭 ---------------------------------- */

// 1판(상자 GW_BOX_COUNT개) 기준 기대 개수. 1 미만이면 "약 N판당 1개"로 표기.
function perRun(rate: number): string {
  const expected = (rate / 100) * GW_BOX_COUNT;
  if (expected >= 1) return `판당 약 ${expected.toFixed(1)}개`;
  return `약 ${Math.round(1 / expected)}판당 1개`;
}

function DropTab({ goTab }: { goTab: (t: Tab) => void }) {
  const books = GW_BOX_DROPS.filter((d) => d.cat === "마북").sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const scrolls = GW_BOX_DROPS.filter((d) => d.cat === "주문서").sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const consumables = GW_BOX_DROPS.filter((d) => d.cat === "소비");
  const totalRate = GW_BOX_DROPS.reduce((a, d) => a + d.rate, 0);

  return (
    <div className="space-y-4">
      <section className="pixel-panel p-5 space-y-2">
        <h2 className="font-pixel text-sm text-ink">📊 보너스 상자 드랍테이블</h2>
        <p className="text-sm text-dim leading-relaxed">
          확률은 보너스 맵(샤렌 3세의 보물창고) <b className="text-ink">상자 1개당</b> 기준, 커뮤니티(디시 메랜갤)
          집계치다. 42종 합계 {totalRate.toFixed(2)}% — 나머지 약 {(100 - totalRate).toFixed(1)}%는 아무것도 나오지
          않는다. 기대치는 1판 = 상자 {GW_BOX_COUNT}개를 전부 부순다고 가정한 값.
        </p>
      </section>

      {/* 마스터리북 */}
      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-sm text-ink">📕 마스터리북 (13종) — 희귀한 순</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-dim border-b-2 border-edge">
                <th className="py-1.5">약어</th>
                <th>스킬</th>
                <th>직업</th>
                <th className="text-right">상자당 확률</th>
                <th className="text-right">기대치</th>
              </tr>
            </thead>
            <tbody>
              {books.map((d) => (
                <tr key={d.key} className="border-b border-edge/40">
                  <td className="py-1.5 font-bold text-maple">{d.key}</td>
                  <td>{d.name}</td>
                  <td className="text-dim">{d.job}</td>
                  <td className="text-right tabular-nums">{d.rate}%</td>
                  <td className="text-right text-dim text-xs">{perRun(d.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 주문서 */}
      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-sm text-ink">
          📜 주문서 60% (23종) <span className="text-xs text-dim font-normal">— 전부 상자당 0.4% · {perRun(0.4)}</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {scrolls.map((d) => (
            <div key={d.key} className="pixel-card p-2">
              <b className="text-sm text-maple">{d.key}</b>
              <p className="text-xs text-dim mt-0.5 leading-snug">{d.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 소비/기타 */}
      <section className="pixel-panel p-5 space-y-3 max-w-xl">
        <h2 className="font-pixel text-sm text-ink">🧪 소비 · 기타</h2>
        <table className="w-full text-sm">
          <tbody>
            {consumables.map((d) => (
              <tr key={d.key} className="border-b border-edge/40">
                <td className="py-1.5">{d.name}</td>
                <td className="text-right tabular-nums text-dim">{d.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-dim leading-relaxed">
          에레고스가 떨어뜨리는 루비안은 보물창고 진입용 퀘스트 아이템입니다. 나리케인의 징표는 크림슨우드 성채
          보상이므로 이 목록에 포함하지 않습니다.
        </p>
      </section>

      <p className="text-xs text-dim">
        드랍한 아이템을 나눌 땐{" "}
        <button type="button" onClick={() => goTab("settle")} className="font-pixel text-maple hover:underline">
          분배 정산 탭 →
        </button>
      </p>
    </div>
  );
}

/* ---------------------------------- 상자 배분 탭 ---------------------------------- */

const BOX_COUNTS = [4, 5, 6, 7] as const;

function BoxTab() {
  const [men, setMen] = useState<(typeof BOX_COUNTS)[number]>(6);

  return (
    <div className="space-y-4">
      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-sm text-ink">📦 보너스 상자 담당 구역</h2>
        <p className="text-sm text-dim leading-relaxed">
          클리어 후 보너스 맵(샤렌 3세의 보물창고)은 제한시간이 매우 짧아, 입장 전에 인원별 담당 구역을 정해두고
          각자 자기 번호 구역의 상자만 부숴야 전부 먹을 수 있다. 상자는 <b className="text-ink">기본공격</b>으로
          부순다.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-pixel text-xs text-dim">참여 인원:</span>
          {BOX_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMen(n)}
              className={`px-4 py-2 font-pixel text-xs border-2 transition-colors ${
                men === n ? "border-maple bg-maple/10 text-maple" : "border-edge text-dim hover:text-maple"
              }`}
            >
              {n}인
            </button>
          ))}
        </div>
        <div className="border-2 border-edge overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/guild-war/box-${men}man.jpeg`}
            alt={`길드대항전 보너스 상자 ${men}인 담당 구역 배분도`}
            className="w-full h-auto"
          />
        </div>
        <ul className="text-xs text-dim space-y-1 leading-relaxed">
          <li>· 노란 테두리와 숫자 = 각 인원의 담당 구역 (자기 번호 구역의 상자만 부순다)</li>
          <li>
            · 스킬 아이콘이 표시된 구역은 <b className="text-ink">텔레포트</b>·<b className="text-ink">헤이스트</b>가
            있어야 시간 안에 돌 수 있는 자리 — 법사/도적 우선 배치
          </li>
        </ul>
      </section>
    </div>
  );
}
