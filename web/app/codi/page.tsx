"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

/* ── 타입 ── */
interface Part { id: number; name: string; icon: string; level: number }
interface GalleryPost {
  id: number;
  nickname: string;
  title: string;
  likes: number;
  created_at: string;
  outfit: { skin: number } & Partial<Record<SlotKey, { id: number; name: string }>>;
}
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
  // 몸(2000번대)과 머리(12000번대)는 별도 파트 — 둘 다 넣어야 머리·헤어·모자가 렌더된다
  const ids: number[] = [outfit.skin, outfit.skin + 10000];
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
  const [view, setView] = useState<"sim" | "compare" | "gallery">("sim");
  const [copied, setCopied] = useState(false);
  /* 갤러리 */
  const [posts, setPosts] = useState<GalleryPost[]>([]);
  const [gallerySort, setGallerySort] = useState<"latest" | "likes">("latest");
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [showBragForm, setShowBragForm] = useState(false);
  const [bragNickname, setBragNickname] = useState("");
  const [bragTitle, setBragTitle] = useState("");
  const [bragBusy, setBragBusy] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
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

  /* ── 갤러리 ── */
  const loadGallery = useCallback((sort: "latest" | "likes") => {
    setGalleryLoading(true);
    fetch(`${API_BASE}/api/codi/posts?sort=${sort}&per_page=48`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setGalleryLoading(false));
  }, []);

  useEffect(() => {
    if (view === "gallery") loadGallery(gallerySort);
  }, [view, gallerySort, loadGallery]);

  useEffect(() => {
    try {
      const n = localStorage.getItem("boss_timer_nickname") || localStorage.getItem("codi_nickname") || "";
      if (n) setBragNickname(n);
    } catch { /* ignore */ }
  }, []);

  const submitBrag = useCallback(() => {
    if (bragBusy) return;
    const worn = SLOTS.some(({ key }) => outfit[key]);
    if (!worn) { alert("한 가지 이상 착용한 코디만 등록할 수 있어요."); return; }
    if (!bragNickname.trim() || !bragTitle.trim()) { alert("닉네임과 코디 이름을 입력하세요."); return; }
    setBragBusy(true);
    fetch(`${API_BASE}/api/codi/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: bragNickname.trim(), title: bragTitle.trim(), outfit }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail || "등록 실패");
        try { localStorage.setItem("codi_nickname", bragNickname.trim()); } catch { /* ignore */ }
        setShowBragForm(false);
        setBragTitle("");
        setGallerySort("latest");
        setView("gallery");
      })
      .catch((e) => alert(String(e.message || e)))
      .finally(() => setBragBusy(false));
  }, [outfit, bragNickname, bragTitle, bragBusy]);

  const likePost = useCallback((id: number) => {
    if (likedIds.has(id)) return;
    fetch(`${API_BASE}/api/codi/posts/${id}/like`, { method: "POST" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail || "실패");
        return r.json();
      })
      .then((d) => {
        setLikedIds((prev) => new Set(prev).add(id));
        setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, likes: d.likes } : p)));
      })
      .catch((e) => {
        setLikedIds((prev) => new Set(prev).add(id)); // 409(이미 누름)도 눌림 처리
        void e;
      });
  }, [likedIds]);

  const wearPost = useCallback((p: GalleryPost) => {
    const o: Outfit = { skin: p.outfit.skin };
    for (const { key } of SLOTS) {
      const it = p.outfit[key];
      if (it) o[key] = { id: it.id, name: it.name || `#${it.id}`, icon: `https://maplestory.io/api/gms/92/item/${it.id}/icon`, level: 0 };
    }
    setOutfit(o);
    setView("sim");
  }, []);

  const previewUrl = useMemo(() => renderUrl(outfit, pose), [outfit, pose]);
  const savedPresets = presets.map((p, i) => ({ p, i })).filter((x) => x.p !== null);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h1 className="font-pixel text-2xl font-bold">🎨 코디 시뮬레이터</h1>
        <div className="flex gap-1.5">
          {view !== "sim" && (
            <button onClick={() => setView("sim")} className="px-3 py-1.5 text-xs font-pixel border-2 border-edge text-dim hover:text-maple hover:border-maple transition-colors">
              시뮬레이터
            </button>
          )}
          <button
            onClick={() => setView(view === "compare" ? "sim" : "compare")}
            disabled={view !== "compare" && savedPresets.length < 2}
            className={`px-3 py-1.5 text-xs font-pixel border-2 transition-colors disabled:opacity-40 ${
              view === "compare" ? "border-maple text-maple" : "border-edge text-dim hover:text-maple hover:border-maple"
            }`}
          >
            프리셋 비교 ({savedPresets.length})
          </button>
          <button
            onClick={() => setView(view === "gallery" ? "sim" : "gallery")}
            className={`px-3 py-1.5 text-xs font-pixel border-2 transition-colors ${
              view === "gallery" ? "border-maple text-maple" : "border-edge text-dim hover:text-maple hover:border-maple"
            }`}
          >
            👑 길드 코디 자랑
          </button>
        </div>
      </div>
      <p className="text-sm text-dim mb-4">
        헤어 1,668종 · 성형 576종 · 메랜 장비 전체를 입혀보고, 프리셋에 저장해 나란히 비교하세요.
      </p>

      {view === "gallery" ? (
        /* ── 길드 코디 자랑 갤러리 ── */
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1.5">
              {(["latest", "likes"] as const).map((s) => (
                <button key={s} onClick={() => setGallerySort(s)}
                  className={`px-2.5 py-1 text-xs font-pixel border-2 transition-colors ${gallerySort === s ? "border-maple text-maple" : "border-edge text-dim hover:text-maple"}`}>
                  {s === "latest" ? "최신순" : "좋아요순"}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {POSES.map((po) => (
                <button key={po.key} onClick={() => setPose(po.key)}
                  className={`px-2 py-1 text-[11px] font-pixel border-2 transition-colors ${pose === po.key ? "border-maple text-maple" : "border-edge text-dim hover:text-maple"}`}>
                  {po.label}
                </button>
              ))}
            </div>
          </div>
          {galleryLoading ? (
            <div className="text-center py-12 text-dim text-sm">로딩 중...</div>
          ) : posts.length === 0 ? (
            <div className="pixel-panel p-10 text-center">
              <p className="text-sm text-dim mb-3">아직 등록된 코디가 없어요 — 첫 번째 자랑의 주인공이 되어보세요!</p>
              <button onClick={() => setView("sim")} className="pixel-btn px-4 py-2 text-sm">코디 만들러 가기</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {posts.map((p) => (
                <div key={p.id} className="pixel-panel p-3 text-center flex flex-col">
                  <div className="h-36 flex items-center justify-center bg-[#0d0f14] mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={renderUrl({ skin: p.outfit.skin, ...Object.fromEntries(SLOTS.map(({ key }) => [key, p.outfit[key] ? { id: p.outfit[key]!.id, name: "", icon: "", level: 0 } : undefined]).filter(([, v]) => v)) } as Outfit, pose)}
                      alt={p.title}
                      className="max-h-32 object-contain"
                      style={{ imageRendering: "pixelated" }}
                      loading="lazy"
                    />
                  </div>
                  <p className="text-sm font-semibold truncate">{p.title}</p>
                  <p className="text-[11px] text-dim mb-2">by {p.nickname}</p>
                  <div className="mt-auto flex items-center justify-center gap-2">
                    <button
                      onClick={() => likePost(p.id)}
                      className={`px-2.5 py-1 text-xs border-2 transition-colors ${likedIds.has(p.id) ? "border-maple text-maple" : "border-edge text-dim hover:text-maple hover:border-maple"}`}
                    >
                      ❤️ {p.likes}
                    </button>
                    <button onClick={() => wearPost(p)} className="px-2.5 py-1 text-xs border-2 border-edge text-dim hover:text-maple hover:border-maple transition-colors">
                      따라 입기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : view === "compare" ? (
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
                  <button onClick={() => { setOutfit(p!); setView("sim"); }} className="text-[11px] text-dim hover:text-maple">불러오기</button>
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
                <button onClick={() => setShowBragForm(!showBragForm)} className="px-3 py-1.5 text-xs font-pixel border-2 border-maple text-maple hover:brightness-110 transition-colors">
                  👑 자랑하기
                </button>
                {Array.from({ length: PRESET_COUNT }, (_, i) => (
                  <button key={i} onClick={() => savePreset(i)}
                    title={presets[i] ? "덮어쓰기" : "저장"}
                    className={`px-2.5 py-1.5 text-xs font-pixel border-2 transition-colors ${presets[i] ? "border-maple text-maple" : "border-edge text-dim hover:text-maple"}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-dim mt-1.5">숫자 = 프리셋 슬롯 저장 · 2개 이상 저장하면 비교 가능</p>

              {/* 자랑 등록 폼 */}
              {showBragForm && (
                <div className="mt-3 pt-3 border-t border-edge/60 space-y-1.5 text-left">
                  <input
                    type="text" value={bragNickname}
                    onChange={(e) => setBragNickname(e.target.value.slice(0, 12))}
                    placeholder="닉네임"
                    className="w-full pixel-input px-2 py-1.5 text-xs"
                  />
                  <input
                    type="text" value={bragTitle}
                    onChange={(e) => setBragTitle(e.target.value.slice(0, 40))}
                    onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && submitBrag()}
                    placeholder="코디 이름 (예: 리스항구 갬성룩)"
                    className="w-full pixel-input px-2 py-1.5 text-xs"
                  />
                  <div className="flex gap-1.5">
                    <button onClick={submitBrag} disabled={bragBusy} className="pixel-btn flex-1 px-3 py-1.5 text-xs disabled:opacity-50">
                      {bragBusy ? "등록 중..." : "갤러리에 등록"}
                    </button>
                    <button onClick={() => setShowBragForm(false)} className="px-3 py-1.5 text-xs text-dim hover:text-maple">취소</button>
                  </div>
                </div>
              )}
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

      {/* 미용실 안내 */}
      <section className="pixel-panel p-5 mt-8">
        <h2 className="font-pixel text-lg font-semibold mb-3">💇 미용실 · 성형 안내</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
          <div>
            <h3 className="font-pixel text-xs text-maple mb-2">미용실이 있는 마을</h3>
            <ul className="space-y-1 text-dim text-xs">
              <li>헤네시스 — 나탈리 · 브리트니 <span className="text-ink">(염색: 검정·빨강·보라·주황·초록)</span></li>
              <li>커닝시티 — 돈 지오바네 · 안드레아 <span className="text-ink">(염색: 검정·주황·노랑·파랑)</span> · 헤어만 가능</li>
              <li>오르비스 — 미노 · 린스 <span className="text-ink">(염색: 검정·빨강·노랑·초록·파랑)</span></li>
              <li>루디브리엄 — 미유 · 미니 <span className="text-ink">(염색: 검정·주황·노랑·파랑·초록)</span></li>
              <li>무릉 — 루오 할아범 · 리리슈슈</li>
              <li>야시장 · 아리안트 — 헤어샵 있음</li>
            </ul>
            <p className="text-[11px] text-dim mt-2">엘리니아·페리온·엘나스·리스항구에는 미용실이 없습니다.</p>
          </div>
          <div>
            <h3 className="font-pixel text-xs text-maple mb-2">쿠폰 시스템</h3>
            <ul className="space-y-1 text-dim text-xs">
              <li>캐시샵 &gt; 기타 &gt; <span className="text-ink">뷰티샵</span>에서 마을별 쿠폰 구매</li>
              <li><span className="text-ink">일반 쿠폰 = 무작위</span> · <span className="text-ink">고급 쿠폰 = 원하는 스타일 선택</span></li>
              <li>헤어 3,500 MP · 염색 2,000 MP · 성형 2,500 MP</li>
              <li>성형·피부: 헤네시스 · 오르비스 · 루디브리엄 · 야시장 · 무릉 <span className="text-ink">(종류는 전 마을 동일)</span></li>
            </ul>
            <p className="text-[11px] text-dim mt-2">
              ※ 마을별 제공 헤어스타일 목록은 커뮤니티 자료가 이미지 형태뿐이라 수집 중 — 확보되면 헤어 선택 시 마을 배지로 표시할 예정입니다.
            </p>
          </div>
        </div>
      </section>

      <p className="text-[11px] text-dim mt-4">
        ※ 렌더는 원작(GMS v92) 데이터 기준 — 메랜 전용 신규 파트(2026 아이돌·로얄 헤어 등)는 누락될 수 있습니다.
        장비 목록에는 캐시샵 코디를 포함한 전체 외형이 나오며, 일부는 메랜에서 아직 판매/획득이 불가능할 수 있습니다.
        미용실 정보 출처: mapledb.kr 맵/NPC 데이터 · 커뮤니티 정리글 (2.0 뷰티샵 개편 기준).
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
