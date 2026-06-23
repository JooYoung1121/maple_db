"use client";

import { useState, useMemo } from "react";

// ─── 직업 (4차 기준) ───
interface JobDef { key: string; label: string; }
interface JobGroup { group: string; jobs: JobDef[]; }

const JOB_GROUPS: JobGroup[] = [
  { group: "전사", jobs: [
    { key: "히어로", label: "히어로" },
    { key: "팔라딘", label: "팔라딘" },
    { key: "다크나이트", label: "다크나이트" },
  ]},
  { group: "마법사", jobs: [
    { key: "썬콜", label: "썬콜" },
    { key: "불독", label: "불독" },
    { key: "비숍", label: "비숍" },
  ]},
  { group: "궁수", jobs: [
    { key: "보우마스터", label: "보우마스터" },
    { key: "신궁", label: "신궁" },
  ]},
  { group: "도적", jobs: [
    { key: "나이트로드", label: "나이트로드" },
    { key: "섀도어", label: "섀도어" },
  ]},
  { group: "시그너스", jobs: [
    { key: "소울마스터", label: "소울마스터" },
    { key: "플레임위자드", label: "플레임위자드" },
    { key: "윈드브레이커", label: "윈드브레이커" },
    { key: "나이트워커", label: "나이트워커" },
    { key: "스트라이커", label: "스트라이커" },
  ]},
];
const ALL_JOBS = JOB_GROUPS.flatMap((g) => g.jobs.map((j) => j.key));

// ─── 사냥터 데이터 (커뮤니티 수집·정리) ───
// common: true → 전 직업 공용 / jobs: 해당 직업만
interface Spot {
  levelMin: number;
  levelMax: number;
  map: string;
  region: string;
  monsters: string[];
  tip: string;
  source: string;       // URL 또는 출처명
  jobs?: string[];
  common?: boolean;
}

