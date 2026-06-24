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
  { group: "해적", jobs: [
    { key: "바이퍼", label: "바이퍼" },
    { key: "캡틴", label: "캡틴" },
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
// common: 전 직업 공용 / jobs: 해당 직업만 / miniDungeon: 2.0 미니던전(개인던전)
// kind: 'meso'=메소 파밍, 'boss'=보스 입문 (없으면 일반 사냥터)
interface Spot {
  levelMin: number;
  levelMax: number;
  map: string;
  region: string;
  monsters: string[];
  tip: string;
  source: string;
  jobs?: string[];
  common?: boolean;
  miniDungeon?: boolean;
  kind?: "meso" | "boss";
}

const SPOTS: Spot[] = [
  // ── 1~30 (전 직업 공용 초반) ──
  { levelMin: 1, levelMax: 10, map: "메이플 아일랜드 (퀘스트 위주)", region: "메이플 아일랜드", monsters: ["달팽이", "파란달팽이", "주황버섯"], tip: "아일랜드 퀘스트를 전부 깨면 8렙 → 전직. 버닝 월드는 경험치 1.5배라 사냥보다 퀘스트가 더 빠르다.", source: "https://ssalmuk.com/community/CATE_community335/game/detail?code=B26040722", common: true },
  { levelMin: 10, levelMax: 20, map: "헤네시스 사냥터1 · 동쪽 풀숲 · 슬라임굴", region: "헤네시스 / 남쪽 숲", monsters: ["주황버섯", "리본돼지", "슬라임"], tip: "일자 지형이라 사냥이 편하다. 헤네 사냥터1이 슬라임굴보다 젠이 좋다는 의견이 다수. 돼지머리/슬라임방울 판매로 초기 자금.", source: "https://ssalmuk.com/community/CATE_community335/game/detail?code=B25041540", common: true },
  { levelMin: 10, levelMax: 15, map: "돼지농장 (미니던전)", region: "헤네시스 동쪽 풀숲", monsters: ["돼지", "리본돼지"], tip: "동쪽 풀숲에서 진입하는 개인 던전. 자리싸움 없이 2시간 사냥, 망토 행운주문서·신발 민첩 등 드롭. 솔플·파티 모두 입문용으로 좋다.", source: "https://vortexgaming.io/postdetail/843653", common: true, miniDungeon: true },
  { levelMin: 20, levelMax: 30, map: "개미굴 (깊은 개미굴)", region: "슬리피우드", monsters: ["좀비버섯", "이블아이", "뿔버섯"], tip: "30렙까지 최고 효율로 꼽히는 6인 파티 사냥터. 좀비버섯이 미스릴 장비 드롭. 지루하면 커닝 파퀘 병행.", source: "https://arca.live/b/mapleland/121755943", common: true },
  { levelMin: 20, levelMax: 30, map: "개미굴2 (미니던전)", region: "슬리피우드", monsters: ["뿔버섯", "좀비버섯"], tip: "5층 구조에 최대 5인 파티 입장, 2시간 개인화. 본섭 개미굴 자리경쟁이 심할 때 대안.", source: "https://vortexgaming.io/postdetail/843653", common: true, miniDungeon: true },
  { levelMin: 24, levelMax: 30, map: "사헬지대 (미니던전)", region: "니할 사막 (마가티아 방면)", monsters: ["모래두더지"], tip: "사헬지대2 위쪽에서 입장. 모래두더지 단일 출현이라 안정적. 마가티아 권역 진입 전 구간.", source: "https://vortexgaming.io/postdetail/843653", common: true, miniDungeon: true },
  { levelMin: 25, levelMax: 30, map: "커닝시티 파티퀘스트", region: "커닝시티", monsters: ["리게이터", "주니어 네키"], tip: "무자본 권장 루트. 단 전사는 리게이터 명중이 높아 25렙 이상 권장.", source: "https://arca.live/b/mapleland/103241532", common: true },
  { levelMin: 25, levelMax: 40, map: "야시장3 자판기 (황제쩔)", region: "대만 (차이나타운)", monsters: ["예티 인형", "버블티"], tip: "고렙이 끌어주는 저렙 쩔 명소. 직업 무관 쩔 수혜.", source: "https://maplelandzzul.gg", common: true },

  // ── 30~50 (중반) ──
  { levelMin: 30, levelMax: 40, map: "와일드보어의 땅 1·2", region: "페리온 동쪽", monsters: ["와일드보어", "주니어 부기"], tip: "1~3층 구조라 2인 파티 층 분담이 효율적. 광역 직업이 층 쓸기 유리.", source: "https://namu.wiki/w/Mapleland/사냥터", jobs: ["히어로","팔라딘","다크나이트","소울마스터","플레임위자드","윈드브레이커","나이트워커","스트라이커"] },
  { levelMin: 30, levelMax: 35, map: "북치는 토끼의 은신처 (미니던전)", region: "루디브리엄 에오스탑", monsters: ["북치는토끼"], tip: "에오스탑 76층 밑에서 진입. 지형이 평탄해 사냥이 쾌적, 개인화 2시간. 30대 초반 무난한 대안.", source: "https://vortexgaming.io/postdetail/843653", common: true, miniDungeon: true },
  { levelMin: 30, levelMax: 45, map: "마약왕 카니발 쩔 (승작/폐작)", region: "루디브리엄 카니발", monsters: ["(쩔 — 직접 사냥 X)"], tip: "자본 있으면 승작쩔, 무자본은 폐작쩔로 메소 벌며 경험치. 솔플보다 압도적으로 빠르다.", source: "https://ssalmuk.com/community/hot/detail?code=B25041542", common: true },
  { levelMin: 30, levelMax: 42, map: "오르비스 탑 1층 (주니어 페페)", region: "오르비스", monsters: ["주니어 페페"], tip: "밀집 지형이라 불 약점 광역(파이어 애로우)에 적합. 불독 무자본 손질용.", source: "https://vortexgaming.io/en/postdetail/505403", jobs: ["불독"] },
  { levelMin: 35, levelMax: 45, map: "동쪽 바위산 6", region: "페리온", monsters: ["커즈아이", "파이어 보어"], tip: "표창/단검 도적·해적 근접의 35~40대 인기 솔플. 2인 지형 분할도 가능.", source: "https://arca.live/b/mapleland/129219844", jobs: ["나이트로드","섀도어","나이트워커","스트라이커","바이퍼","캡틴"] },
  { levelMin: 37, levelMax: 45, map: "원숭이의 숲 1 (원숲1)", region: "엘리니아", monsters: ["루팡", "좀비루팡"], tip: "루팡 메소 110 + 루팡의 바나나 65% 드롭 환금. 왼쪽이 루팡 비중 높음. 저~중반 무자본 자본벌이.", source: "https://jsmu.xyz/mapleland-where-is-monky-forest/", common: true },
  { levelMin: 35, levelMax: 53, map: "시간의 길 1·4 (시길)", region: "루디브리엄 시계탑", monsters: ["플래툰 크로노스", "마스터 크로노스"], tip: "평지형이라 광역·원거리 직업이 유리. 크로노스→플래툰→마스터 순으로 레벨 따라 이동. 젠·드롭 모두 우수. 마스터 크로노스는 투구 민첩 60% 드롭으로 도적 앵벌이도.", source: "https://ssalmuk.com/community/CATE_community335/game/detail?code=B25041544", common: true },
  { levelMin: 40, levelMax: 50, map: "시간의 길 4 심쩔 / 카니발", region: "루디브리엄 시계탑", monsters: ["마스터 크로노스"], tip: "홀리심볼 파티(심쩔)로 본인이 안 잡아도 경험치 분배받는 비숍 핵심 구간.", source: "https://ssalmuk.com/community/CATE_community335/game/detail?code=B25041544", jobs: ["비숍"] },
  { levelMin: 40, levelMax: 50, map: "마가티아 제뉴미스트 연구소 B-3", region: "마가티아", monsters: ["아이언 뮤테", "루루모"], tip: "40대 마가티아 구간. C구역 진입 전 단계. 야생곰의 영토와 번갈아 활용 권장.", source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=3680045", common: true },

  // ── 50~70 ──
  { levelMin: 50, levelMax: 65, map: "마가티아 연구소 C-1", region: "마가티아", monsters: ["로이드"], tip: "버닝 인기 사냥터의 핵심. 로이드(Lv54) 단일 출현 + 무적자리 + 일직선 몰이맵이라 물약을 거의 안 쓰고 솔플 효율·메소가 안정적. C-1 미니던전 버전도 함께 제공.", source: "https://vortexgaming.io/en/postdetail/625336", common: true },
  { levelMin: 50, levelMax: 65, map: "마가티아 C1 (미니던전)", region: "마가티아", monsters: ["로이드"], tip: "본섭 C-1 자리경쟁을 피하는 개인 던전 버전. 젠 양호, 솔플 효율 우수, 2시간 개인화.", source: "https://vortexgaming.io/postdetail/843653", common: true, miniDungeon: true },
  { levelMin: 50, levelMax: 65, map: "무너진 골렘의 성 (미니던전)", region: "슬리피우드", monsters: ["스톤골렘", "믹스골렘"], tip: "슬리피던전4까지 내려가 진입. 물약 소모가 적어 효율적. 인기 골렘 자리싸움 회피용.", source: "https://vortexgaming.io/postdetail/843653", common: true, miniDungeon: true },
  { levelMin: 50, levelMax: 65, map: "커닝스퀘어 8층 CD사냥", region: "커닝시티", monsters: ["흘러간가요CD", "최신곡CD"], tip: "썬콜 핵심 솔플. 올인트 55~65 분당 4만, 65+ 5만. 자리 경쟁 심하면 개인화맵으로 대체.", source: "https://m.dcinside.com/board/mapleplanet/43297", jobs: ["썬콜"] },
  { levelMin: 50, levelMax: 60, map: "따뜻한 모래밭 / 차가운 벌판", region: "플로리나 비치 / 엘나스", monsters: ["화이트팽", "헥터"], tip: "현 50~60 최고 인기 파티 사냥터. 화이트팽이 불 약점이라 '불독팟'까지 존재. 비숍은 심/헤이스트로 환영.", source: "https://namu.wiki/w/Mapleland/사냥터", jobs: ["불독","비숍"] },
  { levelMin: 50, levelMax: 60, map: "오르비스 구름공원", region: "오르비스", monsters: ["루나픽시", "러스터픽시"], tip: "화독법(화염 광역)으로 시간당 40~45만. 플레임위자드·불독에 특히 좋다.", source: "https://vortexgaming.io/en/postdetail/543979", jobs: ["플레임위자드","불독"] },
  { levelMin: 50, levelMax: 60, map: "월하죽림 3", region: "일본 (세계여행)", monsters: ["삼미호", "물도깨비"], tip: "두 몹 모두 불 약점 + 일자맵이라 불독 최적 솔플. 단 삼미호 원킬 못하면 저주, 성수/만병통치약 필수.", source: "https://yulbin.com/메이플랜드-월하죽림3-가는법-사냥정보-정리/", jobs: ["불독"] },
  { levelMin: 51, levelMax: 58, map: "오르비스 경험치 파티 (올비경파)", region: "오르비스", monsters: ["(경험치 파티)"], tip: "51~58 최고 효율 파티, 시간당 35~40만. 텔포/헤이스트 없으면 입장이 까다로워 파티 구성 필요.", source: "https://vortexgaming.io/en/postdetail/498457", jobs: ["히어로","팔라딘","다크나이트","불독"] },
  { levelMin: 50, levelMax: 76, map: "드레이크의 푸른 동굴", region: "페리온 용의 계곡", monsters: ["드레이크", "와일드카고"], tip: "드레이크만 젠하고 드롭템이 좋다. 반시계로 돌며 솔플 또는 층 분할 파티. 와일드카고는 메소 드롭이 큰 편.", source: "https://namu.wiki/w/Mapleland/사냥터", common: true },
  { levelMin: 54, levelMax: 70, map: "마가티아 연구소 C-2", region: "마가티아", monsters: ["로이드", "네오휴로이드"], tip: "맵이 넓어 파티/몰이에 유리, 자리 구하기 쉬움. 네오휴로이드는 장갑 공격력 60% 드롭으로 쌀먹 인기(시간당 약 100만 메소). 네오휴로이드 마법공격 주의.", source: "https://vortexgaming.io/en/postdetail/625336", common: true },
  { levelMin: 50, levelMax: 75, map: "연구소 C-1~3 (지구방위본부)", region: "커닝시티 지하 연구소", monsters: ["로보", "마스터로보", "치명적 오류"], tip: "60+ 전 직업 입장 가능한 메인 구간. 층이 많아 설치/광역(플위)에 유리. 나이트워커는 45~75 핵심.", source: "https://arca.live/b/mapleland/173906185", jobs: ["소울마스터","플레임위자드","윈드브레이커","나이트워커","스트라이커"] },
  { levelMin: 54, levelMax: 80, map: "골렘의 숲 (골숲)", region: "슬리피우드 히든스트리트", monsters: ["스톤골렘", "다크 스톤골렘", "믹스골렘"], tip: "젠률이 엄청나 솔플·파티 모두 좋고 드롭 가치도 높다. 바닥 분할 파티 가능. 근접 광역에 특히 적합.", source: "https://vortexgaming.io/en/postdetail/498457", jobs: ["히어로","팔라딘","다크나이트","썬콜","불독","비숍","소울마스터","스트라이커","바이퍼"] },
  { levelMin: 58, levelMax: 77, map: "차가운 벌판 (차벌) 심쩔", region: "엘나스", monsters: ["드레이크", "아이스 드레이크", "다크 드레이크"], tip: "전사 최고 사냥터로 평가. 차벌 심쩔 1탐 55~70만. 썬콜은 약점은 못 찌르나 썬더볼트로 젠컷. 불독 58~76 거의 고정.", source: "https://arca.live/b/mapleland/146592374", jobs: ["히어로","팔라딘","다크나이트","썬콜","불독","바이퍼"] },
  { levelMin: 53, levelMax: 75, map: "죽은 나무의 숲 2·3 (죽숲)", region: "슬리피우드", monsters: ["쿨리 좀비", "좀비 루팡"], tip: "초창기부터 최고 인기. 53~60 죽숲2, 60~73 죽숲3은 파티 권장. ※ 죽숲1은 2025년 패치로 젠 너프+솔플 전용화 → 고렙 구간은 켄타우로스 원탁 미니던전이 대체재.", source: "https://vortexgaming.io/postdetail/521809", jobs: ["보우마스터","신궁","나이트로드","섀도어","소울마스터","플레임위자드","윈드브레이커","나이트워커","스트라이커"] },
  { levelMin: 58, levelMax: 72, map: "엘나스 콜드필드 / 아이시필드", region: "엘나스", monsters: ["화이트팽", "헥터"], tip: "시간당 40~70만의 최고 효율급(명중 92 필요). 리치 파티 없으면 인접 아이시필드 솔플.", source: "https://vortexgaming.io/en/postdetail/498457", jobs: ["히어로","팔라딘","다크나이트"] },
  { levelMin: 65, levelMax: 75, map: "차가운 요람 (미니던전)", region: "슬리피우드 (드레이크 권역)", monsters: ["다크드레이크"], tip: "엘리니아→택시→개미굴광장→차가운 요람 경로. 다크드레이크(Lv68) 단일 출현. 접근성은 낮지만 드레이크만 나와 인기. 개인화 2시간.", source: "https://vortexgaming.io/postdetail/843653", common: true, miniDungeon: true },
  { levelMin: 68, levelMax: 78, map: "빨간코 해적단 소굴2 (미니던전)", region: "무릉도원 백초마을", monsters: ["캡틴"], tip: "백초마을→오래된 습지→소굴2 경로. 캡틴(Lv70) 출현. 개인 던전 2시간, 솔플·파티 모두 가능.", source: "https://vortexgaming.io/postdetail/843653", common: true, miniDungeon: true },

  // ── 70~100 ──
  { levelMin: 71, levelMax: 85, map: "로미오와 줄리엣 파티퀘스트", region: "마가티아", monsters: ["(파티퀘스트)"], tip: "이 구간 압도적 추천. 숙련 시 12~15분 컷, 1탐 120~150만. 직업 무관 효율 최강. 버닝 1.5배와 시너지.", source: "https://arca.live/b/mapleland/146592374", common: true },
  { levelMin: 75, levelMax: 85, map: "야시장 사잇길", region: "대만 (야시장)", monsters: ["예티 인형 자판기", "버블티"], tip: "불독 77~80 사잇길 파티 인기. 자판기 몹이 밀집돼 광역에 유리.", source: "https://yulbin.com/메이플랜드-야시장-사잇길/", jobs: ["불독"] },
  { levelMin: 80, levelMax: 85, map: "하늘 둥지 입구 (하둥)", region: "미나르 숲 / 리프레", monsters: ["하프", "블러드하프"], tip: "익스플로전(불독)·체인라이트닝(썬콜) 필요 → 75~77 정법 전환 권장. 경험치 120만+. 비숍 1확은 합마 920 요구.", source: "https://namu.wiki/w/Mapleland/직업/비숍", jobs: ["썬콜","불독","비숍"] },
  { levelMin: 85, levelMax: 100, map: "잊혀진 시간의 길 3 (데스테니)", region: "루디브리엄 시계탑 최하층", monsters: ["데스테니", "마스터 데스테니"], tip: "최하층 오른쪽 포탈 2번→잊시길3. 데스테니(85렙) 망토 민첩 60%·피닉스 완드 드롭. 성/불 약점. 도적 파밍·솔플.", source: "https://halfclock.com/entry/메이플랜드루디브리엄-데스테니", jobs: ["나이트로드","섀도어","히어로","팔라딘","다크나이트"] },
  { levelMin: 80, levelMax: 100, map: "죽은나무숲 / 906 / 월죽 / 차벌 (솔플 순환)", region: "리프레 / 엘나스 / 오르비스", monsters: ["루나픽시", "와일드카고", "드레이크"], tip: "솔플 전사들이 5렙 단위로 옮겨다니는 구간. 인기 자리(906·죽숲)는 자리싸움 심해 피해다니기도. 906은 메소, 차벌은 경험치.", source: "https://arca.live/b/mapleland/134045062", jobs: ["히어로","팔라딘","다크나이트"] },
  { levelMin: 80, levelMax: 100, map: "듀얼 파이렛 파티 (듀파)", region: "루디브리엄 시계탑 최하층", monsters: ["듀얼 파이렛", "듀얼 버크"], tip: "파티에 끼면 80~100 레벨업이 획기적으로 빠르다. 85~98 마법사 범위 파밍 성지(뇌전수리검 드롭). 섀도어는 메소익스플로전 사냥터(5번 자리 적자 덜함).", source: "https://arca.live/b/mapleland/146599129", jobs: ["히어로","팔라딘","다크나이트","썬콜","불독","비숍","섀도어","나이트로드"] },
  { levelMin: 83, levelMax: 100, map: "켄타우로스의 원탁 (미니던전)", region: "미나르 숲 (리프레)", monsters: ["붉은켄타우로스", "푸른켄타우로스", "검은켄타우로스"], tip: "★80~100 최고 인기 미니던전. 켄타우로스 3종(전부 Lv88) 총출현 + 3층 구조라 젠이 풍부해 시간당 300~650만급. 개인 던전이라 자리싸움 없음.", source: "https://maplelandzzul.gg/game-maps/켄타우로스의-원탁", common: true, miniDungeon: true },
  { levelMin: 83, levelMax: 100, map: "붉은 켄타우로스의 영역", region: "미나르 숲", monsters: ["붉은 켄타우로스"], tip: "85~100 인기. 광역몹 밀집맵이라 원거리·관통에 적합. 붉켄은 얼음 약점이라 썬콜 효율 최고.", source: "https://vortexgaming.io/postdetail/521809", jobs: ["보우마스터","신궁","썬콜"] },
  { levelMin: 85, levelMax: 110, map: "불과 어둠의 전장 (붉켄/검켄)", region: "미나르 숲", monsters: ["붉은 켄타우로스", "검은 켄타우로스"], tip: "좌측 3층 붉켄(얼음 약점)=썬콜, 우측 3층 검켄=불독. 경험치 압도적이나 적자라 득템 의존.", source: "https://arca.live/b/mapleland/166715712", jobs: ["썬콜","불독"] },
  { levelMin: 89, levelMax: 100, map: "용의 숲 입구 (90제 파밍)", region: "미나르 숲 (리프레)", monsters: ["블루 드래곤터틀"], tip: "블루 드래곤터틀(Lv90)이 90제·100제 장비를 드롭. 표창/단검 도적이 파밍 겸 사냥.", source: "https://namu.wiki/w/Mapleland/직업/섀도어", jobs: ["나이트로드","섀도어"] },
  { levelMin: 60, levelMax: 120, map: "깊은 바다 협곡 2 (망둥 555)", region: "아쿠아로드", monsters: ["망둥이", "폭렬 망둥이집"], tip: "시간당 150~250만의 최상위 효율존. 좁은 발판·다수 젠이라 광역/원거리에 특히 유리.", source: "https://maplelandzzul.gg", jobs: ["플레임위자드","윈드브레이커","나이트워커"] },

  // ── 100~120+ ──
  { levelMin: 92, levelMax: 120, map: "오징어배 (위험한 바다 협곡 2)", region: "아쿠아로드 해저", monsters: ["스퀴드", "리셀스퀴드"], tip: "원거리·도적 핵심. 몹이 흩어져 단일기로 한 마리씩 컷(광역 금지). 2층 1자컷이 표창도적 최적, 5층은 나로 스공 2400+ 요구. 파티 전원 메소업이라 샾비 내고도 흑자, 듀파보다 효율 우위.", source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=2377322", jobs: ["보우마스터","신궁","나이트로드","섀도어","캡틴"] },
  { levelMin: 103, levelMax: 120, map: "미나르 숲 와이번 지역 (협곡)", region: "미나르 숲", monsters: ["다크 와이번"], tip: "100+ 도적 솔플/소수팟. 흑자는 미미해 장공 파밍 목적에 가깝다. 물약 여유 있으면 붉켄으로 넘어가는 게 경험치 효율상 유리.", source: "https://arca.live/b/mapleland/146640057", jobs: ["나이트로드","섀도어"] },
  { levelMin: 98, levelMax: 120, map: "협곡의 동쪽길 / 죽은 용의 둥지 (미스트)", region: "미나르 숲", monsters: ["다크 와이번", "스켈레곤"], tip: "불독 포이즌 미스트 솔플 핵심. 죽둥은 미스트 사냥터 중 피로도 최저라 컨트롤 잘하면 적자 회피.", source: "https://vortexgaming.io/en/postdetail/632210", jobs: ["불독"] },
  { levelMin: 96, levelMax: 130, map: "블루 와이번의 둥지 (심알바)", region: "미나르 숲", monsters: ["블루 와이번"], tip: "전사 성지 → 비숍은 5인팟 심알바(홀리심볼). 피로도 높지만 심알바 중 수익률 최고.", source: "https://arca.live/b/mapleland/135613323", jobs: ["비숍"] },
  { levelMin: 100, levelMax: 200, map: "뉴트 보호구역 (미니던전)", region: "미나르 숲 (용의 숲)", monsters: ["뉴트주니어", "네스트골렘"], tip: "용수3→망가진 용의 둥지 포탈로 진입. 지형상 궁수·도적의 알까기(원거리 안전사냥)에 최적. 100~200 장기 사냥지, 자리싸움 없음.", source: "https://vortexgaming.io/postdetail/843653", jobs: ["보우마스터","신궁","나이트로드","섀도어"], miniDungeon: true },
  { levelMin: 97, levelMax: 120, map: "용의 숲 3 (브레스튼 파티)", region: "미나르 숲", monsters: ["브레스튼"], tip: "브레스튼(Lv97)은 경험치 압도적이나 솔로는 버거워 3~4인 파티 권장. 전사는 탱 역할.", source: "https://vortexgaming.io/en/postdetail/601072", jobs: ["히어로","팔라딘","다크나이트"] },
  { levelMin: 100, levelMax: 160, map: "레드 와이번의 둥지 (얼음 약점)", region: "미나르 숲", monsters: ["레드 와이번", "다크 코니언"], tip: "레드 와이번 화속성(얼음 약점) → 썬콜 전용. 2~3층 아이스 스트라이크 낚시. 사실상 얼음 약점 마지막 사냥터.", source: "https://arca.live/b/mapleland/123213579", jobs: ["썬콜"] },
  { levelMin: 100, levelMax: 120, map: "불의 전당 3층 5인", region: "엘나스", monsters: ["파이어 스티드", "다크 와이번"], tip: "100~108 불의 전당 5인 3층 파티. 시그너스 만렙(120)까지 이어지는 고렙 공통 루트.", source: "https://vortexgaming.io/postdetail/568189", common: true },
  { levelMin: 108, levelMax: 140, map: "큰 미로의 동굴 (큰미굴)", region: "미궁의 길", monsters: ["다크 예티", "페페"], tip: "경험치+피로도 꿀통. HP 2950+면 큰깹(깊은 동굴) 가능. 다층 미로맵. 가로로 긴 평지라 캡틴 래피드파이어에도 유리.", source: "https://vortexgaming.io/postdetail/521809", jobs: ["보우마스터","신궁","캡틴"] },
  { levelMin: 108, levelMax: 200, map: "큰 둥지 봉우리 (큰둥)", region: "미나르 숲", monsters: ["네스트골렘", "스켈로스"], tip: "원거리 솔플 사실상 최종 사냥터. 샤프아이즈30·화이트니스록 드롭으로 경험치+수익. 비숍은 격수에게 심만 주는 심알바 편함.", source: "https://arca.live/b/mapleland/141320136", jobs: ["보우마스터","신궁","썬콜","비숍"] },
  { levelMin: 110, levelMax: 120, map: "부활하는 기억 (남둥, 미니던전)", region: "미나르 숲 (남겨진 용의 둥지)", monsters: ["스켈레곤", "스켈로스"], tip: "★110~120 핵심 미니던전('남둥'). 몬스터 젠 수가 매우 많아 경험치 효율 최상. 개인화 2시간이라 자리싸움 없음.", source: "https://vortexgaming.io/postdetail/843653", common: true, miniDungeon: true },
  { levelMin: 100, levelMax: 140, map: "용기사 피뻥 솔플 (드래곤 로어)", region: "리프레 / 엘나스 / 오르비스", monsters: ["루나픽시", "와일드카고", "드레이크"], tip: "다크나이트는 3차 드래곤 로어(희귀 광역기)+피뻥으로 솔플 메소·경험치를 동시에. 100+ 솔플 전사 중 가장 자립적.", source: "https://arca.live/b/mapleland/162558727", jobs: ["다크나이트"] },
  { levelMin: 71, levelMax: 120, map: "뉴트 보호구역 알까기", region: "미나르 숲 / 리프레", monsters: ["뉴트", "와이번 알"], tip: "나이트워커 사출기 특성상 사냥터를 안 가린다. 71~120 알까기로 장기 사냥.", source: "https://arca.live/b/mapleland/173906185", jobs: ["나이트워커"] },

  // ── 💰 메소 파밍 ──
  { levelMin: 71, levelMax: 90, map: "구름 공원 6 (906)", region: "오르비스", monsters: ["러스터픽시", "루나픽시"], tip: "대표 순메소 파밍지. 태양의 흔적 시간당 2300~2600개 환금, 71렙 봉황4작 기준 시간당 90~110만 메소 + 금/사파이어/장비. 몹이 촘촘해 원거리 직업이 포션 절약 유리.", source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=1716620", common: true, kind: "meso" },
  { levelMin: 50, levelMax: 65, map: "차디찬 벌판 (헥터 꼬리)", region: "엘나스", monsters: ["헥터", "화이트팽"], tip: "헥터 꼬리(60% 드롭)를 찰리중사와 교환→전신갑옷 민첩 10% 등. 헥터는 망토 민첩 60%도 드롭. 꼬리 포함 시간당 약 110만 메소.", source: "https://gall.dcinside.com/mgallery/board/view/?id=mapleland&no=738358", common: true, kind: "meso" },
  { levelMin: 54, levelMax: 70, map: "마가티아 C-2 (네오휴로이드)", region: "마가티아", monsters: ["네오휴로이드", "로이드"], tip: "네오휴로이드 장갑 공격력 60%, 로이드 귀고리 행운주문서 드롭. 자리 구하기 쉽고 시간당 약 100만 메소. 쌀먹 인기.", source: "https://vortexgaming.io/en/postdetail/625336", common: true, kind: "meso" },
  { levelMin: 37, levelMax: 50, map: "원숭이의 숲 1 (루팡)", region: "엘리니아", monsters: ["루팡", "좀비루팡"], tip: "루팡 메소 110 + 바나나 65% 드롭. 저~중반 무자본 자본벌이의 정석.", source: "https://jsmu.xyz/mapleland-where-is-monky-forest/", common: true, kind: "meso" },
  { levelMin: 50, levelMax: 120, map: "마스터 몬스터 필드 (전 지역)", region: "전 대륙", monsters: ["파우스트", "구미호", "레비아탄"], tip: "2026-03 추가된 필드보스 16종, 리젠 시간 존재. 레비아탄(리프레, Lv120) 드롭이 특히 고가치. 레벨대별 분포.", source: "https://yulbin.com/메이플랜드-마스터-몬스터-드랍-및-위치-정리/", common: true, kind: "meso" },

  // ── 👹 보스 입문 (버닝 도전 가능) ──
  { levelMin: 28, levelMax: 50, map: "킹슬라임", region: "숨겨진 숲 (빅토리아)", monsters: ["킹슬라임"], tip: "초저렙 입문용 약체 필드보스(약 28렙). 가장 먼저 도전 가능.", source: "https://mapledb.kr", common: true, kind: "boss" },
  { levelMin: 40, levelMax: 60, map: "머쉬맘", region: "머쉬맘의 오솔길 (헤네시스 인근)", monsters: ["머쉬맘"], tip: "대표 보스 입문몹. 잡기 쉽고 경험치 좋음, 맵 작고 원젠컷 용이.", source: "https://maple.inven.co.kr/dataninfo/monster/detail.php?code=6130101", common: true, kind: "boss" },
  { levelMin: 60, levelMax: 80, map: "주니어 발록", region: "슬리피우드 저주받은 신전", monsters: ["주니어 발록"], tip: "보스 80렙. 강한 마법공격으로 머쉬맘보다 난이도 높음. 중급 입문/도전용.", source: "https://maple.inven.co.kr/dataninfo/monster/detail.php?code=8130100", common: true, kind: "boss" },
  { levelMin: 50, levelMax: 70, map: "자쿰 (하단 자투 · 눕클)", region: "엘나스 자쿰의 제단", monsters: ["자쿰"], tip: "입문 핵심 콘텐츠. 선행퀘 3단계 후 50렙 입장. 초보는 50~60 눕클(하단 자투만 받는 원정대) 권장. 24시간 2회.", source: "https://yulbin.com/메이플랜드-자쿰-선행퀘스트-빠른-공략/", common: true, kind: "boss" },
  { levelMin: 90, levelMax: 120, map: "피아누스", region: "아쿠아로드 심해", monsters: ["피아누스"], tip: "90렙+ 도전, 무자본 메소벌이로 유명. 2025 패치로 입장퀘 추가(클리어 시 7일 1회).", source: "https://gameweekee.com", common: true, kind: "boss" },
  { levelMin: 100, levelMax: 130, map: "크림슨 발록", region: "발록의 배 (오르비스↔엘리니아)", monsters: ["크림슨 발록"], tip: "보스 100렙. 입문보다 중상급 도전 단계, 강한 마공 보유.", source: "https://maple.inven.co.kr/dataninfo/monster/detail.php?code=8150000", common: true, kind: "boss" },
];

// ─── 직업별 특성 메모 ───
const JOB_NOTES: Record<string, string> = {
  "히어로": "브랜디쉬 다수 타격으로 같은 자리에서 사냥 효율이 전사 3직업 중 최상. 공용 자리(차벌·골렘숲·906)에서 체감 효율이 높다.",
  "팔라딘": "디바인 스티그마·생츄어리·묠니르 등 광역 보조기로 몹 밀집맵(골렘숲·차벌·듀파)에서 다수 처리에 강하다. 단일 극딜은 히어로에 밀림.",
  "다크나이트": "3차 드래곤 로어(광역) + 피뻥으로 100+ 솔플 자립도가 전사 중 최고. 죽숲·차벌·906 광역 솔플에 우위.",
  "썬콜": "썬더볼트/체인라이트닝 젠컷 + 얼음 약점 몹(붉켄·레드와이번) 전용 딜러. CD사냥·시길 솔플 효율이 좋다.",
  "불독": "파이어/포이즌 광역 + 불 약점 몹(화이트팽·삼미호) 특화. 미스트 솔플(죽둥·협동)로 고렙 자립.",
  "비숍": "홀리심볼 심쩔/심알바로 안 잡아도 경험치를 받는 구조가 핵심. 파티 유틸(헤이스트·헐)로 어디서나 환영.",
  "보우마스터": "원거리 단일/연사. 죽숲·붉켄·오징어배·뉴트 보호구역·큰둥 등 밀집·관통 맵에서 안정적.",
  "신궁": "관통·강력한 단일딜. 사이길·큰미굴·오징어배·뉴트 보호구역 등 효율 루트가 잘 정립.",
  "나이트로드": "표창 원거리. 오징어배 2층 1자컷·동바산6·시길4 앵벌이. 90~ 사헬 90제 파밍 겸용.",
  "섀도어": "단검 근접 + 메소익스플로전(메익). 듀파 5번 자리·죽숲·90제 파밍. 메익 사냥터 위주.",
  "소울마스터": "시그너스 전사. 근접 광역으로 골렘숲·연구소·시길·죽숲 등 평지·밀집맵 유리. 시그너스 전용 사냥터는 없고 모험가와 공유.",
  "플레임위자드": "시그너스 마법사. 광역 평지·다수 젠(시길·골숲·망둥·구름공원 화독)에서 강함.",
  "윈드브레이커": "시그너스 궁수. 원거리(차가운 벌판·망둥). 좁은 발판/넉백 맵(불어전 등)에서는 불리할 수 있다.",
  "나이트워커": "시그너스 도적. 표창+소환수(사출기)라 사냥터를 안 가림. 뉴트 알까기·연구소·망둥 등.",
  "스트라이커": "시그너스 해적. 근접 번개. 골렘숲·동바산6·추운벌판 등 근접 자리. 시그너스는 보통 120 고정대 운영.",
  "바이퍼": "모험가 해적(너클/인파이터 계열). 근접 광역(트랜스폼·에너지 버스터)이라 골렘숲·차벌·켄타우로스 원탁 등 밀집맵에서 전사처럼 다수 처리에 강하다. ※ 2.0 신규 직업이라 전용 정보가 적어 전사 계열에 준해 배치(추론 포함).",
  "캡틴": "모험가 해적(건/거너 계열). 원거리 + 소환수(옥토퍼스/호밍)라 오징어배·큰미굴·동바산6 등 평지·횡사거리 맵이 유리. 궁수·도적 루트에 준함. ※ 2.0 신규 직업이라 추론 포함.",
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

function SpotCard({ s, showJobs }: { s: Spot; showJobs: boolean }) {
  const url = firstUrl(s.source);
  return (
    <div className="pixel-card p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="pixel-badge font-pixel text-[10px] bg-[color-mix(in_srgb,var(--c-skill)_18%,transparent)] text-skill">
          Lv.{s.levelMin}~{s.levelMax}
        </span>
        {s.miniDungeon && (
          <span className="pixel-badge font-pixel text-[10px] bg-[color-mix(in_srgb,var(--c-mush)_18%,transparent)] text-mush">미니던전</span>
        )}
        <span className="font-bold text-ink">{s.map}</span>
      </div>
      <p className="text-xs text-dim mt-0.5">📍 {s.region}</p>
      {s.monsters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {s.monsters.map((m) => (
            <span key={m} className="pixel-badge text-[11px] bg-surface2 text-dim">{m}</span>
          ))}
        </div>
      )}
      <p className="text-sm text-ink mt-2 leading-relaxed">{s.tip}</p>
      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
        {showJobs && !s.common && s.jobs && (
          <div className="flex flex-wrap gap-1">
            {s.jobs.length >= ALL_JOBS.length - 2
              ? <span className="pixel-badge text-[10px] bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] text-maple">대부분 직업</span>
              : s.jobs.map((j) => (
                  <span key={j} className="pixel-badge text-[10px] bg-[color-mix(in_srgb,var(--c-maple)_12%,transparent)] text-maple">{j}</span>
                ))}
          </div>
        )}
        {showJobs && s.common && (
          <span className="pixel-badge text-[10px] bg-[color-mix(in_srgb,var(--c-slime)_16%,transparent)] text-slime">전 직업 공용</span>
        )}
        {url
          ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-dim hover:text-maple ml-auto">출처: {sourceHost(url)} →</a>
          : <span className="text-[11px] text-dim ml-auto">출처: {s.source}</span>}
      </div>
    </div>
  );
}

export default function LevelingPage() {
  const [job, setJob] = useState<string>("전체");
  const [miniOnly, setMiniOnly] = useState(false);

  const hunting = useMemo(() => {
    let list = SPOTS.filter((s) => !s.kind);
    if (job !== "전체") list = list.filter((s) => s.common || s.jobs?.includes(job));
    if (miniOnly) list = list.filter((s) => s.miniDungeon);
    return [...list].sort((a, b) => a.levelMin - b.levelMin || a.levelMax - b.levelMax);
  }, [job, miniOnly]);

  const meso = useMemo(() => SPOTS.filter((s) => s.kind === "meso").sort((a, b) => a.levelMin - b.levelMin), []);
  const boss = useMemo(() => SPOTS.filter((s) => s.kind === "boss").sort((a, b) => a.levelMin - b.levelMin), []);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* 헤더 */}
      <div>
        <h1 className="font-pixel text-xl text-ink flex items-center gap-2 flex-wrap">
          <span>🗺️</span> 직업별 육성 사냥터
          <span className="pixel-badge font-pixel text-[10px] bg-[color-mix(in_srgb,var(--c-mush)_18%,transparent)] text-mush">버닝 월드</span>
        </h1>
        <p className="text-sm text-dim mt-1">
          커뮤니티에서 모은 레벨 구간별 추천 사냥터. 직업을 고르면 그 직업이 가는 곳만 보여줍니다.
          버닝 월드는 경험치 1.5배라 맵은 같고 체류 시간만 짧아집니다.
        </p>
      </div>

      {/* 2.0 미니던전 안내 */}
      <div className="pixel-panel p-4 flex items-start gap-2">
        <span className="text-base shrink-0">🏰</span>
        <p className="text-sm text-dim">
          <span className="font-pixel text-mush text-[12px]">미니던전</span> · 2.0에서 인기 사냥터에 추가된 <span className="text-ink">개인 던전</span>입니다.
          자리싸움 없이 1회 입장당 약 2시간 사냥, 파티 동반 가능. 젠은 원작 기준.
          버닝 월드(6/19~9/11)는 Lv120 미만 경험치 1.5배 + 상시 버프이며, <span className="text-ink">카에데 성은 버닝 진입 불가</span>입니다.
        </p>
      </div>

      {/* 직업 선택 */}
      <div className="pixel-panel p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => setJob("전체")}
            className={`font-pixel text-[12px] px-3 py-1.5 ${job === "전체" ? "pixel-btn" : "bg-surface2 text-dim hover:text-maple border-2 border-edge"}`}
          >
            전체
          </button>
          <button
            onClick={() => setMiniOnly((v) => !v)}
            className={`font-pixel text-[12px] px-3 py-1.5 ${miniOnly ? "pixel-btn" : "bg-surface2 text-dim hover:text-mush border-2 border-edge"}`}
          >
            🏰 미니던전만
          </button>
        </div>
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
        const spots = hunting.filter((s) => s.levelMin >= band.min && s.levelMin <= band.max);
        if (spots.length === 0) return null;
        return (
          <div key={band.key}>
            <h2 className="font-pixel text-[13px] text-maple mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-maple" />{band.label}
            </h2>
            <div className="space-y-2">
              {spots.map((s, i) => <SpotCard key={`${band.key}-${i}`} s={s} showJobs={job === "전체"} />)}
            </div>
          </div>
        );
      })}
      {hunting.length === 0 && (
        <p className="text-center py-10 text-dim font-pixel text-sm">조건에 맞는 사냥터가 없습니다.</p>
      )}

      {/* 메소 파밍 */}
      {!miniOnly && (
        <div>
          <h2 className="font-pixel text-[13px] text-slime mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-slime" />💰 메소 파밍 (돈벌이)
          </h2>
          <div className="space-y-2">
            {meso.map((s, i) => <SpotCard key={`meso-${i}`} s={s} showJobs={false} />)}
          </div>
        </div>
      )}

      {/* 보스 입문 */}
      {!miniOnly && (
        <div>
          <h2 className="font-pixel text-[13px] text-mush mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-mush" />👹 보스 입문 (버닝 도전 가능)
          </h2>
          <div className="space-y-2">
            {boss.map((s, i) => <SpotCard key={`boss-${i}`} s={s} showJobs={false} />)}
          </div>
        </div>
      )}

      {/* 면책 */}
      <p className="text-[11px] text-dim leading-relaxed pixel-panel p-3">
        ※ 커뮤니티(arca.live·dcinside·inven·나무위키·블로그) 글을 수집·정리한 자료로, 젠률·효율은 패치와 자리 경쟁에 따라 달라질 수 있습니다.
        미니던전 입장 횟수/쿨타임 등 세부 규칙과 시그너스 5종 일부 정보는 2.0 신규라 추론이 섞여 있습니다.
        메소·시간당 경험치 수치는 세팅·시세에 따라 달라지는 참고값입니다.
      </p>
    </div>
  );
}
