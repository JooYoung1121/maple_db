"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

/* ── 타입 ── */
interface Part { id: number; name: string; icon: string; level: number }
type SlotKey = "hair" | "face" | "hat" | "overall" | "top" | "bottom" | "shoes" | "glove" | "cape" | "shield" | "weapon";
type Outfit = { skin: number } & Partial<Record<SlotKey, Part>>;

const SLOTS: { key: SlotKey; label: string }[] = [
  { key: "hair", label: "헤어" },
  { key: "face", label: "성형" },
  { key: "hat", label: "모자" },
  { key: "overall", label: "한벌옷" },
  { key: "top", label: "상의" },
  { key: "bottom", label: "하의" },
  { key: "shoes", label: "신발" },
  { key: "glove", label: "장갑" },
  { key: "cape", label: "망토" },
  { key: "shield", label: "방패" },
  { key: "weapon", label: "무기" },
];

const SKINS = [
  { id: 2000, label: "피부 1" }, { id: 2001, label: "피부 2" }, { id: 2002, label: "피부 3" },
  { id: 2003, label: "피부 4" }, { id: 2004, label: "피부 5" },
];

const POSES = [
  { key: "stand1", label: "서기" },
  { key: "walk1", label: "걷기" },
  { key: "jump", label: "점프" },
  { key: "alert", label: "전투" },
  { key: "sit", label: "앉기" },
];

const DEFAULT_OUTFIT: Outfit = { skin: 2000 };
const PRESET_COUNT = 4;
const PRESET_STORAGE = "codi_presets_v1";

/* 캐릭터 렌더 URL — maplestory.io GMS v92 */
function renderUrl(outfit: Outfit, pose = "stand1", zoom = 3): string {
  const ids: number[] = [outfit.skin];
  for (const { key } of SLOTS) {
    const p = outfit[key];
    if (p) ids.push(p.id);
  }
  const entries = ids
    .map((id) => encodeURIComponent(JSON.stringify({ itemId: id, region: "GMS", version: "92" })))
    .join(",");
  return `https://maplestory.io/api/character/${entries}/${pose}/0?resize=${zoom}`;
}

function outfitToQuery(outfit: Outfit): string {
  const parts: string[] = [`skin=${outfit.skin}`];
  for (const { key } of SLOTS) {
    const p = outfit[key];
    if (p) parts.push(`${key}=${p.id}`);
  }
  return parts.join("&");
}