const SPOTS: Spot[] = [
  // ── 1~30 (전 직업 공용 초반) ──
  { levelMin: 1, levelMax: 10, map: "메이플 아일랜드 (퀘스트 위주)", region: "메이플 아일랜드", monsters: ["달팽이", "파란달팽이", "주황버섯"], tip: "아일랜드 퀘스트를 전부 깨면 8렙 → 전직. 버닝 월드는 경험치 1.5배라 사냥보다 퀘스트가 더 빠르다.", source: "https://ssalmuk.com/community/CATE_community335/game/detail?code=B26040722", common: true },
  { levelMin: 10, levelMax: 20, map: "헤네시스 사냥터1 · 동쪽 풀숲 · 슬라임굴", region: "헤네시스 / 남쪽 숲", monsters: ["주황버섯", "리본돼지", "슬라임"], tip: "일자 지형이라 사냥이 편하다. 헤네 사냥터1이 슬라임굴보다 젠이 좋다는 의견이 다수. 돼지머리/슬라임방울 판매로 초기 자금.", source: "https://ssalmuk.com/community/CATE_community335/game/detail?code=B25041540", common: true },
  { levelMin: 15, levelMax: 20, map: "돼지의 해안가 (히든스트리트)", region: "헤네시스 인근", monsters: ["돼지", "리본돼지"], tip: "폭젠 맵으로 유명. 퀘스트 재료(돼지 리본) 수집도 겸할 수 있다.", source: "https://yulbin.com", common: true },
  { levelMin: 20, levelMax: 30, map: "개미굴 (깊은 개미굴)", region: "슬리피우드", monsters: ["좀비버섯", "이블아이", "뿔버섯"], tip: "30렙까지 최고 효율로 꼽히는 6인 파티 사냥터. 좀비버섯이 미스릴 장비 드롭. 지루하면 커닝 파퀘 병행.", source: "https://arca.live/b/mapleland/121755943", common: true },
  { levelMin: 25, levelMax: 30, map: "커닝시티 파티퀘스트", region: "커닝시티", monsters: ["리게이터", "주니어 네키"], tip: "무자본 권장 루트. 단 전사는 리게이터 명중이 높아 25렙 이상 권장.", source: "https://arca.live/b/mapleland/103241532", common: true },
  { levelMin: 25, levelMax: 40, map: "야시장3 자판기 (황제쩔)", region: "대만 (차이나타운)", monsters: ["예티 인형", "버블티"], tip: "고렙이 끌어주는 저렙 쩔 명소. 직업 무관 쩔 수혜.", source: "https://maplelandzzul.gg", common: true },

  // ── 30~50 (중반) ──
  { levelMin: 30, levelMax: 40, map: "와일드보어의 땅 1·2", region: "페리온 동쪽", monsters: ["와일드보어", "주니어 부기"], tip: "1~3층 구조라 2인 파티 층 분담이 효율적. 광역 직업이 층 쓸기 유리.", source: "https://namu.wiki/w/Mapleland/사냥터", jobs: ["히어로","팔라딘","다크나이트","소울마스터","플레임위자드","윈드브레이커","나이트워커","스트라이커"] },
  { levelMin: 33, levelMax: 40, map: "사헬지대 3", region: "아랍 (사막)", monsters: ["모래두더쥐", "스콜피언"], tip: "전사 솔플 추천. 카에데보다 지형이 편하고 활공 60% 드롭도 매력.", source: "https://ssalmuk.com/community/hot/detail?code=B25041542", jobs: ["히어로","팔라딘","다크나이트"] },
  { levelMin: 30, levelMax: 45, map: "마약왕 카니발 쩔 (승작/폐작)", region: "루디브리엄 카니발", monsters: ["(쩔 — 직접 사냥 X)"], tip: "자본 있으면 승작쩔, 무자본은 폐작쩔로 메소 벌며 경험치. 솔플보다 압도적으로 빠르다.", source: "https://ssalmuk.com/community/hot/detail?code=B25041542", common: true },
  { levelMin: 30, levelMax: 42, map: "오르비스 탑 1층 (주니어 페페)", region: "오르비스", monsters: ["주니어 페페"], tip: "밀집 지형이라 불 약점 광역(파이어 애로우)에 적합. 불독 무자본 손질용.", source: "https://vortexgaming.io/en/postdetail/505403", jobs: ["불독"] },
  { levelMin: 35, levelMax: 45, map: "동쪽 바위산 6", region: "페리온", monsters: ["커즈아이", "파이어 보어"], tip: "표창/단검 도적 계열의 35~40대 인기 솔플. 2인 지형 분할도 가능.", source: "https://arca.live/b/mapleland/129219844", jobs: ["나이트로드","섀도어","나이트워커","스트라이커"] },
  { levelMin: 35, levelMax: 53, map: "시간의 길 1·4 (시길)", region: "루디브리엄 시계탑", monsters: ["플래툰 크로노스", "마스터 크로노스"], tip: "평지형이라 광역·원거리 직업이 유리. 크로노스→플래툰→마스터 순으로 레벨 따라 이동. 젠·드롭 모두 우수.", source: "https://ssalmuk.com/community/CATE_community335/game/detail?code=B25041544", common: true },
  { levelMin: 40, levelMax: 50, map: "시간의 길 4 심쩔 / 카니발", region: "루디브리엄 시계탑", monsters: ["마스터 크로노스"], tip: "홀리심볼 파티(심쩔)로 본인이 안 잡아도 경험치 분배받는 비숍 핵심 구간.", source: "https://ssalmuk.com/community/CATE_community335/game/detail?code=B25041544", jobs: ["비숍"] },
  { levelMin: 45, levelMax: 55, map: "마가티아 C-1 (미스릴 광산)", region: "마가티아", monsters: ["로보", "마가티아 실험체"], tip: "전사 솔플 추천, 1탐 30만+. 미스릴 광산은 명중 55 필요(도감+알약+순덱).", source: "https://vortexgaming.io/en/postdetail/498457", jobs: ["히어로","팔라딘","다크나이트"] },

  // ── 50~70 ──
  { levelMin: 50, levelMax: 65, map: "커닝스퀘어 8층 CD사냥", region: "커닝시티", monsters: ["흘러간가요CD", "최신곡CD"], tip: "썬콜 핵심 솔플. 올인트 55~65 분당 4만, 65+ 5만. 자리 경쟁 심하면 개인화맵으로 대체.", source: "https://m.dcinside.com/board/mapleplanet/43297", jobs: ["썬콜"] },
  { levelMin: 50, levelMax: 60, map: "따뜻한 모래밭 / 차가운 벌판", region: "아리안트 / 엘나스", monsters: ["화이트팽", "헥터"], tip: "현 50~60 최고 인기 파티 사냥터. 화이트팽이 불 약점이라 '불독팟'까지 존재. 비숍은 심/헤이스트로 환영.", source: "https://namu.wiki/w/Mapleland/사냥터", jobs: ["불독","비숍"] },
  { levelMin: 50, levelMax: 60, map: "월하죽림 3", region: "일본 (세계여행)", monsters: ["삼미호", "물 도깨비"], tip: "두 몹 모두 불 약점 + 일자맵이라 불독 최적 솔플. 단 삼미호 원킬 못하면 저주, 성수/만병통치약 필수.", source: "https://yulbin.com/메이플랜드-월하죽림3-가는법-사냥정보-정리/", jobs: ["불독"] },
  { levelMin: 51, levelMax: 58, map: "오르비스 경험치 파티 (올비경파)", region: "오르비스", monsters: ["(경험치 파티)"], tip: "51~58 최고 효율 파티, 시간당 35~40만. 텔포/헤이스트 없으면 입장이 까다로워 파티 구성 필요.", source: "https://vortexgaming.io/en/postdetail/498457", jobs: ["히어로","팔라딘","다크나이트","불독"] },
  { levelMin: 50, levelMax: 76, map: "드레이크의 푸른 동굴", region: "페리온 용의 계곡", monsters: ["드레이크"], tip: "드레이크만 젠하고 드롭템이 좋다. 반시계로 돌며 솔플 또는 층 분할 파티.", source: "https://namu.wiki/w/Mapleland/사냥터", common: true },
  { levelMin: 54, levelMax: 80, map: "골렘의 숲 (골숲)", region: "슬리피우드 히든스트리트", monsters: ["스톤골렘", "다크 스톤골렘", "미스릴 뮤테"], tip: "젠률이 엄청나 솔플·파티 모두 좋고 드롭 가치도 높다. 바닥 분할 파티 가능. 근접 광역에 특히 적합.", source: "https://vortexgaming.io/en/postdetail/498457", jobs: ["히어로","팔라딘","다크나이트","썬콜","불독","비숍","소울마스터","스트라이커"] },
  { levelMin: 58, levelMax: 77, map: "차가운 벌판 (차벌) 심쩔", region: "엘나스", monsters: ["드레이크", "아이스 드레이크", "다크 드레이크"], tip: "전사 최고 사냥터로 평가. 차벌 심쩔 1탐 55~70만. 썬콜은 약점은 못 찌르나 썬더볼트로 젠컷. 불독 58~76 거의 고정.", source: "https://arca.live/b/mapleland/146592374", jobs: ["히어로","팔라딘","다크나이트","썬콜","불독"] },
  { levelMin: 53, levelMax: 75, map: "죽은 나무의 숲 2·3 (죽숲)", region: "슬리피우드", monsters: ["쿨리 좀비", "좀비 루팡"], tip: "초창기부터 최고 인기. 53~60 죽숲2, 60~73 죽숲3은 파티 권장. ※ 죽숲1은 2025년 패치로 젠 너프+솔플 전용화.", source: "https://vortexgaming.io/postdetail/521809", jobs: ["보우마스터","신궁","나이트로드","섀도어","소울마스터","플레임위자드","윈드브레이커","나이트워커","스트라이커"] },
  { levelMin: 58, levelMax: 72, map: "엘나스 콜드필드 / 아이시필드", region: "엘나스", monsters: ["화이트팽", "헥터"], tip: "시간당 40~70만의 최고 효율급(명중 92 필요). 리치 파티 없으면 인접 아이시필드 솔플.", source: "https://vortexgaming.io/en/postdetail/498457", jobs: ["히어로","팔라딘","다크나이트"] },

  // ── 70~100 ──
  { levelMin: 70, levelMax: 90, map: "로미오와 줄리엣 파티퀘스트", region: "마가티아", monsters: ["(파티퀘스트)"], tip: "이 구간 압도적 추천. 숙련 시 12~15분 컷, 1탐 120~150만. 직업 무관 효율 최강. 버닝 1.5배와 시너지.", source: "https://arca.live/b/mapleland/146592374", common: true },
  { levelMin: 73, levelMax: 90, map: "사이길 (시간이 멈춘 곳) / 마대태", region: "시간의 신전 / 미나르 숲", monsters: ["타이밍", "마뇌 대원"], tip: "전사·궁수는 73렙부터 4층 가능. 장갑 공격 드롭. 원거리 단일/관통이 안정적.", source: "https://vortexgaming.io/postdetail/568189", jobs: ["보우마스터","신궁"] },
  { levelMin: 75, levelMax: 85, map: "마가티아 데저트 / 야시장 사잇길", region: "마가티아 / 아쿠아로드", monsters: ["테러브링거", "어인"], tip: "불독 77~80 사잇길 파티, 78~ 마데테(장비 드롭으로 적자 회피).", source: "https://yulbin.com/메이플랜드-야시장-사잇길/", jobs: ["불독"] },
  { levelMin: 80, levelMax: 85, map: "하늘 둥지 입구 (하둥)", region: "오르비스", monsters: ["그리폰", "주니어 그류핀"], tip: "익스플로전(불독)·체인라이트닝(썬콜) 필요 → 75~77 정법 전환 권장. 경험치 120만+. 비숍 1확은 합마 920 요구.", source: "https://namu.wiki/w/Mapleland/직업/비숍", jobs: ["썬콜","불독","비숍"] },
  { levelMin: 80, levelMax: 100, map: "죽은나무숲 / 906 / 월죽 / 차벌 (솔플 순환)", region: "리프레 / 엘나스 / 오르비스", monsters: ["루나픽시", "와일드카고", "드레이크"], tip: "솔플 전사들이 5렙 단위로 옮겨다니는 구간. 인기 자리(906·죽숲)는 자리싸움 심해 피해다니기도. 906은 메소, 차벌은 경험치.", source: "https://arca.live/b/mapleland/134045062", jobs: ["히어로","팔라딘","다크나이트"] },
  { levelMin: 80, levelMax: 100, map: "듀얼 파이렛 파티 (듀파)", region: "루디브리엄 시계탑 최하층", monsters: ["듀얼 파이렛"], tip: "파티에 끼면 80~100 레벨업이 획기적으로 빠르다. 85~98 마법사 범위 파밍 성지(뇌전수리검 드롭).", source: "https://arca.live/b/mapleland/146599129", jobs: ["히어로","팔라딘","다크나이트","썬콜","불독","비숍"] },
  { levelMin: 83, levelMax: 100, map: "붉은 켄타우로스 / 숲속 갈가마귀", region: "미나르 숲", monsters: ["붉은 켄타우로스", "갈가마귀"], tip: "85~100 붉켄 1순위·숲갈 2순위. 광역몹 밀집맵이라 원거리·관통에 적합.", source: "https://vortexgaming.io/postdetail/521809", jobs: ["보우마스터","신궁"] },
  { levelMin: 85, levelMax: 110, map: "불과 어둠의 전장 좌측 3층 (붉켄)", region: "미나르 숲", monsters: ["붉은 켄타우로스"], tip: "붉켄은 얼음 약점/화염 반감 → 썬콜 전용. 젠컷 낚시사냥. 경험치 압도적이나 득템 의존.", source: "https://arca.live/b/mapleland/166715712", jobs: ["썬콜"] },
  { levelMin: 89, levelMax: 100, map: "사헬지대 (90제 파밍)", region: "니할 사막", monsters: ["사막 라쿤", "왕거북"], tip: "89·90 몹이 섞여 90제·100제 장비가 동시 드롭. 표창/단검 도적이 파밍 겸 사냥.", source: "https://namu.wiki/w/Mapleland/직업/섀도어", jobs: ["나이트로드","섀도어"] },
  { levelMin: 60, levelMax: 120, map: "깊은 바다 협곡 2 (망둥 555)", region: "아쿠아로드", monsters: ["망둥이", "폭렬 망둥이집"], tip: "시간당 150~250만의 최상위 효율존. 좁은 발판·다수 젠이라 광역/원거리에 특히 유리.", source: "https://maplelandzzul.gg", jobs: ["플레임위자드","윈드브레이커","나이트워커"] },

  // ── 100~120+ ──
  { levelMin: 92, levelMax: 120, map: "오징어 (해저 폐선)", region: "아쿠아로드", monsters: ["오징어", "오징어 선장"], tip: "궁수 무기 드롭 구간. 오징어 선장(140~180)은 5층 쩔로 모집 쉬움. 샤프아이즈 비용 부담.", source: "https://vortexgaming.io/postdetail/521809", jobs: ["보우마스터","신궁","나이트로드","섀도어"] },
  { levelMin: 98, levelMax: 120, map: "협곡의 동쪽길 / 죽은 용의 둥지 (미스트)", region: "미나르 숲", monsters: ["다크 와이번", "스켈레곤"], tip: "불독 포이즌 미스트 솔플 핵심. 죽둥은 미스트 사냥터 중 피로도 최저라 컨트롤 잘하면 적자 회피.", source: "https://vortexgaming.io/en/postdetail/632210", jobs: ["불독"] },
  { levelMin: 96, levelMax: 130, map: "블루 와이번의 둥지 (심알바)", region: "미나르 숲", monsters: ["블루 와이번"], tip: "전사 성지 → 비숍은 5인팟 심알바(홀리심볼). 피로도 높지만 심알바 중 수익률 최고.", source: "https://arca.live/b/mapleland/135613323", jobs: ["비숍"] },
  { levelMin: 100, levelMax: 120, map: "미래의 시간 / 브레스튼 파티", region: "리프레", monsters: ["브레스튼"], tip: "100 안팎 강몹 브레스튼은 경험치 압도적이나 솔로는 버거워 3~4인 파티 권장. 전사는 탱 역할.", source: "https://vortexgaming.io/en/postdetail/601072", jobs: ["히어로","팔라딘","다크나이트"] },
  { levelMin: 100, levelMax: 160, map: "레드 와이번의 둥지 (얼음 약점)", region: "미나르 숲", monsters: ["레드 와이번", "다크 코니언"], tip: "레드 와이번 화속성(얼음 약점) → 썬콜 전용. 2~3층 아이스 스트라이크 낚시. 사실상 얼음 약점 마지막 사냥터.", source: "https://arca.live/b/mapleland/123213579", jobs: ["썬콜"] },
  { levelMin: 100, levelMax: 120, map: "불의 전당 3층 5인 / 망용동 쩔", region: "엘나스 / 미나르 숲", monsters: ["불 도깨비", "와이번"], tip: "100~108 불어전 5인 3층. 망용동 쩔 경험치 650~750만/시간. 고렙 파티/쩔 위주 구간.", source: "https://vortexgaming.io/postdetail/568189", common: true },
  { levelMin: 108, levelMax: 140, map: "큰 미로의 동굴 (큰미굴)", region: "미궁의 길", monsters: ["다크 예티", "페페"], tip: "경험치+피로도 꿀통. HP 2950+면 큰깹(깊은 동굴) 가능. 다층 미로맵.", source: "https://vortexgaming.io/postdetail/521809", jobs: ["보우마스터","신궁"] },
  { levelMin: 108, levelMax: 200, map: "큰 둥지 봉우리 (큰둥) / 용의 숲 3", region: "미나르 숲", monsters: ["와이번", "브레스튼", "다크 코니언"], tip: "원거리 솔플 사실상 최종 사냥터. 샤프아이즈30·화이트니스록 드롭으로 경험치+수익. 비숍은 격수에게 심만 주는 심알바 편함.", source: "https://arca.live/b/mapleland/141320136", jobs: ["보우마스터","신궁","썬콜","비숍"] },
  { levelMin: 100, levelMax: 140, map: "용기사 피뻥 솔플 (드래곤 로어)", region: "리프레 / 엘나스 / 오르비스", monsters: ["루나픽시", "와일드카고", "드레이크"], tip: "다크나이트는 3차 드래곤 로어(희귀 광역기)+피뻥으로 솔플 메소·경험치를 동시에. 100+ 솔플 전사 중 가장 자립적.", source: "https://arca.live/b/mapleland/162558727", jobs: ["다크나이트"] },
];

