"use client";

// 길드대항전 분배금 정산기 — 트라이별 참여 체크 + 드랍 아이템 + 시세만 입력하면
// 거래 수수료(5%)와 송금 수수료(5%)를 반영해 인원별 송금액을 자동 계산한다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { itemIcon } from "@/components/ItemChip";
import { GW_ITEM_NAME, SETTLE_ITEM_GROUPS } from "./dropData";

const STORAGE_KEY = "guild-war-settlement";
const LEDGERS_STORAGE_KEY = "guild-war-settlement-ledgers-v1";
const LEDGER_DRAFT_META_KEY = "guild-war-settlement-ledger-draft-meta-v1";
const SALE_FEE = 0.05; // 경매장 판매 수수료
const TRANSFER_FEE = 0.05; // 메소 송금 수수료
const MAX_TRIES = 30;
const MIN_TRIES = 1;
const INVALID_DROP_KEYS = new Set(["나리케인의 징표"]);

type Person = { id: string; name: string; tr: number[] };
type SaleStatus = "unlisted" | "listed" | "sold";
type AttendancePaint = { pointerId: number; value: 0 | 1; visited: Set<string> };
type DropEntry = {
  id: string;
  item: string;
  price: string;
  saleStatus: SaleStatus;
  priceUpdatedAt: string;
};
type SettleState = {
  tries: number;
  people: Person[];
  drops: DropEntry[][]; // 동일 아이템도 개별 판매가·상태를 갖는 드랍 인스턴스
  soldOnly: boolean;
};

type LedgerStatus = "selling" | "settled";
type SettlementLedger = {
  id: string;
  title: string;
  eventDate: string;
  manager: string;
  status: LedgerStatus;
  createdAt: string;
  updatedAt: string;
  state: SettleState;
};

const DEFAULT_STATE: SettleState = {
  tries: 10,
  people: [],
  drops: [],
  soldOnly: false,
};

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatDateWithDay(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const day = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(parsed);
  return `${date.replaceAll("-", ".")} (${day})`;
}

function formatUpdatedAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function normalizeState(raw: unknown): SettleState {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const tries = Math.min(MAX_TRIES, Math.max(MIN_TRIES, Number(s.tries) || DEFAULT_STATE.tries));
  const rawPeople = Array.isArray(s.people) ? s.people : [];
  const people = rawPeople
    .filter(
      (p): p is { id?: unknown; name: string; tr?: unknown } =>
        !!p && typeof p === "object" && typeof (p as { name?: unknown }).name === "string",
    )
    .map((p, i) => ({
      id: typeof p.id === "string" && p.id ? p.id : `legacy-${i}-${p.name}`,
      name: p.name,
      tr: Array.from({ length: MAX_TRIES }, (_, i) => (Array.isArray(p.tr) && p.tr[i] ? 1 : 0)),
    }));
  const legacyPrices = s.prices && typeof s.prices === "object" ? (s.prices as Record<string, unknown>) : {};
  const legacyStatuses =
    s.saleStatuses && typeof s.saleStatuses === "object" ? (s.saleStatuses as Record<string, unknown>) : {};
  const legacyUpdatedAt =
    s.priceUpdatedAt && typeof s.priceUpdatedAt === "object" ? (s.priceUpdatedAt as Record<string, unknown>) : {};
  const drops = Array.from({ length: MAX_TRIES }, (_, i) => {
    const arr = Array.isArray(s.drops) ? s.drops[i] : null;
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((value, slot): DropEntry[] => {
      const legacyItem = typeof value === "string" ? value : "";
      const entry = value && typeof value === "object" ? (value as Partial<DropEntry>) : null;
      const item = legacyItem || (typeof entry?.item === "string" ? entry.item : "");
      if (!item || INVALID_DROP_KEYS.has(item)) return [];
      const legacyPrice = legacyPrices[item];
      const price =
        typeof entry?.price === "string" || typeof entry?.price === "number"
          ? String(entry.price)
          : typeof legacyPrice === "string" || typeof legacyPrice === "number"
            ? String(legacyPrice)
            : "";
      const rawStatus = entry?.saleStatus ?? legacyStatuses[item];
      const saleStatus: SaleStatus =
        rawStatus === "sold" || rawStatus === "listed" || rawStatus === "unlisted"
          ? rawStatus
          : price
            ? "listed"
            : "unlisted";
      const rawUpdatedAt = entry?.priceUpdatedAt ?? legacyUpdatedAt[item];
      return [
        {
          id: typeof entry?.id === "string" && entry.id ? entry.id : `drop-${i}-${slot}-${item}`,
          item,
          price,
          saleStatus,
          priceUpdatedAt: typeof rawUpdatedAt === "string" ? rawUpdatedAt : "",
        },
      ];
    });
  });
  return { tries, people, drops, soldOnly: s.soldOnly === true };
}

