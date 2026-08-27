// 길드대항전 드랍테이블 단일 소스 — 드랍테이블 탭과 분배 정산기(아이템 선택)가 공유한다.
// 확률은 보너스 상자(리액터) 1개당 % — 디시 메이플랜드 갤러리 집계
// (https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=1235530), 42종 합계 80.27%.
// 약어 풀네임은 인벤 아이템 DB로 확인 (속강30 = 캡틴 속성강화, 폭시20 = 보우마스터 폭풍의 시).

export type GwDropCategory = "소비" | "주문서" | "마북";

export interface GwDrop {
  /** 길드 정산에서 통용되는 약어 (정산기의 아이템 키) */
  key: string;
  /** 풀네임 */
  name: string;
  /** 상자 1개당 확률(%) */
  rate: number;
  cat: GwDropCategory;
  /** 마스터리북 해당 직업 */
  job?: string;
}

export const GW_BOX_COUNT = 24; // 보너스 맵 상자 수 (커뮤니티 기준)

export const GW_BOX_DROPS: GwDrop[] = [
  // 소비 아이템
  { key: "하얀포션", name: "하얀 포션", rate: 20, cat: "소비" },
  { key: "주황포션", name: "주황 포션", rate: 20, cat: "소비" },
  { key: "마나엘릭서", name: "마나 엘릭서", rate: 20, cat: "소비" },
  { key: "엘릭서", name: "엘릭서", rate: 4, cat: "소비" },
  { key: "순록의 우유", name: "순록의 우유", rate: 4, cat: "소비" },
  { key: "검은보따리", name: "검은 보따리", rate: 0.2, cat: "소비" },
  // 주문서 (전부 60%, 상자당 0.4%)
  { key: "투방", name: "투구 방어력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "투체", name: "투구 체력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "귀지", name: "귀 장식 지력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "상방", name: "상의 방어력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "전민", name: "전신 갑옷 민첩 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "전방", name: "전신 갑옷 방어력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "전지", name: "전신 갑옷 지력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "전행", name: "전신 갑옷 행운 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "하방", name: "하의 방어력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "신민", name: "신발 민첩 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "신점", name: "신발 점프력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "신이", name: "신발 이동속도 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "장민", name: "장갑 민첩 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "장공", name: "장갑 공격력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "방방", name: "방패 방어력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "망마방", name: "망토 마법방어력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "망물방", name: "망토 물리방어력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "망체", name: "망토 체력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "망마", name: "망토 마나 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "망힘", name: "망토 힘 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "망지", name: "망토 지력 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "망민", name: "망토 민첩 주문서 60%", rate: 0.4, cat: "주문서" },
  { key: "망행", name: "망토 행운 주문서 60%", rate: 0.4, cat: "주문서" },
  // 마스터리북
  { key: "어콤30북", name: "어드밴스드 콤보 30", rate: 0.06, cat: "마북", job: "히어로" },
  { key: "페럴30북", name: "페럴라이즈 30", rate: 0.07, cat: "마북", job: "아크메이지(불/독)" },
  { key: "이프리트30북", name: "이프리트 30", rate: 0.06, cat: "마북", job: "아크메이지(불/독)" },
  { key: "체라30북", name: "체인 라이트닝 30", rate: 0.35, cat: "마북", job: "아크메이지(썬/콜)" },
  { key: "엘퀴네스30북", name: "엘퀴네스 30", rate: 0.4, cat: "마북", job: "아크메이지(썬/콜)" },
  { key: "폭시20북", name: "폭풍의 시 20", rate: 0.2, cat: "마북", job: "보우마스터" },
  { key: "프리져30북", name: "프리져 30", rate: 0.02, cat: "마북", job: "신궁" },
  { key: "닌자스톰30북", name: "닌자스톰 30", rate: 0.15, cat: "마북", job: "나이트로드" },
  { key: "쇼다운30북", name: "쇼다운 30", rate: 0.2, cat: "마북", job: "나이트로드" },
  { key: "암살30북", name: "암살 30", rate: 0.02, cat: "마북", job: "섀도어" },
  { key: "속강30북", name: "속성강화 30", rate: 0.36, cat: "마북", job: "캡틴" },
  { key: "레피드30북", name: "래피드 파이어 30", rate: 0.44, cat: "마북", job: "캡틴" },
  { key: "배틀쉽캐논30북", name: "배틀쉽 캐논 30", rate: 0.54, cat: "마북", job: "캡틴" },
];

export const GW_BOSS_DROP = {
  key: "나리케인의 징표",
  name: "나리케인의 징표",
  desc: "Lv120 펜던트 · 올스탯+5 / 공+4 / 마력+8 / HP·MP+150 / 회피+15 / 이속·점프+5 — 에레고스 확률 드랍",
};

/** 정산기 아이템 선택 목록 — 팔아서 나눌 만한 것만 (물약 제외) */
export const SETTLE_ITEM_GROUPS: { label: string; items: { key: string; name: string }[] }[] = [
  {
    label: "주문서 60%",
    items: GW_BOX_DROPS.filter((d) => d.cat === "주문서").map(({ key, name }) => ({ key, name })),
  },
  {
    label: "마스터리북",
    items: GW_BOX_DROPS.filter((d) => d.cat === "마북").map(({ key, name, job }) => ({
      key,
      name: `${name} (${job})`,
    })),
  },
  {
    label: "보스 · 기타",
    items: [
      { key: GW_BOSS_DROP.key, name: GW_BOSS_DROP.desc },
      { key: "검은보따리", name: "검은 보따리" },
    ],
  },
];

/** 약어 → 풀네임 룩업 */
export const GW_ITEM_NAME: Record<string, string> = Object.fromEntries([
  ...GW_BOX_DROPS.map((d) => [d.key, d.cat === "마북" ? `${d.name} (${d.job})` : d.name]),
  [GW_BOSS_DROP.key, GW_BOSS_DROP.desc],
]);
