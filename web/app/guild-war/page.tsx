"use client";

import { useState } from "react";
import OfferingSolver from "./OfferingSolver";
import SettlementTool from "./SettlementTool";

type Tab = "guide" | "boxes" | "offering" | "settle";

const TABS: { key: Tab; label: string }[] = [
  { key: "guide", label: "공략 가이드" },
  { key: "boxes", label: "상자 배분" },
  { key: "offering", label: "제물 맞추기" },
  { key: "settle", label: "분배 정산" },
];

export default function GuildWarPage() {
  const [activeTab, setActiveTab] = useState<Tab>("guide");

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="font-pixel text-2xl font-bold mb-1">⚔️ 길드대항전</h1>
      <p className="text-sm text-dim mb-6">
        샤레니안 길드퀘스트 공략 · 보너스 상자 배분 · 제물 맞추기 솔버 · 분배금 정산
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
    name: "기사의 홀 — 롱기누스의 창 4개 수집",
    goal: "각 방에서 창을 점프 타격으로 떨어뜨려 4개 수집",
    tips: [
      "창은 높은 곳에 있어 점프해서 쳐야 떨어진다.",
      "다크사이트가 가능한 도적이 필요한 방이 있다 (도적 1인 필수인 이유).",
      "잠긴 방은 몬스터가 떨어뜨리는 열쇠로 연다.",
    ],
  },
  {
    icon: "⚖️",
    name: "정의의 방 — 창 봉헌",
    goal: "4곳의 봉인에 롱기누스의 창을 하나씩 꽂기",
    tips: [
      "발판 순서 암기·장애물 구간이 있는 점프맵. 텔레포트 법사와 헤이스트가 있으면 크게 수월해진다.",
      "4개 모두 봉헌하면 다음 구역이 열린다.",
    ],
  },
  {
    icon: "⛲",
    name: "현자의 분수 — 제물 맞추기 (야구게임)",
    goal: "석상 4개 앞에 제물을 하나씩 놓고 정답 조합 추리 (기회 7번)",
    tips: [
      "제물 4종(용맹의 훈장·지혜의 두루마리·오래된 음식·700년산 주니어 네키 술)은 주변 술 저장고·식량 창고의 몬스터가 드랍한다 — 사전 준비 불필요.",
      "제물을 놓고 길드마스터가 석상 NPC에게 말을 걸면 「올바른/틀린」 개수를 알려준다.",
      "7번 안에 못 맞추면 정답이 리셋되고 유령 몬스터가 소환되는 페널티가 있다.",
    ],
    link: { tab: "offering", label: "제물 맞추기 솔버 열기 →" },
  },
  {
    icon: "🌊",
    name: "지하 수로 — 샤렌 3세의 의류 수집",
    goal: "미로 4개를 돌파해 상자에서 의류 4종 획득",
    tips: [
      "대부분의 통로가 되돌아오는 가짜 길인 미로. 길을 아는 사람이 리드하면 빠르다.",
      "미로 안 몬스터가 잠긴 문을 여는 아이템을 떨어뜨린다.",
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
      "수호석을 버린 사람은 사망 위험이 있어 보통 30레벨 이하 저렙 캐릭터가 담당한다.",
      "30레벨 이하만 통과할 수 있는 포탈 구간도 있어 저렙 1인은 필수 인원이다.",
    ],
  },
  {
    icon: "👑",
    name: "에레고스의 왕좌 — 보스전",
    goal: "왕좌의 보석 「루비안」을 타격해 에레고스와 석상들을 소환, 처치",
    tips: [
      "석상들이 버프해제·힐+마법공격·스킬봉인·슬로우를 시전한다 — 힐+마공 석상부터 최우선 제거.",
      "방해 효과는 전부 석상 몫이므로 석상을 정리한 뒤 본체를 치는 게 편하다.",
      "에레고스는 언데드라 힐 공격이 유효하다. 저레벨·저체력 캐릭터는 즉사 주의.",
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

const MASTERY_BOOKS: [string, string, string][] = [
  ["아크메이지(썬/콜)", "엘퀴네스 30 · 이프리트 30", "0.35% · 0.40%"],
  ["아크메이지(불/독)", "엘퀴네스 30 · 페럴라이즈 30", "0.06% · 0.07%"],
  ["히어로", "어드밴스드 콤보 30", "0.06%"],
  ["나이트로드", "닌자스톰 30 · 쇼다운 30", "0.15% · 0.20%"],
  ["보우마스터", "피닉스 20", "0.20%"],
  ["신궁", "프리져 30", "0.002%"],
  ["섀도어", "암살 30", "0.02%"],
];

const SOURCES: [string, string][] = [
  ["나무위키 — 길드 대항전", "https://namu.wiki/w/%EA%B8%B8%EB%93%9C%20%EB%8C%80%ED%95%AD%EC%A0%84"],
  ["나무위키 — Mapleland/파티 퀘스트", "https://namu.wiki/w/Mapleland/%ED%8C%8C%ED%8B%B0%20%ED%80%98%EC%8A%A4%ED%8A%B8"],
  [
    "디시 메이플랜드 갤러리 — 길드대항전 가이드",
    "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=2246415",
  ],
  ["디시 메이플랜드 갤러리 — 드롭테이블", "https://m.dcinside.com/board/mapleland/2225091"],
  ["인벤 몬스터 DB — 에레고스", "https://maple.inven.co.kr/dataninfo/monster/detail.php?code=9300028"],
];

function GuideTab({ goTab }: { goTab: (t: Tab) => void }) {
  return (
    <div className="space-y-4">
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
              <b className="text-ink">30레벨 이하(전직 완료) 1인 필수</b>
            </p>
          </div>
          <div className="pixel-card p-3">
            <b>필수 스킬</b>
            <p className="text-xs text-dim mt-1 leading-relaxed">
              텔레포트 마스터 법사 1 · 다크사이트 도적 1 · 헤이스트(또는 플젬) 도적 1
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
              보너스 상자의 <b className="text-ink">4차 마스터리북</b>(어콤30 등)·60% 주문서 · 보스 드랍{" "}
              <b className="text-ink">나리케인의 징표</b>(Lv120 펜던트)
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
                <td>
                  주변 석상이 버프해제 / 힐+마법공격 / 스킬봉인 / 슬로우 시전 —{" "}
                  <b className="text-maple">힐+마공 석상 최우선 제거</b>
                </td>
              </tr>
              <tr>
                <td className="py-1.5 text-dim">드랍</td>
                <td>
                  나리케인의 징표 (Lv120 펜던트 · 올스탯+5 / 공+4 / 마력+8 / HP·MP+150 / 회피+15 / 이속·점프+5) —
                  나이트로드 효율이 높아 나로 우선 배분 관행
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 보상 */}
      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-sm text-ink">🎁 보상 — 보너스 상자 마스터리북</h2>
        <p className="text-xs text-dim leading-relaxed">
          보너스 상자에서 잡 물약·60% 주문서(박스당 약 2개)·고가 주문서와 함께 4차 마스터리북이 확률로 나온다.
          어콤30 등 일부 마북은 길드대항전에서만 수급되어 고가에 거래된다. 확률은 커뮤니티 집계치라 참고만 할 것.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-dim border-b-2 border-edge">
                <th className="py-1.5">직업</th>
                <th>마스터리북</th>
                <th>확률(참고치)</th>
              </tr>
            </thead>
            <tbody>
              {MASTERY_BOOKS.map(([job, book, rate]) => (
                <tr key={job} className="border-b border-edge/40">
                  <td className="py-1.5 font-bold">{job}</td>
                  <td>{book}</td>
                  <td className="text-dim">{rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-dim">
          드랍 정산이 필요하면{" "}
          <button type="button" onClick={() => goTab("settle")} className="font-pixel text-maple hover:underline">
            분배 정산 탭 →
          </button>
        </p>
      </section>

      {/* 준비물 체크리스트 */}
      <section className="pixel-panel p-5 space-y-2">
        <h2 className="font-pixel text-sm text-ink">✅ 출발 전 체크리스트</h2>
        <ul className="text-sm text-dim space-y-1 leading-relaxed">
          <li>☐ 길드장 또는 부길마 참석 + 같은 길드원 6인 이상</li>
          <li>☐ 30레벨 이하(1차/2차 전직 완료) 부캐 1인 — 전용 포탈 통과 · 수호석 봉헌 담당</li>
          <li>☐ 텔레포트 마스터 법사 · 다크사이트 도적 · 헤이스트 도적</li>
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
