"use client";

import { useState, useMemo } from "react";

/* ── 전직 데이터 ── */

interface AdvancementStep {
  order: number;       // 1차, 2차, 3차
  level: number;       // 요구 레벨
  jobName: string;     // 전직 후 직업명
  npc: string;         // 전직 NPC
  location: string;    // NPC 위치
  quest: string;       // 전직 퀘스트 요약
  skills: string[];    // 핵심 스킬
  tip?: string;        // 팁
}

interface JobPath {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  branches: {
    name: string;
    advancements: AdvancementStep[];
  }[];
}

const JOB_PATHS: JobPath[] = [
  {
    id: "warrior",
    name: "전사",
    icon: "⚔️",
    color: "red",
    description: "높은 HP와 물리 공격력으로 근접 전투에 특화된 직업",
    branches: [
      {
        name: "파이터 → 크루세이더",
        advancements: [
          {
            order: 1, level: 10, jobName: "전사",
            npc: "다크로드", location: "페리온 - 전사 전직관",
            quest: "페리온의 전사 전직관을 찾아가면 바로 전직 가능",
            skills: ["파워 스트라이크", "슬래시 블래스트"],
            tip: "STR 35 이상 필요",
          },
          {
            order: 2, level: 30, jobName: "파이터",
            npc: "다크로드", location: "페리온 - 전사 전직관",
            quest: "전사의 증표를 모아 전직관에게 전달",
            skills: ["파워 가드", "소드 부스터", "레이지"],
            tip: "한손검/도끼/둔기 중 선택. 파이터는 한손검+방패 추천",
          },
          {
            order: 3, level: 70, jobName: "크루세이더",
            npc: "타일러스", location: "엘나스 - 사무실",
            quest: "엘나스의 타일러스를 찾아가 시련 퀘스트 완료",
            skills: ["콤보 어택", "패닉", "코마"],
            tip: "콤보 어택이 핵심. 오브 관리가 중요",
          },
        ],
      },
      {
        name: "페이지 → 나이트",
        advancements: [
          {
            order: 1, level: 10, jobName: "전사",
            npc: "다크로드", location: "페리온 - 전사 전직관",
            quest: "페리온의 전사 전직관을 찾아가면 바로 전직 가능",
            skills: ["파워 스트라이크", "슬래시 블래스트"],
          },
          {
            order: 2, level: 30, jobName: "페이지",
            npc: "다크로드", location: "페리온 - 전사 전직관",
            quest: "전사의 증표를 모아 전직관에게 전달",
            skills: ["파워 가드", "소드 부스터", "쓰레셔"],
            tip: "한손둔기+방패 조합 추천. 안정적인 사냥 가능",
          },
          {
            order: 3, level: 70, jobName: "나이트",
            npc: "타일러스", location: "엘나스 - 사무실",
            quest: "엘나스의 타일러스를 찾아가 시련 퀘스트 완료",
            skills: ["차지 블로우", "파이어/아이스/라이트닝 차지"],
            tip: "속성 공격으로 보스전에서 강력. 파티 지원도 가능",
          },
        ],
      },
      {
        name: "스피어맨 → 버서커",
        advancements: [
          {
            order: 1, level: 10, jobName: "전사",
            npc: "다크로드", location: "페리온 - 전사 전직관",
            quest: "페리온의 전사 전직관을 찾아가면 바로 전직 가능",
            skills: ["파워 스트라이크", "슬래시 블래스트"],
          },
          {
            order: 2, level: 30, jobName: "스피어맨",
            npc: "다크로드", location: "페리온 - 전사 전직관",
            quest: "전사의 증표를 모아 전직관에게 전달",
            skills: ["폴암 부스터", "아이언 월", "하이퍼 바디"],
            tip: "하이퍼 바디로 파티에서 환영받는 직업",
          },
          {
            order: 3, level: 70, jobName: "버서커",
            npc: "타일러스", location: "엘나스 - 사무실",
            quest: "엘나스의 타일러스를 찾아가 시련 퀘스트 완료",
            skills: ["드래곤 로어", "폴암 퓨리"],
            tip: "광역기가 강력. 사냥 효율이 좋음",
          },
        ],
      },
    ],
  },
  {
    id: "magician",
    name: "마법사",
    icon: "🧙",
    color: "blue",
    description: "강력한 마법 공격과 다양한 보조 스킬을 보유한 직업",
    branches: [
      {
        name: "위자드(불/독) → 메이지(불/독)",
        advancements: [
          {
            order: 1, level: 8, jobName: "마법사",
            npc: "겔리메르", location: "엘리니아 - 마법의 도서관",
            quest: "엘리니아 마법의 도서관에서 겔리메르를 만나면 전직",
            skills: ["매직 클로", "매직 가드", "매직 아머"],
            tip: "INT 20 이상 필요. 레벨 8에 전직 가능 (가장 빠름)",
          },
          {
            order: 2, level: 30, jobName: "위자드(불/독)",
            npc: "겔리메르", location: "엘리니아 - 마법의 도서관",
            quest: "마법사의 증표를 모아 전달",
            skills: ["파이어 애로우", "포이즌 브레스", "메디테이션"],
            tip: "지속 데미지(DOT)가 강점. 보스전에서 유리",
          },
          {
            order: 3, level: 70, jobName: "메이지(불/독)",
            npc: "로비나", location: "엘나스 - 사무실",
            quest: "엘나스의 로비나를 찾아가 시련 퀘스트 완료",
            skills: ["익스플로전", "포이즌 미스트", "엘리먼트 앰프"],
            tip: "익스플로전의 광역 딜이 강력",
          },
        ],
      },
      {
        name: "위자드(얼/뇌) → 메이지(얼/뇌)",
        advancements: [
          {
            order: 1, level: 8, jobName: "마법사",
            npc: "겔리메르", location: "엘리니아 - 마법의 도서관",
            quest: "엘리니아 마법의 도서관에서 겔리메르를 만나면 전직",
            skills: ["매직 클로", "매직 가드", "매직 아머"],
          },
          {
            order: 2, level: 30, jobName: "위자드(얼/뇌)",
            npc: "겔리메르", location: "엘리니아 - 마법의 도서관",
            quest: "마법사의 증표를 모아 전달",
            skills: ["콜드 빔", "썬더 볼트", "메디테이션"],
            tip: "빙결 효과로 안전한 사냥 가능",
          },
          {
            order: 3, level: 70, jobName: "메이지(얼/뇌)",
            npc: "로비나", location: "엘나스 - 사무실",
            quest: "엘나스의 로비나를 찾아가 시련 퀘스트 완료",
            skills: ["아이스 스트라이크", "썬더 스피어", "엘리먼트 앰프"],
            tip: "광역 빙결로 사냥 효율 최상급",
          },
        ],
      },
      {
        name: "클레릭 → 프리스트",
        advancements: [
          {
            order: 1, level: 8, jobName: "마법사",
            npc: "겔리메르", location: "엘리니아 - 마법의 도서관",
            quest: "엘리니아 마법의 도서관에서 겔리메르를 만나면 전직",
            skills: ["매직 클로", "매직 가드", "매직 아머"],
          },
          {
            order: 2, level: 30, jobName: "클레릭",
            npc: "겔리메르", location: "엘리니아 - 마법의 도서관",
            quest: "마법사의 증표를 모아 전달",
            skills: ["힐", "인빈서블", "블레스"],
            tip: "힐로 언데드 몬스터 즉사 가능. 파티 필수 직업",
          },
          {
            order: 3, level: 70, jobName: "프리스트",
            npc: "로비나", location: "엘나스 - 사무실",
            quest: "엘나스의 로비나를 찾아가 시련 퀘스트 완료",
            skills: ["홀리 심볼", "샤이닝 레이", "디스펠"],
            tip: "홀리 심볼로 파티 경험치 1.5배. 최고의 파티 직업",
          },
        ],
      },
    ],
  },
  {
    id: "archer",
    name: "궁수",
    icon: "🏹",
    color: "green",
    description: "원거리 물리 공격과 높은 명중률을 가진 직업",
    branches: [
      {
        name: "헌터 → 레인저",
        advancements: [
          {
            order: 1, level: 10, jobName: "궁수",
            npc: "아테나 피어스", location: "헤네시스 - 궁수 전직관",
            quest: "헤네시스의 궁수 전직관을 찾아가면 전직",
            skills: ["애로우 블로우", "더블 샷"],
            tip: "DEX 25 이상 필요",
          },
          {
            order: 2, level: 30, jobName: "헌터",
            npc: "아테나 피어스", location: "헤네시스 - 궁수 전직관",
            quest: "궁수의 증표를 모아 전달",
            skills: ["애로우 봄", "보우 부스터", "소울 애로우"],
            tip: "활 사용. 애로우 봄의 범위가 넓어 사냥 효율 좋음",
          },
          {
            order: 3, level: 70, jobName: "레인저",
            npc: "레네", location: "엘나스 - 사무실",
            quest: "엘나스의 레네를 찾아가 시련 퀘스트 완료",
            skills: ["애로우 레인", "스트레이프", "퍼펫"],
            tip: "퍼펫으로 안전하게 사냥 가능",
          },
        ],
      },
      {
        name: "사수 → 저격수",
        advancements: [
          {
            order: 1, level: 10, jobName: "궁수",
            npc: "아테나 피어스", location: "헤네시스 - 궁수 전직관",
            quest: "헤네시스의 궁수 전직관을 찾아가면 전직",
            skills: ["애로우 블로우", "더블 샷"],
          },
          {
            order: 2, level: 30, jobName: "사수",
            npc: "아테나 피어스", location: "헤네시스 - 궁수 전직관",
            quest: "궁수의 증표를 모아 전달",
            skills: ["아이언 애로우", "석궁 부스터", "소울 애로우"],
            tip: "석궁 사용. 단발 데미지가 높아 보스전에 유리",
          },
          {
            order: 3, level: 70, jobName: "저격수",
            npc: "레네", location: "엘나스 - 사무실",
            quest: "엘나스의 레네를 찾아가 시련 퀘스트 완료",
            skills: ["블리자드", "프리징", "퍼펫"],
            tip: "블리자드로 광역 딜 가능. 빙결 효과 부여",
          },
        ],
      },
    ],
  },
  {
    id: "thief",
    name: "도적",
    icon: "🗡️",
    color: "purple",
    description: "높은 회피와 빠른 공격 속도를 가진 직업",
    branches: [
      {
        name: "어쌔신 → 허밋",
        advancements: [
          {
            order: 1, level: 10, jobName: "도적",
            npc: "다크로드", location: "커닝시티 - 도적 전직관",
            quest: "커닝시티의 도적 전직관을 찾아가면 전직",
            skills: ["럭키 세븐", "님블 바디"],
            tip: "DEX 25 이상 필요. LUK 높을수록 유리",
          },
          {
            order: 2, level: 30, jobName: "어쌔신",
            npc: "다크로드", location: "커닝시티 - 도적 전직관",
            quest: "도적의 증표를 모아 전달",
            skills: ["크리티컬 쓰로우", "표창 부스터", "헤이스트"],
            tip: "표창 사용. 원거리 공격으로 안전한 사냥",
          },
          {
            order: 3, level: 70, jobName: "허밋",
            npc: "아르웬", location: "엘나스 - 사무실",
            quest: "엘나스의 아르웬을 찾아가 시련 퀘스트 완료",
            skills: ["어벤져", "쉐도우 웹", "쉐도우 파트너"],
            tip: "쉐도우 파트너로 2배 공격. DPM 최상위",
          },
        ],
      },
      {
        name: "시프 → 시프마스터",
        advancements: [
          {
            order: 1, level: 10, jobName: "도적",
            npc: "다크로드", location: "커닝시티 - 도적 전직관",
            quest: "커닝시티의 도적 전직관을 찾아가면 전직",
            skills: ["럭키 세븐", "님블 바디"],
          },
          {
            order: 2, level: 30, jobName: "시프",
            npc: "다크로드", location: "커닝시티 - 도적 전직관",
            quest: "도적의 증표를 모아 전달",
            skills: ["새비지 블로우", "단검 부스터", "헤이스트"],
            tip: "단검 사용. 근접 공격으로 빠른 연타",
          },
          {
            order: 3, level: 70, jobName: "시프마스터",
            npc: "아르웬", location: "엘나스 - 사무실",
            quest: "엘나스의 아르웬을 찾아가 시련 퀘스트 완료",
            skills: ["어설트", "밴디트 슬래시", "메소 가드"],
            tip: "메소 가드로 생존력 UP. 밴디트 슬래시 광역 사냥",
          },
        ],
      },
    ],
  },
];

