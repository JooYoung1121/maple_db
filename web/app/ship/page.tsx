"use client";

import { useState, useEffect, useMemo } from "react";

// ─── 정기 노선 (타이머 적용) ───
interface ShipRoute {
  id: string;
  from: string;
  to: string;
  intervalMinutes: number;
  durationMinutes: number;
  cost: string;
  vehicle: string;
  note?: string;
  group: "victoria-orbis" | "orbis-other";
}

// ─── 즉시 이동 수단 ───
interface InstantRoute {
  id: string;
  from: string;
  to: string;
  cost: string;
  vehicle: string;
  note?: string;
}

const SHIP_ROUTES: ShipRoute[] = [
  // 빅토리아 <-> 오르비스
  {
    id: "ellinia-orbis",
    from: "엘리니아",
    to: "오르비스",
    intervalMinutes: 15,
    durationMinutes: 10,
    cost: "5,000 메소 (티켓)",
    vehicle: "배",
    note: "탑승 시작: 출발 10분 전 / 출발 1분 전 마감 / 크림슨 발록 출현 가능",
    group: "victoria-orbis",
  },
  {
    id: "orbis-ellinia",
    from: "오르비스",
    to: "엘리니아",
    intervalMinutes: 15,
    durationMinutes: 10,
    cost: "5,000 메소 (티켓)",
    vehicle: "배",
    note: "탑승 시작: 출발 10분 전 / 출발 1분 전 마감 / 크림슨 발록 출현 가능",
    group: "victoria-orbis",
  },
  // 오르비스 <-> 기타 지역
  {
    id: "orbis-leafre",
    from: "오르비스",
    to: "리프레",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "6,000 메소 (티켓)",
    vehicle: "배",
    note: "Lv.15 이상 탑승 가능",
    group: "orbis-other",
  },
  {
    id: "leafre-orbis",
    from: "리프레",
    to: "오르비스",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "6,000 메소 (티켓)",
    vehicle: "배",
    group: "orbis-other",
  },
  {
    id: "orbis-ludi",
    from: "오르비스",
    to: "루디브리엄",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "6,000 메소 (티켓)",
    vehicle: "장난감 열차",
    group: "orbis-other",
  },
  {
    id: "ludi-orbis",
    from: "루디브리엄",
    to: "오르비스",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "6,000 메소 (티켓)",
    vehicle: "장난감 열차",
    group: "orbis-other",
  },
  {
    id: "orbis-ariant",
    from: "오르비스",
    to: "아리안트",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "6,000 메소 (티켓)",
    vehicle: "배",
    note: "Lv.10 이상 탑승 가능",
    group: "orbis-other",
  },
  {
    id: "ariant-orbis",
    from: "아리안트",
    to: "오르비스",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "6,000 메소 (티켓)",
    vehicle: "배",
    group: "orbis-other",
  },
];

const INSTANT_ROUTES: InstantRoute[] = [
  {
    id: "orbis-mureung",
    from: "오르비스",
    to: "무릉",
    cost: "6,000 메소",
    vehicle: "학 (鶴)",
    note: "NPC에게 말 걸면 탑승, 약 1분 소요",
  },
  {
    id: "mureung-orbis",
    from: "무릉",
    to: "오르비스",
    cost: "6,000 메소",
    vehicle: "학 (鶴)",
    note: "NPC에게 말 걸면 탑승, 약 1분 소요",
  },
  {
    id: "mureung-herbtown",
    from: "무릉",
    to: "백초마을",
    cost: "500 메소",
    vehicle: "학 (鶴)",
  },
  {
    id: "herbtown-mureung",
    from: "백초마을",
    to: "무릉",
    cost: "500 메소",
    vehicle: "학 (鶴)",
  },
  {
    id: "herbtown-aquarium",
    from: "백초마을",
    to: "아쿠아리움",
    cost: "10,000 메소",
    vehicle: "돌고래 택시",
    note: "아쿠아리움 가는 유일한 루트",
  },
  {
    id: "aquarium-herbtown",
    from: "아쿠아리움",
    to: "백초마을",
    cost: "10,000 메소",
    vehicle: "돌고래 택시",
  },
  {
    id: "ariant-magatia",
    from: "아리안트",
    to: "마가티아",
    cost: "1,500 메소",
    vehicle: "낙타 택시",
  },
  {
    id: "magatia-ariant",
    from: "마가티아",
    to: "아리안트",
    cost: "1,500 메소",
    vehicle: "낙타 택시",
  },
];

