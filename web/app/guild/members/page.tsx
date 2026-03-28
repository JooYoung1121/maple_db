"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getGuildMembers,
  createGuildMember,
  updateGuildMember,
  updateGuildMemberAlias,
  deleteGuildMember,
  GuildMember,
} from "@/lib/api";

const RANKS = ["전체", "마스터", "부마스터", "길드원", "부캐릭", "새싹"] as const;
type RankFilter = (typeof RANKS)[number];
type SortField = "rank" | "job" | "level" | "nickname";
type SortDir = "asc" | "desc";

const RANK_ORDER: Record<string, number> = {
  마스터: 0, 부마스터: 1, 길드원: 2, 부캐릭: 3, 새싹: 4,
};

const RANK_BADGE: Record<string, string> = {
  마스터: "bg-orange-100 text-orange-700 border border-orange-300",
  부마스터: "bg-blue-100 text-blue-700 border border-blue-300",
  길드원: "bg-gray-100 text-gray-600 border border-gray-300",
  부캐릭: "bg-purple-100 text-purple-600 border border-purple-200 italic",
  새싹: "bg-green-100 text-green-700 border border-green-300",
};

const EMPTY_FORM = { nickname: "", job: "", level: 1, rank: "길드원", note: "" };

const DEFAULT_SORT: { field: SortField; dir: SortDir } = { field: "level", dir: "desc" };

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <span className="text-gray-300 ml-0.5">↕</span>;
  return <span className="text-orange-500 ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