/* ── 3차 전직 퀴즈 족보 ── */

interface QuizItem {
  q: string;
  a: string;
  category: string;
}

const QUIZ_DATA: QuizItem[] = [
  // NPC/마을 관련
  { q: "메이플 스토리에서 제일 처음 만나는 NPC는?", a: "히나", category: "NPC" },
  { q: "메이플 아일랜드에 없는 NPC는?", a: "테오", category: "NPC" },
  { q: "오르비스에서 만날 수 없는 NPC는?", a: "소피아", category: "NPC" },
  { q: "엘나스에 없는 NPC는?", a: "가정부 엘마", category: "NPC" },
  { q: "합성/제련/제작 NPC가 아닌 것은?", a: "쉐인 / 하인즈", category: "NPC" },
  { q: "헤네시스에 없는 NPC는?", a: "테오", category: "NPC" },
  { q: "엘리니아에 없는 NPC는?", a: "로엘", category: "NPC" },
  { q: "커닝시티에 없는 NPC는?", a: "루크", category: "NPC" },
  { q: "펫과 관련이 없는 NPC는?", a: "비셔스", category: "NPC" },
  { q: "페리온에 없는 NPC는?", a: "에뜨랑", category: "NPC" },
  { q: "커닝시티에 있는 알렉스 아빠의 이름은?", a: "장로 스탄", category: "NPC" },
  { q: "오시리아에 있는 알파소대가 아닌 사람은?", a: "피터", category: "NPC" },
  { q: "천치의 원수?", a: "만지", category: "NPC" },
  { q: "빅토리아 아일랜드에 없는 마을은?", a: "암허스트", category: "NPC" },
  // 몬스터 관련
  { q: "오르비스에서 엘리니아로 갈 때 나오는 몬스터는?", a: "크림슨 발록", category: "몬스터" },
  { q: "개미굴에서 나오지 않는 몬스터는?", a: "스톤볼", category: "몬스터" },
  { q: "메이플 아일랜드에 나오지 않는 몬스터는?", a: "돼지", category: "몬스터" },
  { q: "하늘을 나는 몬스터는?", a: "멜러디", category: "몬스터" },
  { q: "오시리아 대륙에서 나타나지 않는 몬스터는?", a: "크로코", category: "몬스터" },
  { q: "언데드 몬스터가 아닌 것은?", a: "주니어부기", category: "몬스터" },
  { q: "주니어 발록보다 강한 몬스터는 몇마리?", a: "2마리", category: "몬스터" },
  { q: "몬스터와 전리품이 올바르지 않은 것은?", a: "네펜데스", category: "몬스터" },
  { q: "몬스터와 전리품이 올바른 것은?", a: "스티지", category: "몬스터" },
  { q: "초록버섯/스텀프/버블링/엑스텀프/옥토퍼스 중 정답은?", a: "엑스텀프", category: "몬스터" },
  { q: "몬스터의 공격으로 캐릭터에게 걸 수 있는 상태이상이 바르게 짝지어지지 않은 것은?", a: "허약", category: "몬스터" },
  // 퀘스트/전직 관련
  { q: "마야가 구해달라는 약은?", a: "이상한 약", category: "퀘스트" },
  { q: "스텀프 50마리를 잡는 퀘스트는?", a: "스텀프가 무서워요", category: "퀘스트" },
  { q: "레벨제한이 가장 높은 퀘스트는?", a: "알케스터와 암흑의 크리스탈", category: "퀘스트" },
  { q: "한번 깨고도 다시 할 수 있는 퀘스트는?", a: "아르웬의 유리구두", category: "퀘스트" },
  { q: "2차 전직을 할 때 검은수정 30개를 모으면 얻을 수 있는 아이템은?", a: "영웅의 증거", category: "퀘스트" },
  { q: "2차 전직이 아닌 것은?", a: "메이시", category: "퀘스트" },
  { q: "낡은 글라디우스 퀘스트에서 필요 없는 퀘스트 아이템은?", a: "요정의 날개", category: "퀘스트" },
  { q: "1차 전직 요구 능력치로 틀린 것은?", a: "도적 LUK 20", category: "퀘스트" },
  { q: "1차 전직 요구 능력치로 맞는 것은?", a: "궁수 DEX 25", category: "퀘스트" },
  // 기타
  { q: "렙1에서 2로 레벨업 할 때 필요하는 경험치는?", a: "15", category: "기타" },
  { q: "운영자 이벤트 과일 생크림은 케익이 몇 개?", a: "5개", category: "기타" },
  { q: "물약과 회복량이 올바른 것은?", a: "피자 (HP 400)", category: "기타" },
  { q: "메이플스토리 모바일 출시일은?", a: "2004년 7월 16일", category: "기타" },
  { q: "물약과 물약의 기능이 바르게 짝지어지지 않은 것은?", a: "새벽의 이슬 (MP 3000)", category: "기타" },
  { q: "메이플 공식 가이드북의 가격은?", a: "12,000", category: "기타" },
];