// ─── 유틸 ───
function getNextDeparture(intervalMinutes: number): { minutesLeft: number; secondsLeft: number } {
  const now = new Date();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  const currentSeconds = now.getSeconds();

  const minuteInCycle = totalMinutes % intervalMinutes;
  const minutesLeft = intervalMinutes - minuteInCycle - (currentSeconds > 0 ? 1 : 0);
  const secondsLeft = currentSeconds > 0 ? 60 - currentSeconds : 0;

  return {
    minutesLeft: minutesLeft < 0 ? intervalMinutes - 1 : minutesLeft,
    secondsLeft,
  };
}

function getStatusColor(minutesLeft: number): { bg: string; text: string; label: string } {
  if (minutesLeft < 2) {
    return { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-400", label: "곧 출발" };
  }
  if (minutesLeft < 5) {
    return { bg: "bg-yellow-100 dark:bg-yellow-900/40", text: "text-yellow-700 dark:text-yellow-400", label: "대기 중" };
  }
  return { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-400", label: "대기 중" };
}

// ─── 정기 노선 행 ───
function RouteRow({ route }: { route: ShipRoute }) {
  const [timer, setTimer] = useState(() => getNextDeparture(route.intervalMinutes));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(getNextDeparture(route.intervalMinutes));
    }, 1000);
    return () => clearInterval(interval);
  }, [route.intervalMinutes]);

  const status = getStatusColor(timer.minutesLeft);

  return (
    <tr className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-sm">{route.from}</div>
      </td>
      <td className="px-2 py-3 text-center text-gray-400">
        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-sm">{route.to}</div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
        {route.vehicle}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
        매 {route.intervalMinutes}분
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
        약 {route.durationMinutes}분
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
        {route.cost}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${status.bg} ${status.text}`}>
            {status.label}
          </span>
          <span className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200 min-w-[4rem]">
            {timer.minutesLeft}:{timer.secondsLeft.toString().padStart(2, "0")}
          </span>
        </div>
      </td>
    </tr>
  );
}

// ─── 정기 노선 모바일 카드 ───
function RouteCard({ route }: { route: ShipRoute }) {
  const [timer, setTimer] = useState(() => getNextDeparture(route.intervalMinutes));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(getNextDeparture(route.intervalMinutes));
    }, 1000);
    return () => clearInterval(interval);
  }, [route.intervalMinutes]);

  const status = getStatusColor(timer.minutesLeft);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{route.from}</span>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <span className="font-medium text-sm">{route.to}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {route.vehicle} / 매 {route.intervalMinutes}분 / 약 {route.durationMinutes}분 / {route.cost}
        </div>
        <div className="text-lg font-mono font-bold text-orange-600">
          {timer.minutesLeft}:{timer.secondsLeft.toString().padStart(2, "0")}
        </div>
      </div>
      {route.note && (
        <p className="text-xs text-orange-500 dark:text-orange-400 mt-1.5">{route.note}</p>
      )}
    </div>
  );
}

// ─── 메인 ───
export default function ShipPage() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const victoriaRoutes = useMemo(
    () => SHIP_ROUTES.filter((r) => r.group === "victoria-orbis"),
    []
  );
  const otherRoutes = useMemo(
    () => SHIP_ROUTES.filter((r) => r.group === "orbis-other"),
    []
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">배 시간표</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        메이플랜드 배/이동수단 실시간 출발 타이머
      </p>

      {/* 현재 시간 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6 text-center">
        <p className="text-xs text-gray-400 mb-0.5">현재 시간</p>
        <p className="text-2xl font-mono font-bold text-gray-800 dark:text-gray-200">
          {now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          타이머는 게임 내 서버 시간과 약간의 차이가 있을 수 있습니다
        </p>
      </div>

      {/* 빅토리아 <-> 오르비스 */}
      <ScheduledRouteGroup title="빅토리아 아일랜드 ↔ 오르비스" routes={victoriaRoutes} />

      {/* 오르비스 <-> 기타 */}
      <ScheduledRouteGroup title="오르비스 ↔ 기타 지역" routes={otherRoutes} />

      {/* 즉시 이동수단 */}
      <div className="mb-6">
        <h2 className="font-bold text-lg mb-3">즉시 이동수단 (대기 없음)</h2>

        {/* Desktop table */}
        <div className="hidden sm:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs">
                <th className="text-left px-4 py-2.5 font-medium">출발지</th>
                <th className="px-2 py-2.5" />
                <th className="text-left px-4 py-2.5 font-medium">도착지</th>
                <th className="text-left px-4 py-2.5 font-medium">이동수단</th>
                <th className="text-left px-4 py-2.5 font-medium">비용</th>
                <th className="text-left px-4 py-2.5 font-medium">비고</th>
              </tr>
            </thead>
            <tbody>
              {INSTANT_ROUTES.map((route) => (
                <tr key={route.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-sm">{route.from}</td>
                  <td className="px-2 py-3 text-center text-gray-400">
                    <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </td>
                  <td className="px-4 py-3 font-medium text-sm">{route.to}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{route.vehicle}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{route.cost}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{route.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-2">
          {INSTANT_ROUTES.map((route) => (
            <div key={route.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-medium text-sm">{route.from}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span className="font-medium text-sm">{route.to}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                  즉시
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {route.vehicle} / {route.cost}
              </div>
              {route.note && (
                <p className="text-xs text-orange-500 dark:text-orange-400 mt-1">{route.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 아쿠아리움 가는 법 안내 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 mb-6">
        <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">아쿠아리움 가는 방법</h3>
        <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
          오르비스에서 아쿠아리움으로 가는 직행 배편은 없습니다. 다음 경로를 이용하세요:
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-blue-800 dark:text-blue-300">
          <span className="bg-blue-100 dark:bg-blue-800/50 px-2 py-0.5 rounded">오르비스</span>
          <span className="text-blue-400">→ 학 6,000메소 →</span>
          <span className="bg-blue-100 dark:bg-blue-800/50 px-2 py-0.5 rounded">무릉</span>
          <span className="text-blue-400">→ 학 500메소 →</span>
          <span className="bg-blue-100 dark:bg-blue-800/50 px-2 py-0.5 rounded">백초마을</span>
          <span className="text-blue-400">→ 돌고래 10,000메소 →</span>
          <span className="bg-blue-100 dark:bg-blue-800/50 px-2 py-0.5 rounded">아쿠아리움</span>
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-500 mt-2">총 비용: 16,500 메소 / 모두 즉시 이동 (대기 없음)</p>
      </div>

      {/* 참고사항 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-bold mb-3">참고사항</h2>
        <ul className="space-y-1.5">
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            엘리니아↔오르비스 배 탑승 중 <strong className="text-red-500">크림슨 발록</strong>이 출현할 수 있습니다 (출발 후 약 1분 뒤, 미출현 시 해당 회차 없음).
          </li>
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            정기 노선은 출발 시간 전에 탑승장에 도착해야 합니다. 출발 후에는 탑승 불가합니다.
          </li>
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            티켓은 각 탑승장 근처 NPC에서 구매할 수 있습니다.
          </li>
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            비용은 메이플랜드 기준이며, 실제 게임 내 가격과 다를 수 있습니다.
          </li>
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> 곧 출발 (2분 이내)
              <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block ml-2" /> 대기 중 (2~5분)
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block ml-2" /> 대기 중 (5분+)
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block ml-2" /> 즉시 이동
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// ─── 정기 노선 그룹 ───
function ScheduledRouteGroup({ title, routes }: { title: string; routes: ShipRoute[] }) {
  return (
    <div className="mb-6">
      <h2 className="font-bold text-lg mb-3">{title}</h2>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs">
              <th className="text-left px-4 py-2.5 font-medium">출발지</th>
              <th className="px-2 py-2.5" />
              <th className="text-left px-4 py-2.5 font-medium">도착지</th>
              <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">이동수단</th>
              <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">간격</th>
              <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">소요</th>
              <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">비용</th>
              <th className="text-left px-4 py-2.5 font-medium">다음 출발</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <RouteRow key={route.id} route={route} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {routes.map((route) => (
          <RouteCard key={route.id} route={route} />
        ))}
      </div>
    </div>
  );
}