export default function GuildMembersPage() {
  const [allMembers, setAllMembers] = useState<GuildMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankFilter, setRankFilter] = useState<RankFilter>("전체");
  const [sortField, setSortField] = useState<SortField>(DEFAULT_SORT.field);
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT.dir);

  // admin
  const [adminMode, setAdminMode] = useState(false);
  const [password, setPassword] = useState("");

  // modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<GuildMember | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  // alias inline edit
  const [editingAlias, setEditingAlias] = useState<{ id: number; value: string } | null>(null);
  const [savingAlias, setSavingAlias] = useState(false);
  const aliasInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getGuildMembers({ per_page: 500 });
      setAllMembers(res.members);
    } catch {
      setAllMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (editingAlias) aliasInputRef.current?.focus();
  }, [editingAlias]);

  // column header sort: asc → desc → default
  function handleColumnSort(field: SortField) {
    if (sortField === field) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortField(DEFAULT_SORT.field);
        setSortDir(DEFAULT_SORT.dir);
      }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // quick sort buttons
  const QUICK_SORTS: { label: string; field: SortField; dir: SortDir }[] = [
    { label: "레벨순", field: "level", dir: "desc" },
    { label: "닉네임순", field: "nickname", dir: "asc" },
    { label: "직책순", field: "rank", dir: "asc" },
    { label: "직업순", field: "job", dir: "asc" },
  ];

  // filtered + sorted
  const filtered = allMembers.filter((m) => rankFilter === "전체" || m.rank === rankFilter);
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === "rank") cmp = (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99);
    else if (sortField === "level") cmp = a.level - b.level;
    else if (sortField === "nickname") cmp = a.nickname.localeCompare(b.nickname, "ko");
    else if (sortField === "job") cmp = a.job.localeCompare(b.job, "ko");
    return sortDir === "asc" ? cmp : -cmp;
  });

  // stats
  const rankCounts = RANKS.slice(1).reduce<Record<string, number>>((acc, r) => {
    acc[r] = allMembers.filter((m) => m.rank === r).length;
    return acc;
  }, {});
  const avgLevel = allMembers.length
    ? Math.round(allMembers.reduce((s, m) => s + m.level, 0) / allMembers.length)
    : 0;

  // alias save
  async function saveAlias() {
    if (!editingAlias) return;
    setSavingAlias(true);
    try {
      const updated = await updateGuildMemberAlias(editingAlias.id, editingAlias.value);
      setAllMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch {
      // silently ignore
    } finally {
      setSavingAlias(false);
      setEditingAlias(null);
    }
  }

  // modal save
  async function handleSave() {
    setModalError("");
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await updateGuildMember(editTarget.id, { ...form, level: Number(form.level) }, password);
        setAllMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setEditTarget(null);
      } else {
        const created = await createGuildMember({ ...form, level: Number(form.level) }, password);
        setAllMembers((prev) => [...prev, created]);
        setShowAddModal(false);
      }
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: GuildMember) {
    if (!confirm(`${m.nickname}을(를) 명단에서 삭제할까요?`)) return;
    try {
      await deleteGuildMember(m.id, password);
      setAllMembers((prev) => prev.filter((x) => x.id !== m.id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  }

  const FormModal = ({ title, onClose }: { title: string; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {([
          { label: "닉네임", key: "nickname", type: "text" },
          { label: "직업", key: "job", type: "text" },
          { label: "레벨", key: "level", type: "number" },
        ] as const).map(({ label, key, type }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <input
              type={type}
              value={form[key]}
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
          />
        </div>

        {modalError && <p className="text-red-500 text-xs">{modalError}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
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
          <p className="text-sm text-gray-500 mt-0.5">총 {allMembers.length}명</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdminMode((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              adminMode ? "bg-orange-500 text-white border-orange-500" : "text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {adminMode ? "관리자 모드 ON" : "관리자 모드"}
          </button>
          {adminMode && (
            <button
              onClick={() => { setForm({ ...EMPTY_FORM }); setModalError(""); setShowAddModal(true); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600"
            >
              + 추가
            </button>
          )}
        </div>
      </div>

      {/* Admin password */}
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{allMembers.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">전체</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{avgLevel}</p>
          <p className="text-xs text-gray-500 mt-0.5">평균 레벨</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 col-span-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center h-full items-center">
            {RANKS.slice(1).map((r) => (
              <span key={r} className="text-xs text-gray-600">
                <span className="font-semibold">{r}</span> {rankCounts[r] ?? 0}명
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Filters + sort */}
      <div className="flex items-center gap-1 flex-wrap">
        {RANKS.map((r) => (
          <button
            key={r}
            onClick={() => setRankFilter(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              rankFilter === r ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {r} ({r === "전체" ? allMembers.length : (rankCounts[r] ?? 0)})
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-gray-400">정렬:</span>
          {QUICK_SORTS.map(({ label, field, dir }) => (
            <button
              key={label}
              onClick={() => { setSortField(field); setSortDir(dir); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                sortField === field && sortDir === dir
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">길드원이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {(["rank", "job", "level", "nickname"] as SortField[]).map((field) => {
                    const labels: Record<SortField, string> = { rank: "직책", job: "직업", level: "레벨", nickname: "닉네임" };
                    return (
                      <th
                        key={field}
                        onClick={() => handleColumnSort(field)}
                        className={`px-4 py-3 text-xs font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-700 hover:bg-gray-100 transition-colors ${
                          field === "level" || field === "nickname" ? "text-right" : "text-left"
                        }`}
                      >
                        {labels[field]}
                        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">
                    별명 <span className="font-normal text-gray-400">(클릭해서 수정)</span>
                  </th>
                  {adminMode && (
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">관리</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    {/* 직책 */}
                    <td className="px-4 py-2.5">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${RANK_BADGE[m.rank] ?? "bg-gray-100 text-gray-600"}`}>
                        {m.rank}
                      </span>
                    </td>
                    {/* 직업 */}
                    <td className="px-4 py-2.5 text-gray-600">{m.job}</td>
                    {/* 레벨 */}
                    <td className="px-4 py-2.5 text-right font-mono text-gray-800">{m.level}</td>
                    {/* 닉네임 */}
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                      {m.nickname}
                      {m.note && <span className="ml-1 text-xs text-gray-400">({m.note})</span>}
                    </td>
                    {/* 별명 */}
                    <td className="px-4 py-2.5">
                      {editingAlias?.id === m.id ? (
                        <input
                          ref={aliasInputRef}
                          value={editingAlias.value}
                          onChange={(e) => setEditingAlias({ id: m.id, value: e.target.value })}
                          onBlur={saveAlias}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveAlias();
                            if (e.key === "Escape") setEditingAlias(null);
                          }}
                          disabled={savingAlias}
                          className="w-full border border-orange-300 rounded px-2 py-0.5 text-sm outline-none focus:ring-1 focus:ring-orange-400"
                          placeholder="별명 입력..."
                        />
                      ) : (
                        <button
                          onClick={() => setEditingAlias({ id: m.id, value: m.alias ?? "" })}
                          className="text-left text-sm text-gray-500 hover:text-orange-500 hover:underline min-w-[60px]"
                        >
                          {m.alias ?? <span className="text-gray-300">—</span>}
                        </button>
                      )}
                    </td>
                    {/* 관리 */}
                    {adminMode && (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setForm({ nickname: m.nickname, job: m.job, level: m.level, rank: m.rank, note: m.note ?? "" });
                              setModalError("");
                              setEditTarget(m);
                            }}
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
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        메이플랜드 공식 API 미제공으로 스크린샷 기반 수동 업데이트됩니다. · 별명은 누구나 수정 가능합니다.
      </p>

      {showAddModal && (
        <FormModal title="길드원 추가" onClose={() => { setShowAddModal(false); setModalError(""); }} />
      )}
      {editTarget && (
        <FormModal title={`${editTarget.nickname} 수정`} onClose={() => { setEditTarget(null); setModalError(""); }} />
      )}
    </div>
  );
}