const QUIZ_CATEGORIES = ["전체", "NPC", "몬스터", "퀘스트", "기타"];

/* ── 색상 매핑 ── */
const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  red: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800", text: "text-red-600 dark:text-red-400", badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" },
  blue: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-600 dark:text-blue-400", badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
  green: { bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800", text: "text-green-600 dark:text-green-400", badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
  purple: { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", text: "text-purple-600 dark:text-purple-400", badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" },
};

export default function JobAdvancementPage() {
  const [selectedJob, setSelectedJob] = useState<string>("warrior");
  const [expandedBranch, setExpandedBranch] = useState<number>(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizSearch, setQuizSearch] = useState("");
  const [quizCategory, setQuizCategory] = useState("전체");

  const filteredQuiz = useMemo(() => {
    let list = QUIZ_DATA;
    if (quizCategory !== "전체") list = list.filter((q) => q.category === quizCategory);
    if (quizSearch) {
      const s = quizSearch.toLowerCase();
      list = list.filter((q) => q.q.toLowerCase().includes(s) || q.a.toLowerCase().includes(s));
    }
    return list;
  }, [quizSearch, quizCategory]);

  const job = JOB_PATHS.find((j) => j.id === selectedJob)!;
  const colors = COLOR_MAP[job.color];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">전직 가이드</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        직업별 전직 경로, 요구 조건, 추천 스킬을 확인하세요
      </p>

      {/* 직업 선택 탭 */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {JOB_PATHS.map((j) => (
          <button
            key={j.id}
            onClick={() => { setSelectedJob(j.id); setExpandedBranch(0); }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${
              selectedJob === j.id
                ? `${COLOR_MAP[j.color].bg} ${COLOR_MAP[j.color].border} ${COLOR_MAP[j.color].text} border-2`
                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <span className="text-xl">{j.icon}</span>
            {j.name}
          </button>
        ))}
      </div>

      {/* 직업 설명 */}
      <div className={`${colors.bg} ${colors.border} border rounded-xl p-4 mb-6`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{job.icon}</span>
          <div>
            <h2 className={`text-xl font-bold ${colors.text}`}>{job.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{job.description}</p>
          </div>
        </div>
      </div>

      {/* 분기 선택 */}
      {job.branches.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {job.branches.map((branch, idx) => (
            <button
              key={idx}
              onClick={() => setExpandedBranch(idx)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                expandedBranch === idx
                  ? `${colors.badge}`
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {branch.name}
            </button>
          ))}
        </div>
      )}

      {/* 3차 전직 퀴즈 토글 */}
      <div className="mb-6">
        <button
          onClick={() => setShowQuiz(!showQuiz)}
          className="w-full flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-4 hover:shadow-sm transition"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <div className="text-left">
              <div className="font-bold text-amber-700 dark:text-amber-300">3차 전직 퀴즈 족보</div>
              <div className="text-xs text-amber-600 dark:text-amber-400">40문제 중 랜덤 5문제 출제 · 1문제라도 틀리면 재시작</div>
            </div>
          </div>
          <svg className={`w-5 h-5 text-amber-500 transition-transform ${showQuiz ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showQuiz && (
          <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            {/* 검색 + 카테고리 */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={quizSearch}
                  onChange={(e) => setQuizSearch(e.target.value)}
                  placeholder="질문 또는 정답 검색..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {QUIZ_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setQuizCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      quizCategory === cat
                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-gray-400 mb-3">{filteredQuiz.length}문제</div>

            {/* 퀴즈 리스트 */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredQuiz.map((quiz, i) => (
                <div key={i} className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                  <span className="text-xs text-gray-400 font-mono mt-0.5 shrink-0">
                    Q{QUIZ_DATA.indexOf(quiz) + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm">{quiz.q}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded">
                        {quiz.a}
                      </span>
                      <span className="text-xs text-gray-400">{quiz.category}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 전직 경로 시각화 */}
      <div className="space-y-4">
        {job.branches[expandedBranch].advancements.map((adv, idx) => (
          <div key={idx} className="relative">
            {/* 연결선 */}
            {idx > 0 && (
              <div className="absolute left-6 -top-4 w-0.5 h-4 bg-gray-300 dark:bg-gray-600" />
            )}

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md transition">
              {/* 헤더 */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full ${colors.bg} ${colors.border} border-2 flex items-center justify-center font-bold ${colors.text}`}>
                    {adv.order}차
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{adv.jobName}</h3>
                    <span className="text-sm text-gray-400">Lv.{adv.level} 이상</span>
                  </div>
                </div>
              </div>

              {/* 정보 그리드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 text-sm shrink-0">NPC</span>
                  <span className="text-sm font-medium">{adv.npc}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 text-sm shrink-0">위치</span>
                  <span className="text-sm font-medium">{adv.location}</span>
                </div>
              </div>

              {/* 퀘스트 */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-3">
                <span className="text-xs text-gray-400 block mb-1">전직 방법</span>
                <span className="text-sm">{adv.quest}</span>
              </div>

              {/* 핵심 스킬 */}
              <div className="mb-2">
                <span className="text-xs text-gray-400 block mb-2">핵심 스킬</span>
                <div className="flex flex-wrap gap-1.5">
                  {adv.skills.map((skill) => (
                    <span key={skill} className={`text-xs px-2 py-1 rounded-full ${colors.badge}`}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* 팁 */}
              {adv.tip && (
                <div className="mt-3 flex items-start gap-2 text-sm">
                  <span className="text-yellow-500">💡</span>
                  <span className="text-gray-600 dark:text-gray-400">{adv.tip}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