function normalizeLedger(raw: unknown, index: number): SettlementLedger | null {
  if (!raw || typeof raw !== "object") return null;
  const ledger = raw as Partial<SettlementLedger>;
  if (!ledger.state || typeof ledger.state !== "object") return null;
  const now = new Date().toISOString();
  return {
    id: typeof ledger.id === "string" && ledger.id ? ledger.id : `imported-${Date.now()}-${index}`,
    title: typeof ledger.title === "string" && ledger.title.trim() ? ledger.title.trim() : "길드대항전 정산",
    eventDate:
      typeof ledger.eventDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ledger.eventDate)
        ? ledger.eventDate
        : todayLocal(),
    manager: typeof ledger.manager === "string" ? ledger.manager : "",
    status: ledger.status === "settled" ? "settled" : "selling",
    createdAt: typeof ledger.createdAt === "string" ? ledger.createdAt : now,
    updatedAt: typeof ledger.updatedAt === "string" ? ledger.updatedAt : now,
    state: normalizeState(ledger.state),
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

export default function SettlementTool() {
  const [state, setState] = useState<SettleState>(() => normalizeState(DEFAULT_STATE));
  const [ledgers, setLedgers] = useState<SettlementLedger[]>([]);
  const [activeLedgerId, setActiveLedgerId] = useState<string | null>(null);
  const [ledgerTitle, setLedgerTitle] = useState("");
  const [eventDate, setEventDate] = useState(todayLocal);
  const [manager, setManager] = useState("");
  const [ledgerStatus, setLedgerStatus] = useState<LedgerStatus>("selling");
  const [saveNotice, setSaveNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedTry, setSelectedTry] = useState(0);
  const [dragOverTry, setDragOverTry] = useState<number | null>(null);
  const [draggedPersonId, setDraggedPersonId] = useState<string | null>(null);
  const [personDragOverId, setPersonDragOverId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const attendancePaintRef = useRef<AttendancePaint | null>(null);
  const paintAttendance = useCallback((personId: string, tryIndex: number, value: 0 | 1) => {
    setState((current) => {
      const personIndex = current.people.findIndex((person) => person.id === personId);
      if (personIndex < 0 || tryIndex < 0 || tryIndex >= current.tries) return current;
      const person = current.people[personIndex];
      if (person.tr[tryIndex] === value) return current;
      const nextPeople = [...current.people];
      const nextTries = [...person.tr];
      nextTries[tryIndex] = value;
      nextPeople[personIndex] = { ...person, tr: nextTries };
      return { ...current, people: nextPeople };
    });
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(normalizeState(JSON.parse(raw)));
    } catch {
      /* 작성 중 장부가 깨졌다면 기본값 사용 */
    }
    try {
      const savedLedgers = localStorage.getItem(LEDGERS_STORAGE_KEY);
      if (savedLedgers) {
        const parsed = JSON.parse(savedLedgers);
        if (Array.isArray(parsed)) {
          setLedgers(parsed.map(normalizeLedger).filter((ledger): ledger is SettlementLedger => ledger !== null));
        }
      }
    } catch {
      /* 저장 장부가 깨졌다면 빈 목록 사용 */
    }
    try {
      const draftMeta = localStorage.getItem(LEDGER_DRAFT_META_KEY);
      if (draftMeta) {
        const meta = JSON.parse(draftMeta) as Partial<SettlementLedger>;
        if (typeof meta.id === "string") setActiveLedgerId(meta.id);
        if (typeof meta.title === "string") setLedgerTitle(meta.title);
        if (typeof meta.eventDate === "string") setEventDate(meta.eventDate);
        if (typeof meta.manager === "string") setManager(meta.manager);
        if (meta.status === "selling" || meta.status === "settled") setLedgerStatus(meta.status);
      }
    } catch {
      /* 장부 메타데이터가 깨졌다면 기본값 사용 */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(
        LEDGER_DRAFT_META_KEY,
        JSON.stringify({ id: activeLedgerId, title: ledgerTitle, eventDate, manager, status: ledgerStatus }),
      );
    } catch {
      /* ignore */
    }
  }, [state, activeLedgerId, ledgerTitle, eventDate, manager, ledgerStatus, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(LEDGERS_STORAGE_KEY, JSON.stringify(ledgers));
    } catch {
      /* ignore */
    }
  }, [ledgers, loaded]);

  useEffect(() => {
    const paintCellAtPointer = (event: PointerEvent) => {
      const paint = attendancePaintRef.current;
      if (!paint || paint.pointerId !== event.pointerId) return;
      event.preventDefault();
      const cell = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-attendance-person][data-attendance-try]");
      const personId = cell?.dataset.attendancePerson;
      const tryValue = Number(cell?.dataset.attendanceTry);
      if (!personId || !Number.isInteger(tryValue)) return;
      const key = `${personId}:${tryValue}`;
      if (paint.visited.has(key)) return;
      paint.visited.add(key);
      paintAttendance(personId, tryValue, paint.value);
    };
    const stopPainting = (event: PointerEvent) => {
      if (attendancePaintRef.current?.pointerId === event.pointerId) attendancePaintRef.current = null;
    };
    window.addEventListener("pointermove", paintCellAtPointer, { passive: false });
    window.addEventListener("pointerup", stopPainting);
    window.addEventListener("pointercancel", stopPainting);
    return () => {
      window.removeEventListener("pointermove", paintCellAtPointer);
      window.removeEventListener("pointerup", stopPainting);
      window.removeEventListener("pointercancel", stopPainting);
    };
  }, [paintAttendance]);

  const { tries, people, drops } = state;
  const tryIdx = useMemo(() => Array.from({ length: tries }, (_, i) => i), [tries]);

  // 드랍테이블에 없는 커스텀 아이템(직접 입력분)도 드롭다운에 계속 노출
  const knownKeys = useMemo(() => new Set(SETTLE_ITEM_GROUPS.flatMap((g) => g.items.map((i) => i.key))), []);
  const dropRows = tryIdx
    .flatMap((tryIndex) => drops[tryIndex].map((entry, slot) => ({ entry, tryIndex, slot })))
    .sort(
      (a, b) =>
        (GW_ITEM_NAME[a.entry.item] ?? a.entry.item).localeCompare(GW_ITEM_NAME[b.entry.item] ?? b.entry.item, "ko") ||
        a.tryIndex - b.tryIndex ||
        a.slot - b.slot,
    );
  const customKeys = [...new Set(dropRows.map(({ entry }) => entry.item).filter((item) => !knownKeys.has(item)))];
  const activeLedger = ledgers.find((ledger) => ledger.id === activeLedgerId) ?? null;
  const isLedgerDirty = activeLedger
    ? activeLedger.title !== ledgerTitle ||
      activeLedger.eventDate !== eventDate ||
      activeLedger.manager !== manager ||
      activeLedger.status !== ledgerStatus ||
      JSON.stringify(activeLedger.state) !== JSON.stringify(state)
    : people.length > 0 || dropRows.length > 0 || ledgerTitle.trim().length > 0;
  const groupedLedgers = useMemo(() => {
    const groups = new Map<string, SettlementLedger[]>();
    for (const ledger of [...ledgers].sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.updatedAt.localeCompare(a.updatedAt))) {
      const group = groups.get(ledger.eventDate) ?? [];
      group.push(ledger);
      groups.set(ledger.eventDate, group);
    }
    return [...groups.entries()];
  }, [ledgers]);

  // 아이템 실수령가 (판매금액 - 판매 수수료 5%)
  const saleNetPrice = (entry: DropEntry): number | null => {
    const v = parseFloat(entry.price);
    return isNaN(v) || v <= 0 ? null : v * (1 - SALE_FEE);
  };
  const netPrice = (entry: DropEntry): number | null => {
    if (state.soldOnly && entry.saleStatus !== "sold") return null;
    return saleNetPrice(entry);
  };
  // 트라이별 참여 인원 / 분배 총액
  const cntTr = (t: number) => people.reduce((a, p) => a + (p.tr[t] ? 1 : 0), 0);
  const totTr = (t: number) => drops[t].reduce((total, entry) => total + (netPrice(entry) ?? 0), 0);
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

  function saveLedger() {
    const now = new Date().toISOString();
    const id = activeLedgerId ?? crypto.randomUUID();
    const title = ledgerTitle.trim() || `${formatDateWithDay(eventDate)} 길드대항전`;
    const saved: SettlementLedger = {
      id,
      title,
      eventDate,
      manager: manager.trim(),
      status: ledgerStatus,
      createdAt: activeLedger?.createdAt ?? now,
      updatedAt: now,
      state: normalizeState(state),
    };
    setLedgers((current) => {
      const index = current.findIndex((ledger) => ledger.id === id);
      if (index < 0) return [saved, ...current];
      return current.map((ledger) => (ledger.id === id ? saved : ledger));
    });
    setActiveLedgerId(id);
    setLedgerTitle(title);
    setSaveNotice(activeLedger ? "변경 내용을 저장했습니다." : "새 정산 장부를 저장했습니다.");
    setTimeout(() => setSaveNotice(""), 1800);
  }

  function startNewLedger(keepRoster: boolean) {
    if (isLedgerDirty && !confirm("현재 장부에 저장하지 않은 변경이 있습니다. 새 장부를 시작할까요?")) return;
    const next = normalizeState(DEFAULT_STATE);
    if (keepRoster) {
      next.tries = tries;
      next.people = people.map((person) => ({ ...person, id: crypto.randomUUID(), tr: Array(MAX_TRIES).fill(0) }));
    }
    setState(next);
    setActiveLedgerId(null);
    setLedgerTitle("");
    setEventDate(todayLocal());
    setLedgerStatus("selling");
    setSaveNotice(keepRoster ? "참여자 명단을 복사한 새 장부입니다." : "빈 장부를 시작했습니다.");
  }

  function loadLedger(ledger: SettlementLedger) {
    if (ledger.id !== activeLedgerId && isLedgerDirty && !confirm("현재 장부에 저장하지 않은 변경이 있습니다. 불러올까요?")) {
      return;
    }
    setState(normalizeState(ledger.state));
    setActiveLedgerId(ledger.id);
    setLedgerTitle(ledger.title);
    setEventDate(ledger.eventDate);
    setManager(ledger.manager);
    setLedgerStatus(ledger.status);
    setSaveNotice("저장된 장부를 불러왔습니다. 수정 후 다시 저장할 수 있습니다.");
  }

  function deleteLedger(ledger: SettlementLedger) {
    if (!confirm(`「${ledger.title}」 장부를 삭제할까요? 이 브라우저에서는 복구할 수 없습니다.`)) return;
    setLedgers((current) => current.filter((item) => item.id !== ledger.id));
    if (activeLedgerId === ledger.id) {
      setActiveLedgerId(null);
      setLedgerTitle("");
      setState(normalizeState(DEFAULT_STATE));
    }
  }

  function exportLedgers() {
    if (ledgers.length === 0) return;
    const payload = JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), ledgers }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `샤레니안-정산장부-${todayLocal()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importLedgers(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const rawLedgers = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { ledgers?: unknown }).ledgers)
          ? (parsed as { ledgers: unknown[] }).ledgers
          : [];
      const imported = rawLedgers
        .map(normalizeLedger)
        .filter((ledger): ledger is SettlementLedger => ledger !== null);
      if (imported.length === 0) throw new Error("장부 없음");
      if (!confirm(`${imported.length}개의 저장 장부를 현재 브라우저에 합칠까요? 같은 장부는 백업 내용으로 갱신됩니다.`)) {
        return;
      }
      setLedgers((current) => {
        const merged = new Map(current.map((ledger) => [ledger.id, ledger]));
        for (const ledger of imported) merged.set(ledger.id, ledger);
        return [...merged.values()];
      });
      setSaveNotice(`${imported.length}개 장부를 복원했습니다.`);
    } catch {
      alert("정산 장부 백업 파일을 읽지 못했습니다.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function updateDropEntry(entryId: string, changes: Partial<DropEntry>) {
    setState((current) => ({
      ...current,
      drops: current.drops.map((trialDrops) =>
        trialDrops.map((entry) => (entry.id === entryId ? { ...entry, ...changes } : entry)),
      ),
    }));
  }

  function updatePrice(entryId: string, value: string) {
    updateDropEntry(entryId, { price: value, priceUpdatedAt: new Date().toISOString() });
  }

  function updateSaleStatus(entryId: string, status: SaleStatus) {
    updateDropEntry(entryId, { saleStatus: status, priceUpdatedAt: new Date().toISOString() });
  }

  function removeDropEntry(entryId: string) {
    setState((current) => ({
      ...current,
      drops: current.drops.map((trialDrops) => trialDrops.filter((entry) => entry.id !== entryId)),
    }));
  }

  function setDrop(t: number, slot: number, value: string) {
    const val = value.trim();
    setState((currentState) => {
      const next = currentState.drops.map((arr, i) => (i === t ? [...arr] : arr));
      const current = next[t][slot];
      if (!val) {
        if (current) next[t].splice(slot, 1);
      } else if (current) {
        next[t][slot] =
          current.item === val
            ? current
            : { ...current, item: val, price: "", saleStatus: "unlisted", priceUpdatedAt: "" };
      } else {
        next[t].push({ id: crypto.randomUUID(), item: val, price: "", saleStatus: "unlisted", priceUpdatedAt: "" });
      }
      return { ...currentState, drops: next };
    });
  }

  function addDrop(t: number, item: string) {
    setState((current) => ({
      ...current,
      drops: current.drops.map((trialDrops, i) =>
        i === t
          ? [
              ...trialDrops,
              { id: crypto.randomUUID(), item, price: "", saleStatus: "unlisted", priceUpdatedAt: "" },
            ]
          : trialDrops,
      ),
    }));
    setSelectedTry(t);
  }

  function removeLastDrop(t: number, item: string) {
    setState((current) => {
      const next = current.drops.map((trialDrops, i) => (i === t ? [...trialDrops] : trialDrops));
      for (let i = next[t].length - 1; i >= 0; i -= 1) {
        if (next[t][i].item !== item) continue;
        next[t].splice(i, 1);
        return { ...current, drops: next };
      }
      return current;
    });
  }

  function dropItem(t: number, value: string) {
    if (knownKeys.has(value)) addDrop(t, value);
    setDragOverTry(null);
  }

  function copySummary() {
    const lines = [
      `⚔️ ${ledgerTitle.trim() || "길드대항전 분배 정산"} (${tries}트 기준${state.soldOnly ? " · 판매완료만 반영" : ""})`,
    ];
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
      {/* 정산 장부 */}
      <section className="pixel-panel p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-pixel text-sm text-ink">💾 정산 장부</h2>
            <p className="mt-1 text-xs text-dim leading-relaxed">
              날짜별 장부를 따로 저장하고, 판매가·판매 상태를 나중에 수정한 뒤 같은 장부에 다시 저장할 수 있습니다.
            </p>
          </div>
          <span className={`text-xs font-bold ${isLedgerDirty ? "text-mush" : "text-dim"}`}>
            {activeLedger ? (isLedgerDirty ? "● 저장하지 않은 변경 있음" : "✓ 저장됨") : "새 장부 작성 중"}
          </span>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)] gap-4">
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-dim space-y-1">
                <span className="block">길대 날짜</span>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="pixel-input w-full px-3 py-2 text-sm text-ink"
                />
                <span className="block text-[11px] text-maple">{formatDateWithDay(eventDate)}</span>
              </label>
              <label className="text-xs text-dim space-y-1">
                <span className="block">판매 담당자</span>
                <input
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  placeholder="공대장 또는 판매자 닉네임"
                  className="pixel-input w-full px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="text-xs text-dim space-y-1 sm:col-span-2">
                <span className="block">장부 이름</span>
                <input
                  value={ledgerTitle}
                  onChange={(e) => setLedgerTitle(e.target.value)}
                  placeholder={`${formatDateWithDay(eventDate)} 길드대항전`}
                  className="pixel-input w-full px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="text-xs text-dim space-y-1">
                <span className="block">장부 상태</span>
                <select
                  value={ledgerStatus}
                  onChange={(e) => setLedgerStatus(e.target.value as LedgerStatus)}
                  className="w-full px-3 py-2 text-sm bg-surface2 border-2 border-edge focus:border-maple outline-none text-ink"
                >
                  <option value="selling">판매·정산 중</option>
                  <option value="settled">정산 완료</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveLedger} className="pixel-btn px-4 py-2 text-xs font-pixel">
                {activeLedger ? "💾 변경 저장" : "💾 새 장부 저장"}
              </button>
              <button
                type="button"
                onClick={() => startNewLedger(false)}
                className="px-3 py-2 text-xs font-pixel border-2 border-edge text-dim hover:text-maple transition-colors"
              >
                빈 장부 새로 만들기
              </button>
              {people.length > 0 && (
                <button
                  type="button"
                  onClick={() => startNewLedger(true)}
                  className="px-3 py-2 text-xs font-pixel border-2 border-edge text-dim hover:text-maple transition-colors"
                >
                  명단 복사해서 새 장부
                </button>
              )}
            </div>
            {saveNotice && <p className="text-xs text-maple">{saveNotice}</p>}
          </div>

          <div className="border-2 border-edge bg-surface2/40 p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-pixel text-xs text-ink">저장된 장부 ({ledgers.length})</h3>
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  onClick={exportLedgers}
                  disabled={ledgers.length === 0}
                  className="px-2 py-1 text-[11px] border border-edge text-dim hover:text-maple disabled:opacity-40"
                >
                  JSON 백업
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="px-2 py-1 text-[11px] border border-edge text-dim hover:text-maple"
                >
                  복원
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importLedgers(file);
                  }}
                />
              </div>
            </div>
            {groupedLedgers.length === 0 ? (
              <p className="text-xs text-dim">아직 저장한 장부가 없습니다.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                {groupedLedgers.map(([date, dateLedgers]) => (
                  <div key={date} className="space-y-1">
                    <p className="text-[11px] font-bold text-dim">{formatDateWithDay(date)}</p>
                    {dateLedgers.map((ledger) => (
                      <div
                        key={ledger.id}
                        className={`p-2 border text-xs ${
                          ledger.id === activeLedgerId ? "border-maple bg-maple/10" : "border-edge/60"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button type="button" onClick={() => loadLedger(ledger)} className="min-w-0 flex-1 text-left">
                            <b className="block text-ink truncate">{ledger.title}</b>
                            <span className="block mt-0.5 text-[11px] text-dim">
                              {ledger.manager ? `판매 ${ledger.manager} · ` : ""}
                              {ledger.status === "settled" ? "정산 완료" : "판매·정산 중"} · 수정 {formatUpdatedAt(ledger.updatedAt)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteLedger(ledger)}
                            className="shrink-0 text-dim/50 hover:text-mush"
                            aria-label={`${ledger.title} 삭제`}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-dim leading-relaxed">
              장부는 현재 브라우저에 저장됩니다. 다른 PC·브라우저로 옮기거나 백업하려면 JSON 백업/복원을 사용하세요.
            </p>
          </div>
        </div>
      </section>

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
            <span className="text-xs text-dim font-normal">
              — 칸을 클릭하거나 누른 채 쓸어서 참여/불참 입력 · 손잡이로 순서 변경
            </span>
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
                        data-attendance-person={p.id}
                        data-attendance-try={t}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          e.preventDefault();
                          const value: 0 | 1 = p.tr[t] ? 0 : 1;
                          attendancePaintRef.current = {
                            pointerId: e.pointerId,
                            value,
                            visited: new Set([`${p.id}:${t}`]),
                          };
                          paintAttendance(p.id, t, value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          paintAttendance(p.id, t, p.tr[t] ? 0 : 1);
                        }}
                        className={`w-8 h-8 border-2 transition-colors touch-none select-none ${
                          p.tr[t]
                            ? "border-maple bg-maple/10 text-maple font-bold"
                            : "border-edge text-dim/40 hover:text-maple"
                        }`}
                        aria-label={`${p.name} ${t + 1}트 ${p.tr[t] ? "참여 해제" : "참여 설정"}`}
                        title="클릭하거나 누른 채 다른 칸으로 쓸어 입력"
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
                    const entry = drops[t][s];
                    const v = entry?.item || "";
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
                          <option value="">{v ? "✕ 이 아이템 제거" : "− 비어 있음"}</option>
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
          추가. 등록된 아이템은 드롭다운의 「✕ 이 아이템 제거」로 뺄 수 있습니다.
        </p>

        <div className="border-t-2 border-edge pt-4 space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="font-pixel text-xs text-ink">아이템 빠른 추가</h3>
            <p className="text-xs text-dim">
              카드를 클릭하면 <b className="text-maple">{selectedTry + 1}트</b>에 추가 · 우측 상단 − 버튼으로 1개씩 제거
              · PC에서는 위 트라이 칸으로 드래그
            </p>
          </div>
          {SETTLE_ITEM_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <h4 className="text-xs font-bold text-dim">{group.label}</h4>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-1.5">
                {group.items.map((item) => {
                  const count = drops[selectedTry].filter((entry) => entry.item === item.key).length;
                  return (
                    <div key={item.key} className="relative">
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "copy";
                          e.dataTransfer.setData("text/plain", item.key);
                        }}
                        onDragEnd={() => setDragOverTry(null)}
                        onClick={() => addDrop(selectedTry, item.key)}
                        title={`${item.name} — 클릭 시 ${selectedTry + 1}트에 추가`}
                        className="w-full min-h-[5.25rem] p-1.5 border-2 border-edge bg-surface2 hover:border-maple hover:bg-maple/10 transition-colors flex flex-col items-center justify-center gap-1 cursor-grab active:cursor-grabbing"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={itemIcon(item.itemId)}
                          alt=""
                          className="w-9 h-9 object-contain [image-rendering:pixelated] pointer-events-none"
                          loading="lazy"
                        />
                        <span className="text-[10px] font-bold leading-tight text-ink break-keep">{item.key}</span>
                      </button>
                      {count > 0 && (
                        <>
                          <span className="absolute top-1 left-1 min-w-6 h-6 px-1 rounded-full bg-maple text-white text-[10px] font-bold leading-6 pointer-events-none">
                            ×{count}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLastDrop(selectedTry, item.key)}
                            className="absolute top-1 right-1 min-w-6 h-6 px-1 rounded-full bg-mush text-white text-[10px] font-bold leading-6 hover:brightness-110"
                            title={`${selectedTry + 1}트에서 ${item.name} 1개 제거`}
                            aria-label={`${selectedTry + 1}트 ${item.key} 1개 제거, 현재 ${count}개`}
                          >
                            −1
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ③ 시세표 */}
      <section className="pixel-panel p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-pixel text-sm text-ink">
            ③ 판매·시세 관리 <span className="text-xs text-dim font-normal">— 가격과 판매 상태를 나중에 수정 가능</span>
          </h2>
          <label className="ml-auto flex items-center gap-2 text-xs text-dim cursor-pointer">
            <input
              type="checkbox"
              checked={state.soldOnly}
              onChange={(e) => setState({ ...state, soldOnly: e.target.checked })}
              className="accent-maple"
            />
            판매완료 아이템만 정산 반영
          </label>
        </div>
        {dropRows.length === 0 ? (
          <p className="text-sm text-dim">드랍 아이템을 입력하면 여기에 자동으로 나타납니다.</p>
        ) : (
          <div className="overflow-x-auto max-w-4xl">
            <table className="w-full min-w-[840px] text-sm">
              <thead>
                <tr className="text-left text-dim border-b-2 border-edge">
                  <th className="py-1.5">아이템</th>
                  <th className="px-2">획득</th>
                  <th className="px-2">상태</th>
                  <th className="text-right">개별 판매금액</th>
                  <th className="text-right">수수료 제외</th>
                  <th className="px-2 text-right">마지막 변경</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {dropRows.map(({ entry, tryIndex, slot }) => {
                  const n = saleNetPrice(entry);
                  return (
                    <tr key={entry.id} className="border-b border-edge/40">
                      <td className="py-1">
                        <b>{entry.item}</b>
                        {GW_ITEM_NAME[entry.item] && GW_ITEM_NAME[entry.item] !== entry.item && (
                          <span className="block text-[11px] text-dim leading-tight">{GW_ITEM_NAME[entry.item]}</span>
                        )}
                      </td>
                      <td className="px-2 text-xs text-dim tabular-nums">
                        {tryIndex + 1}트 · #{slot + 1}
                      </td>
                      <td className="px-2">
                        <select
                          value={entry.saleStatus}
                          onChange={(e) => updateSaleStatus(entry.id, e.target.value as SaleStatus)}
                          className={`w-24 px-1.5 py-1 text-xs bg-surface2 border border-edge focus:border-maple outline-none ${
                            entry.saleStatus === "sold" ? "text-maple font-bold" : "text-dim"
                          }`}
                          aria-label={`${tryIndex + 1}트 ${entry.item} 판매 상태`}
                        >
                          <option value="unlisted">미등록</option>
                          <option value="listed">판매중</option>
                          <option value="sold">판매완료</option>
                        </select>
                      </td>
                      <td className="text-right">
                        <input
                          type="number"
                          value={entry.price}
                          onChange={(e) => updatePrice(entry.id, e.target.value)}
                          placeholder="0"
                          className="w-28 px-2 py-1 text-right text-xs bg-surface2 border border-edge focus:border-maple outline-none"
                          aria-label={`${tryIndex + 1}트 ${entry.item} 판매금액`}
                        />
                      </td>
                      <td className="text-right text-dim tabular-nums">{n === null ? "" : fmt(n)}</td>
                      <td className="px-2 text-right text-[11px] text-dim tabular-nums">
                        {entry.priceUpdatedAt ? formatUpdatedAt(entry.priceUpdatedAt) : ""}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => removeDropEntry(entry.id)}
                          className="text-dim/50 hover:text-mush transition-colors"
                          title="이 드랍 아이템 제거"
                          aria-label={`${tryIndex + 1}트 ${entry.item} 제거`}
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
        <p className="text-xs text-dim leading-relaxed">
          중복 아이템도 드랍된 개수만큼 각각 표시되므로 서로 다른 판매가와 상태를 입력할 수 있습니다. 판매중 가격은
          언제든 수정할 수 있고 변경 시각이 함께 기록됩니다. 「판매완료만 정산 반영」을 켜면 아직 팔리지 않은
          아이템은 인원별 송금액에서 제외됩니다.
        </p>
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