// ─── 직업별 특성 메모 ───
const JOB_NOTES: Record<string, string> = {
  "히어로": "브랜디쉬 다수 타격으로 같은 자리에서 사냥 효율이 전사 3직업 중 최상. 공용 자리(차벌·골렘숲·906)에서 체감 효율이 높다.",
  "팔라딘": "디바인 스티그마·생츄어리·묠니르 등 광역 보조기로 몹 밀집맵(골렘숲·차벌·듀파)에서 다수 처리에 강하다. 단일 극딜은 히어로에 밀림.",
  "다크나이트": "3차 드래곤 로어(광역) + 피뻥으로 100+ 솔플 자립도가 전사 중 최고. 죽숲·차벌·906 광역 솔플에 우위.",
  "썬콜": "썬더볼트/체인라이트닝 젠컷 + 얼음 약점 몹(붉켄·레드와이번) 전용 딜러. CD사냥·시길 솔플 효율이 좋다.",
  "불독": "파이어/포이즌 광역 + 불 약점 몹(화이트팽·삼미호) 특화. 미스트 솔플(죽둥·협동)로 고렙 자립.",
  "비숍": "홀리심볼 심쩔/심알바로 안 잡아도 경험치를 받는 구조가 핵심. 파티 유틸(헤이스트·헐)로 어디서나 환영.",
  "보우마스터": "원거리 단일/연사. 죽숲·붉켄·오징어·큰둥 등 밀집·관통 맵에서 안정적.",
  "신궁": "관통·강력한 단일딜. 산책로 '날먹', 사이길, 큰미굴 등 효율 루트가 잘 정립되어 있다.",
  "나이트로드": "표창 원거리 + 어밴/표풍. 동바산6·죽숲·오징어 등. 90~ 사헬 90제 파밍 겸용.",
  "섀도어": "단검 근접 + 메소 익스플로전. 죽숲·드레이크 동굴 등 근접 효율 자리. 90제 파밍.",
  "소울마스터": "시그너스 전사. 근접 광역으로 골렘숲·시길·죽숲 등 평지·밀집맵 유리. 시그너스 전용 사냥터는 없고 모험가와 공유.",
  "플레임위자드": "시그너스 마법사. 광역 평지·다수 젠(시길·골숲·망둥)에서 강함.",
  "윈드브레이커": "시그너스 궁수. 원거리(차가운 벌판·망둥). 좁은 발판/넉백 맵(불어전 등)에서는 불리할 수 있다.",
  "나이트워커": "시그너스 도적. 표창+소환수. 동바산6·차가운 벌판·망둥 등 원거리 효율 자리.",
  "스트라이커": "시그너스 해적. 근접 번개. 골렘숲·동바산6 등 근접 자리. 시그너스는 보통 120 고정대 운영.",
};

