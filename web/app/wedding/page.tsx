import Link from "next/link";

const OFFICIAL_ROADMAP = "https://maple.land/board/notices/wjc935d9pldwyywmi43t8y23";
const DC_TOKEN_POST = "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3882525";
const SRC_NOBLE = "https://noblestory.boards.net/thread/18/engagement-marriage-guide";
const SRC_NAMU = "https://namu.wiki/w/%EC%95%84%EB%AA%A8%EB%A6%AC%EC%95%84";
const SRC_2009 = "http://thestoryofmaple.blogspot.com/2009/07/maplestory-amoria-wedding-guide.html";

// 메랜 사전 확인 (8/12 커뮤니티) — 사랑의 증표 획득 퀘스트: 마을 NPC에 재료 전달
const TOKEN_QUESTS = [
  ["헤네시스", "마야", "주황버섯의 갓 40개"],
  ["엘리니아", "로웬", "부드러운 깃털 20개"],
  ["페리온", "이얀", "장작 40개"],
  ["커닝시티", "넬라", "뿔버섯의 갓 40개"],
  ["오르비스", "에릭손", "셀리온의 꼬리 20개"],
  ["루디브리엄", "보좌관 티군", "솜뭉치 20개"],
  ["아쿠아리움", "뮤즈", "딱딱한 비늘 20개"],
  ["리프레", "팜", "레쉬의 털뭉치 10개"],
  ["무릉", "한태수", "비늘쌈지 30개"],
  ["아리안트", "지유르", "클로버 40개"],
];

// 원작 약혼반지 4종 (빅뱅 전 GMS 기준 참고값)
const RINGS = [
  ["문 스톤", "문 록 1 + 다이아몬드 1 + 300만 메소", "이동속도 +5"],
  ["샤이닝 스타", "스타 록 1 + 다이아몬드 1 + 200만 메소", "점프 +2"],
  ["골드 하트", "골드 플레이트 1 + 다이아몬드 1 + 100만 메소", "HP +60"],
  ["실버 스완", "실버 플레이트 1 + 다이아몬드 1 + 50만 메소", "MP +60"],
];

