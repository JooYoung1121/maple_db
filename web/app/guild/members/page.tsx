"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getGuildMembers,
  createGuildMember,
  updateGuildMember,
  updateGuildMemberLevel,
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
  길드원: "bg-surface2 text-dim border-2 border-edge",
  부캐릭: "bg-purple-100 text-purple-600 border border-purple-200 italic",
  새싹: "bg-green-100 text-green-700 border border-green-300",
};

const EMPTY_FORM = { nickname: "", job: "", level: 1, rank: "길드원", note: "" };
const DEFAULT_SORT: { field: SortField; dir: SortDir } = { field: "level", dir: "desc" };

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <span className="text-dim ml-0.5">↕</span>;
  return <span className="text-maple ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

// ── FormModal을 최상위 컴포넌트로 분리 (내부 정의 시 리렌더마다 언마운트되어 포커스 유실) ──
interface FormModalProps {
  title: string;
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  password: string;
  setPassword: (v: string) => void;
  saving: boolean;
  error: string;
  onSave: () => void;
  onClose: () => void;
}

function FormModal({ title, form, setForm, password, setPassword, saving, error, onSave, onClose }: FormModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="pixel-panel w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-pixel font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="text-dim hover:text-ink text-xl leading-none">&times;</button>
        </div>

        {([
          { label: "닉네임", key: "nickname", type: "text" },
          { label: "직업", key: "job", type: "text" },
          { label: "레벨", key: "level", type: "number" },
        ] as const).map(({ label, key, type }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-dim mb-1">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="pixel-input w-full px-3 py-2 text-sm"
            />
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-dim mb-1">직책</label>
          <select
            value={form.rank}
            onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))}
            className="pixel-input w-full px-3 py-2 text-sm"
          >
            {RANKS.slice(1).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-dim mb-1">메모 (선택)</label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="pixel-input w-full px-3 py-2 text-sm"
            placeholder="선택 입력"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-dim mb-1">관리자 비밀번호</label>
          <input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pixel-input w-full px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-red-500 text-xs">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="pixel-btn flex-1 py-2 text-sm">
            취소
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="pixel-btn flex-1 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────

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

  // level inline edit
  const [editingLevel, setEditingLevel] = useState<{ id: number; value: string } | null>(null);
  const [savingLevel, setSavingLevel] = useState(false);
  const levelInputRef = useRef<HTMLInputElement>(null);

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
    if (editingLevel) levelInputRef.current?.focus();
  }, [editingLevel]);

  useEffect(() => {
    if (editingAlias) aliasInputRef.current?.focus();
  }, [editingAlias]);

  function handleColumnSort(field: SortField) {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortField(DEFAULT_SORT.field); setSortDir(DEFAULT_SORT.dir); }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const QUICK_SORTS: { label: string; field: SortField; dir: SortDir }[] = [
    { label: "레벨순", field: "level", dir: "desc" },
    { label: "닉네임순", field: "nickname", dir: "asc" },
    { label: "직책순", field: "rank", dir: "asc" },
    { label: "직업순", field: "job", dir: "asc" },
  ];

  const filtered = allMembers.filter((m) => rankFilter === "전체" || m.rank === rankFilter);
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === "rank") cmp = (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99);
    else if (sortField === "level") cmp = a.level - b.level;
    else if (sortField === "nickname") cmp = a.nickname.localeCompare(b.nickname, "ko");
    else if (sortField === "job") cmp = a.job.localeCompare(b.job, "ko");
    return sortDir === "asc" ? cmp : -cmp;
  });

  const rankCounts = RANKS.slice(1).reduce<Record<string, number>>((acc, r) => {
    acc[r] = allMembers.filter((m) => m.rank === r).length;
    return acc;
  }, {});
  const avgLevel = allMembers.length
    ? Math.round(allMembers.reduce((s, m) => s + m.level, 0) / allMembers.length)
    : 0;

  async function saveLevel() {
    if (!editingLevel) return;
    const num = parseInt(editingLevel.value, 10);
    if (isNaN(num) || num < 1) { setEditingLevel(null); return; }
    setSavingLevel(true);
    try {
      const updated = await updateGuildMemberLevel(editingLevel.id, num);
      setAllMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch { /* silent */ } finally {
      setSavingLevel(false);
      setEditingLevel(null);
    }
  }

  async function saveAlias() {
    if (!editingAlias) return;
    setSavingAlias(true);
    try {
      const updated = await updateGuildMemberAlias(editingAlias.id, editingAlias.value);
      setAllMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch { /* silent */ } finally {
      setSavingAlias(false);
      setEditingAlias(null);
    }
  }

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

  const modalCommonProps = { form, setForm, password, setPassword, saving, error: modalError, onSave: handleSave };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-pixel text-2xl font-bold text-ink">추억길드 길드원 명단</h1>
          <p className="text-sm text-dim mt-0.5">총 {allMembers.length}명</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdminMode((v) => !v)}
            className={`font-pixel px-3 py-1.5 text-xs font-medium transition-colors ${
              adminMode ? "pixel-btn" : "border-2 border-edge text-dim hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
            }`}
          >
            {adminMode ? "관리자 모드 ON" : "관리자 모드"}
          </button>
          {adminMode && (
            <button
              onClick={() => { setForm({ ...EMPTY_FORM }); setModalError(""); setShowAddModal(true); }}
              className="pixel-btn px-3 py-1.5 text-xs font-medium"
            >
              + 추가
            </button>
          )}
        </div>
      </div>

      {/* Admin password */}
      {adminMode && (
        <div className="flex items-center gap-2 bg-[color-mix(in_srgb,var(--c-maple)_14%,transparent)] border-2 border-maple px-4 py-3">
          <span className="text-xs text-maple font-medium shrink-0">관리자 비밀번호</span>
          <input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            className="flex-1 text-sm border-none bg-transparent outline-none text-ink"
          />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="pixel-panel p-4 text-center">
          <p className="font-pixel text-2xl font-bold text-maple">{allMembers.length}</p>
          <p className="font-pixel text-xs text-dim mt-0.5">전체</p>
        </div>
        <div className="pixel-panel p-4 text-center">
          <p className="font-pixel text-2xl font-bold text-ink">{avgLevel}</p>
          <p className="font-pixel text-xs text-dim mt-0.5">평균 레벨</p>
        </div>
        <div className="pixel-panel p-4 col-span-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center h-full items-center">
            {RANKS.slice(1).map((r) => (
              <span key={r} className="text-xs text-dim">
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
            className={`font-pixel px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              rankFilter === r ? "pixel-btn rounded-full" : "bg-surface2 text-dim hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
            }`}
          >
            {r} ({r === "전체" ? allMembers.length : (rankCounts[r] ?? 0)})
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <span className="font-pixel text-xs text-dim">정렬:</span>
          {QUICK_SORTS.map(({ label, field, dir }) => (
            <button
              key={label}
              onClick={() => { setSortField(field); setSortDir(dir); }}
              className={`font-pixel px-2.5 py-1 text-xs font-medium transition-colors ${
                sortField === field && sortDir === dir
                  ? "pixel-btn"
                  : "bg-surface2 text-dim hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="pixel-panel overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-dim text-sm">불러오는 중...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-dim text-sm">길드원이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface2 border-b-2 border-edge/40">
                  {(["rank", "job", "level", "nickname"] as SortField[]).map((field) => {
                    const labels: Record<SortField, string> = { rank: "직책", job: "직업", level: "레벨", nickname: "닉네임" };
                    return (
                      <th
                        key={field}
                        onClick={() => handleColumnSort(field)}
                        className={`font-pixel px-4 py-3 text-xs font-semibold text-dim cursor-pointer select-none hover:text-ink hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] transition-colors ${
                          field === "level" || field === "nickname" ? "text-right" : "text-left"
                        }`}
                      >
                        {labels[field]}
                        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
                      </th>
                    );
                  })}
                  <th className="font-pixel px-4 py-3 text-xs font-semibold text-dim text-left">
                    별명 <span className="font-normal text-dim">(클릭해서 수정)</span>
                  </th>
                  {adminMode && (
                    <th className="font-pixel px-4 py-3 text-xs font-semibold text-dim text-right">관리</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/40">
                {sorted.map((m) => (
                  <tr key={m.id} className="hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)] transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${RANK_BADGE[m.rank] ?? "bg-surface2 text-dim"}`}>
                        {m.rank}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-dim">{m.job}</td>
                    <td className="px-4 py-2.5 text-right">
                      {editingLevel?.id === m.id ? (
                        <input
                          ref={levelInputRef}
                          type="number"
                          value={editingLevel.value}
                          onChange={(e) => setEditingLevel({ id: m.id, value: e.target.value })}
                          onBlur={saveLevel}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) saveLevel();
                            if (e.key === "Escape") setEditingLevel(null);
                          }}
                          disabled={savingLevel}
                          className="pixel-input w-16 text-right px-1.5 py-0.5 text-sm font-mono"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingLevel({ id: m.id, value: String(m.level) })}
                          className="font-mono text-ink hover:text-maple hover:underline"
                        >
                          {m.level}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink">
                      {m.nickname}
                      {m.note && <span className="ml-1 text-xs text-dim">({m.note})</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {editingAlias?.id === m.id ? (
                        <input
                          ref={aliasInputRef}
                          value={editingAlias.value}
                          onChange={(e) => setEditingAlias({ id: m.id, value: e.target.value })}
                          onBlur={saveAlias}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) saveAlias();
                            if (e.key === "Escape") setEditingAlias(null);
                          }}
                          disabled={savingAlias}
                          className="pixel-input w-full px-2 py-0.5 text-sm"
                          placeholder="별명 입력..."
                        />
                      ) : (
                        <button
                          onClick={() => setEditingAlias({ id: m.id, value: m.alias ?? "" })}
                          className="text-left text-sm text-dim hover:text-maple hover:underline min-w-[60px]"
                        >
                          {m.alias ?? <span className="text-dim">—</span>}
                        </button>
                      )}
                    </td>
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

      <p className="text-xs text-dim text-center">
        메이플랜드 공식 API 미제공으로 스크린샷 기반 수동 업데이트됩니다. · 별명/레벨은 누구나 수정 가능합니다.
      </p>

      {showAddModal && (
        <FormModal
          {...modalCommonProps}
          title="길드원 추가"
          onClose={() => { setShowAddModal(false); setModalError(""); }}
        />
      )}
      {editTarget && (
        <FormModal
          {...modalCommonProps}
          title={`${editTarget.nickname} 수정`}
          onClose={() => { setEditTarget(null); setModalError(""); }}
        />
      )}
    </div>
  );
}