// ─── 레벨 밴드 ───
const BANDS = [
  { key: "1-30", label: "Lv.1~30 · 초반", min: 0, max: 29 },
  { key: "30-50", label: "Lv.30~50 · 중반", min: 30, max: 49 },
  { key: "50-70", label: "Lv.50~70 · 중후반", min: 50, max: 69 },
  { key: "70-100", label: "Lv.70~100 · 후반", min: 70, max: 99 },
  { key: "100+", label: "Lv.100+ · 만렙 구간", min: 100, max: 999 },
];

function firstUrl(s: string): string | null {
  const m = s.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}
function sourceHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").replace(/^m\./, ""); }
  catch { return "출처"; }
}

export default function LevelingPage() {
  const [job, setJob] = useState<string>("전체");

  const filtered = useMemo(() => {
    const list = job === "전체" ? SPOTS : SPOTS.filter((s) => s.common || s.jobs?.includes(job));
    return [...list].sort((a, b) => a.levelMin - b.levelMin || a.levelMax - b.levelMax);
  }, [job]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* 헤더 */}
      <div>
        <h1 className="font-pixel text-xl text-ink flex items-center gap-2">
          <span>🗺️</span> 직업별 육성 사냥터
          <span className="pixel-badge font-pixel text-[10px] bg-[color-mix(in_srgb,var(--c-mush)_18%,transparent)] text-mush">버닝 월드</span>
        </h1>
        <p className="text-sm text-dim mt-1">
          커뮤니티에서 모은 레벨 구간별 추천 사냥터. 직업을 고르면 그 직업이 가는 곳만 보여줍니다.
          버닝 월드는 경험치 1.5배라 맵은 같고 체류 시간만 짧아집니다.
        </p>
      </div>

      {/* 직업 선택 */}
      <div className="pixel-panel p-4 space-y-3">
        <button
          onClick={() => setJob("전체")}
          className={`font-pixel text-[12px] px-3 py-1.5 mr-2 ${job === "전체" ? "pixel-btn" : "bg-surface2 text-dim hover:text-maple border-2 border-edge"}`}
        >
          전체
        </button>
        {JOB_GROUPS.map((g) => (
          <div key={g.group} className="flex items-center gap-2 flex-wrap">
            <span className="font-pixel text-[11px] text-dim w-14 shrink-0">{g.group}</span>
            {g.jobs.map((j) => (
              <button
                key={j.key}
                onClick={() => setJob(j.key)}
                className={`font-pixel text-[12px] px-3 py-1.5 ${job === j.key ? "pixel-btn" : "bg-surface2 text-dim hover:text-maple border-2 border-edge"}`}
              >
                {j.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* 직업 특성 메모 */}
      {job !== "전체" && JOB_NOTES[job] && (
        <div className="pixel-panel p-4 flex items-start gap-2">
          <span className="text-base shrink-0">📌</span>
          <p className="text-sm text-dim"><span className="font-pixel text-maple text-[12px]">{job}</span> · {JOB_NOTES[job]}</p>
        </div>
      )}

      {/* 사냥터 목록 (레벨 밴드별) */}
      {BANDS.map((band) => {
        const spots = filtered.filter((s) => s.levelMin >= band.min && s.levelMin <= band.max);
        if (spots.length === 0) return null;
        return (
          <div key={band.key}>
            <h2 className="font-pixel text-[13px] text-maple mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-maple" />{band.label}
            </h2>
            <div className="space-y-2">
              {spots.map((s, i) => {
                const url = firstUrl(s.source);
                return (
                  <div key={`${band.key}-${i}`} className="pixel-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="pixel-badge font-pixel text-[10px] bg-[color-mix(in_srgb,var(--c-skill)_18%,transparent)] text-skill">
                            Lv.{s.levelMin}~{s.levelMax}
                          </span>
                          <span className="font-bold text-ink">{s.map}</span>
                        </div>
                        <p className="text-xs text-dim mt-0.5">📍 {s.region}</p>
                      </div>
                    </div>
                    {s.monsters.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.monsters.map((m) => (
                          <span key={m} className="pixel-badge text-[11px] bg-surface2 text-dim">{m}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-ink mt-2 leading-relaxed">{s.tip}</p>
                    <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                      {/* 직업 태그 (전체 보기일 때만, 공용은 표시 안 함) */}
                      {job === "전체" && !s.common && s.jobs && (
                        <div className="flex flex-wrap gap-1">
                          {s.jobs.length >= ALL_JOBS.length - 2 ? (
                            <span className="pixel-badge text-[10px] bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple">대부분 직업</span>
                          ) : s.jobs.map((j) => (
                            <span key={j} className="pixel-badge text-[10px] bg-[color-mix(in_srgb,var(--c-maple)_12%,transparent)] text-maple">{j}</span>
                          ))}
                        </div>
                      )}
                      {job === "전체" && s.common && (
                        <span className="pixel-badge text-[10px] bg-[color-mix(in_srgb,var(--c-slime)_16%,transparent)] text-slime">전 직업 공용</span>
                      )}
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-dim hover:text-maple ml-auto">
                          출처: {sourceHost(url)} →
                        </a>
                      ) : (
                        <span className="text-[11px] text-dim ml-auto">출처: {s.source}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 면책 */}
      <p className="text-[11px] text-dim leading-relaxed pixel-panel p-3">
        ※ 커뮤니티(arca.live·dcinside·inven·나무위키·블로그) 글을 수집·정리한 자료로, 젠률·효율은 패치와 자리 경쟁에 따라 달라질 수 있습니다.
        인기 자리(906·죽숲·플래툰 크로노스 등)는 자리싸움이 심해 실제 효율이 크게 좌우됩니다. 명중·합산마력 수치는 세팅에 따라 달라지는 참고값입니다.
      </p>
    </div>
  );
}