export default function WeddingPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="font-pixel text-2xl font-bold">💍 결혼 시스템 가이드</h1>
          <span className="font-pixel text-[10px] px-2 py-1 border border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300">
            8/14 출시 — 사전 가이드
          </span>
        </div>
        <p className="text-sm text-dim">
          8월 14일 출시가 공식 확정된 결혼 시스템(아모리아)의 준비물·절차·보상을 미리 정리했습니다.
          메이플랜드 확정값이 아닌 항목은 원작(빅뱅 전) 참고값으로 표시했고, 패치노트 공개 후 갱신합니다.
        </p>
      </header>

      <section className="pixel-panel p-4 border-emerald-400 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-pixel text-sm text-ink">✅ 지금 준비해두면 좋은 것 (메랜 사전 확인)</h2>
            <p className="text-sm mt-2">
              결혼에는 <b>사랑의 증표 4개</b>가 필요합니다. 각 마을 NPC에게 재료를 전달하면 받을 수 있어서,
              <b className="text-maple"> 출시 전에 재료를 미리 사두면</b> 첫날 바로 진행할 수 있습니다.
            </p>
          </div>
          <a href={OFFICIAL_ROADMAP} target="_blank" rel="noopener noreferrer" className="pixel-btn px-3 py-2 text-xs shrink-0">8/12 공식 로드맵 ↗</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-dim border-b-2 border-edge">
                <th className="py-1.5 pr-3">마을</th><th className="pr-3">NPC</th><th>요구 재료</th>
              </tr>
            </thead>
            <tbody>
              {TOKEN_QUESTS.map(([town, npc, mat]) => (
                <tr key={town} className="border-b border-edge/40">
                  <td className="py-1.5 pr-3 font-medium">{town}</td>
                  <td className="pr-3 text-dim">{npc}</td>
                  <td className="text-maple">{mat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-dim">
          10곳 중 4곳만 완료하면 됩니다 — 재료가 싸거나 이미 갖고 있는 마을을 고르세요.
          원작의 &lsquo;러브 포프(나나 6인)&rsquo; 수집을 메랜이 10개 마을로 확장한 구성입니다.
          출처: <a href={DC_TOKEN_POST} target="_blank" rel="noopener noreferrer" className="underline text-maple">커뮤니티 사전 정리(8/12) ↗</a>
        </p>
      </section>

      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-base text-ink">📋 절차 (원작 기준)</h2>
        <ol className="space-y-2 text-sm list-none">
          {[
            ["1", "약혼반지 제작", "아모리아 보석상 '무니'에게 퀘스트 수령 → 사랑의 증표 4개 + 반지 재료·메소 지불. 원작은 남성 캐릭터만 제작 가능, 이성 간에만 결혼 가능"],
            ["2", "프로포즈", "약혼반지를 더블클릭해 상대 닉네임 입력 → 상대가 수락하면 약혼"],
            ["3", "예식장 예약", "채플(소규모) 또는 대성당(대규모). 원작 기준 대성당은 성직자 '존'의 주례 허가서 + 신부 측 사랑의 증표 2개 추가 수집 필요. 예식 티켓이 원작에선 캐시템이었는데 메랜에서 어떻게 풀릴지가 관전 포인트"],
            ["4", "하객 초대", "청첩장 발송 — 원작 기준 채플 양가 각 5명, 대성당 각 15명"],
            ["5", "예식 + 보너스맵", "예식 진행 후 하객은 보너스맵에 입장해 상자 보상 획득 (하객 1인당 1개)"],
          ].map(([n, title, text]) => (
            <li key={n} className="pixel-card p-3 flex gap-3">
              <span className="font-pixel text-maple text-sm shrink-0">{n}</span>
              <div><b className="text-sm">{title}</b><p className="text-xs text-dim mt-1 leading-relaxed">{text}</p></div>
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-dim">아모리아 이동: 원작은 각 마을의 '토마스 스위프트' NPC. 메랜은 차원의 거울 추가 가능성.</p>
      </section>

      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-base text-ink">💍 약혼반지 4종 (원작 참고값)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-dim border-b-2 border-edge">
                <th className="py-1.5 pr-3">반지</th><th className="pr-3">제작 재료 (원작)</th><th>착용 옵션</th>
              </tr>
            </thead>
            <tbody>
              {RINGS.map(([name, mat, stat]) => (
                <tr key={name} className="border-b border-edge/40">
                  <td className="py-1.5 pr-3 font-medium">{name}</td>
                  <td className="pr-3 text-dim">{mat}</td>
                  <td className="text-maple">{stat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-dim">다이아몬드는 4종 공통 재료 — 제련용 다이아몬드·원석 시세가 오를 수 있으니 미리 확보해두는 것도 방법입니다. 메랜 확정 재료는 패치 후 갱신.</p>
      </section>

      <section className="grid md:grid-cols-2 gap-3">
        <div className="pixel-panel p-5 space-y-2">
          <h2 className="font-pixel text-base text-ink">⛪ 채플 vs 대성당 (원작)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-dim border-b-2 border-edge">
                <th className="py-1.5 pr-2">항목</th><th className="pr-2">채플</th><th>대성당</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["하객", "양가 각 5명", "양가 각 15명"],
                ["부부 반지", "1캐럿 (올스탯 +1)", "2캐럿 (올스탯 +2)"],
                ["예식 시간", "약 9분", "약 18분"],
                ["추가 조건", "없음", "주례 허가서 + 증표 2개"],
              ].map(([k, a, b]) => (
                <tr key={k} className="border-b border-edge/40">
                  <td className="py-1.5 pr-2 text-dim">{k}</td><td className="pr-2">{a}</td><td className="text-maple">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-dim">이혼도 원작에 존재 (아모리아 필라 프레젠트, 수수료+유예기간).</p>
        </div>

        <div className="pixel-panel p-5 space-y-2">
          <h2 className="font-pixel text-base text-ink">🎁 하객 보상 — 결혼식의 진짜 꿀</h2>
          <p className="text-sm leading-relaxed">
            예식 후 보너스맵에서 <b>오닉스 상자</b>를 얻어 교환하면:
          </p>
          <ul className="text-sm space-y-1.5">
            <li className="flex gap-2"><span className="text-maple shrink-0">★</span><span><b>오닉스 애플</b> — 공격력·마력 <b className="text-maple">+100 (10분)</b>. 원작 최강 도핑으로 자쿰·혼테일 공대 필수템이었습니다</span></li>
            <li className="flex gap-2"><span className="text-maple shrink-0">·</span><span><b>빅토리아 아모리안 바스켓</b> — 명중률 +40 (10분)</span></li>
          </ul>
          <p className="text-[11px] text-dim">
            하객 1인당 상자 1개, 예식 종료 후 약 20분 뒤 소멸(원작 기준). 부부는 아모리아 파티퀘스트(APQ)로 오닉스 애플을 반복 수급할 수 있어 —
            결혼 시스템이 사실상 <b>보스 도핑 경제</b>를 여는 업데이트입니다. 하객 초대가 곧 재화가 될 수 있어요.
          </p>
        </div>
      </section>

      <section className="text-[11px] text-dim leading-relaxed border-t-2 border-edge pt-4">
        <p className="font-pixel text-[10px] text-ink mb-1">출처와 판정 기준</p>
        <p>
          메랜 확정: <a href={OFFICIAL_ROADMAP} target="_blank" rel="noopener noreferrer" className="underline text-maple">8/12 공식 로드맵 공지</a> (8/14 출시),{" "}
          <a href={DC_TOKEN_POST} target="_blank" rel="noopener noreferrer" className="underline text-maple">사랑의 증표 사전 정리 ↗</a>.
          원작 참고: <a href={SRC_NOBLE} target="_blank" rel="noopener noreferrer" className="underline text-maple">복각서버 결혼 가이드</a>,{" "}
          <a href={SRC_NAMU} target="_blank" rel="noopener noreferrer" className="underline text-maple">나무위키 아모리아</a>,{" "}
          <a href={SRC_2009} target="_blank" rel="noopener noreferrer" className="underline text-maple">2009 웨딩 가이드 보존본</a>.
          반지 재료·비용, 예식 티켓 방식, 하객 수, 레벨 제한 등은 원작 참고값이라 메랜 구현과 다를 수 있으며 8/14 패치노트 공개 후 확정값으로 갱신합니다.
        </p>
        <p className="mt-1">
          관련: <Link href="/charlie" className="underline text-maple">찰리중사 교환</Link> ·{" "}
          <Link href="/events/master-m-2026" className="underline text-maple">마스터M 이벤트 정리</Link> ·{" "}
          <Link href="/dojo" className="underline text-maple">무릉도장 공략</Link>
        </p>
      </section>
    </div>
  );
}