function CodiContent() {
  const searchParams = useSearchParams();
  const [outfit, setOutfit] = useState<Outfit>(DEFAULT_OUTFIT);
  const [activeSlot, setActiveSlot] = useState<SlotKey>("hair");
  const [pose, setPose] = useState("stand1");
  const [parts, setParts] = useState<Part[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [loadingParts, setLoadingParts] = useState(false);
  const [presets, setPresets] = useState<(Outfit | null)[]>(Array(PRESET_COUNT).fill(null));
  const [compareMode, setCompareMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const perPage = 60;

  /* URL 공유 복원 + 프리셋 로드 */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRESET_STORAGE);
      if (saved) setPresets(JSON.parse(saved));
    } catch { /* ignore */ }
    const skin = parseInt(searchParams.get("skin") || "", 10);
    if (skin >= 2000 && skin <= 2004) {
      const o: Outfit = { skin };
      const loads: Promise<void>[] = [];
      for (const { key } of SLOTS) {
        const id = parseInt(searchParams.get(key) || "", 10);
        if (id > 0) {
          // 이름·아이콘은 몰라도 렌더는 되므로 placeholder로 채우고 표시명만 lazy
          o[key] = { id, name: `#${id}`, icon: `https://maplestory.io/api/gms/92/item/${id}/icon`, level: 0 };
        }
      }
      void loads;
      setOutfit(o);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 파트 목록 로드 */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoadingParts(true);
      fetch(`${API_BASE}/api/codi/parts?type=${activeSlot}&page=${page}&per_page=${perPage}${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}`)
        .then((r) => r.json())
        .then((d) => { setParts(d.parts || []); setTotal(d.total || 0); })
        .catch(() => setParts([]))
        .finally(() => setLoadingParts(false));
    }, 200);
  }, [activeSlot, page, query]);

  useEffect(() => { setPage(1); setQuery(""); }, [activeSlot]);

  const equip = useCallback((p: Part) => {
    setOutfit((prev) => {
      const next = { ...prev, [activeSlot]: p };
      // 한벌옷 ↔ 상/하의 상호 배타
      if (activeSlot === "overall") { delete next.top; delete next.bottom; }
      if (activeSlot === "top" || activeSlot === "bottom") delete next.overall;
      return next;
    });
  }, [activeSlot]);

  const unequip = useCallback((key: SlotKey) => {
    setOutfit((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const savePreset = useCallback((idx: number) => {
    setPresets((prev) => {
      const next = [...prev];
      next[idx] = JSON.parse(JSON.stringify(outfit));
      try { localStorage.setItem(PRESET_STORAGE, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [outfit]);

  const clearPreset = useCallback((idx: number) => {
    setPresets((prev) => {
      const next = [...prev];
      next[idx] = null;
      try { localStorage.setItem(PRESET_STORAGE, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const share = useCallback(() => {
    const url = `${window.location.origin}/codi?${outfitToQuery(outfit)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [outfit]);

  const previewUrl = useMemo(() => renderUrl(outfit, pose), [outfit, pose]);
  const savedPresets = presets.map((p, i) => ({ p, i })).filter((x) => x.p !== null);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h1 className="font-pixel text-2xl font-bold">🎨 코디 시뮬레이터</h1>
        <button
          onClick={() => setCompareMode(!compareMode)}
          disabled={!compareMode && savedPresets.length < 2}
          className={`px-3 py-1.5 text-xs font-pixel border-2 transition-colors disabled:opacity-40 ${
            compareMode ? "border-maple text-maple" : "border-edge text-dim hover:text-maple hover:border-maple"
          }`}
        >
          {compareMode ? "시뮬레이터로" : `프리셋 비교 (${savedPresets.length})`}
        </button>
      </div>
      <p className="text-sm text-dim mb-4">
        헤어 1,668종 · 성형 576종 · 메랜 장비 전체를 입혀보고, 프리셋에 저장해 나란히 비교하세요.
      </p>

      {compareMode ? (
        /* ── 프리셋 비교 뷰 ── */
        <div>
          <div className={`grid gap-3 ${savedPresets.length <= 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
            {savedPresets.map(({ p, i }) => (
              <div key={i} className="pixel-panel p-4 text-center">
                <p className="font-pixel text-xs text-maple mb-2">프리셋 {i + 1}</p>
                <div className="h-40 flex items-center justify-center bg-[#0d0f14] mb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={renderUrl(p!, pose)} alt={`프리셋 ${i + 1}`} className="max-h-36 object-contain" style={{ imageRendering: "pixelated" }} />
                </div>
                <div className="text-left space-y-0.5">
                  {SLOTS.map(({ key, label }) => {
                    const item = p![key];
                    return item ? (
                      <p key={key} className="text-[11px] text-dim truncate">
                        <span className="text-ink">{label}</span> {item.name}{item.level > 0 ? ` (Lv.${item.level})` : ""}
                      </p>
                    ) : null;
                  })}
                </div>
                <div className="flex justify-center gap-2 mt-2">
                  <button onClick={() => { setOutfit(p!); setCompareMode(false); }} className="text-[11px] text-dim hover:text-maple">불러오기</button>
                  <button onClick={() => clearPreset(i)} className="text-[11px] text-dim hover:text-red-500">삭제</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            {POSES.map((po) => (
              <button key={po.key} onClick={() => setPose(po.key)}
                className={`px-2.5 py-1 text-xs font-pixel border-2 transition-colors ${pose === po.key ? "border-maple text-maple" : "border-edge text-dim hover:text-maple"}`}>
                {po.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── 시뮬레이터 뷰 ── */
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* 왼쪽: 미리보기 + 착용 목록 */}
          <div>
            <div className="pixel-panel p-4 text-center sticky top-4">
              <div className="h-52 flex items-center justify-center bg-[#0d0f14] mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="캐릭터 미리보기" className="max-h-48 object-contain" style={{ imageRendering: "pixelated" }} />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
                {POSES.map((po) => (
                  <button key={po.key} onClick={() => setPose(po.key)}
                    className={`px-2 py-1 text-[11px] font-pixel border-2 transition-colors ${pose === po.key ? "border-maple text-maple" : "border-edge text-dim hover:text-maple"}`}>
                    {po.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
                {SKINS.map((s) => (
                  <button key={s.id} onClick={() => setOutfit((prev) => ({ ...prev, skin: s.id }))}
                    className={`px-2 py-1 text-[11px] font-pixel border-2 transition-colors ${outfit.skin === s.id ? "border-maple text-maple" : "border-edge text-dim hover:text-maple"}`}>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* 착용 중 */}
              <div className="text-left space-y-1 mb-3 min-h-[60px]">
                {SLOTS.map(({ key, label }) => {
                  const item = outfit[key];
                  return item ? (
                    <div key={key} className="flex items-center gap-1.5 text-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.icon} alt="" className="w-5 h-5 object-contain" />
                      <span className="text-dim shrink-0">{label}</span>
                      <span className="flex-1 truncate">{item.name}</span>
                      <button onClick={() => unequip(key)} className="text-dim hover:text-red-500 shrink-0">✕</button>
                    </div>
                  ) : null;
                })}
                {SLOTS.every(({ key }) => !outfit[key]) && (
                  <p className="text-xs text-dim text-center py-3">오른쪽에서 파트를 골라 입혀보세요</p>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-1.5">
                <button onClick={share} className="pixel-btn px-3 py-1.5 text-xs">{copied ? "복사됨!" : "코디 링크 공유"}</button>
                {Array.from({ length: PRESET_COUNT }, (_, i) => (
                  <button key={i} onClick={() => savePreset(i)}
                    title={presets[i] ? "덮어쓰기" : "저장"}
                    className={`px-2.5 py-1.5 text-xs font-pixel border-2 transition-colors ${presets[i] ? "border-maple text-maple" : "border-edge text-dim hover:text-maple"}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-dim mt-1.5">숫자 = 프리셋 슬롯 저장 · 2개 이상 저장하면 비교 가능</p>
            </div>
          </div>

          {/* 오른쪽: 파트 선택 */}
          <div>
            <div className="flex flex-wrap gap-1 mb-3">
              {SLOTS.map(({ key, label }) => (
                <button key={key} onClick={() => setActiveSlot(key)}
                  className={`px-3 py-1.5 text-xs font-pixel border-2 transition-colors ${activeSlot === key ? "border-maple text-maple bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]" : "border-edge text-dim hover:text-maple"}`}>
                  {label}
                </button>
              ))}
            </div>
            <input
              type="text" value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder={`${SLOTS.find((s) => s.key === activeSlot)?.label} 검색 (예: 토벤, 검은색)`}
              className="w-full pixel-input px-3 py-2 text-sm mb-3"
            />
            {loadingParts ? (
              <div className="text-center py-10 text-dim text-sm">로딩 중...</div>
            ) : (
              <>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                  {parts.map((p) => (
                    <button key={p.id} onClick={() => equip(p)}
                      title={`${p.name}${p.level > 0 ? ` (Lv.${p.level})` : ""}`}
                      className={`pixel-card p-1.5 flex flex-col items-center gap-1 hover:border-maple transition-colors ${outfit[activeSlot]?.id === p.id ? "border-maple" : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.icon} alt={p.name} className="w-8 h-8 object-contain" loading="lazy" />
                      <span className="text-[9px] leading-tight text-center text-dim line-clamp-2 w-full">{p.name}</span>
                    </button>
                  ))}
                </div>
                {total > perPage && (
                  <div className="flex items-center justify-center gap-3 mt-3 text-sm">
                    <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="pixel-btn px-3 py-1 text-xs disabled:opacity-40">이전</button>
                    <span className="text-xs text-dim">{page} / {Math.ceil(total / perPage)}</span>
                    <button disabled={page >= Math.ceil(total / perPage)} onClick={() => setPage(page + 1)} className="pixel-btn px-3 py-1 text-xs disabled:opacity-40">다음</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-dim mt-6">
        ※ 렌더는 원작(GMS v92) 데이터 기준 — 메랜 전용 신규 파트는 누락될 수 있습니다.
        헤어·성형은 미리보기용 전체 목록이며, 실제 시술 가능한 마을 미용실 안내는 준비 중입니다.
      </p>
    </div>
  );
}

export default function CodiPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-dim">로딩 중...</div>}>
      <CodiContent />
    </Suspense>
  );
}
