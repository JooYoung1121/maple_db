export type CanonDiffStatus = "changed" | "added" | "terminology" | "unverified";

export interface CanonDiffEntry {
  id: string;
  path: string;
  subject: string;
  status: CanonDiffStatus;
  mapleland: string;
  original: string;
  note?: string;
  sourceLabel: string;
  sourceUrl: string;
  originalSourceLabel?: string;
  originalSourceUrl?: string;
  verifiedAt: string;
}

const OFFICIAL_DOJO_PATCH = "https://maple.land/board/notices/ze975xgn5g5p18nra6i1a6wf";

/**
 * 메이플랜드와 빅뱅 전 원작의 차이를 검증된 항목부터 쌓는 중앙 레지스트리.
 * 화면에서 임의로 비교 문구를 만들지 말고, 출처·검증일과 함께 이곳에 등록한다.
 */
export const CANON_DIFFS: Record<string, CanonDiffEntry> = {
  "dojo.floor-count": {
    id: "dojo.floor-count",
    path: "/dojo",
    subject: "층 수 표기",
    status: "terminology",
    mapleland: "38층: 보스 32단계와 휴게실 6층을 모두 층으로 셉니다.",
    original: "2009년 공략은 같은 보스 구성을 주로 32라운드·32단계로 표기했습니다.",
    note: "보스가 6마리 늘어난 것이 아니라 휴게실을 층 수에 포함한 표기 차이입니다.",
    sourceLabel: "메이플랜드 8/7 패치노트",
    sourceUrl: OFFICIAL_DOJO_PATCH,
    verifiedAt: "2026-08-07",
  },
  "dojo.black-belt": {
    id: "dojo.black-belt",
    path: "/dojo",
    subject: "검은색 허리띠 능력치",
    status: "changed",
    mapleland: "올스탯 +3, 공격력 +1, 마력 +4, 물/마방 +50, 회피 +15",
    original: "올스탯 +5, 물/마방 +50, 회피 +15 (공격력·마력 없음)",
    note: "메이플랜드는 주스탯을 낮추고 공격력·마력을 추가했습니다. 흰색~빨간색 허리띠는 원작 수치와 같습니다.",
    sourceLabel: "메이플랜드 공식 아이템 이미지",
    sourceUrl: OFFICIAL_DOJO_PATCH,
    verifiedAt: "2026-08-07",
  },
  "dojo.successor-medal": {
    id: "dojo.successor-medal",
    path: "/dojo",
    subject: "소공의 후계자 훈장",
    status: "changed",
    mapleland: "Lv.80, 올스탯 +3, HP/MP +100. 2026년 9월 11일까지 최상층 클리어 보상",
    original: "후기 원작 아이템은 올스탯 +2, HP/MP +100, 물/마방 +50",
    note: "2009년 최초 무릉도장 보상이 아니라 원작 후기에 추가된 훈장을 메이플랜드 오픈 이벤트용으로 조정한 사례입니다.",
    sourceLabel: "메이플랜드 8/7 패치노트",
    sourceUrl: OFFICIAL_DOJO_PATCH,
    verifiedAt: "2026-08-07",
  },
  "dojo.ranking": {
    id: "dojo.ranking",
    path: "/dojo",
    subject: "클리어 시간 랭킹",
    status: "added",
    mapleland: "솔로 최상층 클리어 시간을 기준으로 기간제 엔젤릭 블레스 계열 보상을 지급할 예정입니다.",
    original: "2009년 초기형은 누적 수련 점수와 허리띠 교환이 중심이며 현재 형태의 랭킹 보상은 없었습니다.",
    note: "8월 10일 전후 업데이트 예정 기능으로, 세부 순위·지급 기간은 후속 공지 확인이 필요합니다.",
    sourceLabel: "메이플랜드 8/7 패치노트",
    sourceUrl: OFFICIAL_DOJO_PATCH,
    verifiedAt: "2026-08-07",
  },
  "dojo.death-penalty": {
    id: "dojo.death-penalty",
    path: "/dojo",
    subject: "사망 페널티·호부 차감",
    status: "unverified",
    mapleland: "첫날 호부가 차감됐다는 제보가 있으나 경험치 감소 여부와 의도된 사양인지는 확인되지 않았습니다.",
    original: "초기 공략은 도장 내부 사망 시 경험치 감소가 없다고 안내했습니다.",
    note: "공식 확인 전에는 고경험치 캐릭터가 사망하지 않도록 보수적으로 플레이하는 편이 안전합니다.",
    sourceLabel: "메이플랜드 커뮤니티 첫날 제보",
    sourceUrl: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3868765",
    verifiedAt: "2026-08-07",
  },
  "medals.explorer-stats": {
    id: "medals.explorer-stats",
    path: "/medals",
    subject: "탐험가 훈장 능력치",
    status: "changed",
    mapleland: "정상화 수치 적용. 예: 메이플 탐험가 올스탯 +1, HP/MP +60",
    original: "GMS v92 메이플 탐험가는 올스탯 +1, HP/MP +180",
    note: "초보 탐험가도 HP/MP +60에서 +25로 조정되는 등 훈장별 차이가 있어 메이플랜드 수치를 우선 표시합니다.",
    sourceLabel: "메이플랜드 훈장 수치표",
    sourceUrl: "https://maplelandzzul.gg/titles",
    originalSourceLabel: "GMS v92 원본 데이터",
    originalSourceUrl: "https://maplestory.io/api/gms/92/item/1142120",
    verifiedAt: "2026-08-07",
  },
};

export const DOJO_CANON_DIFFS = [
  CANON_DIFFS["dojo.floor-count"],
  CANON_DIFFS["dojo.black-belt"],
  CANON_DIFFS["dojo.successor-medal"],
  CANON_DIFFS["dojo.ranking"],
  CANON_DIFFS["dojo.death-penalty"],
];
