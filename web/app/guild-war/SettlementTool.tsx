"use client";

// 길드대항전 분배금 정산기 — 트라이별 참여 체크 + 드랍 아이템 + 시세만 입력하면
// 거래 수수료(5%)와 송금 수수료(5%)를 반영해 인원별 송금액을 자동 계산한다.
import { useEffect, useMemo, useState } from "react";
import { itemIcon } from "@/components/ItemChip";
import { GW_ITEM_NAME, SETTLE_ITEM_GROUPS } from "./dropData";

const STORAGE_KEY = "guild-war-settlement";
const SALE_FEE = 0.05; // 경매장 판매 수수료
const TRANSFER_FEE = 0.05; // 메소 송금 수수료
const MAX_TRIES = 30;
const MIN_TRIES = 1;
const INVALID_DROP_KEYS = new Set(["나리케인의 징표"]);

type Person = { id: string; name: string; tr: number[] };
type SettleState = {
  tries: number;
  people: Person[];
  drops: string[][]; // drops[트라이] = 아이템 이름 배열
  prices: Record<string, string>; // 아이템 이름 → 판매금액 입력값
};

const DEFAULT_STATE: SettleState = { tries: 10, people: [], drops: [], prices: {} };

function normalizeState(raw: unknown): SettleState {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<SettleState>;
  const tries = Math.min(MAX_TRIES, Math.max(MIN_TRIES, Number(s.tries) || DEFAULT_STATE.tries));
  const people = Array.isArray(s.people)
    ? s.people
        .filter((p): p is Person => !!p && typeof p.name === "string")
        .map((p, i) => ({
          id: typeof p.id === "string" && p.id ? p.id : `legacy-${i}-${p.name}`,
          name: p.name,
          tr: Array.from({ length: MAX_TRIES }, (_, i) => (Array.isArray(p.tr) && p.tr[i] ? 1 : 0)),
        }))
    : [];
  const drops = Array.from({ length: MAX_TRIES }, (_, i) => {
    const arr = Array.isArray(s.drops) ? s.drops[i] : null;
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string" && !INVALID_DROP_KEYS.has(x))
      : [];
  });
  const prices: Record<string, string> = {};
  if (s.prices && typeof s.prices === "object") {
    for (const [k, v] of Object.entries(s.prices)) {
      if (INVALID_DROP_KEYS.has(k)) continue;
      if (typeof v === "string" || typeof v === "number") prices[k] = String(v);
    }
  }
  return { tries, people, drops, prices };
}

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

