"use client";

import Link from "next/link";
import { useState } from "react";

/* ── 혼테일 공략 — 추억길드 헤딩 실측 정리 (요정주영/비숍 디스코드 정리본 기반) ── */

/* 필요 명중률 (파츠 L160 기준, 캐릭터가 1레벨 낮을 때마다 명중 추가 필요) */
const ACC_TABLE: { part: string; avoid: number; acc: number; perLevel: number; note?: string }[] = [
  { part: "왼쪽머리 (선발대)", avoid: 18, acc: 66, perLevel: 2.4, note: "본체 전 동굴 머리" },
  { part: "오른쪽머리 (선발대)", avoid: 18, acc: 66, perLevel: 2.4, note: "본체 전 동굴 머리" },
  { part: "머리A (좌)", avoid: 43, acc: 158, perLevel: 5.733 },
  { part: "머리B (중앙)", avoid: 45, acc: 165, perLevel: 6 },
  { part: "머리C (우)", avoid: 43, acc: 158, perLevel: 5.733 },
  { part: "왼손", avoid: 40, acc: 147, perLevel: 5.333 },
  { part: "오른손", avoid: 40, acc: 147, perLevel: 5.333 },
  { part: "날개", avoid: 42, acc: 154, perLevel: 5.6 },
  { part: "다리", avoid: 42, acc: 154, perLevel: 5.6 },
  { part: "꼬리", avoid: 40, acc: 147, perLevel: 5.333 },
];

/* 직업별 준비물 · 합류 기준 */
const JOB_PREP: { job: string; icon: string; items: string[]; join: string[] }[] = [
  {
    job: "전사",
    icon: "⚔️",
    items: [
      "우유 1,000개 이상 + 치즈 500개 이상",
      "우유 자동물약 세팅, 필요할 때마다 치즈/우유 손컨으로 체력 10,000 이상 유지 필수",
    ],
    join: [
      "레벨 155 이상 또는 스탠스 30 — 어려우면 스탠스 10이라도 + 명중 확보",
      "파티 구성에 따라 그 외에도 참여 가능",
    ],
  },
  {
    job: "궁수 (보마·신궁)",
    icon: "🏹",
    items: [
      "우유 1,000개 이상 + 치즈 500개 (또는 쭈쭈바 1,000개 이상)",
      "회피가 낮아 미스가 적고 5,000+ 데미지가 자주 들어옴 → 손컨용 물약 필수",
      "체력 7,000 이상 유지. 맥뎀은 쭈바로 못 버틸 수 있어 익숙해질 때까진 치즈 손컨 추천",
    ],
    join: [
      "체력 7,000 이상 · 손컨에 자신 있는 사람",
      "샤프아이즈는 공대에 한 명만 20~30이면 충분 — 레벨·체력 맞추는 게 우선",
    ],
  },
  {
    job: "나이트로드",
    icon: "🗡️",
    items: [
      "무조건 우유 자동물약 세팅 — 치즈 세팅+손컨으로 아끼려다 주 딜러 딜로스 나면 더 손해",
    ],
    join: ["체력 7,000 이상이면 합류 가능", "페이크 높을수록 환영, 어려우면 레벨 우선"],
  },
  {
    job: "섀도어",
    icon: "🥷",
    items: [
      "우유 500개 이상",
      "부스트 덕에 딜 타임엔 피격이 적은 편",
      "개인유혹 담당이면 헤이스트 반드시 끄고(가짜머리·다리/꼬리 구간) 다크사이트 상태 수시 확인",
    ],
    join: ["페이크 높을수록 환영 — 아니면 연막탄 마스터(30) 필수"],
  },
  {
    job: "비숍",
    icon: "✨",
    items: [
      "파워엘릭서 700개 이상 + 엘릭서 800개 (이슬 안 됨)",
      "라면 또는 쭈쭈바 300개 세팅",
      "자동물약 HP 70% / MP 30% (꼬리 떨어지면 MP 20%도 가능)",
      "홀리실드 20~30 필수",
    ],
    join: [
      "홀실 30 환영 (20도 합류 가능) · 리저렉션 마스터 필수 · 가드(매직가드? 홀리가드) 마스터 필수",
      "원격/근격/유혹 팟에 따라 역할·플레이가 다름 — 하단 영상 참조",
    ],
  },
  {
    job: "썬콜",
    icon: "❄️",
    items: [
      "파워엘릭서 700개 이상 + 장어구이 또는 라면 1,000개 이상",
      "주력 딜러(나로·전사)와 동일하게 포커싱 — 1/1·마나번 대비 손컨 항상 준비",
    ],
    join: [
      "다크와이번 나올 때 가드 반응 잘할 자신 있는 분 — 아니어도 다 데려감",
      "레벨 높을수록 환영 (레벨이 돼야 체력·마나 회복이 따라옴)",
    ],
  },
  {
    job: "불독",
    icon: "🔥",
    items: ["데이터가 없지만 언제나 환영 — 썬콜 준비물 준용"],
    join: ["언제나 환영"],
  },
];

