import Link from "next/link";
import ItemChip from "@/components/ItemChip";

const OFFICIAL_PATCH_0814 = "https://maple.land/board/notices/pzx6wmuz4h4slkbvklaojerw";
const DC_TOKEN_POST = "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3882525";
const SRC_NOBLE = "https://noblestory.boards.net/thread/18/engagement-marriage-guide";
const SRC_NAMU = "https://namu.wiki/w/%EC%95%84%EB%AA%A8%EB%A6%AC%EC%95%84";

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

// 결혼 반지 4종 — 우리 DB 실물 (아이콘·기본 옵션). 캐럿별 옵션은 실측 확인 중.
const WEDDING_RINGS = [
  { id: 1112803, name: "문스톤 웨딩링", base: "마법방어 +30" },
  { id: 1112806, name: "스타젬 웨딩링", base: "마법방어 +30" },
  { id: 1112807, name: "골든하트 웨딩링", base: "마법방어 +10" },
  { id: 1112809, name: "실버스완 웨딩링", base: "마법방어 +10" },
];

export default function WeddingPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="font-pixel text-2xl font-bold">💍 결혼 시스템 가이드</h1>
          <span className="font-pixel text-[10px] px-2 py-1 border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
            8/14 출시 — 공식 패치 반영
          </span>
        </div>
        <p className="text-sm text-dim">
          8월 14일 출시된 메이플랜드 결혼 시스템 공식 사양과, 출시 전 커뮤니티에서 확인된 준비물을 정리했습니다.
          캐럿별 반지 옵션 등 미공개 수치는 실측이 확인되는 대로 갱신합니다.
        </p>
      </header>

      {/* 메랜 공식 확정 */}
      <section className="pixel-panel p-5 border-emerald-400 space-y-3">
        <h2 className="font-pixel text-sm text-ink">📢 메이플랜드 공식 사양 (8/14 패치노트)</h2>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="pixel-card p-3">
            <b>입장 · 안내</b>
            <p className="text-xs text-dim mt-1 leading-relaxed">
              헤네시스·오르비스·루디브리엄·리프레 등 마을의 <b className="text-ink">헤라</b> NPC로 <b className="text-ink">웨딩빌리지</b>(아모리아) 입장.
              자세한 안내는 웨딩빌리지의 <b className="text-ink">문월하</b> NPC. 신규 구역: 웨딩홀 로비 · 웨딩홀 · 웨딩케이크 스튜디오 · 웨딩파크 · 웨딩박스
            </p>
          </div>
          <div className="pixel-card p-3">
            <b className="text-maple">💎 캐럿 시스템 (원작과 다른 핵심!)</b>
            <p className="text-xs text-dim mt-1 leading-relaxed">
              원작의 채플/대성당 등급 대신, <b className="text-ink">약혼반지에 쓴 다이아몬드 캐럿(1·2·3캐럿)</b>에 따라
              결혼 후 교환 가능한 결혼반지 옵션이 달라집니다 (예: 문스톤링 1캐럿/2캐럿/3캐럿).
              <b className="text-red-500"> 결혼반지 옵션은 이혼 후 재결혼까지 변경 불가</b> — 캐럿 선택은 신중하게!
            </p>
          </div>
          <div className="pixel-card p-3">
            <b>부부 전용 기능</b>
            <p className="text-xs text-dim mt-1 leading-relaxed">
              프로필 기혼 여부 표시 · <b className="text-ink">월드맵/미니맵에 배우자 위치 표시</b> · 결혼식 중 버프 · 기념사진 · 예식 종료 후 보상
            </p>
          </div>
          <div className="pixel-card p-3">
            <b>💳 과금 요소</b>
            <p className="text-xs text-dim mt-1 leading-relaxed">
              캐시샵에서 <b className="text-ink">&lsquo;프리미엄 결혼식 티켓&rsquo;</b> 판매 — 일반/프리미엄 예식 차이(하객 수·보상 규모 추정)는 실측 확인 중입니다.
            </p>
          </div>
        </div>
      </section>

      {/* 준비물 */}
      <section className="pixel-panel p-4 space-y-2">
        <h2 className="font-pixel text-sm text-ink">✅ 준비물 — 사랑의 증표 4개 (출시 전 커뮤 확인)</h2>
        <p className="text-sm">각 마을 NPC에게 재료를 전달하면 사랑의 증표를 받습니다. <b className="text-maple">10곳 중 4곳</b>만 완료하면 되니 재료가 싸거나 이미 갖고 있는 마을을 고르세요.</p>
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
          + 약혼반지 제작에 <b>다이아몬드</b>가 필요하고 캐럿 수가 곧 반지 등급이라, 다이아몬드(제련) 시세가 오를 수 있습니다.
          출처: <a href={DC_TOKEN_POST} target="_blank" rel="noopener noreferrer" className="underline text-maple">커뮤니티 사전 정리 ↗</a> — 패치 후 변경 여부 재검증 중
        </p>
      </section>

      {/* 결혼 반지 실물 */}
      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-base text-ink">💍 결혼 반지 4종 — 실물 아이콘 · 기본 옵션</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {WEDDING_RINGS.map((r) => (
            <div key={r.id} className="pixel-card p-3 text-center space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://maplestory.io/api/gms/92/item/${r.id}/icon`} alt={r.name} className="w-10 h-10 object-contain mx-auto [image-rendering:pixelated]" />
              <div className="text-sm font-medium text-ink">{r.name}</div>
              <div className="text-xs text-maple">{r.base}</div>
              <Link href={`/items/${r.id}`} className="text-[10px] text-dim hover:text-maple underline">상세 →</Link>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-dim">
          기본 옵션은 우리 DB(원작 데이터) 기준. 메랜은 <b>캐럿(1·2·3)에 따라 옵션이 달라지므로</b> 캐럿별 실측이 모이는 대로 표를 확장합니다.
        </p>
      </section>

      {/* 원작 참고 (축소) */}
      <section className="pixel-panel p-4 space-y-2">
        <h2 className="font-pixel text-sm text-ink">📜 원작 참고 — 메랜 확인 대기 항목</h2>
        <ul className="text-xs text-dim space-y-1.5 leading-relaxed">
          <li>· 원작 절차: 보석상에게 약혼반지 제작 → 반지 더블클릭 프로포즈 → 예식 예약 → 청첩장 → 예식 + 하객 보너스맵</li>
          <li>· 원작 하객 보상: <b className="text-ink">오닉스 애플 (공·마 +100, 10분)</b> — 원작 최강 보스 도핑. 메랜 &lsquo;예식 종료 후 소정의 보상&rsquo;이 무엇인지 실측 확인 중 (확인되면 보스 도핑 경제에 큰 영향)</li>
          <li>· 원작 부가: 아모리아 파티퀘스트(APQ), 이혼 시스템 — 메랜 패치노트에 이혼 언급 있음(&lsquo;이혼 후 재결혼&rsquo;)</li>
        </ul>
      </section>

      <section className="text-[11px] text-dim leading-relaxed border-t-2 border-edge pt-4">
        <p className="font-pixel text-[10px] text-ink mb-1">출처와 판정 기준</p>
        <p>
          메랜 확정: <a href={OFFICIAL_PATCH_0814} target="_blank" rel="noopener noreferrer" className="underline text-maple">8/14 공식 패치노트</a>,{" "}
          <a href={DC_TOKEN_POST} target="_blank" rel="noopener noreferrer" className="underline text-maple">사랑의 증표 사전 정리</a>.
          원작 참고: <a href={SRC_NOBLE} target="_blank" rel="noopener noreferrer" className="underline text-maple">복각서버 결혼 가이드</a>,{" "}
          <a href={SRC_NAMU} target="_blank" rel="noopener noreferrer" className="underline text-maple">나무위키 아모리아</a>.
          캐럿별 반지 옵션·예식 보상·티켓 가격은 실측 확인 후 갱신합니다.
        </p>
        <p className="mt-1">
          관련: <Link href="/charlie" className="underline text-maple">찰리중사 교환</Link> ·{" "}
          <Link href="/events/master-m-2026" className="underline text-maple">마스터M 이벤트</Link> ·{" "}
          <Link href="/dojo" className="underline text-maple">무릉도장 공략</Link>
        </p>
      </section>
    </div>
  );
}