export default function SettlementTool() {
  const [state, setState] = useState<SettleState>(() => normalizeState(DEFAULT_STATE));
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedTry, setSelectedTry] = useState(0);
  const [dragOverTry, setDragOverTry] = useState<number | null>(null);
  const [draggedPersonId, setDraggedPersonId] = useState<string | null>(null);
  const [personDragOverId, setPersonDragOverId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(normalizeState(JSON.parse(raw)));
    } catch {
      /* 저장값이 깨졌다면 기본값 사용 */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, loaded]);

  const { tries, people, drops, prices } = state;
  const tryIdx = useMemo(() => Array.from({ length: tries }, (_, i) => i), [tries]);
  const itemNames = Object.keys(prices);

  // 드랍테이블에 없는 커스텀 아이템(직접 입력분)도 드롭다운에 계속 노출
  const knownKeys = useMemo(() => new Set(SETTLE_ITEM_GROUPS.flatMap((g) => g.items.map((i) => i.key))), []);
  const customKeys = itemNames.filter((k) => !knownKeys.has(k));

  // 아이템 실수령가 (판매금액 - 판매 수수료 5%)
  const netPrice = (item: string): number | null => {
    const v = parseFloat(prices[item]);
    return isNaN(v) || v <= 0 ? null : v * (1 - SALE_FEE);
  };
  // 트라이별 참여 인원 / 분배 총액
  const cntTr = (t: number) => people.reduce((a, p) => a + (p.tr[t] ? 1 : 0), 0);
  const totTr = (t: number) => drops[t].reduce((a, x) => a + (netPrice(x) ?? 0), 0);
  // 인원별 분배 합계 (송금 수수료 공제 전)
  const shareOf = (p: Person) =>
    tryIdx.reduce((sum, t) => {
      const c = cntTr(t);
      const tot = totTr(t);
      return p.tr[t] && c > 0 && tot > 0 ? sum + tot / c : sum;
    }, 0);

  // 드랍 표에 보여줄 슬롯 수: 실제 입력된 최대 개수 + 1 (최소 3)
  const slotCount = Math.max(3, ...tryIdx.map((t) => drops[t].length)) + 1;

  useEffect(() => {
    if (selectedTry >= tries) setSelectedTry(tries - 1);
  }, [selectedTry, tries]);

  function addPerson() {
    const name = newName.trim();
    if (!name) return;
    if (people.some((p) => p.name === name)) return;
    setState({
      ...state,
      people: [
        ...people,
        { id: `person-${Date.now()}-${Math.random().toString(36).slice(2)}`, name, tr: Array(MAX_TRIES).fill(0) },
      ],
    });
    setNewName("");
  }

  function movePerson(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setState((current) => {
      const sourceIndex = current.people.findIndex((person) => person.id === sourceId);
      const targetIndex = current.people.findIndex((person) => person.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const nextPeople = [...current.people];
      const [moved] = nextPeople.splice(sourceIndex, 1);
      nextPeople.splice(targetIndex, 0, moved);
      return { ...current, people: nextPeople };
    });
    setDraggedPersonId(null);
    setPersonDragOverId(null);
  }

  function movePersonByOffset(personId: string, offset: number) {
    setState((current) => {
      const sourceIndex = current.people.findIndex((person) => person.id === personId);
      const targetIndex = sourceIndex + offset;
      if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= current.people.length) return current;
      const nextPeople = [...current.people];
      const [moved] = nextPeople.splice(sourceIndex, 1);
      nextPeople.splice(targetIndex, 0, moved);
      return { ...current, people: nextPeople };
    });
  }

  function sortPeople(mode: string) {
    const joinedCount = (person: Person) => tryIdx.reduce((count, t) => count + (person.tr[t] ? 1 : 0), 0);
    setState((current) => {
      const nextPeople = [...current.people];
      nextPeople.sort((a, b) => {
        if (mode === "name-asc") return a.name.localeCompare(b.name, "ko");
        if (mode === "name-desc") return b.name.localeCompare(a.name, "ko");
        if (mode === "joined-desc") return joinedCount(b) - joinedCount(a);
        if (mode === "payment-desc") return shareOf(b) - shareOf(a);
        if (mode === "payment-asc") return shareOf(a) - shareOf(b);
        return 0;
      });
      return { ...current, people: nextPeople };
    });
  }

  function setDrop(t: number, slot: number, value: string) {
    const val = value.trim();
    const next = drops.map((arr, i) => (i === t ? [...arr] : arr));
    while (next[t].length <= slot) next[t].push("");
    next[t][slot] = val;
    while (next[t].length && !next[t][next[t].length - 1]) next[t].pop();
    const nextPrices = { ...prices };
    if (val && !(val in nextPrices)) nextPrices[val] = "";
    setState({ ...state, drops: next, prices: nextPrices });
  }

  function addDrop(t: number, item: string) {
    const emptySlot = drops[t].findIndex((value) => !value);
    setDrop(t, emptySlot === -1 ? drops[t].length : emptySlot, item);
    setSelectedTry(t);
  }

  function dropItem(t: number, value: string) {
    if (knownKeys.has(value)) addDrop(t, value);
    setDragOverTry(null);
  }

  function copySummary() {
    const lines = [`⚔️ 길드대항전 분배 정산 (${tries}트 기준)`];
    const active = people.filter((p) => shareOf(p) > 0);
    for (const p of active) {
      const share = shareOf(p);
      const net = share * (1 - TRANSFER_FEE);
      const joined = tryIdx.filter((t) => p.tr[t]).length;
      lines.push(`- ${p.name}: ${fmt(net)} 메소 (${joined}트 참여)`);
    }
    const gross = active.reduce((a, p) => a + shareOf(p), 0);
    lines.push(`합계(송금 수수료 공제 후): ${fmt(gross * (1 - TRANSFER_FEE))} 메소`);
    navigator.clipboard?.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function resetAll() {
    if (!confirm("모든 입력을 지우고 처음부터 시작할까요?")) return;
    setState(normalizeState(DEFAULT_STATE));
  }

  if (!loaded) return <div className="pixel-panel p-5 text-sm text-dim">불러오는 중…</div>;

  const anyShare = people.some((p) => shareOf(p) > 0);

  return (
    <div className="space-y-4">
      {/* 설정 줄 */}
      <section className="pixel-panel p-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-xs text-dim">트라이 수</span>
          <button
            type="button"
            onClick={() => setState({ ...state, tries: Math.max(MIN_TRIES, tries - 1) })}
            className="w-8 h-8 border-2 border-edge font-pixel text-dim hover:text-maple transition-colors"
          >
            −
          </button>
          <span className="font-pixel text-sm text-ink w-10 text-center">{tries}트</span>
          <button
            type="button"
            onClick={() => setState({ ...state, tries: Math.min(MAX_TRIES, tries + 1) })}
            className="w-8 h-8 border-2 border-edge font-pixel text-dim hover:text-maple transition-colors"
          >
            +
          </button>
        </div>
        <span className="text-xs text-dim">
          계산 흐름: 판매금액 × {(1 - SALE_FEE) * 100}% (판매 수수료) → 트별 총액 ÷ 참여 인원 → 개인 합계 ×{" "}
          {(1 - TRANSFER_FEE) * 100}% (송금 수수료) = <b className="text-maple">💰 송금액</b>
        </span>
        <span className="text-xs text-dim ml-auto">입력 내용은 이 브라우저에 자동 저장됩니다</span>
        <button
          type="button"
          onClick={resetAll}
          className="px-3 py-1.5 text-xs font-pixel border-2 border-edge text-dim hover:text-mush transition-colors"
        >
          초기화
        </button>
      </section>

      {/* ① 참여 현황 */}
      <section className="pixel-panel p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-pixel text-sm text-ink">
            ① 참여 현황{" "}
            <span className="text-xs text-dim font-normal">— 칸을 눌러 참여/불참 전환 · 손잡이로 순서 변경</span>
          </h2>
          {people.length > 1 && (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) sortPeople(e.target.value);
                e.target.value = "";
              }}
              className="ml-auto px-2 py-1 text-xs bg-surface2 border-2 border-edge focus:border-maple outline-none"
              aria-label="참여자 정렬"
            >
              <option value="" disabled>
                정렬 적용…
              </option>
              <option value="name-asc">가나다순</option>
              <option value="name-desc">가나다 역순</option>
              <option value="joined-desc">참여 횟수 많은 순</option>
              <option value="payment-desc">송금액 높은 순</option>
              <option value="payment-asc">송금액 낮은 순</option>
            </select>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="text-sm whitespace-nowrap">
            <thead>
              <tr className="text-dim border-b-2 border-edge">
                <th className="w-8" aria-label="순서 변경" />
                <th className="text-left py-1.5 pr-3 min-w-[7rem]">닉네임</th>
                {tryIdx.map((t) => (
                  <th key={t} className="px-1 font-normal text-xs">
                    {t + 1}트
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {people.map((p, i) => (
                <tr
                  key={p.id}
                  onDragOver={(e) => {
                    if (!draggedPersonId || draggedPersonId === p.id) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setPersonDragOverId(p.id);
                  }}
                  onDragLeave={() => setPersonDragOverId((current) => (current === p.id ? null : current))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sourceId = e.dataTransfer.getData("application/x-guild-war-person") || draggedPersonId;
                    if (sourceId) movePerson(sourceId, p.id);
                  }}
                  className={`border-b border-edge/40 transition-colors ${
                    personDragOverId === p.id ? "bg-maple/10" : ""
                  }`}
                >
                  <td className="pr-1 text-center">
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        setDraggedPersonId(p.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("application/x-guild-war-person", p.id);
                      }}
                      onDragEnd={() => {
                        setDraggedPersonId(null);
                        setPersonDragOverId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          movePersonByOffset(p.id, -1);
                        }
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          movePersonByOffset(p.id, 1);
                        }
                      }}
                      className="w-7 h-8 text-dim/60 hover:text-maple cursor-grab active:cursor-grabbing transition-colors"
                      title="드래그하거나 위·아래 방향키로 순서 변경"
                      aria-label={`${p.name || `참여자 ${i + 1}`} 순서 변경`}
                    >
                      ⠿
                    </button>
                  </td>
                  <td className="py-1 pr-3">
                    <input
                      value={p.name}
                      onChange={(e) =>
                        setState({
                          ...state,
                          people: people.map((q, j) => (j === i ? { ...q, name: e.target.value } : q)),
                        })
                      }
                      className="w-28 bg-transparent border-b border-edge focus:border-maple outline-none font-bold"
                      aria-label={`참여자 ${i + 1} 닉네임`}
                    />
                  </td>
                  {tryIdx.map((t) => (
                    <td key={t} className="px-0.5 py-1 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setState({
                            ...state,
                            people: people.map((q, j) =>
                              j === i ? { ...q, tr: q.tr.map((v, k) => (k === t ? (v ? 0 : 1) : v)) } : q,
                            ),
                          })
                        }
                        className={`w-8 h-8 border-2 transition-colors ${
                          p.tr[t]
                            ? "border-maple bg-maple/10 text-maple font-bold"
                            : "border-edge text-dim/40 hover:text-maple"
                        }`}
                        aria-label={`${p.name} ${t + 1}트 참여 토글`}
                      >
                        {p.tr[t] ? "✓" : ""}
                      </button>
                    </td>
                  ))}
                  <td className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`${p.name || "이 참여자"} 삭제?`))
                          setState({ ...state, people: people.filter((_, j) => j !== i) });
                      }}
                      className="text-dim/50 hover:text-mush transition-colors"
                      aria-label={`${p.name} 삭제`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {people.length > 0 && (
                <tr className="font-bold text-xs text-dim">
                  <td />
                  <td className="py-1.5 pr-3">인원</td>
                  {tryIdx.map((t) => (
                    <td key={t} className="text-center">
                      {cntTr(t) || ""}
                    </td>
                  ))}
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) addPerson();
            }}
            placeholder="닉네임 입력"
            className="pixel-input px-3 py-1.5 text-sm w-40"
          />
          <button type="button" onClick={addPerson} className="pixel-btn px-4 py-1.5 text-xs font-pixel">
            + 참여자 추가
          </button>
        </div>
      </section>

      {/* ② 드랍 아이템 */}
      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-sm text-ink">
          ② 드랍 아이템{" "}
          <span className="text-xs text-dim font-normal">— 트라이별로 드랍템 선택 (시세표에 자동 등록)</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="text-sm whitespace-nowrap">
            <thead>
              <tr className="text-dim border-b-2 border-edge">
                <th className="w-8" />
                {tryIdx.map((t) => (
                  <th
                    key={t}
                    className={`px-1 py-1 font-normal text-xs min-w-[5.5rem] transition-colors ${
                      selectedTry === t ? "bg-maple/10 text-maple" : ""
                    }`}
                  >
                    <button type="button" onClick={() => setSelectedTry(t)} className="w-full py-1 font-pixel">
                      {t + 1}트
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-edge">
                <td className="text-[10px] text-dim pr-2 text-right">추가</td>
                {tryIdx.map((t) => (
                  <td key={t} className="px-0.5 py-1">
                    <button
                      type="button"
                      onClick={() => setSelectedTry(t)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                        setDragOverTry(t);
                      }}
                      onDragLeave={() => setDragOverTry((current) => (current === t ? null : current))}
                      onDrop={(e) => {
                        e.preventDefault();
                        dropItem(t, e.dataTransfer.getData("text/plain"));
                      }}
                      className={`w-[5.5rem] min-h-9 border-2 text-[10px] transition-colors ${
                        dragOverTry === t
                          ? "border-maple bg-maple/20 text-maple"
                          : selectedTry === t
                            ? "border-maple bg-maple/10 text-maple"
                            : "border-dashed border-edge text-dim hover:text-maple"
                      }`}
                      aria-label={`${t + 1}트 빠른 추가 대상으로 선택`}
                    >
                      {dragOverTry === t ? "여기에 놓기" : selectedTry === t ? "✓ 선택됨" : "클릭/드롭"}
                    </button>
                  </td>
                ))}
              </tr>
              {Array.from({ length: slotCount }, (_, s) => (
                <tr key={s} className="border-b border-edge/40">
                  <td className="text-xs text-dim/60 pr-2 text-right">{s + 1}</td>
                  {tryIdx.map((t) => {
                    const v = drops[t][s] || "";
                    return (
                      <td key={t} className="px-0.5 py-0.5">
                        <select
                          value={v}
                          onChange={(e) => {
                            if (e.target.value === "__custom") {
                              const name = prompt("아이템 이름 (직접 입력):");
                              if (name?.trim()) setDrop(t, s, name.trim());
                              else e.target.value = v;
                              return;
                            }
                            setDrop(t, s, e.target.value);
                          }}
                          title={v ? GW_ITEM_NAME[v] ?? v : undefined}
                          className={`w-[5.5rem] px-1 py-1 text-xs bg-surface2 border border-edge focus:border-maple outline-none ${
                            v ? "text-ink" : "text-dim/60"
                          }`}
                          aria-label={`${t + 1}트 드랍 ${s + 1}`}
                        >
                          <option value="">−</option>
                          {SETTLE_ITEM_GROUPS.map((g) => (
                            <optgroup key={g.label} label={g.label}>
                              {g.items.map((it) => (
                                <option key={it.key} value={it.key} title={it.name}>
                                  {it.key}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          {customKeys.length > 0 && (
                            <optgroup label="직접 입력한 아이템">
                              {customKeys.map((k) => (
                                <option key={k} value={k}>
                                  {k}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {v && !knownKeys.has(v) && !customKeys.includes(v) && <option value={v}>{v}</option>}
                          <option value="__custom">✏️ 직접 입력…</option>
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="font-bold text-xs">
                <td className="text-dim pr-2 text-right whitespace-nowrap">총액</td>
                {tryIdx.map((t) => {
                  const v = totTr(t);
                  return (
                    <td key={t} className="text-center text-maple py-1.5">
                      {v ? fmt(v) : ""}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-dim">
          약어에 마우스를 올리면 풀네임이 보입니다. 목록은 드랍테이블 탭과 동일 — 없는 아이템은 「직접 입력…」으로
          추가.
        </p>

        <div className="border-t-2 border-edge pt-4 space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="font-pixel text-xs text-ink">아이템 빠른 추가</h3>
            <p className="text-xs text-dim">
              클릭하면 <b className="text-maple">{selectedTry + 1}트</b>에 추가 · PC에서는 위 트라이 칸으로 드래그
            </p>
          </div>
          {SETTLE_ITEM_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <h4 className="text-xs font-bold text-dim">{group.label}</h4>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-1.5">
                {group.items.map((item) => {
                  const count = drops[selectedTry].filter((value) => value === item.key).length;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "copy";
                        e.dataTransfer.setData("text/plain", item.key);
                      }}
                      onDragEnd={() => setDragOverTry(null)}
                      onClick={() => addDrop(selectedTry, item.key)}
                      title={`${item.name} — 클릭 시 ${selectedTry + 1}트에 추가`}
                      className="relative min-h-[5.25rem] p-1.5 border-2 border-edge bg-surface2 hover:border-maple hover:bg-maple/10 transition-colors flex flex-col items-center justify-center gap-1 cursor-grab active:cursor-grabbing"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={itemIcon(item.itemId)}
                        alt=""
                        className="w-9 h-9 object-contain [image-rendering:pixelated] pointer-events-none"
                        loading="lazy"
                      />
                      <span className="text-[10px] font-bold leading-tight text-ink break-keep">{item.key}</span>
                      {count > 0 && (
                        <span className="absolute top-1 right-1 min-w-5 h-5 px-1 rounded-full bg-maple text-white text-[10px] font-bold leading-5">
                          ×{count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ③ 시세표 */}
      <section className="pixel-panel p-5 space-y-3">
        <h2 className="font-pixel text-sm text-ink">
          ③ 시세표 <span className="text-xs text-dim font-normal">— 판매금액만 입력하면 전부 자동 계산</span>
        </h2>
        {itemNames.length === 0 ? (
          <p className="text-sm text-dim">드랍 아이템을 입력하면 여기에 자동으로 나타납니다.</p>
        ) : (
          <div className="overflow-x-auto max-w-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-dim border-b-2 border-edge">
                  <th className="py-1.5">아이템</th>
                  <th className="text-right">판매금액</th>
                  <th className="text-right">수수료 제외</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {itemNames.map((it) => {
                  const n = netPrice(it);
                  return (
                    <tr key={it} className="border-b border-edge/40">
                      <td className="py-1">
                        <b>{it}</b>
                        {GW_ITEM_NAME[it] && GW_ITEM_NAME[it] !== it && (
                          <span className="block text-[11px] text-dim leading-tight">{GW_ITEM_NAME[it]}</span>
                        )}
                      </td>
                      <td className="text-right">
                        <input
                          type="number"
                          value={prices[it]}
                          onChange={(e) => setState({ ...state, prices: { ...prices, [it]: e.target.value } })}
                          placeholder="0"
                          className="w-28 px-2 py-1 text-right text-xs bg-surface2 border border-edge focus:border-maple outline-none"
                          aria-label={`${it} 판매금액`}
                        />
                      </td>
                      <td className="text-right text-dim tabular-nums">{n === null ? "" : fmt(n)}</td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...prices };
                            delete next[it];
                            setState({ ...state, prices: next });
                          }}
                          className="text-dim/50 hover:text-mush transition-colors"
                          aria-label={`${it} 삭제`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ④ 인원별 정산 */}
      <section className="pixel-panel p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-pixel text-sm text-ink">
            ④ 인원별 정산 <span className="text-xs text-dim font-normal">— 💰 송금액만 확인하면 끝</span>
          </h2>
          {anyShare && (
            <button type="button" onClick={copySummary} className="pixel-btn px-3 py-1.5 text-xs font-pixel">
              {copied ? "✓ 복사됨" : "📋 정산 결과 복사"}
            </button>
          )}
        </div>
        {people.length === 0 ? (
          <p className="text-sm text-dim">참여자를 먼저 추가해 주세요.</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <table className="min-w-max text-sm whitespace-nowrap">
              <thead>
                <tr className="text-dim border-b-2 border-edge">
                  <th className="text-left py-1.5 px-4 min-w-[8rem]">닉네임</th>
                  {tryIdx.map((t) => (
                    <th
                      key={t}
                      className="px-3 font-normal text-xs text-center min-w-[6.5rem] border-r border-edge/30"
                    >
                      {t + 1}트
                    </th>
                  ))}
                  <th className="px-4 text-xs text-right min-w-[8.5rem]">분배합계</th>
                  <th className="px-4 text-xs text-right min-w-[8.5rem]">송금 수수료</th>
                  <th className="px-4 text-xs text-right text-maple min-w-[8.5rem]">💰 송금액</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p, i) => {
                  const share = shareOf(p);
                  const fee = share * TRANSFER_FEE;
                  return (
                    <tr key={p.id} className="border-b border-edge/40 tabular-nums">
                      <td className="py-2 px-4 font-bold">{p.name}</td>
                      {tryIdx.map((t) => {
                        const c = cntTr(t);
                        const tot = totTr(t);
                        const v = p.tr[t] && c > 0 && tot > 0 ? tot / c : 0;
                        return (
                          <td key={t} className="min-w-[6.5rem] px-3 py-2 text-center text-xs text-dim border-r border-edge/30">
                            {v ? fmt(v) : ""}
                          </td>
                        );
                      })}
                      <td className="text-right px-4 font-bold">{share ? fmt(share) : ""}</td>
                      <td className="text-right px-4 text-dim text-xs">{share ? fmt(fee) : ""}</td>
                      <td className="text-right px-4 font-bold text-maple">{share ? fmt(share - fee) : ""}</td>
                    </tr>
                  );
                })}
                {anyShare && (
                  <tr className="font-bold tabular-nums text-xs">
                    <td className="py-2 px-4">합계</td>
                    {tryIdx.map((t) => {
                      const tot = totTr(t);
                      return (
                        <td key={t} className="min-w-[6.5rem] px-3 py-2 text-center text-dim border-r border-edge/30">
                          {tot ? fmt(tot) : ""}
                        </td>
                      );
                    })}
                    <td className="text-right px-4">{fmt(people.reduce((a, p) => a + shareOf(p), 0))}</td>
                    <td className="text-right px-4 text-dim">
                      {fmt(people.reduce((a, p) => a + shareOf(p) * TRANSFER_FEE, 0))}
                    </td>
                    <td className="text-right px-4 text-maple">
                      {fmt(people.reduce((a, p) => a + shareOf(p) * (1 - TRANSFER_FEE), 0))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {people.length > 0 && (
          <p className="text-xs text-dim">각 금액 칸의 최소 폭을 유지하며, 트라이가 많으면 표를 좌우로 스크롤할 수 있습니다.</p>
        )}
      </section>
    </div>
  );
}
