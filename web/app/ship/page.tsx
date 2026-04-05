"use client";

import { useState, useEffect, useMemo } from "react";

// ─── 노선 데이터 ───
interface ShipRoute {
  id: string;
  routeName: string;
  from: string;
  to: string;
  intervalMinutes: number; // 배 출발 간격(분)
  durationMinutes: number; // 소요 시간(분)
  cost: string;
  group: "victoria-orbis" | "orbis-other";
}

const SHIP_ROUTES: ShipRoute[] = [
  // 빅토리아 <-> 오르비스
  {
    id: "ellinia-orbis",
    routeName: "빅토리아 -> 오르비스",
    from: "엘리니아",
    to: "오르비스",
    intervalMinutes: 15,
    durationMinutes: 10,
    cost: "무료",
    group: "victoria-orbis",
  },
  {
    id: "orbis-ellinia",
    routeName: "오르비스 -> 빅토리아",
    from: "오르비스",
    to: "엘리니아",
    intervalMinutes: 15,
    durationMinutes: 10,
    cost: "무료",
    group: "victoria-orbis",
  },
  // 오르비스 <-> 기타 지역
  {
    id: "orbis-aquarium",
    routeName: "오르비스 -> 아쿠아리움",
    from: "오르비스",
    to: "아쿠아리움",
    intervalMinutes: 15,
    durationMinutes: 5,
    cost: "무료",
    group: "orbis-other",
  },
  {
    id: "aquarium-orbis",
    routeName: "아쿠아리움 -> 오르비스",
    from: "아쿠아리움",
    to: "오르비스",
    intervalMinutes: 15,
    durationMinutes: 5,
    cost: "무료",
    group: "orbis-other",
  },
  {
    id: "orbis-leafre",
    routeName: "오르비스 -> 리프레",
    from: "오르비스",
    to: "리프레",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "무료",
    group: "orbis-other",
  },
  {
    id: "leafre-orbis",
    routeName: "리프레 -> 오르비스",
    from: "리프레",
    to: "오르비스",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "무료",
    group: "orbis-other",
  },
  {
    id: "orbis-ludi",
    routeName: "오르비스 -> 루디브리엄",
    from: "오르비스",
    to: "루디브리엄",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "무료",
    group: "orbis-other",
  },
  {
    id: "ludi-orbis",
    routeName: "루디브리엄 -> 오르비스",
    from: "루디브리엄",
    to: "오르비스",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "무료",
    group: "orbis-other",
  },
  {
    id: "orbis-mureung",
    routeName: "오르비스 -> 무릉/백초",
    from: "오르비스",
    to: "무릉",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "무료",
    group: "orbis-other",
  },
  {
    id: "mureung-orbis",
    routeName: "무릉 -> 오르비스",
    from: "무릉",
    to: "오르비스",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "무료",
    group: "orbis-other",
  },
  {
    id: "orbis-ariant",
    routeName: "오르비스 -> 아리안트",
    from: "오르비스",
    to: "아리안트",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "무료",
    group: "orbis-other",
  },
  {
    id: "ariant-orbis",
    routeName: "아리안트 -> 오르비스",
    from: "아리안트",
    to: "오르비스",
    intervalMinutes: 10,
    durationMinutes: 5,
    cost: "무료",
    group: "orbis-other",
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
    return { bg: "bg-green-100", text: "text-green-700", label: "곧 출발" };
  }
  if (minutesLeft < 5) {
    return { bg: "bg-yellow-100", text: "text-yellow-700", label: "대기 중" };
  }
  return { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-400", label: "대기 중" };
}

function getDepartureTimesStr(interval: number): string {
  const times: string[] = [];
  for (let m = 0; m < 60; m += interval) {
    times.push(`:${m.toString().padStart(2, "0")}`);
  }
  return `매 ${interval}분 (${times.join(", ")})`;
}

// ─── 타이머 행 컴포넌트 ───
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
    <tr className="border-t border-gray-50 hover:bg-gray-50 dark:bg-gray-900 transition-colors">
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

// ─── 모바일 카드 ───
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
          매 {route.intervalMinutes}분 / 소요 약 {route.durationMinutes}분 / {route.cost}
        </div>
        <div className="text-lg font-mono font-bold text-orange-600">
          {timer.minutesLeft}:{timer.secondsLeft.toString().padStart(2, "0")}
        </div>
      </div>
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
      <RouteGroup title="빅토리아 아일랜드 <-> 오르비스" routes={victoriaRoutes} />

      {/* 오르비스 <-> 기타 */}
      <RouteGroup title="오르비스 <-> 기타 지역" routes={otherRoutes} />

      {/* 참고사항 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mt-6">
        <h2 className="font-bold mb-3">참고사항</h2>
        <ul className="space-y-1.5">
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            시간표는 v83 기준 대략적인 값이며, 메이플랜드 서버에서는 다를 수 있습니다.
          </li>
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            배 탑승 시 발리록 등 몬스터가 출현할 수 있으니 주의하세요.
          </li>
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            출발 직전에 탑승장에 도착해야 합니다. 출발 후에는 탑승 불가합니다.
          </li>
          <li className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
            <span className="text-orange-400 flex-shrink-0">-</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> 곧 출발 (2분 이내)
              <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block ml-2" /> 대기 중 (2~5분)
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block ml-2" /> 대기 중 (5분+)
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// ─── 그룹 컴포넌트 ───
function RouteGroup({ title, routes }: { title: string; routes: ShipRoute[] }) {
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
