"use client";

import { useState, useMemo } from "react";

// ─── 직업 타입 ───
type Job = "all" | "warrior" | "mage" | "archer" | "thief" | "pirate";

const JOB_LABELS: Record<Job, string> = {
  all: "전체",
  warrior: "전사",
  mage: "마법사",
  archer: "궁수",
  thief: "도적",
  pirate: "해적",
};

// 한글 직업명 → Job 키 매핑
const JOB_KR_TO_KEY: Record<string, Job> = {
  "전체": "all",
  "전사": "warrior",
  "마법사": "mage",
  "궁수": "archer",
  "도적": "thief",
  "해적": "pirate",
};

// ─── 사냥터 데이터 ───
interface Monster {
  name: string;
  nameEn?: string;
  level: number;
  hp: number;
  exp: number;
}

interface HuntingSpot {
  id: string;
  levelMin: number;
  levelMax: number;
  mapName: string;
  mapNameEn?: string;
  region: string;
  monsters: Monster[];
  expPerHour: number;
  jobs: string[];
  tips: string;
  source: string;
}

const HUNTING_SPOTS: HuntingSpot[] = [
  {
    id: "maple-island",
    levelMin: 1,
    levelMax: 8,
    mapName: "메이플 아일랜드 (달팽이 사냥터)",
    mapNameEn: "Maple Island Snail Hunting Ground",
    region: "메이플 아일랜드",
    monsters: [
      { name: "달팽이", nameEn: "Snail", level: 1, hp: 8, exp: 3 },
      { name: "파란달팽이", nameEn: "Blue Snail", level: 2, hp: 15, exp: 4 },
      { name: "버섯", nameEn: "Shroom", level: 2, hp: 20, exp: 5 },
      { name: "빨간달팽이", nameEn: "Red Snail", level: 4, hp: 40, exp: 8 },
      { name: "그루터기", nameEn: "Stump", level: 4, hp: 40, exp: 8 },
    ],
    expPerHour: 2000,
    jobs: ["전체"],
    tips: "메이플 아일랜드 퀘스트를 전부 완료하면서 자연스럽게 레벨업. 빅토리아 아일랜드로 넘어가기 전에 퀘스트 보상으로 기본 장비와 포션을 챙기자.",
    source: "게임 기본 가이드 + DB 데이터",
  },
  {
    id: "henesys-hunting-1",
    levelMin: 8,
    levelMax: 15,
    mapName: "헤네시스 사냥터",
    mapNameEn: "Henesys Hunting Ground",
    region: "빅토리아 아일랜드",
    monsters: [
      { name: "주황버섯", nameEn: "Orange Mushroom", level: 8, hp: 80, exp: 15 },
      { name: "초록버섯", nameEn: "Green Mushroom", level: 15, hp: 250, exp: 26 },
      { name: "리본돼지", nameEn: "Ribbon Pig", level: 10, hp: 120, exp: 20 },
    ],
    expPerHour: 8000,
    jobs: ["전체"],
    tips: "1차 전직 전후 가장 무난한 사냥터. 포션 소비 적고 몬스터 밀집도 높음. 파티 사냥 시 더 효율적.",
    source: "커뮤니티 종합 + DB 데이터 (mobs table)",
  },
  {
    id: "ellinia-forest",
    levelMin: 10,
    levelMax: 18,
    mapName: "엘리니아 숲길",
    mapNameEn: "Ellinia Forest Path",
    region: "빅토리아 아일랜드",
    monsters: [
      { name: "슬라임", nameEn: "Slime", level: 6, hp: 50, exp: 10 },
      { name: "초록버섯", nameEn: "Green Mushroom", level: 15, hp: 250, exp: 26 },
      { name: "버블링", nameEn: "Bubbling", level: 15, hp: 240, exp: 26 },
    ],
    expPerHour: 7500,
    jobs: ["마법사"],
    tips: "마법사 전직 퀘스트 병행 가능. 엘리니아 마을에서 마법사 전직 후 인근 사냥터에서 바로 레벨업.",
    source: "커뮤니티 종합 + DB 데이터",
  },
  {
    id: "kerning-subway-stirge",
    levelMin: 10,
    levelMax: 20,
    mapName: "커닝시티 지하철 1구역",
    mapNameEn: "Line 1 <Area 1>",
    region: "빅토리아 아일랜드",
    monsters: [
      { name: "스티지", nameEn: "Stirge", level: 6, hp: 60, exp: 22 },
      { name: "도깨비불", nameEn: "Goblin Fire", level: 11, hp: 155, exp: 22 },
    ],
    expPerHour: 9000,
    jobs: ["전체"],
    tips: "스티지는 낮은 레벨 대비 경험치가 좋아서 효율 사냥터로 인기. 지하철 맵 구조가 평탄하여 모든 직업이 사냥하기 편함. MapleRoyals/커뮤니티에서도 15~21 구간 추천 1순위.",
    source: "MapleRoyals Training Guide + 커뮤니티",
  },
  {
    id: "perion-wild-boar",
    levelMin: 15,
    levelMax: 25,
    mapName: "와일드보어의 땅",
    mapNameEn: "Land of Wild Boar",
    region: "빅토리아 아일랜드",
    monsters: [
      { name: "뿔버섯", nameEn: "Horny Mushroom", level: 22, hp: 300, exp: 35 },
      { name: "와일드보어", nameEn: "Wild Boar", level: 25, hp: 550, exp: 42 },
    ],
    expPerHour: 12000,
    jobs: ["전사", "전체"],
    tips: "페리온 주변 전사 전직 퀘스트와 병행 가능. 넓은 맵에서 돌아다니며 사냥. 커닝PQ 대기 시간에 솔플 사냥 추천.",
    source: "커뮤니티 종합",
  },
  {
    id: "kerning-pq",
    levelMin: 21,
    levelMax: 30,
    mapName: "커닝시티 파티퀘스트",
    mapNameEn: "Kerning City Party Quest",
    region: "빅토리아 아일랜드",
    monsters: [],
    expPerHour: 25000,
    jobs: ["전체"],
    tips: "21~30 구간 최고 효율 파티퀘스트. 4인 파티 필수. 1회 클리어 시 경험치가 매우 높아 이 구간에서는 무조건 커닝PQ가 정답. 대기 시간에 개미굴이나 와일드보어 사냥 병행.",
    source: "나무위키 메이플랜드/파티퀘스트 + 커뮤니티 공통 합의",
  },
  {
    id: "ant-tunnel",
    levelMin: 20,
    levelMax: 30,
    mapName: "개미굴 (슬리피우드)",
    mapNameEn: "Ant Tunnel (Sleepywood)",
    region: "빅토리아 아일랜드",
    monsters: [
      { name: "좀비버섯", nameEn: "Zombie Mushroom", level: 24, hp: 500, exp: 42 },
      { name: "이블아이", nameEn: "Evil Eye", level: 27, hp: 720, exp: 50 },
    ],
    expPerHour: 15000,
    jobs: ["전체"],
    tips: "커닝PQ 대기 중 솔플 사냥터로 추천. 좀비버섯은 언데드라 클레릭 힐 공격 가능. 이블아이 드랍 아이템도 쓸만함.",
    source: "커뮤니티 종합 + DB 데이터",
  },
  {
    id: "ariant-desert",
    levelMin: 22,
    levelMax: 35,
    mapName: "아리안트 사막",
    mapNameEn: "Ariant Desert",
    region: "아리안트",
    monsters: [
      { name: "모래 두더지", nameEn: "Sand Rat", level: 24, hp: 600, exp: 55 },
      { name: "스콜피언", nameEn: "Scorpion", level: 29, hp: 780, exp: 58 },
    ],
    expPerHour: 18000,
    jobs: ["전체"],
    tips: "모래 두더지가 동레벨 대비 경험치가 높아 인기. 아리안트 히든 퀘스트(다크엑스텀프)도 병행 가능. 불독 마법사 가이드에서 18~29 구간 추천.",
    source: "vortexgaming.io 불독 가이드 + DB 데이터",
  },
  {
    id: "florina-beach",
    levelMin: 30,
    levelMax: 40,
    mapName: "플로리나 비치",
    mapNameEn: "Florina Beach",
    region: "빅토리아 아일랜드",
    monsters: [
      { name: "파이어보어", nameEn: "Fire Boar", level: 32, hp: 1000, exp: 60 },
      { name: "커즈아이", nameEn: "Curse Eye", level: 35, hp: 1250, exp: 70 },
    ],
    expPerHour: 20000,
    jobs: ["전체"],
    tips: "커닝PQ 졸업 후 솔플 사냥터. 몬스터 밀집도 높고 맵 구조가 단순해서 효율적.",
    source: "커뮤니티 종합",
  },
  {
    id: "ludi-pq",
    levelMin: 35,
    levelMax: 50,
    mapName: "루디브리엄 파티퀘스트 (미로PQ)",
    mapNameEn: "Ludibrium Party Quest",
    region: "루디브리엄",
    monsters: [],
    expPerHour: 35000,
    jobs: ["전체"],
    tips: "35~50 구간 최고 효율 파티퀘스트. 6인 파티 필수. 알리샤르 보스까지 잡아야 보상 최대. 레벨 제한 35~50. 이 구간에서는 루디PQ가 압도적 효율.",
    source: "나무위키 메이플랜드/파티퀘스트 + 커뮤니티",
  },
  {
    id: "ludi-chronos",
    levelMin: 35,
    levelMax: 50,
    mapName: "루디브리엄 시계탑 (크로노스)",
    mapNameEn: "Ludibrium Clock Tower",
    region: "루디브리엄",
    monsters: [
      { name: "크로노스", nameEn: "Chronos", level: 37, hp: 1750, exp: 82 },
      { name: "장난감 목마", nameEn: "Toy Trojan", level: 39, hp: 1920, exp: 92 },
      { name: "플래툰 크로노스", nameEn: "Platoon Chronos", level: 41, hp: 2050, exp: 99 },
      { name: "마스터 크로노스", nameEn: "Master Chronos", level: 46, hp: 2600, exp: 115 },
    ],
    expPerHour: 28000,
    jobs: ["전체"],
    tips: "루디PQ 대기 시간에 사냥. 층별로 몬스터 레벨이 다르니 자기 레벨에 맞는 층에서 사냥. MapleRoyals에서도 35~51 구간 대안 사냥터 1순위.",
    source: "MapleRoyals Training Guide + DB 데이터",
  },
  {
    id: "magatia-iron-mutae",
    levelMin: 37,
    levelMax: 50,
    mapName: "마가티아 연구소",
    mapNameEn: "Magatia Lab",
    region: "마가티아",
    monsters: [
      { name: "아이언 뮤테", nameEn: "Iron Mutae", level: 42, hp: 2400, exp: 102 },
      { name: "강화형 아이언 뮤테", nameEn: "Reinforced Iron Mutae", level: 45, hp: 2550, exp: 110 },
    ],
    expPerHour: 30000,
    jobs: ["전체"],
    tips: "마가티아 B-3에서 막민 주문서 획득 가능. 불독 마법사 가이드에서 37~45 구간 추천. 마가티아 C-1 솔플로 1탐당 경험치 30만 이상(전사 기준 51~58).",
    source: "vortexgaming.io 불독 가이드 + arca.live 전사 가이드",
  },
  {
    id: "omega-block-golem",
    levelMin: 40,
    levelMax: 50,
    mapName: "지구방위본부 (블록골렘)",
    mapNameEn: "Omega Sector (Block Golem)",
    region: "루디브리엄",
    monsters: [
      { name: "블록골렘", nameEn: "Block Golem", level: 42, hp: 2400, exp: 102 },
      { name: "킹 블록골렘", nameEn: "King Block Golem", level: 45, hp: 2600, exp: 110 },
    ],
    expPerHour: 27000,
    jobs: ["전체"],
    tips: "루디PQ가 안 잡힐 때 대안 사냥터. 블록골렘은 밀집도가 좋은 편. 40렙부터 전직업 가능한 사냥터로 5분당 1.3~1.6%.",
    source: "DC갤러리 메이플랜드 마갤 + DB 데이터",
  },
  {
    id: "orbis-pq",
    levelMin: 51,
    levelMax: 70,
    mapName: "오르비스 파티퀘스트",
    mapNameEn: "Orbis Party Quest",
    region: "오르비스",
    monsters: [],
    expPerHour: 50000,
    jobs: ["전체"],
    tips: "51~70 구간 최고 효율 파티퀘스트. 경파(경험치 파티)는 구름모으기 + LP판 찾기까지만 반복하면 2~4분에 약 13,500~15,500 경험치. 완파보다 경파가 시간 효율 더 높음.",
    source: "나무위키 메이플랜드/파티퀘스트 + arca.live 오르비스PQ 공략",
  },
  {
    id: "orbis-pixie",
    levelMin: 50,
    levelMax: 60,
    mapName: "오르비스 정원 (픽시 사냥터)",
    mapNameEn: "Orbis Garden (Pixie)",
    region: "오르비스",
    monsters: [
      { name: "러스터픽시", nameEn: "Luster Pixie", level: 52, hp: 4000, exp: 155 },
      { name: "셀리온", nameEn: "Cellion", level: 53, hp: 4200, exp: 160 },
      { name: "라이오너", nameEn: "Lioner", level: 53, hp: 4200, exp: 160 },
      { name: "그루핀", nameEn: "Grupin", level: 53, hp: 4200, exp: 160 },
    ],
    expPerHour: 40000,
    jobs: ["마법사", "궁수"],
    tips: "마법사 범위 공격으로 효율 극대화. 러스터픽시가 법사 전용 장비(노란색 우산 등)와 주문서를 드랍. 50레벨대 궁수도 루나픽시 사냥터 추천.",
    source: "커뮤니티 종합 + DB 데이터",
  },
  {
    id: "elnath-coolie",
    levelMin: 50,
    levelMax: 65,
    mapName: "엘나스 쿨리좀비 사냥터 (죽은나무의 숲)",
    mapNameEn: "El Nath Dead Tree Forest (Coolie Zombie)",
    region: "엘나스",
    monsters: [
      { name: "쿨리 좀비", nameEn: "Coolie Zombie", level: 57, hp: 4500, exp: 190 },
      { name: "헥터", nameEn: "Hector", level: 55, hp: 4600, exp: 170 },
      { name: "화이트팽", nameEn: "White Fang", level: 58, hp: 5800, exp: 220 },
    ],
    expPerHour: 45000,
    jobs: ["전체"],
    tips: "클레릭/프리스트 힐 사냥 성지 (언데드 몬스터). 밀집도 높은 맵에서 범위기 효율 극대화. 25년 2월 21일 패치로 젠률 너프되어 솔플 전용으로 변경됨. 이전에는 50~80 구간 최고 효율이었음.",
    source: "나무위키 메이플랜드/사냥터 + 커뮤니티",
  },
  {
    id: "drake-cave",
    levelMin: 45,
    levelMax: 60,
    mapName: "페리온 드레이크 동굴",
    mapNameEn: "Perion Drake Cave",
    region: "빅토리아 아일랜드",
    monsters: [
      { name: "카파 드레이크", nameEn: "Copper Drake", level: 45, hp: 2700, exp: 105 },
      { name: "드레이크", nameEn: "Drake", level: 50, hp: 3200, exp: 135 },
      { name: "레드 드레이크", nameEn: "Red Drake", level: 60, hp: 6000, exp: 220 },
    ],
    expPerHour: 35000,
    jobs: ["전사"],
    tips: "차가운 요람에서 드레이크 사냥 추천. 드레이크 드랍템이 좋은 편. 전사 계열 근접 사냥에 적합한 맵 구조.",
    source: "커뮤니티 종합 + DB 데이터",
  },
  {
    id: "magatia-mid",
    levelMin: 55,
    levelMax: 75,
    mapName: "마가티아 연구소 (호문/호문쿨루)",
    mapNameEn: "Magatia Lab (Homun/Homunculus)",
    region: "마가티아",
    monsters: [
      { name: "호문", nameEn: "Homun", level: 65, hp: 11000, exp: 255 },
      { name: "D. 로이", nameEn: "D. Roy", level: 75, hp: 16000, exp: 350 },
      { name: "호문쿨루", nameEn: "Homunculus", level: 73, hp: 15500, exp: 320 },
      { name: "로이드", nameEn: "Roid", level: 78, hp: 29000, exp: 295 },
      { name: "네오 휴로이드", nameEn: "Neo Huroid", level: 80, hp: 35000, exp: 390 },
    ],
    expPerHour: 55000,
    jobs: ["전체"],
    tips: "마가티아 연구소 202에서 호문클로 주문서 파밍. 마가티아 C-2에서 귀행/장공 획득. 불독 68~80 구간 추천 사냥터. 속성 저항이 낮아 마법 데미지 극대화 가능.",
    source: "vortexgaming.io 불독 가이드 + 커뮤니티",
  },
  {
    id: "elnath-yeti",
    levelMin: 60,
    levelMax: 75,
    mapName: "엘나스 예티/다크예티 사냥터",
    mapNameEn: "El Nath Yeti Hunting Ground",
    region: "엘나스",
    monsters: [
      { name: "페페", nameEn: "Pepe", level: 60, hp: 7200, exp: 220 },
      { name: "다크 페페", nameEn: "Dark Pepe", level: 64, hp: 7800, exp: 250 },
      { name: "예티", nameEn: "Yeti", level: 65, hp: 11000, exp: 255 },
      { name: "다크 예티", nameEn: "Dark Yeti", level: 68, hp: 13000, exp: 265 },
    ],
    expPerHour: 50000,
    jobs: ["전체"],
    tips: "엘나스 얼어붙은 계곡에서 안정적 파밍. 느린 몬스터와 빽빽한 배치로 파밍 효율 좋음.",
    source: "커뮤니티 종합 + DB 데이터",
  },
  {
    id: "mulung-boss",
    levelMin: 65,
    levelMax: 85,
    mapName: "무릉 구미호/태룡",
    mapNameEn: "Mu Lung Nine-Tailed Fox / Tae Roon",
    region: "무릉",
    monsters: [
      { name: "구미호", nameEn: "Nine-Tailed Fox", level: 70, hp: 89000, exp: 1300 },
      { name: "태룡", nameEn: "Tae Roon", level: 71, hp: 93000, exp: 1580 },
    ],
    expPerHour: 70000,
    jobs: ["전체"],
    tips: "무릉 보스급 몬스터. HP가 높지만 경험치도 높아 스펙이 되면 효율적. 무릉 접근 퀘스트 필요.",
    source: "DB 데이터",
  },
  {
    id: "herb-town-captain",
    levelMin: 65,
    levelMax: 80,
    mapName: "허브타운 캡틴/크루 사냥터",
    mapNameEn: "Herb Town Captain/Kru",
    region: "허브타운",
    monsters: [
      { name: "크루", nameEn: "Kru", level: 68, hp: 12500, exp: 265 },
      { name: "캡틴", nameEn: "Captain", level: 70, hp: 15000, exp: 282 },
    ],
    expPerHour: 65000,
    jobs: ["전체"],
    tips: "허브타운 접근 후 크루/캡틴 사냥으로 안정적 레벨업. 오르비스PQ 졸업 후 추천.",
    source: "DB 데이터 + 커뮤니티",
  },
  {
    id: "romeo-pq",
    levelMin: 71,
    levelMax: 85,
    mapName: "로미오와 줄리엣 파티퀘스트",
    mapNameEn: "Romeo and Juliet Party Quest",
    region: "마가티아",
    monsters: [],
    expPerHour: 120000,
    jobs: ["전체"],
    tips: "70~85 구간 국민 렙업 코스. 시간당 약 120만 경험치. 카드키로 맵 양끝 문을 열고 연구자료를 가져오는 방식. 전사 기준 71~90 구간 추천. 불독 기준 71~83 구간 추천.",
    source: "나무위키 + arca.live 전사 가이드 + vortexgaming.io",
  },
  {
    id: "leafre-entrance",
    levelMin: 70,
    levelMax: 85,
    mapName: "리프레 입구 (래쉬/비틀)",
    mapNameEn: "Leafre Entrance (Rash/Beetle)",
    region: "리프레",
    monsters: [
      { name: "래쉬", nameEn: "Rash", level: 70, hp: 14500, exp: 270 },
      { name: "비틀", nameEn: "Beetle", level: 72, hp: 15200, exp: 295 },
      { name: "듀얼 비틀", nameEn: "Dual Beetle", level: 76, hp: 18000, exp: 370 },
    ],
    expPerHour: 60000,
    jobs: ["전체"],
    tips: "리프레 진입 퀘스트 완료 필요. 로미오PQ가 안 잡힐 때 대안 사냥터. 3차 전직 이후 스킬 활용 가능한 레벨.",
    source: "DB 데이터 + 커뮤니티",
  },
  {
    id: "wolf-spider",
    levelMin: 75,
    levelMax: 95,
    mapName: "늑대거미 동굴",
    mapNameEn: "Wolf Spider Cavern",
    region: "싱가포르/뉴리프",
    monsters: [
      { name: "늑대거미", nameEn: "Wolf Spider", level: 80, hp: 28000, exp: 1200 },
    ],
    expPerHour: 100000,
    jobs: ["전체"],
    tips: "경험치 대비 HP가 낮아 킬 효율이 매우 높은 숨은 명당. 비숍은 홀리 심볼 활용 시 더욱 효율적. MapleRoyals에서도 75~95 구간 1순위 추천. 다만 맵이 좁아 경쟁이 심할 수 있음.",
    source: "MapleRoyals Training Guide + DB 데이터",
  },
  {
    id: "elnath-lycanthrope",
    levelMin: 78,
    levelMax: 90,
    mapName: "엘나스 라이칸스로프 사냥터",
    mapNameEn: "El Nath Lycanthrope",
    region: "엘나스",
    monsters: [
      { name: "라이칸스로프", nameEn: "Lycanthrope", level: 80, hp: 27000, exp: 850 },
      { name: "하프", nameEn: "Harp", level: 80, hp: 27000, exp: 850 },
    ],
    expPerHour: 90000,
    jobs: ["전체"],
    tips: "늑대거미 경쟁이 심할 때 대안. HP 27,000 대비 경험치 850으로 효율적. 드랍 아이템도 좋은 편.",
    source: "DB 데이터 + 커뮤니티",
  },
  {
    id: "sky-nest-entrance",
    levelMin: 80,
    levelMax: 95,
    mapName: "리프레 하늘둥지 입구",
    mapNameEn: "Leafre Sky Nest Entrance",
    region: "리프레",
    monsters: [
      { name: "블러드 하프", nameEn: "Blood Harp", level: 83, hp: 30000, exp: 1100 },
      { name: "한키", nameEn: "Hankie", level: 80, hp: 27000, exp: 850 },
    ],
    expPerHour: 85000,
    jobs: ["전체"],
    tips: "3차 전직 이후 익스플로전 등 광역기 사용 시 효율 상승. 불독 마법사 80~83 구간 추천.",
    source: "vortexgaming.io 불독 가이드 + DB 데이터",
  },
  {
    id: "fire-darkness",
    levelMin: 83,
    levelMax: 100,
    mapName: "불과 어둠의 전장",
    mapNameEn: "Battlefield of Fire and Darkness",
    region: "리프레",
    monsters: [
      { name: "데스테니", nameEn: "Death Teddy", level: 85, hp: 32000, exp: 1300 },
      { name: "마스터 데스테니", nameEn: "Master Death Teddy", level: 89, hp: 40000, exp: 1720 },
    ],
    expPerHour: 110000,
    jobs: ["전체"],
    tips: "리프레 지역 파티사냥 주요 사냥터. 불독 83~98 구간 추천. 크리븐 획득 가능. 비숍 81~91 구간에는 맨타레이 사냥도 추천.",
    source: "vortexgaming.io 불독 가이드 + 나무위키",
  },
  {
    id: "ghost-pirate",
    levelMin: 85,
    levelMax: 100,
    mapName: "유령해적선 (듀얼 파이렛)",
    mapNameEn: "Ghost Ship (Dual Ghost Pirate)",
    region: "허브타운",
    monsters: [
      { name: "듀얼 파이렛", nameEn: "Dual Ghost Pirate", level: 87, hp: 35000, exp: 1500 },
    ],
    expPerHour: 100000,
    jobs: ["전체"],
    tips: "유령해적선 2층이 밀집도 좋음. 법사 범위 공격 시 효율 극대화. MapleRoyals에서 불/독 마법사 51~75 구간 추천.",
    source: "MapleRoyals Training Guide + DB 데이터",
  },
  {
    id: "kentaurus",
    levelMin: 85,
    levelMax: 100,
    mapName: "리프레 켄타우루스 사냥터",
    mapNameEn: "Leafre Kentaurus Forest",
    region: "리프레",
    monsters: [
      { name: "블랙 켄타우루스", nameEn: "Black Kentaurus", level: 88, hp: 37000, exp: 1600 },
      { name: "레드 켄타우루스", nameEn: "Red Kentaurus", level: 88, hp: 37000, exp: 1600 },
      { name: "블루 켄타우루스", nameEn: "Blue Kentaurus", level: 88, hp: 37000, exp: 1600 },
    ],
    expPerHour: 100000,
    jobs: ["전체"],
    tips: "리프레 중급 사냥터. 듀얼 버크(Lv.88)도 같은 구역에서 사냥 가능. 코니언/와이번 이전 단계.",
    source: "DB 데이터 + 커뮤니티",
  },
  {
    id: "squid-risell",
    levelMin: 90,
    levelMax: 105,
    mapName: "허브타운 스퀴드/리셀스퀴드",
    mapNameEn: "Herb Town Squid/Risell Squid",
    region: "허브타운",
    monsters: [
      { name: "스퀴드", nameEn: "Squid", level: 94, hp: 46000, exp: 2200 },
      { name: "리셀스퀴드", nameEn: "Risell Squid", level: 97, hp: 49000, exp: 2500 },
    ],
    expPerHour: 130000,
    jobs: ["전체"],
    tips: "프리스트 91~96 구간 추천. 리셀스퀴드가 법사 최종 전신 흑견랑포를 드랍. 허밋은 91레벨부터 Squid Pots 추천.",
    source: "vortexgaming.io + MapleRoyals + DB 데이터",
  },
  {
    id: "temple-of-time-memory",
    levelMin: 90,
    levelMax: 110,
    mapName: "시간의 신전 (기억의 수도승)",
    mapNameEn: "Temple of Time (Memory Monk)",
    region: "시간의 신전",
    monsters: [
      { name: "기억의 수도승", nameEn: "Memory Monk", level: 91, hp: 41000, exp: 1900 },
      { name: "기억의 수도승 견습생", nameEn: "Memory Monk Trainee", level: 94, hp: 45000, exp: 2200 },
    ],
    expPerHour: 120000,
    jobs: ["전체"],
    tips: "시간의 신전 퀘스트 진행 필요. 파티 사냥 필수 (맵이 넓어서 솔플 비효율). 2인 사냥 추천.",
    source: "MapleRoyals Training Guide + DB 데이터",
  },
  {
    id: "leafre-cornian",
    levelMin: 95,
    levelMax: 110,
    mapName: "리프레 코니언 사냥터",
    mapNameEn: "Leafre Cornian Hunting Ground",
    region: "리프레",
    monsters: [
      { name: "그린코니언", nameEn: "Green Cornian", level: 100, hp: 48000, exp: 3000 },
      { name: "다크코니언", nameEn: "Dark Cornian", level: 105, hp: 67000, exp: 3700 },
    ],
    expPerHour: 150000,
    jobs: ["마법사", "궁수"],
    tips: "불숲(불타는 숲)에서 법사 광역기 쩔 사냥 성지. 다크 코니언 불독(메테오) 마력 1,230+ / 썬콜(블리자드) 마력 1,260+에서 1확컷. 명중률 약 205 필요.",
    source: "Gemini 분석 문서 + 나무위키 + DB 데이터",
  },
  {
    id: "leafre-wyvern-canyon",
    levelMin: 95,
    levelMax: 110,
    mapName: "리프레 와이번의 협곡",
    mapNameEn: "Wyvern Canyon",
    region: "리프레",
    monsters: [
      { name: "블루 와이번", nameEn: "Blue Wyvern", level: 101, hp: 57000, exp: 3050 },
      { name: "다크 와이번", nameEn: "Dark Wyvern", level: 103, hp: 60000, exp: 3150 },
    ],
    expPerHour: 140000,
    jobs: ["도적", "궁수"],
    tips: "나이트로드 좌1/우1 자리 스공 2,600~2,800 (베놈 활용 시). 필요 명중률 약 205. 보우마스터도 효율 좋음.",
    source: "Gemini 분석 문서 + DB 데이터",
  },
  {
    id: "shark-deep-sea",
    levelMin: 95,
    levelMax: 110,
    mapName: "깊은 바다 협곡 (샤크/콜드샤크)",
    mapNameEn: "Deep Sea Gorge",
    region: "아쿠아리움",
    monsters: [
      { name: "샤크", nameEn: "Shark", level: 100, hp: 56000, exp: 3000 },
      { name: "콜드샤크", nameEn: "Cold Shark", level: 102, hp: 58500, exp: 3100 },
    ],
    expPerHour: 130000,
    jobs: ["전체"],
    tips: "깊은 바다 협곡 2가 최고 경험치. 불독은 빅뱅 30 권장. 아쿠아리움 난파선에서 주문서 획득 가능. MapleRoyals에서 80~95 구간 대안으로 추천.",
    source: "vortexgaming.io 불독 가이드 + MapleRoyals + DB 데이터",
  },
  {
    id: "leafre-dragon-nest-destroyed",
    levelMin: 100,
    levelMax: 120,
    mapName: "망가진 용의 둥지 (망용둥)",
    mapNameEn: "Destroyed Dragon Nest",
    region: "리프레",
    monsters: [
      { name: "네스트골렘", nameEn: "Nest Golem", level: 110, hp: 80000, exp: 8050 },
      { name: "스켈레곤", nameEn: "Skelegon", level: 110, hp: 80000, exp: 4500 },
      { name: "스켈로스", nameEn: "Skelosaurus", level: 113, hp: 85000, exp: 4750 },
    ],
    expPerHour: 200000,
    jobs: ["전체"],
    tips: "망용둥은 4차 전직 이후 핵심 사냥터. 네스트골렘이 샾/폭시/어콤 북 드랍. 보우마스터 옥상(6젠컷) 스공 5,400+. 2층(5젠컷) 스공 4,400~4,700. 나이트로드 2층(5젠컷) 스공 3,800~4,000.",
    source: "Gemini 분석 문서 + 나무위키 + DB 데이터",
  },
  {
    id: "leafre-dead-dragon",
    levelMin: 100,
    levelMax: 120,
    mapName: "죽은 용의 둥지 (죽둥)",
    mapNameEn: "Nest of a Dead Dragon",
    region: "리프레",
    monsters: [
      { name: "네스트골렘", nameEn: "Nest Golem", level: 110, hp: 80000, exp: 4450 },
      { name: "스켈레곤", nameEn: "Skelegon", level: 110, hp: 80000, exp: 4500 },
    ],
    expPerHour: 180000,
    jobs: ["전체"],
    tips: "1:1 파티 사냥 위주. 비숍 파트너 + 보우마스터(스공 4,500+) 조합이 이상적. 2확컷 기준 비숍 마력 850~860 (제네시스 20 기준 900+).",
    source: "Gemini 분석 문서 + 나무위키",
  },
  {
    id: "temple-of-time-qualm",
    levelMin: 105,
    levelMax: 120,
    mapName: "시간의 신전 (후회의 수도승)",
    mapNameEn: "Temple of Time (Qualm Monk)",
    region: "시간의 신전",
    monsters: [
      { name: "후회의 수도승 견습생", nameEn: "Qualm Monk Trainee", level: 109, hp: 79000, exp: 3600 },
      { name: "후회의 파수꾼", nameEn: "Qualm Guardian", level: 113, hp: 90000, exp: 4500 },
      { name: "후회의 대파수꾼", nameEn: "Chief Qualm Guardian", level: 116, hp: 99000, exp: 4960 },
    ],
    expPerHour: 170000,
    jobs: ["전체"],
    tips: "시간의 신전 2차 구역. 후회의 수도승은 경험치가 높지만 HP도 높아 스펙 요구. 파티 사냥 권장.",
    source: "DB 데이터 + MapleRoyals",
  },
  {
    id: "temple-of-time-oblivion",
    levelMin: 120,
    levelMax: 140,
    mapName: "시간의 신전 (망각의 수도승)",
    mapNameEn: "Temple of Time (Oblivion Monk)",
    region: "시간의 신전",
    monsters: [
      { name: "망각의 수도승", nameEn: "Oblivion Monk", level: 121, hp: 115000, exp: 5750 },
      { name: "망각의 수도승 견습생", nameEn: "Oblivion Monk Trainee", level: 124, hp: 123000, exp: 6150 },
      { name: "망각의 파수꾼", nameEn: "Oblivion Guardian", level: 128, hp: 133000, exp: 6670 },
    ],
    expPerHour: 200000,
    jobs: ["전체"],
    tips: "4차 전직 후 시간의 신전 3차 구역. MapleRoyals에서 120~200 구간 추천. 파티 사냥 필수.",
    source: "MapleRoyals Training Guide + DB 데이터",
  },
  {
    id: "leafre-dragon-nest-left",
    levelMin: 120,
    levelMax: 200,
    mapName: "남겨진 용의 둥지 (남둥)",
    mapNameEn: "The Dragon Nest Left Behind",
    region: "리프레",
    monsters: [
      { name: "스켈레곤", nameEn: "Skelegon", level: 110, hp: 80000, exp: 4500 },
      { name: "스켈로스", nameEn: "Skelosaurus", level: 113, hp: 85000, exp: 4750 },
      { name: "네스트골렘", nameEn: "Nest Golem", level: 110, hp: 80000, exp: 8050 },
    ],
    expPerHour: 250000,
    jobs: ["전체"],
    tips: "메이플랜드 최종 사냥터. 3:1 파티 구성으로 피로도 0. 비숍 제네시스 30 기준 1확컷: 마력 1,320+ (안정권). 2확컷: 마력 885~910. 히어로 남둥 젠컷 스공 6,500+. 다크나이트 버서크 30 스공 3,500~4,000. 성속성 약점이라 제네시스/홀리 계열이 강력.",
    source: "Gemini 분석 문서 + 나무위키 메이플랜드/사냥터 + 커뮤니티 공통 합의",
  },
  {
    id: "mini-bean",
    levelMin: 140,
    levelMax: 200,
    mapName: "시간의 신전 (미니빈)",
    mapNameEn: "Temple of Time (Mini Bean)",
    region: "시간의 신전",
    monsters: [
      { name: "미니빈", nameEn: "Mini Bean", level: 150, hp: 303000, exp: 11000 },
    ],
    expPerHour: 220000,
    jobs: ["전체"],
    tips: "시간의 신전 최종 구역. 남둥과 함께 엔드게임 사냥터. 파티 사냥 필수. 매우 높은 스펙 요구.",
    source: "DB 데이터 + MapleRoyals",
  },
  // ─── 보스 ───
  {
    id: "boss-zakum",
    levelMin: 50,
    levelMax: 200,
    mapName: "자쿰 (보스)",
    mapNameEn: "Zakum (Boss)",
    region: "엘나스",
    monsters: [],
    expPerHour: 0,
    jobs: ["전체"],
    tips: "레벨 50+ 부터 참여 가능. 135레벨부터 풀 경험치. 데일리 보스런으로 경험치 + 장비 획득. 자쿰 헬멧은 거의 모든 직업 필수 장비.",
    source: "MapleRoyals + 커뮤니티 공통",
  },
  {
    id: "boss-papulatus",
    levelMin: 120,
    levelMax: 200,
    mapName: "파풀라투스 (보스)",
    mapNameEn: "Papulatus (Boss)",
    region: "루디브리엄",
    monsters: [
      { name: "파풀라투스", nameEn: "Papulatus", level: 125, hp: 23000000, exp: 596000 },
    ],
    expPerHour: 0,
    jobs: ["전체"],
    tips: "루디브리엄 시계탑 최상층 보스. 1회 클리어 시 596,000 경험치. 보스런 병행 시 레벨업 효율 상승.",
    source: "DB 데이터 + 커뮤니티",
  },
  {
    id: "boss-horntail",
    levelMin: 130,
    levelMax: 200,
    mapName: "혼테일 (보스)",
    mapNameEn: "Horntail (Boss)",
    region: "리프레",
    monsters: [],
    expPerHour: 0,
    jobs: ["전체"],
    tips: "레벨 130+ 부터 참여 가능. 메이플랜드 최종 보스 콘텐츠. 도적이 피격 회피율과 페이크로 가장 편하게 참여 가능. 혼테일 펜던트/링 등 최종 장비 획득.",
    source: "커뮤니티 공통",
  },
];

