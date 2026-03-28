"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getGuildMembers,
  createGuildMember,
  updateGuildMember,
  deleteGuildMember,
  GuildMember,
} from "@/lib/api";

const RANKS = ["전체", "마스터", "부마스터", "길드원", "부캐릭", "새싹"] as const;
type RankFilter = (typeof RANKS)[number];

const RANK_BADGE: Record<string, string> = {
  마스터: "bg-orange-100 text-orange-700 border border-orange-300",
  부마스터: "bg-blue-100 text-blue-700 border border-blue-300",
  길드원: "bg-gray-100 text-gray-600 border border-gray-300",
  부캐릭: "bg-purple-100 text-purple-600 border border-purple-200 italic",
  새싹: "bg-green-100 text-green-700 border border-green-300",
};

const RANK_ORDER: Record<string, number> = { 마스터: 0, 부마스터: 1, 길드원: 2, 부캐릭: 3, 새싹: 4 };

const EMPTY_FORM = { nickname: "", job: "", level: 1, rank: "길드원", note: "" };

export default function GuildMembersPage() {
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rankFilter, setRankFilter] = useState<RankFilter>("전체");
  const [sort, setSort] = useState<"level" | "nickname">("level");

  // admin
  const [adminMode, setAdminMode] = useState(false);
  const [password, setPassword] = useState("");

  // modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<GuildMember | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rank = rankFilter === "전체" ? undefined : rankFilter;
      const res = await getGuildMembers({ rank, sort, per_page: 500 });
      setMembers(res.members);
      setTotal(res.total);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [rankFilter, sort]);

  useEffect(() => { load(); }, [load]);

  // stats
  const allMembers = rankFilter === "전체" ? members : members;
  const rankCounts = RANKS.slice(1).reduce<Record<string, number>>((acc, r) => {
    acc[r] = members.filter((m) => m.rank === r).length;
    return acc;
  }, {});
  const avgLevel = members.length
    ? Math.round(members.reduce((s, m) => s + m.level, 0) / members.length)
    : 0;

  // stats using all members (not filtered)
  const [allRankCounts, setAllRankCounts] = useState<Record<string, number>>({});
  const [allAvgLevel, setAllAvgLevel] = useState(0);
  const [allTotal, setAllTotal] = useState(0);
  useEffect(() => {
    getGuildMembers({ per_page: 500 }).then((res) => {
      const counts = RANKS.slice(1).reduce<Record<string, number>>((acc, r) => {
        acc[r] = res.members.filter((m) => m.rank === r).length;
        return acc;
      }, {});
      setAllRankCounts(counts);
      setAllTotal(res.total);
      setAllAvgLevel(
        res.members.length
          ? Math.round(res.members.reduce((s, m) => s + m.level, 0) / res.members.length)
          : 0
      );
    }).catch(() => {});
  }, [members]);

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setError("");
    setShowAddModal(true);
  }

  function openEdit(m: GuildMember) {
    setForm({ nickname: m.nickname, job: m.job, level: m.level, rank: m.rank, note: m.note ?? "" });
    setError("");
    setEditTarget(m);
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      if (editTarget) {
        await updateGuildMember(editTarget.id, { ...form, level: Number(form.level) }, password);
        setEditTarget(null);
      } else {
        await createGuildMember({ ...form, level: Number(form.level) }, password);
        setShowAddModal(false);
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: GuildMember) {
    if (!confirm(`${m.nickname}을(를) 명단에서 삭제할까요?`)) return;
    try {
      await deleteGuildMember(m.id, password);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  }

  const Modal = ({ title, onClose }: { title: string; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {[
          { label: "닉네임", key: "nickname", type: "text" },
          { label: "직업", key: "job", type: "text" },
          { label: "레벨", key: "level", type: "number" },
        ].map(({ label, key, type }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <input
              type={type}
              value={form[key as keyof typeof form]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">직책</label>
          <select
            value={form.rank}
            onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            {RANKS.slice(1).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">메모 (선택)</label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            placeholder="선택 입력"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">관리자 비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            placeholder="비밀번호"
          />
        </div>

        {error && <p className="text-red-500 text-xs">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">추억길드 길드원 명단</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {allTotal}명</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdminMode((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              adminMode
                ? "bg-orange-500 text-white border-orange-500"
                : "text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {adminMode ? "관리자 모드 ON" : "관리자 모드"}
          </button>
          {adminMode && (
            <button
              onClick={openAdd}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600"
            >
              + 추가
            </button>
          )}
        </div>
      </div>

      {/* Admin password input */}
      {adminMode && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <span className="text-xs text-orange-700 font-medium shrink-0">관리자 비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            className="flex-1 text-sm border-none bg-transparent outline-none"
          />
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{allTotal}</p>
          <p className="text-xs text-gray-500 mt-0.5">전체</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{allAvgLevel}</p>
          <p className="text-xs text-gray-500 mt-0.5">평균 레벨</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 col-span-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
            {RANKS.slice(1).map((r) => (
              <span key={r} className="text-xs text-gray-600">
                <span className="font-semibold">{r}</span> {allRankCounts[r] ?? 0}명
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {RANKS.map((r) => (
          <button
            key={r}
            onClick={() => setRankFilter(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              rankFilter === r
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {r} {r !== "전체" ? `(${allRankCounts[r] ?? 0})` : `(${allTotal})`}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-gray-400">정렬:</span>
          {(["level", "nickname"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                sort === s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "level" ? "레벨순" : "닉네임순"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">길드원이 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">직책</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">닉네임</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">직업</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">레벨</th>
                {adminMode && (
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">관리</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${RANK_BADGE[m.rank] ?? "bg-gray-100 text-gray-600"}`}>
                      {m.rank}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {m.nickname}
                    {m.note && <span className="ml-1.5 text-xs text-gray-400">({m.note})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{m.job}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-800">{m.level}</td>
                  {adminMode && (
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(m)}
                          className="px-2 py-1 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="px-2 py-1 text-xs rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        메이플랜드 공식 API 미제공으로 스크린샷 기반 수동 업데이트됩니다.
      </p>

      {/* Add modal */}
      {showAddModal && (
        <Modal title="길드원 추가" onClose={() => { setShowAddModal(false); setError(""); }} />
      )}

      {/* Edit modal */}
      {editTarget && (
        <Modal title={`${editTarget.nickname} 수정`} onClose={() => { setEditTarget(null); setError(""); }} />
      )}
    </div>
  );
}