const VIDEOS: { title: string; url: string; by: string }[] = [
  { title: "썬콜 시점 혼테일", url: "https://www.youtube.com/watch?v=f1ipUHkzbuM&t=400s", by: "BIIKEI" },
  { title: "비숍 원격팟 시점", url: "https://www.youtube.com/watch?v=yU7F0q9xTZU&t=233s", by: "요정주영" },
  { title: "비숍 유혹케어 포지션", url: "https://www.youtube.com/watch?v=cDGdKjxlrBc&t=20s", by: "요정주영" },
  { title: "혼테일 풀런", url: "https://www.youtube.com/watch?v=eQYd3VQTz3s&t=758s", by: "메이플홀릭" },
  { title: "알목·깡목 데미지 참고", url: "https://www.youtube.com/watch?v=rG5OGcMAZeg", by: "Rover" },
  { title: "혼테일 공략 (개그+정보)", url: "https://youtu.be/9R7tfSiMSDg", by: "파도야" },
];

function Section({ id, icon, title, children, defaultOpen = true }: {
  id: string; icon: string; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="pixel-panel overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[color-mix(in_srgb,var(--c-maple)_8%,transparent)] transition-colors"
      >
        <span className="font-pixel font-bold text-sm">{icon} {title}</span>
        <svg className={`w-4 h-4 text-dim transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 border-t-2 border-edge pt-4">{children}</div>}
    </section>
  );
}

export default function HorntailGuidePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <header className="mb-2">
        <h1 className="font-pixel text-2xl font-bold mb-1">🐉 혼테일 공략</h1>
        <p className="text-sm text-dim">
          추억길드 헤딩 실측 정리 (정리: 요정주영/비숍). 패턴 타이밍은{" "}
          <Link href="/boss-timer" className="text-maple hover:underline">⏱️ 혼테일 타이머</Link>와 함께 쓰세요.
        </p>
      </header>

      <Section id="patterns" icon="⚠️" title="패턴 정리 — 원작 데이터 검증본">
        <p className="text-xs text-dim mb-3">
          수치 근거: 원작 v62 클라이언트 원본 데이터(WZ) + 메랜 유저 실측 — 길드 정리본에서 다르게 알려져 있던 값은 정정 표기.
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-pixel text-dim border-b-2 border-edge">
                <th className="py-2 pr-3">패턴</th>
                <th className="py-2 pr-3">시전 파츠</th>
                <th className="py-2 pr-3">조건</th>
                <th className="py-2 pr-3">주기</th>
                <th className="py-2">지속</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-edge/40">
                <td className="py-1.5 pr-3 font-medium">물공 무효 (공무)</td><td className="py-1.5 pr-3">좌·중·우 머리</td>
                <td className="py-1.5 pr-3 text-dim">상시</td><td className="py-1.5 pr-3">60초</td><td className="py-1.5"><b className="text-maple">40초</b> (실측 43초)</td>
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-1.5 pr-3 font-medium">마공 무효 (마무)</td><td className="py-1.5 pr-3">좌·중·우 머리</td>
                <td className="py-1.5 pr-3 text-dim">상시</td><td className="py-1.5 pr-3">60초</td><td className="py-1.5"><b className="text-maple">40초</b> (실측 43초)</td>
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-1.5 pr-3 font-medium">버프해제 (5갈)</td><td className="py-1.5 pr-3">중머리 · 좌팔</td>
                <td className="py-1.5 pr-3 text-dim">HP <b className="text-mush">60%</b> 이하</td><td className="py-1.5 pr-3"><b>5분</b></td><td className="py-1.5">-</td>
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-1.5 pr-3 font-medium">버프해제 (3갈)</td><td className="py-1.5 pr-3">중머리 · 좌팔</td>
                <td className="py-1.5 pr-3 text-dim">HP 30% 이하</td><td className="py-1.5 pr-3"><b>3분</b> (5갈과 독립)</td><td className="py-1.5">-</td>
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-1.5 pr-3 font-medium">단체유혹 (10인)</td><td className="py-1.5 pr-3">좌팔 · 우팔 (둘 다)</td>
                <td className="py-1.5 pr-3 text-dim">HP 30% 이하</td><td className="py-1.5 pr-3"><b>60초</b></td><td className="py-1.5">10초</td>
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-1.5 pr-3 font-medium">개인유혹 (1인)</td><td className="py-1.5 pr-3">좌팔 · 우팔 (+1페이즈 머리)</td>
                <td className="py-1.5 pr-3 text-dim">상시 · <b>원정대 1번 고정</b> (사망 시 다음 순번)</td><td className="py-1.5 pr-3"><b>3분</b></td><td className="py-1.5">10초</td>
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-1.5 pr-3 font-medium">와이번 소환</td><td className="py-1.5 pr-3">좌·중·우 머리</td>
                <td className="py-1.5 pr-3 text-dim">레드 <b>95%</b> · 블루 <b>75%</b> · 다크 <b className="text-mush">45%</b> 이하</td>
                <td className="py-1.5 pr-3">60/55/50초 · 5마리씩</td><td className="py-1.5">-</td>
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-1.5 pr-3 font-medium">상태이상 디버프</td><td className="py-1.5 pr-3"><b>우팔</b></td>
                <td className="py-1.5 pr-3 text-dim">상시</td><td className="py-1.5 pr-3">봉인 25초 · 암흑 15초 · 위크니스 45초</td><td className="py-1.5">30초</td>
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-1.5 pr-3 font-medium">1/1 (데들리)</td><td className="py-1.5 pr-3">좌·중·우 머리 브레스</td>
                <td className="py-1.5 pr-3 text-dim" colSpan={3}>맞으면 HP/MP 1 — 물약 즉시</td>
              </tr>
              <tr className="border-b border-edge/40">
                <td className="py-1.5 pr-3 font-medium">마나번</td><td className="py-1.5 pr-3">좌팔 · 우팔 공격</td>
                <td className="py-1.5 pr-3 text-dim" colSpan={3}>MP 3,000 소각</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 font-medium">파워업·마공업 + 힐</td><td className="py-1.5 pr-3"><b>날개</b></td>
                <td className="py-1.5 pr-3 text-dim" colSpan={3}>아군 강화(30~40초 간격) + 본체 힐(30초 간격) + 코니언 소환 — 공격은 안 함</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2"><span className="text-mush shrink-0">●</span>
            <span><b>다크와이번(45%↓ 소환)은 근접공격에 버프해제가 붙어 있습니다</b> — 맞으면 벞해. 20초마다 주변 몹 힐(10만±3만)도 함.</span></li>
          <li className="flex gap-2"><span className="text-mush shrink-0">●</span>
            <span><b>중머리는 60%부터 5갈, 30%부터 3갈이 독립으로 돕니다</b> → 최대한 마지막에 딜 + 타이머 두 개 병행 (좌팔도 동일 구조).</span></li>
          <li className="flex gap-2"><span className="text-mush shrink-0">●</span>
            <span><b>각 머리는 방어력업</b>을 겁니다 → 비숍 디스펠로 계속 해제해야 딜이 박힙니다.</span></li>
          <li className="flex gap-2"><span className="text-mush shrink-0">●</span>
            <span>상태이상 디버프(봉인·암흑·위크니스)는 <b>우팔</b> 담당 — 그래서 우측(날개·팔)을 먼저 정리합니다. <i className="text-dim">(길드 정리본의 "우날개 디버프"는 파츠 착오 — 날개는 버프·힐 전담)</i></span></li>
        </ul>
      </Section>

      <Section id="elements" icon="🔥" title="속성 · 와이번">
        <p className="text-sm text-ink mb-3">
          <b>머리에는 속성 반감이 없습니다</b> (원본 데이터에 속성 내성 필드 없음 — "반감"으로 알려진 건 각 머리의 <b>공격 속성</b>과의 혼동).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="pixel-card p-3 text-center">
            <p className="font-pixel text-sm font-bold">좌머리 (A)</p>
            <p className="text-xs mt-1 text-dim">공격 속성: <span className="text-sky-400">얼음</span> (넉백 주의)</p>
          </div>
          <div className="pixel-card p-3 text-center">
            <p className="font-pixel text-sm font-bold">중머리 (B)</p>
            <p className="text-xs mt-1 text-dim">공격 속성: <span className="text-mush">불</span></p>
          </div>
          <div className="pixel-card p-3 text-center">
            <p className="font-pixel text-sm font-bold">우머리 (C)</p>
            <p className="text-xs mt-1 text-dim">공격 속성: <span className="text-yellow-400">번개</span></p>
          </div>
        </div>
        <p className="text-sm text-ink">
          반감·약점은 <b>와이번</b>에 있습니다: 레드와이번 = <span className="text-sky-400">얼음 약점</span>·불 반감,
          블루·다크와이번 = <span className="text-mush">불 약점</span>·얼음 반감, 코니언 = 독 반감.
          소환 순서는 HP 임계값(95→75→45%) 때문에 자연히 <b>레드 → 블루 → 다크</b>. 45% 아래에선 셋 다 번갈아 나옵니다.
          소환 이펙트 후 약 2초 뒤 등장 — 썬콜은 이때 가드 반응이 중요합니다.
        </p>
      </Section>

      <Section id="acc" icon="🎯" title="파츠별 필요 명중률 (L160 기준)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-pixel text-dim border-b-2 border-edge">
                <th className="py-2 pr-3">파츠</th>
                <th className="py-2 pr-3">회피율</th>
                <th className="py-2 pr-3">필요 명중률</th>
                <th className="py-2">1레벨 낮을 때마다</th>
              </tr>
            </thead>
            <tbody>
              {ACC_TABLE.map((r) => (
                <tr key={r.part} className="border-b border-edge/40">
                  <td className="py-1.5 pr-3 font-medium">
                    {r.part}
                    {r.note && <span className="text-[10px] text-dim ml-1.5">({r.note})</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-dim">{r.avoid}</td>
                  <td className="py-1.5 pr-3 text-maple font-semibold">{r.acc}</td>
                  <td className="py-1.5 text-dim">+{r.perLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-dim mt-2">전 파츠 L160 — 내 레벨이 160보다 1 낮을 때마다 표의 수치만큼 필요 명중이 추가됩니다.</p>
      </Section>

      <Section id="prep" icon="🎒" title="직업별 준비물 · 합류 기준">
        <div className="space-y-4">
          {JOB_PREP.map((j) => (
            <div key={j.job} className="pixel-card p-4">
              <p className="font-pixel text-sm font-bold mb-2">{j.icon} {j.job}</p>
              <p className="text-[11px] font-pixel text-dim mb-1">준비물·운영</p>
              <ul className="text-sm space-y-1 mb-2">
                {j.items.map((it, i) => <li key={i} className="flex gap-1.5"><span className="text-maple shrink-0">-</span>{it}</li>)}
              </ul>
              <p className="text-[11px] font-pixel text-dim mb-1">합류 기준</p>
              <ul className="text-sm space-y-1">
                {j.join.map((it, i) => <li key={i} className="flex gap-1.5"><span className="text-dim shrink-0">-</span>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section id="strategy" icon="🗺️" title="파츠별 딜 위치 · 공략" defaultOpen={false}>
        <div className="space-y-5 text-sm leading-relaxed">
          <div>
            <p className="font-pixel text-[12px] text-maple mb-1.5">날개·팔 (시작 구간 — 우날개 먼저)</p>
            <ul className="space-y-1">
              <li>• 우팔이 상태이상 디버프(봉인·암흑·위크니스)를 걸고 30% 아래부턴 단체유혹까지 — <b>우측(날개·팔)부터</b> 공략</li>
              <li>• <b>전사·섀도어</b>: 3타격 가능한 위치에서 딜 — 너무 앞으로 가면 몸박사. <b>단체유혹 시점엔 한 칸 아래 발판</b>에서 딜 (1/1 맞고 몸박 사고 방지)</li>
              <li>• <b>썬콜·나로·궁수</b>: 맨 끝에서 딜하면 우팔이 안 닿고 날개만 닿음. 회피 낮은 궁수는 조금 앞이나 전사 포지션도 가능 (몸박 조심)</li>
              <li>• <b>비숍</b>: 파티 위치 확인하며 홀리실드 꾸준히 + 힐·디스펠</li>
              <li>• <b>유혹파티</b>: 개인유혹 담당은 1층에서 잔몹 정리하거나 줄에 매달려야 같은 파티가 힐을 받음</li>
            </ul>
          </div>
          <div>
            <p className="font-pixel text-[12px] text-maple mb-1.5">좌머리</p>
            <ul className="space-y-1">
              <li>• 지정 위치에서 <b>최대한 앞에서</b> 딜 — 뒤에 있으면 피격 후 낙하 딜로스, 궁수는 풀피 아니면 종유석에 사망 가능</li>
              <li>• 비숍은 파티 위치 보며 힐 + 머리 방업 디스펠</li>
            </ul>
          </div>
          <div>
            <p className="font-pixel text-[12px] text-maple mb-1.5">우머리</p>
            <ul className="space-y-1">
              <li>• 궁수·전사 지정 원 위치에서 딜. <b>우머리 공무 시</b> 근격팟은 중머리 왼쪽 발판으로 이동</li>
              <li>• 궁수는 <b>윗클릭 누르며 딜</b> — 피격당해도 줄을 바로 잡고 복귀 가능</li>
              <li>• 나머지 원격은 맨 위 발판/하단 발판 자유</li>
            </ul>
          </div>
          <div>
            <p className="font-pixel text-[12px] text-maple mb-1.5">중머리 (마지막)</p>
            <ul className="space-y-1">
              <li>• 우머리 쪽에서 칠 땐 우측 아래 발판 (나로는 점샷으로 닿음) · 궁수는 상단 발판 · 전사는 좌측 발판(근격팟만 이동)</li>
              <li>• 좌머리 쪽에서 칠 땐 좌머리 때와 동일</li>
              <li>• HP 50%부터 버프해제 시작 — <b>타이머 5갈 즉시 가동</b>, 30% 아래부턴 3갈도 병행</li>
            </ul>
          </div>
          <div>
            <p className="font-pixel text-[12px] text-maple mb-1.5">다리 · 꼬리</p>
            <ul className="space-y-1">
              <li>• <b>궁수</b>: 지정 위치에서 보마 스트레이프(익숙해지면 폭풍의시), 신궁 피어싱(없으면 스트+스나이핑). 비숍이 디스펠하느라 힐 못 준다 생각하고 <b>풀피 아니면 손컨</b></li>
              <li>• <b>전사</b>: 3타격 위치에서 계속 딜 — 체력 10,000 유지 손컨 필수 (특히 다크나이트)</li>
              <li>• <b>나로·썬콜·섀도어</b>: 나로는 점프샷으로 다리 딜 회피 — 디스펠 안 된 파워업 다리 딜은 8,000+ 즉사. 섀도어는 연막 컨트롤하며 딜</li>
              <li>• <b>꼬리 구간</b>: 격수는 가운데 왕(1자)선을 <b>절대 넘지 말 것</b> — 넘으면 우측으로 밀려남. 나로는 헤이스트 끄고 점프샷</li>
              <li>• <b>썬콜 팁</b>: 시작할 때 썬콜이 꼬리를 먼저 쳐서 어그로를 끌고 위에서 머리 딜하면, 꼬리 딜이 격수에게 안 들어감</li>
            </ul>
          </div>
          <div>
            <p className="font-pixel text-[12px] text-maple mb-1.5">유혹 케어 (1섀도어 + 2비숍 고정)</p>
            <ul className="space-y-1">
              <li>• 유혹파티: 1섀도어 + 전사 2~3 + 비숍 2 (구성 변동 가능, 1섀 2비숍은 고정)</li>
              <li>• <b>개인유혹</b>: 지정 줄에 매달리기. 섀도어는 다크사이트 유지 인지 + 위아래로 계속 움직이기 — <b>움직임이 멈추면 유혹에 걸린 것</b>으로 판단 가능</li>
              <li>• 너무 위로 가면 비숍 케어가 안 닿음 — 약간 아래 위치</li>
              <li>• 다리·꼬리 구간: 시작하면 우측 비숍은 종유석 맞으며 대기, 섀도어 위치 확인 후 <b>즉시 힐</b> (마공은 들어오는데 물약 손컨 불가이므로)</li>
              <li>• 전사가 유혹 담당이면 앞순번 사망 시 바로 줄에 매달리도록 순번 체크</li>
            </ul>
          </div>
          <p className="text-xs text-dim">※ 원 위치 표시 이미지는 길드 디스코드 고정글 참조 — 텍스트로 옮긴 요약입니다.</p>
        </div>
      </Section>

      <Section id="videos" icon="🎬" title="참고 영상" defaultOpen={false}>
        <ul className="space-y-1.5 text-sm">
          {VIDEOS.map((v) => (
            <li key={v.url}>
              <a href={v.url} target="_blank" rel="noreferrer" className="text-maple hover:underline">▶ {v.title}</a>
              <span className="text-xs text-dim ml-2">{v.by}</span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="text-[11px] text-dim pt-2">
        출처: 추억길드 디스코드 혼테일 공략 정리 (요정주영/비숍, 2025.06~12 헤딩 실측) + 패턴 수치는 원작 v62 클라이언트 원본 데이터(WZ)·메랜 커뮤니티 실측으로 교차검증 (2026-07).
        파티 구성 관련 항목 일부는 추억길드 한정 운영 방식입니다.
      </p>
    </div>
  );
}