// ─── 유틸 ───
function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatExpShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}억`;
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}천만`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return formatNumber(n);
}

function isBoss(spot: HuntingSpot): boolean {
  return spot.id.startsWith("boss-");
}

function isPQ(spot: HuntingSpot): boolean {
  return spot.id.endsWith("-pq");
}

// ─── 메인 컴포넌트 ───
export default function HuntPage() {
  const [level, setLevel] = useState<number | "">(30);
  const [job, setJob] = useState<Job>("all");
  const [damage, setDamage] = useState<string>("");

  // 보스/PQ가 아닌 일반 사냥터
  const filteredSpots = useMemo(() => {
    const dmg = damage ? parseInt(damage, 10) : null;
    const lvl = level === "" ? null : level;

    return HUNTING_SPOTS.filter((spot) => {
      // 보스 제외 (별도 섹션)
      if (isBoss(spot)) return false;

      // 레벨이 비어있으면 전체 표시
      if (lvl !== null) {
        const inRange = lvl >= spot.levelMin - 5 && lvl <= spot.levelMax + 5;
        if (!inRange) return false;
      }

      // 직업 필터
      if (job !== "all") {
        const jobKr = JOB_LABELS[job];
        const hasJobFilter = spot.jobs.length > 0 && !spot.jobs.includes("전체");
        if (hasJobFilter && !spot.jobs.includes(jobKr)) {
          return false;
        }
      }

      // 데미지 필터: PQ는 몬스터 없으므로 통과
      if (dmg && dmg > 0 && spot.monsters.length > 0) {
        const canKill = spot.monsters.some((m) => m.hp <= dmg * 10);
        if (!canKill) return false;
      }

      return true;
    }).sort((a, b) => {
      if (lvl === null) return a.levelMin - b.levelMin;

      const midA = (a.levelMin + a.levelMax) / 2;
      const midB = (b.levelMin + b.levelMax) / 2;
      const diffA = Math.abs(lvl - midA);
      const diffB = Math.abs(lvl - midB);

      const inA = lvl >= a.levelMin && lvl <= a.levelMax ? 0 : 1;
      const inB = lvl >= b.levelMin && lvl <= b.levelMax ? 0 : 1;
      if (inA !== inB) return inA - inB;

      return diffA - diffB;
    });
  }, [level, job, damage]);

  // 보스 콘텐츠
  const bossSpots = useMemo(() => {
    const lvl = level === "" ? null : level;
    return HUNTING_SPOTS.filter((spot) => {
      if (!isBoss(spot)) return false;
      if (lvl !== null) {
        if (lvl < spot.levelMin) return false;
      }
      return true;
    }).sort((a, b) => a.levelMin - b.levelMin);
  }, [level]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">사냥터 추천</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        레벨과 직업에 맞는 최적의 사냥터를 찾아보세요 — 검증된 메이플랜드 데이터 기반
      </p>

      {/* 입력 영역 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 레벨 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              캐릭터 레벨
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={level}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setLevel("");
                  return;
                }
                const v = parseInt(raw, 10);
                if (!isNaN(v) && v >= 1 && v <= 200) setLevel(v);
              }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
            />
          </div>

          {/* 직업 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              직업 선택
            </label>
            <select
              value={job}
              onChange={(e) => setJob(e.target.value as Job)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white dark:bg-gray-800"
            >
              {Object.entries(JOB_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 1타 데미지 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              1타 데미지 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="number"
              min={0}
              placeholder="미입력시 무시"
              value={damage}
              onChange={(e) => setDamage(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
            />
          </div>
        </div>
      </div>

      {/* 결과 */}
      {filteredSpots.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center text-gray-400">
          <p className="text-lg mb-1">추천 사냥터가 없습니다</p>
          <p className="text-sm">레벨 또는 데미지 조건을 조정해보세요</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {level !== "" ? `Lv.${level}` : "전체 레벨"} {JOB_LABELS[job]} 기준 추천 사냥터 <span className="font-bold text-orange-600">{filteredSpots.length}곳</span>
          </p>

          {filteredSpots.map((spot, idx) => {
            const isInRange = level !== "" && level >= spot.levelMin && level <= spot.levelMax;
            const isPQSpot = isPQ(spot);
            const jobsDisplay = spot.jobs.filter((j) => j !== "전체");

            return (
              <div
                key={spot.id}
                className={`bg-white dark:bg-gray-800 border rounded-xl overflow-hidden ${
                  isInRange
                    ? isPQSpot
                      ? "border-green-200 dark:border-green-800"
                      : "border-orange-200 dark:border-orange-800"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                {/* 헤더 */}
                <div className="px-5 py-4 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center mt-0.5 ${
                      isPQSpot
                        ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                        : "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400"
                    }`}>
                      {isPQSpot ? "PQ" : idx + 1}
                    </div>
                    <div>
                      <h3 className="font-bold">{spot.mapName}</h3>
                      {spot.mapNameEn && (
                        <p className="text-xs text-gray-400">{spot.mapNameEn}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                          Lv.{spot.levelMin}~{spot.levelMax}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {spot.region}
                        </span>
                        {isInRange && (
                          <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded font-medium">
                            적정 레벨
                          </span>
                        )}
                        {isPQSpot && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded font-medium">
                            파티퀘스트
                          </span>
                        )}
                        {jobsDisplay.length > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                            {jobsDisplay.join(", ")} 추천
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-xs text-gray-400">시간당 예상 경험치</p>
                    <p className="text-lg font-bold text-orange-600">
                      {spot.expPerHour > 0 ? formatExpShort(spot.expPerHour) : "-"}
                    </p>
                  </div>
                </div>

                {/* 몬스터 목록 */}
                <div className="px-5 pb-4">
                  {spot.monsters.length > 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 dark:text-gray-400 text-xs">
                            <th className="text-left px-3 py-2 font-medium">몬스터</th>
                            <th className="text-center px-3 py-2 font-medium">레벨</th>
                            <th className="text-right px-3 py-2 font-medium">HP</th>
                            <th className="text-right px-3 py-2 font-medium">EXP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {spot.monsters.map((m) => {
                            const dmg = damage ? parseInt(damage, 10) : null;
                            const canOneshot = dmg ? dmg >= m.hp : null;
                            return (
                              <tr key={m.name} className="border-t border-gray-100 dark:border-gray-800">
                                <td className="px-3 py-2 font-medium">{m.name}</td>
                                <td className="px-3 py-2 text-center text-gray-500 dark:text-gray-400">Lv.{m.level}</td>
                                <td className="px-3 py-2 text-right">
                                  {formatNumber(m.hp)}
                                  {canOneshot !== null && (
                                    <span className={`ml-1 text-xs ${canOneshot ? "text-green-600" : "text-red-500"}`}>
                                      {canOneshot ? "(1타)" : "(X)"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right text-orange-600 font-medium">
                                  {formatNumber(m.exp)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                      {isPQSpot ? "파티퀘스트 — 몬스터 대신 스테이지 클리어로 경험치 획득" : "몬스터 정보 없음"}
                    </div>
                  )}

                  {/* 팁 */}
                  {spot.tips && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                        <span className="text-orange-400 flex-shrink-0">-</span>
                        {spot.tips}
                      </p>
                    </div>
                  )}

                  {/* 출처 */}
                  {spot.source && (
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                      출처: {spot.source}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 보스런 섹션 */}
      {bossSpots.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 text-xs font-bold">B</span>
            보스런
          </h2>
          <div className="space-y-4">
            {bossSpots.map((spot) => {
              const isInRange = level !== "" && level >= spot.levelMin;
              return (
                <div
                  key={spot.id}
                  className={`bg-white dark:bg-gray-800 border rounded-xl overflow-hidden ${
                    isInRange ? "border-red-200 dark:border-red-800" : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="px-5 py-4 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 text-sm font-bold flex items-center justify-center mt-0.5">
                        BOSS
                      </div>
                      <div>
                        <h3 className="font-bold">{spot.mapName}</h3>
                        {spot.mapNameEn && (
                          <p className="text-xs text-gray-400">{spot.mapNameEn}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded font-medium">
                            Lv.{spot.levelMin}+
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                            {spot.region}
                          </span>
                          {isInRange && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded font-medium">
                              참여 가능
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-4">
                    {spot.monsters.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden mb-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500 dark:text-gray-400 text-xs">
                              <th className="text-left px-3 py-2 font-medium">보스</th>
                              <th className="text-center px-3 py-2 font-medium">레벨</th>
                              <th className="text-right px-3 py-2 font-medium">HP</th>
                              <th className="text-right px-3 py-2 font-medium">EXP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {spot.monsters.map((m) => (
                              <tr key={m.name} className="border-t border-gray-100 dark:border-gray-800">
                                <td className="px-3 py-2 font-medium">{m.name}</td>
                                <td className="px-3 py-2 text-center text-gray-500 dark:text-gray-400">Lv.{m.level}</td>
                                <td className="px-3 py-2 text-right">{formatNumber(m.hp)}</td>
                                <td className="px-3 py-2 text-right text-orange-600 font-medium">{formatNumber(m.exp)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {spot.tips && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                        <span className="text-red-400 flex-shrink-0">-</span>
                        {spot.tips}
                      </p>
                    )}

                    {spot.source && (
                      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                        출처: {spot.source}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 전체 사냥터 레벨 맵 */}
      <div className="mt-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-bold mb-4">레벨 구간별 사냥터 총정리</h2>
        <div className="space-y-2">
          {HUNTING_SPOTS.filter((s) => !isBoss(s)).map((spot) => {
            const isHighlighted = level !== "" && level >= spot.levelMin && level <= spot.levelMax;
            return (
              <div
                key={spot.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isHighlighted ? "bg-orange-50 dark:bg-orange-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-900"
                }`}
              >
                <span
                  className={`flex-shrink-0 text-xs px-2 py-1 rounded font-bold min-w-[5.5rem] text-center ${
                    isHighlighted
                      ? "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  Lv.{spot.levelMin}~{spot.levelMax}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isHighlighted ? "text-orange-700 dark:text-orange-300" : ""}`}>
                    {spot.mapName}
                    {isPQ(spot) && <span className="ml-1 text-xs text-green-600 dark:text-green-400">[PQ]</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {spot.monsters.length > 0
                      ? spot.monsters.map((m) => m.name).join(", ")
                      : isPQ(spot)
                        ? "파티퀘스트"
                        : ""}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {spot.region}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
