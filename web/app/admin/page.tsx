"use client";

import { useEffect, useState, useCallback } from "react";
import { getAdminStats, getAdminMobs, patchAdminMob, deleteAdminMob } from "@/lib/api";
import type { AdminMob } from "@/lib/types";
import Pagination from "@/components/Pagination";

interface Stats {
  total_mobs: number;
  hidden_count: number;
  visible_count: number;
  boss_count: number;
  drop_count: number;
  spawn_count: number;
  no_kr_name: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [mobs, setMobs] = useState<AdminMob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [isHidden, setIsHidden] = useState("all");
  const [isBoss, setIsBoss] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const perPage = 50;

  const loadStats = useCallback(() => {
    getAdminStats().then(setStats).catch(() => null);
  }, []);

  const loadMobs = useCallback(() => {
    setLoading(true);
    getAdminMobs({ page, per_page: perPage, q: q || undefined, is_hidden: isHidden, is_boss: isBoss })
      .then((d) => { setMobs(d.mobs); setTotal(d.total); })
      .catch(() => setMobs([]))
      .finally(() => setLoading(false));
  }, [page, q, isHidden, isBoss]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadMobs(); }, [loadMobs]);

  const handleToggleHidden = async (mob: AdminMob) => {
    setActionLoading(mob.id);
    try {
      await patchAdminMob(mob.id, { is_hidden: mob.is_hidden ? 0 : 1 });
      loadMobs();
      loadStats();
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleBoss = async (mob: AdminMob) => {
    setActionLoading(mob.id);
    try {
      await patchAdminMob(mob.id, { is_boss: mob.is_boss ? 0 : 1 });
      loadMobs();
      loadStats();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (mob: AdminMob) => {
    if (!confirm(`"${mob.name_kr || mob.name}" 몬스터를 영구 삭제하시겠습니까?\n드롭 및 스폰 데이터도 함께 삭제됩니다.`)) return;
    setActionLoading(mob.id);
    try {
      await deleteAdminMob(mob.id);
      loadMobs();
      loadStats();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">관리자 대시보드</h1>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {[
            { label: "전체 몬스터", value: stats.total_mobs },
            { label: "노출", value: stats.visible_count },
            { label: "숨김", value: stats.hidden_count },
            { label: "보스", value: stats.boss_count },
            { label: "드롭 데이터", value: stats.drop_count },
            { label: "스폰 데이터", value: stats.spawn_count },
            { label: "한국어명 없음", value: stats.no_kr_name },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
              <div className="text-xl font-bold text-orange-500">{s.value.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="몬스터 이름 검색"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-400 w-48"
        />
        <select
          value={isHidden}
          onChange={(e) => { setIsHidden(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
        >
          <option value="all">숨김여부: 전체</option>
          <option value="0">노출</option>
          <option value="1">숨김</option>
        </select>
        <select
          value={isBoss}
          onChange={(e) => { setIsBoss(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
        >
          <option value="all">보스여부: 전체</option>
          <option value="1">보스만</option>
          <option value="0">일반만</option>
        </select>
      </div>

      <p className="text-sm text-gray-500 mb-2">총 {total.toLocaleString()}건</p>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 w-16">ID</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 w-12">아이콘</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">이름 (영/한)</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 w-16">레벨</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 w-24">HP</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600 w-14">보스</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600 w-14">숨김</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600 w-16">드롭수</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600 w-32">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mobs.map((mob) => {
                const busy = actionLoading === mob.id;
                return (
                  <tr key={mob.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 text-gray-400 text-xs">{mob.id}</td>
                    <td className="px-3 py-2">
                      {mob.icon_url ? (
                        <img src={mob.icon_url} alt={mob.name} className="w-8 h-8 object-contain" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-100 rounded" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {mob.name_kr && <div className="font-medium">{mob.name_kr}</div>}
                      <div className={mob.name_kr ? "text-xs text-gray-400" : "font-medium"}>{mob.name}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{mob.level}</td>
                    <td className="px-3 py-2 text-right text-xs">{(mob.hp ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleToggleBoss(mob)}
                        disabled={busy}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                          mob.is_boss
                            ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        }`}
                      >
                        {mob.is_boss ? "보스" : "-"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleToggleHidden(mob)}
                        disabled={busy}
                        title={mob.is_hidden ? "숨김 해제" : "숨기기"}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                          mob.is_hidden
                            ? "bg-red-100 text-red-600 hover:bg-red-200"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                      >
                        {mob.is_hidden ? "숨김" : "노출"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">{mob.drop_count}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleDelete(mob)}
                        disabled={busy}
                        className="px-2 py-1 rounded text-xs bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-40"
                      >
                        {busy ? "..." : "삭제"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {mobs.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400">
                    데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={Math.ceil(total / perPage)} onChange={(p) => { setPage(p); window.scrollTo(0, 0); }} />
    </div>
  );
}
