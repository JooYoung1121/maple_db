"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchSuggest } from "@/lib/api";
import { expBetween } from "@/lib/expTable";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ─── 타입 ───
interface BrainNode {
  id: string;
  type: "char" | "map" | "mob" | "item" | "quest" | "goal" | "npc" | "tool";
  entity_id: number;
  label: string;
  sub?: string;
  icon?: string | null;
  emoji?: string;
  detail_url?: string;
  group?: string;
  // 시뮬레이션 상태
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
  phase: number;
}

interface BrainLink {
  source: string;
  target: string;
  kind: string;
}

interface ApiNode {
  id: string;
  type: BrainNode["type"];
  entity_id: number;
  label: string;
  sub?: string;
  icon?: string | null;
  emoji?: string;
  detail_url?: string;
  group?: string;
}

interface CharInfo {
  level: number;
  job: string;      // 계열 (전사/마법사/궁수/도적/해적)
  subJob?: string;  // 차수별 실제 직업 (히어로, 비숍, 썬콜 등)
  nickname?: string;
}

const JOBS = ["전사", "마법사", "궁수", "도적", "해적"];

// 원작(프리빅뱅 KMS) 차수별 직업 트리
const JOB_TREE: Record<string, Record<number, string[]>> = {
  전사: { 1: ["검사"], 2: ["파이터", "페이지", "스피어맨"], 3: ["크루세이더", "나이트", "용기사"], 4: ["히어로", "팔라딘", "다크나이트"] },
  마법사: { 1: ["매지션"], 2: ["위자드(불,독)", "위자드(썬,콜)", "클레릭"], 3: ["메이지(불,독)", "메이지(썬,콜)", "프리스트"], 4: ["아크메이지(불,독)", "아크메이지(썬,콜)", "비숍"] },
  궁수: { 1: ["아처"], 2: ["헌터", "사수"], 3: ["레인저", "저격수"], 4: ["보우마스터", "신궁"] },
  도적: { 1: ["로그"], 2: ["어쌔신", "시프"], 3: ["허밋", "시프마스터"], 4: ["나이트로드", "섀도어"] },
  해적: { 1: ["해적"], 2: ["인파이터", "건슬링거"], 3: ["버커니어", "발키리"], 4: ["바이퍼", "캡틴"] },
};

function jobTier(level: number): number {
  return level >= 120 ? 4 : level >= 70 ? 3 : level >= 30 ? 2 : 1;
}

// 사이트 도구 연결 노드 (그래프에 정적 주입)
const TOOL_HUBS: { hub: { id: string; label: string; emoji: string }; children: { id: string; label: string; emoji: string; href: string }[] }[] = [
  {
    hub: { id: "tool:calc", label: "계산기·시뮬", emoji: "🧰" },
    children: [
      { id: "tool:exp", label: "경험치 계산기", emoji: "📈", href: "/exp" },
      { id: "tool:skill-sim", label: "스킬 시뮬레이터", emoji: "✨", href: "/skill-sim" },
      { id: "tool:gear-sim", label: "장비 세팅", emoji: "🛡️", href: "/gear-sim" },
      { id: "tool:nhit", label: "엔방컷 계산기", emoji: "⚔️", href: "/nhit" },
      { id: "tool:scroll", label: "주문서 계산기", emoji: "📖", href: "/scroll" },
      { id: "tool:hunt", label: "사냥터 추천", emoji: "🏕️", href: "/hunt" },
    ],
  },
  {
    hub: { id: "tool:play", label: "놀이터", emoji: "🎮" },
    children: [
      { id: "tool:codi", label: "코디 시뮬레이터", emoji: "👕", href: "/codi" },
      { id: "tool:worldcup", label: "이상형 월드컵", emoji: "🏆", href: "/worldcup" },
      { id: "tool:versus", label: "대전 게임", emoji: "🎯", href: "/versus" },
      { id: "tool:quiz", label: "메이플 퀴즈", emoji: "❓", href: "/quiz" },
      { id: "tool:mapletle", label: "추억틀", emoji: "🍁", href: "/mapletle" },
    ],
  },
];

// 타입별 색 (라이트/다크) — 캔버스는 CSS 토큰을 못 쓰므로 여기서 고정 팔레트로 정의
const TYPE_COLORS: Record<string, { light: string; dark: string; emoji: string; name: string }> = {
  char: { light: "#e8590c", dark: "#ff9f45", emoji: "⭐", name: "내 캐릭터" },
  map: { light: "#1971c2", dark: "#63b3ff", emoji: "🗺️", name: "사냥터/맵" },
  mob: { light: "#c2255c", dark: "#ff7eb0", emoji: "👾", name: "몬스터" },
  item: { light: "#b08900", dark: "#ffd43b", emoji: "🎁", name: "아이템" },
  quest: { light: "#6741d9", dark: "#b197fc", emoji: "📜", name: "퀘스트" },
  goal: { light: "#2f9e44", dark: "#69db7c", emoji: "🚩", name: "다음 목표" },
  npc: { light: "#0c8599", dark: "#66d9e8", emoji: "🧙", name: "NPC" },
  tool: { light: "#495057", dark: "#adb5bd", emoji: "🧰", name: "사이트 기능" },
};

const EXPANDABLE = new Set(["map", "mob", "item", "quest"]);

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export default function BrainPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const nodesRef = useRef<Map<string, BrainNode>>(new Map());
  const linksRef = useRef<BrainLink[]>([]);
  const linkKeysRef = useRef<Set<string>>(new Set());
  const imagesRef = useRef<Map<string, HTMLImageElement | null>>(new Map());
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistRef = useRef<number | null>(null);
  const dragRef = useRef<{ node: BrainNode | null; panning: boolean; startX: number; startY: number; moved: boolean }>({
    node: null, panning: false, startX: 0, startY: 0, moved: false,
  });
  const lastClickRef = useRef<{ id: string; t: number }>({ id: "", t: 0 });
  const darkRef = useRef(false);
  const selectedRef = useRef<string | null>(null);
  const pinsRef = useRef<{ nodes: ApiNode[]; links: BrainLink[] } | null>(null);
  const linkingFromRef = useRef<string | null>(null);

  const [char, setChar] = useState<CharInfo | null | undefined>(undefined); // undefined = 로딩 전
  const [selected, setSelected] = useState<BrainNode | null>(null);
  const [popPos, setPopPos] = useState<{ x: number; y: number } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandLoading, setExpandLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [suggestions, setSuggestions] = useState<{ entity_type: string; entity_id: number; name: string; name_kr: string | null; icon_url: string | null }[]>([]);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  // 성장 예측: 분당 처치 수(내 사냥 속도) + 맵 통계 캐시
  const [eff, setEff] = useState(30);
  const [mapStats, setMapStats] = useState<Record<number, { exp_per_cycle: number; meso_per_cycle: number; total_spawn: number; avg_mob_level: number } | null>>({});
  const [setupLevel, setSetupLevel] = useState("");
  const [setupJob, setSetupJob] = useState("");
  const [setupSubJob, setSetupSubJob] = useState("");
  const [setupNickname, setSetupNickname] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [loginHintDismissed, setLoginHintDismissed] = useState(false);

  // ─── 이미지 로더 ───
  const loadImage = useCallback((url: string | null | undefined) => {
    if (!url) return null;
    const cache = imagesRef.current;
    if (cache.has(url)) return cache.get(url) ?? null;
    cache.set(url, null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => cache.set(url, img);
    img.onerror = () => cache.set(url, null);
    img.src = url;
    return null;
  }, []);

  // ─── 그래프 병합 — 새로 생성된 노드 id 목록 반환 ───
  const mergeGraph = useCallback((apiNodes: ApiNode[], apiLinks: BrainLink[], near?: BrainNode): string[] => {
    const created: string[] = [];
    const nodes = nodesRef.current;
    for (const n of apiNodes) {
      if (nodes.has(n.id)) continue;
      created.push(n.id);
      const baseX = near ? near.x : 0;
      const baseY = near ? near.y : 0;
      const ang = Math.random() * Math.PI * 2;
      const r = 60 + Math.random() * 60;
      nodes.set(n.id, {
        ...n,
        x: baseX + Math.cos(ang) * r,
        y: baseY + Math.sin(ang) * r,
        vx: 0, vy: 0,
        phase: Math.random() * Math.PI * 2,
      });
      if (n.icon) loadImage(n.icon);
    }
    for (const l of apiLinks) {
      const key = `${l.source}→${l.target}`;
      const rev = `${l.target}→${l.source}`;
      if (linkKeysRef.current.has(key) || linkKeysRef.current.has(rev)) continue;
      linkKeysRef.current.add(key);
      linksRef.current.push(l);
    }
    return created;
  }, [loadImage]);

  // 노드별 확장으로 생긴 자식 목록 (가지 접기용)
  const expandChildrenRef = useRef<Map<string, string[]>>(new Map());

  // ─── 내 연결(핀·커스텀 링크) 저장/복원 ───
  const persistPins = useCallback(() => {
    const links = linksRef.current.filter((l) => l.kind === "pin" || l.kind === "custom");
    const ids = new Set<string>();
    links.forEach((l) => { ids.add(l.source); ids.add(l.target); });
    ids.delete("char:me");
    const nodes = [...nodesRef.current.values()]
      .filter((n) => ids.has(n.id))
      .map((n) => ({
        id: n.id, type: n.type, entity_id: n.entity_id, label: n.label,
        sub: n.sub, icon: n.icon, emoji: n.emoji, detail_url: n.detail_url,
      }));
    const payload = { nodes, links };
    pinsRef.current = payload;
    try { localStorage.setItem("brain_pins", JSON.stringify(payload)); } catch { /* ignore */ }
    if (loggedInRef.current) {
      fetch(`${API_BASE}/api/me/settings/brain_pins`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: payload }),
      }).catch(() => {});
    }
  }, []);

  const addLink = useCallback((source: string, target: string, kind: string) => {
    const key = `${source}→${target}`;
    const rev = `${target}→${source}`;
    if (linkKeysRef.current.has(key) || linkKeysRef.current.has(rev)) return false;
    linkKeysRef.current.add(key);
    linksRef.current.push({ source, target, kind });
    return true;
  }, []);

  const removeNode = useCallback((id: string) => {
    if (id === "char:me") return;
    nodesRef.current.delete(id);
    linksRef.current = linksRef.current.filter((l) => {
      const hit = l.source === id || l.target === id;
      if (hit) linkKeysRef.current.delete(`${l.source}→${l.target}`);
      return !hit;
    });
    setSelected(null);
    setPopPos(null);
    persistPins();
  }, [persistPins]);

  // ─── 가지 접기: 이 노드의 확장으로 생긴 자식 중 다른 연결 없는 것 제거 ───
  const collapseNode = useCallback((id: string) => {
    const children = expandChildrenRef.current.get(id) || [];
    const protectedIds = new Set<string>();
    for (const l of linksRef.current) {
      if (l.kind === "pin" || l.kind === "custom") { protectedIds.add(l.source); protectedIds.add(l.target); }
    }
    for (const cid of children) {
      if (protectedIds.has(cid)) continue;
      if (expandChildrenRef.current.has(cid)) continue; // 자식이 또 펼쳐져 있으면 유지
      const others = linksRef.current.filter(
        (l) => (l.source === cid || l.target === cid) && l.source !== id && l.target !== id
      );
      if (others.length > 0) continue;
      nodesRef.current.delete(cid);
      linksRef.current = linksRef.current.filter((l) => {
        const hit = l.source === cid || l.target === cid;
        if (hit) linkKeysRef.current.delete(`${l.source}→${l.target}`);
        return !hit;
      });
    }
    expandChildrenRef.current.delete(id);
    setExpanded((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  const resetGraph = useCallback(() => {
    nodesRef.current = new Map();
    linksRef.current = [];
    linkKeysRef.current = new Set();
    setExpanded(new Set());
    setSelected(null);
    setPopPos(null);
    const wrap = wrapRef.current;
    transformRef.current = {
      x: wrap ? wrap.clientWidth / 2 : 0,
      y: wrap ? wrap.clientHeight / 2 : 0,
      k: 1,
    };
  }, []);

  // ─── ego 로드 ───
  const loadEgo = useCallback(async (c: CharInfo) => {
    resetGraph();
    try {
      const jobDisplay = c.subJob || c.job;
      const d = await fetchJSON<{ nodes: ApiNode[]; links: BrainLink[] }>(
        `/api/brain/ego?level=${c.level}&job=${encodeURIComponent(jobDisplay)}`
      );
      mergeGraph(d.nodes, d.links);
      // 사이트 도구 허브 주입 (정적)
      const toolNodes: ApiNode[] = [];
      const toolLinks: BrainLink[] = [];
      for (const g of TOOL_HUBS) {
        toolNodes.push({ id: g.hub.id, type: "tool", entity_id: 0, label: g.hub.label, emoji: g.hub.emoji, sub: "사이트 기능 모음" });
        toolLinks.push({ source: "char:me", target: g.hub.id, kind: "tool" });
        for (const ch of g.children) {
          toolNodes.push({ id: ch.id, type: "tool", entity_id: 0, label: ch.label, emoji: ch.emoji, detail_url: ch.href, sub: "더블클릭으로 이동" });
          toolLinks.push({ source: g.hub.id, target: ch.id, kind: "tool" });
        }
      }
      mergeGraph(toolNodes, toolLinks);
      // 내 연결(핀·커스텀) 복원
      if (pinsRef.current) {
        mergeGraph(pinsRef.current.nodes, pinsRef.current.links);
      }
      const me = nodesRef.current.get("char:me");
      if (me) {
        me.fx = 0; me.fy = 0; me.x = 0; me.y = 0;
        if (c.nickname) {
          me.label = c.nickname;
          me.sub = `Lv.${c.level}${jobDisplay ? ` ${jobDisplay}` : ""}`;
        }
      }
    } catch {
      // 네트워크 오류 시 빈 화면 유지
    }
  }, [mergeGraph, resetGraph]);

  // ─── 초기화: URL 파라미터(공유용) > 계정 저장값 > localStorage ───
  const loggedInRef = useRef(false);
  useEffect(() => {
    fetch(`${API_BASE}/api/auth/config`).then((r) => r.json()).then((d) => setAuthEnabled(!!d.enabled)).catch(() => {});
    try {
      const savedPins = localStorage.getItem("brain_pins");
      if (savedPins) pinsRef.current = JSON.parse(savedPins);
    } catch { /* ignore */ }
    (async () => {
      try {
        const sp = new URLSearchParams(window.location.search);
        const lv = parseInt(sp.get("lv") || "", 10);
        if (lv >= 1 && lv <= 200) {
          const c: CharInfo = {
            level: lv,
            job: sp.get("job") || "",
            subJob: sp.get("sub") || undefined,
            nickname: sp.get("name") || undefined,
          };
          localStorage.setItem("brain_char", JSON.stringify(c));
          setChar(c);
          loadEgo(c);
          return;
        }
        // 로그인 시 계정 저장값 우선 (기기 간 동기화)
        let account: CharInfo | null = null;
        try {
          const me = await fetch(`${API_BASE}/api/auth/me`).then((r) => r.json());
          if (me.user) {
            loggedInRef.current = true;
            const bc = me.settings?.brain_char;
            if (bc && bc.level >= 1 && bc.level <= 200) account = bc as CharInfo;
            if (me.settings?.brain_pins) pinsRef.current = me.settings.brain_pins;
          }
        } catch { /* 비로그인 */ }
        if (account) {
          localStorage.setItem("brain_char", JSON.stringify(account));
          setChar(account);
          loadEgo(account);
          return;
        }
        const saved = localStorage.getItem("brain_char");
        if (saved) {
          const c = JSON.parse(saved) as CharInfo;
          setChar(c);
          loadEgo(c);
          // 로그인 상태인데 계정에 없으면 localStorage 값을 계정으로 승격
          if (loggedInRef.current) {
            fetch(`${API_BASE}/api/me/settings/brain_char`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ value: c }),
            }).catch(() => {});
          }
          return;
        }
      } catch { /* ignore */ }
      setChar(null);
    })();
  }, [loadEgo]);

  // ─── 노드 확장 ───
  const expandNode = useCallback(async (node: BrainNode) => {
    if (!EXPANDABLE.has(node.type)) return;
    setExpandLoading(true);
    try {
      const d = await fetchJSON<{ nodes: ApiNode[]; links: BrainLink[] }>(
        `/api/brain/expand?type=${node.type}&id=${node.entity_id}`
      );
      const created = mergeGraph(d.nodes, d.links, node);
      expandChildrenRef.current.set(node.id, created);
      setExpanded((prev) => new Set(prev).add(node.id));
    } catch { /* ignore */ } finally {
      setExpandLoading(false);
    }
  }, [mergeGraph]);

  // ─── 검색 ───
  useEffect(() => {
    if (!searchQ.trim()) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const d = await searchSuggest(searchQ.trim(), 8);
        setSuggestions(d.suggestions.filter((s) => ["item", "mob", "map"].includes(s.entity_type)));
      } catch { setSuggestions([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQ]);

  const pickSuggestion = useCallback(async (s: { entity_type: string; entity_id: number; name: string; name_kr: string | null; icon_url: string | null }) => {
    setSearchQ("");
    setSuggestions([]);
    const id = `${s.entity_type}:${s.entity_id}`;
    let node = nodesRef.current.get(id);
    if (!node) {
      mergeGraph([{
        id, type: s.entity_type as BrainNode["type"], entity_id: s.entity_id,
        label: s.name_kr || s.name, icon: s.icon_url,
        detail_url: `/${s.entity_type}s/${s.entity_id}`,
      }], []);
      node = nodesRef.current.get(id)!;
    }
    // 검색으로 넣은 노드는 내 캐릭터에 자동 연결(📌 핀) — 떠다니는 섬 방지 + 저장
    if (nodesRef.current.has("char:me") && addLink("char:me", id, "pin")) {
      persistPins();
    }
    // 카메라 이동 + 선택 + 자동 확장
    const cv = canvasRef.current;
    if (cv && node) {
      const tr = transformRef.current;
      tr.x = cv.clientWidth / 2 - node.x * tr.k;
      tr.y = cv.clientHeight / 2 - node.y * tr.k;
    }
    if (node) {
      setSelected(node);
      await expandNode(node);
    }
  }, [expandNode, mergeGraph, addLink, persistPins]);

  // ─── 캐릭터 설정 저장 ───
  const applySetup = useCallback(() => {
    const lv = parseInt(setupLevel, 10);
    if (!lv || lv < 1 || lv > 200) return;
    const c: CharInfo = {
      level: lv,
      job: setupJob,
      subJob: setupSubJob || undefined,
      nickname: setupNickname.trim() || undefined,
    };
    localStorage.setItem("brain_char", JSON.stringify(c));
    if (loggedInRef.current) {
      fetch(`${API_BASE}/api/me/settings/brain_char`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: c }),
      }).catch(() => {});
    }
    setChar(c);
    setShowSetup(false);
    loadEgo(c);
    // 첫 연결이면 사용법 가이드 자동 표시
    try {
      if (!localStorage.getItem("brain_guide_seen")) {
        localStorage.setItem("brain_guide_seen", "1");
        setGuideStep(0);
        setShowGuide(true);
      }
    } catch { /* ignore */ }
  }, [setupLevel, setupJob, setupSubJob, setupNickname, loadEgo]);

  useEffect(() => { selectedRef.current = selected?.id ?? null; }, [selected]);
  useEffect(() => { linkingFromRef.current = linkingFrom; }, [linkingFrom]);

  // 효율 설정 복원/저장
  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem("brain_eff") || "", 10);
      if (saved >= 10 && saved <= 100) setEff(saved);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("brain_eff", String(eff)); } catch { /* ignore */ }
  }, [eff]);

  // ─── 경로 하이라이트: 선택 노드 → 내 캐릭터 BFS ───
  const pathRef = useRef<{ nodes: Set<string>; links: Set<string> } | null>(null);
  useEffect(() => {
    if (!selected || selected.id === "char:me") { pathRef.current = null; return; }
    const adj = new Map<string, { to: string; key: string }[]>();
    for (const l of linksRef.current) {
      const key = `${l.source}→${l.target}`;
      if (!adj.has(l.source)) adj.set(l.source, []);
      if (!adj.has(l.target)) adj.set(l.target, []);
      adj.get(l.source)!.push({ to: l.target, key });
      adj.get(l.target)!.push({ to: l.source, key });
    }
    const prev = new Map<string, { from: string; key: string }>();
    const queue = [selected.id];
    const seen = new Set([selected.id]);
    let found = false;
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur === "char:me") { found = true; break; }
      for (const e of adj.get(cur) || []) {
        if (!seen.has(e.to)) { seen.add(e.to); prev.set(e.to, { from: cur, key: e.key }); queue.push(e.to); }
      }
    }
    if (!found) { pathRef.current = null; return; }
    const pn = new Set<string>(["char:me"]);
    const pl = new Set<string>();
    let cur = "char:me";
    while (cur !== selected.id) {
      const p = prev.get(cur)!;
      pl.add(p.key);
      pn.add(p.from);
      cur = p.from;
    }
    pathRef.current = { nodes: pn, links: pl };
  }, [selected]);

  // 맵 노드 선택 시 성장 예측 통계 로드
  useEffect(() => {
    if (selected?.type !== "map") return;
    const mid = selected.entity_id;
    if (mapStats[mid] !== undefined) return;
    setMapStats((prev) => ({ ...prev, [mid]: null }));
    fetchJSON<{ exp_per_cycle: number; meso_per_cycle: number; total_spawn: number; avg_mob_level: number }>(
      `/api/brain/map-stats?id=${mid}`
    )
      .then((d) => setMapStats((prev) => ({ ...prev, [mid]: d })))
      .catch(() => {});
  }, [selected, mapStats]);

  // ─── 물리 시뮬 + 렌더 루프 ───
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wrap.clientWidth * dpr;
      canvas.height = wrap.clientHeight * dpr;
      canvas.style.width = `${wrap.clientWidth}px`;
      canvas.style.height = `${wrap.clientHeight}px`;
    };
    resize();
    // 첫 마운트: 월드 원점(내 캐릭터)을 화면 중앙에
    if (transformRef.current.x === 0 && transformRef.current.y === 0) {
      transformRef.current.x = wrap.clientWidth / 2;
      transformRef.current.y = wrap.clientHeight / 2;
    }
    window.addEventListener("resize", resize);

    const obs = new MutationObserver(() => {
      darkRef.current = document.documentElement.classList.contains("dark");
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    darkRef.current = document.documentElement.classList.contains("dark");

    const nodeRadius = (n: BrainNode) => (n.type === "char" ? 26 : n.type === "goal" ? 20 : 16);

    const tick = () => {
      t += 0.016;
      const nodes = [...nodesRef.current.values()];
      const links = linksRef.current;
      const byId = nodesRef.current;

      // 반발력
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          const d = Math.sqrt(d2);
          const f = Math.min(2600 / d2, 8);
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }
      // 스프링
      for (const l of links) {
        const a = byId.get(l.source), b = byId.get(l.target);
        if (!a || !b) continue;
        const rest = l.kind === "hunt" || l.kind === "quest" || l.kind === "goal" ? 150 : 95;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = (d - rest) * 0.02;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // 중심 인력 + 둥둥 부유 + 적분
      for (const n of nodes) {
        n.vx += -n.x * 0.0008 + Math.sin(t * 0.7 + n.phase) * 0.02;
        n.vy += -n.y * 0.0008 + Math.cos(t * 0.9 + n.phase) * 0.02;
        n.vx *= 0.86; n.vy *= 0.86;
        if (n.fx != null) { n.x = n.fx; n.vx = 0; } else n.x += n.vx;
        if (n.fy != null) { n.y = n.fy; n.vy = 0; } else n.y += n.vy;
      }

      // ─ 렌더 ─
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr, H = canvas.height / dpr;
      const dark = darkRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // 배경 점 패턴 (우주 느낌)
      ctx.fillStyle = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      const tr = transformRef.current;
      const grid = 90 * tr.k;
      if (grid > 24) {
        for (let gx = ((tr.x % grid) + grid) % grid; gx < W; gx += grid) {
          for (let gy = ((tr.y % grid) + grid) % grid; gy < H; gy += grid) {
            ctx.fillRect(gx, gy, 2, 2);
          }
        }
      }

      ctx.save();
      ctx.translate(tr.x, tr.y);
      ctx.scale(tr.k, tr.k);

      // 경로 하이라이트 활성 여부
      const path = selectedRef.current ? pathRef.current : null;
      // 핀·커스텀 연결 노드 (줌아웃 라벨 우선 표시용)
      const pinnedIds = new Set<string>();
      for (const l of links) {
        if (l.kind === "pin" || l.kind === "custom") { pinnedIds.add(l.source); pinnedIds.add(l.target); }
      }

      // 링크 — pin(검색 추가)·custom(직접 연결)은 구분 표시
      for (const l of links) {
        const a = byId.get(l.source), b = byId.get(l.target);
        if (!a || !b) continue;
        ctx.globalAlpha = path && !path.links.has(`${l.source}→${l.target}`) ? 0.15 : 1;
        if (l.kind === "custom") {
          ctx.strokeStyle = dark ? "rgba(255,159,69,0.75)" : "rgba(232,89,12,0.6)";
          ctx.lineWidth = 2.5 / tr.k;
          ctx.setLineDash([]);
        } else if (l.kind === "pin") {
          ctx.strokeStyle = dark ? "rgba(255,159,69,0.4)" : "rgba(232,89,12,0.35)";
          ctx.lineWidth = 1.5 / tr.k;
          ctx.setLineDash([5, 4]);
        } else {
          ctx.strokeStyle = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)";
          ctx.lineWidth = 1.5 / tr.k;
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // 연결 모드: 출발 노드 → 커서 방향 안내선은 출발 노드 강조로 대체
      const linkingId = linkingFromRef.current;
      if (linkingId) {
        const ln = byId.get(linkingId);
        if (ln) {
          ctx.beginPath();
          ctx.arc(ln.x, ln.y, 24 + Math.sin(t * 4) * 3, 0, Math.PI * 2);
          ctx.strokeStyle = dark ? "#ff9f45" : "#e8590c";
          ctx.lineWidth = 2 / tr.k;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 노드
      const selId = selectedRef.current;
      for (const n of nodes) {
        const r = nodeRadius(n);
        const col = TYPE_COLORS[n.type] ?? TYPE_COLORS.map;
        const color = dark ? col.dark : col.light;
        ctx.globalAlpha = path && !path.nodes.has(n.id) && n.id !== selId ? 0.3 : 1;

        if (n.id === selId) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 7 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2 / tr.k;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "#1d2026" : "#ffffff";
        ctx.fill();
        ctx.lineWidth = n.type === "char" ? 3 : 2;
        ctx.strokeStyle = color;
        ctx.stroke();

        const img = n.icon ? imagesRef.current.get(n.icon) : null;
        if (img) {
          const size = r * 1.3;
          ctx.imageSmoothingEnabled = false;
          ctx.save();
          ctx.beginPath();
          ctx.arc(n.x, n.y, r - 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, n.x - size / 2, n.y - size / 2, size, size);
          ctx.restore();
        } else {
          ctx.font = `${r}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.emoji ?? col.emoji, n.x, n.y + 1);
        }

        // 라벨: 확대 시 전부, 축소 시 중요 노드(캐릭터·목표·허브·핀·선택)만
        const important =
          n.type === "char" || n.type === "goal" || n.id === "tool:calc" || n.id === "tool:play" ||
          pinnedIds.has(n.id) || n.id === selId;
        if (tr.k > 0.55 || (tr.k > 0.3 && important)) {
          ctx.font = `${11 / Math.min(tr.k, 1.4)}px Galmuri11, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const label = n.label.length > 12 ? n.label.slice(0, 12) + "…" : n.label;
          ctx.lineWidth = 3;
          ctx.strokeStyle = dark ? "rgba(14,16,20,0.85)" : "rgba(255,255,255,0.85)";
          ctx.strokeText(label, n.x, n.y + r + 5);
          ctx.fillStyle = dark ? "#e8eaed" : "#2a2d33";
          ctx.fillText(label, n.x, n.y + r + 5);
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // 팝오버 위치 추적
      if (selId) {
        const n = byId.get(selId);
        if (n) {
          const sx = n.x * tr.k + tr.x;
          const sy = n.y * tr.k + tr.y;
          setPopPos((prev) => (prev && Math.abs(prev.x - sx) < 0.5 && Math.abs(prev.y - sy) < 0.5 ? prev : { x: sx, y: sy }));
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      obs.disconnect();
    };
  }, []);

  // ─── 포인터 인터랙션 ───
  const toWorld = useCallback((sx: number, sy: number) => {
    const tr = transformRef.current;
    return { x: (sx - tr.x) / tr.k, y: (sy - tr.y) / tr.k };
  }, []);

  const hitTest = useCallback((sx: number, sy: number): BrainNode | null => {
    const { x, y } = toWorld(sx, sy);
    let best: BrainNode | null = null;
    let bestD = Infinity;
    for (const n of nodesRef.current.values()) {
      const r = (n.type === "char" ? 26 : 16) + 6;
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < r * r && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }, [toWorld]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    pointersRef.current.set(e.pointerId, { x: sx, y: sy });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      pinchDistRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      dragRef.current = { node: null, panning: false, startX: sx, startY: sy, moved: true };
      return;
    }
    const node = hitTest(sx, sy);
    dragRef.current = { node, panning: !node, startX: sx, startY: sy, moved: false };
    if (node && node.type !== "char") { node.fx = node.x; node.fy = node.y; }
  }, [hitTest]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const prev = pointersRef.current.get(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: sx, y: sy });

    if (pointersRef.current.size === 2 && pinchDistRef.current != null) {
      const pts = [...pointersRef.current.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
      const tr = transformRef.current;
      const factor = d / pinchDistRef.current;
      const k = Math.min(Math.max(tr.k * factor, 0.3), 3);
      tr.x = cx - ((cx - tr.x) / tr.k) * k;
      tr.y = cy - ((cy - tr.y) / tr.k) * k;
      tr.k = k;
      pinchDistRef.current = d;
      return;
    }
    if (!prev) return;
    const drag = dragRef.current;
    const dx = sx - prev.x, dy = sy - prev.y;
    if (Math.abs(sx - drag.startX) + Math.abs(sy - drag.startY) > 5) drag.moved = true;

    if (drag.node && drag.node.type !== "char") {
      const tr = transformRef.current;
      drag.node.fx = (drag.node.fx ?? drag.node.x) + dx / tr.k;
      drag.node.fy = (drag.node.fy ?? drag.node.y) + dy / tr.k;
    } else if (drag.panning && e.buttons > 0) {
      transformRef.current.x += dx;
      transformRef.current.y += dy;
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    pinchDistRef.current = null;
    const drag = dragRef.current;
    const node = drag.node;
    if (node && node.type !== "char") { node.fx = null; node.fy = null; }

    if (!drag.moved) {
      // 연결 모드: 다음 클릭한 노드와 커스텀 링크 생성
      const linking = linkingFromRef.current;
      if (linking) {
        if (node && node.id !== linking) {
          if (addLink(linking, node.id, "custom")) persistPins();
        }
        setLinkingFrom(null);
        dragRef.current = { node: null, panning: false, startX: 0, startY: 0, moved: false };
        return;
      }
      if (node) {
        const now = Date.now();
        const last = lastClickRef.current;
        if (last.id === node.id && now - last.t < 350 && node.detail_url) {
          router.push(node.detail_url);
          return;
        }
        lastClickRef.current = { id: node.id, t: now };
        setSelected(node);
      } else {
        setSelected(null);
        setPopPos(null);
      }
    }
    dragRef.current = { node: null, panning: false, startX: 0, startY: 0, moved: false };
  }, [router, addLink, persistPins]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const tr = transformRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const k = Math.min(Math.max(tr.k * factor, 0.3), 3);
    tr.x = sx - ((sx - tr.x) / tr.k) * k;
    tr.y = sy - ((sy - tr.y) / tr.k) * k;
    tr.k = k;
  }, []);

  // ─── UI ───
  const needsSetup = char === null || showSetup;

  return (
    <div ref={wrapRef} className="fixed left-0 right-0 bottom-0 top-14 xl:left-56 overflow-hidden bg-bg touch-none select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />

      {/* 상단 바: 검색 + 캐릭터 칩 */}
      <div className="absolute top-3 left-3 right-3 flex items-start gap-2 pointer-events-none">
        <div className="relative flex-1 max-w-sm pointer-events-auto">
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="🔍 아이템·몬스터·맵 검색 → 그래프에 추가"
            className="w-full pixel-panel px-3 py-2 text-sm bg-surface text-ink placeholder:text-dim outline-none"
          />
          {suggestions.length > 0 && (
            <div className="pixel-panel absolute top-full mt-1 left-0 right-0 bg-surface z-20 max-h-64 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={`${s.entity_type}:${s.entity_id}`}
                  onClick={() => pickSuggestion(s)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[color-mix(in_srgb,var(--c-maple)_10%,transparent)]"
                >
                  {s.icon_url && <img src={s.icon_url} alt="" className="w-6 h-6 object-contain" style={{ imageRendering: "pixelated" }} />}
                  <span className="text-ink">{s.name_kr || s.name}</span>
                  <span className="ml-auto text-[10px] text-dim font-pixel">
                    {TYPE_COLORS[s.entity_type]?.name ?? s.entity_type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {char && (
          <button
            onClick={() => {
              setShowSetup(true);
              setSetupLevel(String(char.level));
              setSetupJob(char.job);
              setSetupSubJob(char.subJob || "");
              setSetupNickname(char.nickname || "");
            }}
            className="pixel-btn px-3 py-2 text-sm pointer-events-auto shrink-0"
          >
            ⭐ {char.nickname ? `${char.nickname} · ` : ""}Lv.{char.level}{(char.subJob || char.job) ? ` ${char.subJob || char.job}` : ""}
          </button>
        )}
      </div>

      {/* 로그인 유도 (비로그인 + 로그인 기능 활성) */}
      {char && authEnabled && !loggedInRef.current && !loginHintDismissed && !needsSetup && (
        <div className="pixel-panel absolute top-14 right-3 bg-surface px-3 py-2 flex items-center gap-2 text-xs text-dim max-w-xs">
          <span>🔐 <a href={`/api/auth/discord/login?next=/brain`} className="text-maple underline">로그인</a>하면 캐릭터가 계정에 저장돼요</span>
          <button onClick={() => setLoginHintDismissed(true)} className="text-dim hover:text-ink" aria-label="닫기">✕</button>
        </div>
      )}

      {/* 범례 + 안내 */}
      <div className="absolute bottom-3 left-3 pointer-events-none space-y-1">
        <div className="flex flex-wrap gap-2">
          {(["map", "quest", "mob", "item", "goal"] as const).map((tk) => (
            <span key={tk} className="pixel-panel bg-surface px-2 py-1 text-[10px] font-pixel text-dim flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: TYPE_COLORS[tk].light }} />
              {TYPE_COLORS[tk].name}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-dim font-pixel">
          클릭 = 정보 · 더블클릭 = 상세 페이지 · 드래그 = 이동 · 휠/핀치 = 확대 — 사냥터 추천은 원작 수치(몹 EXP × 젠 수) 기반 근사치
        </p>
      </div>

      {/* 노드 팝오버 — 화면 경계 클램프 */}
      {selected && popPos && !needsSetup && (
        <div
          className="pixel-panel absolute z-10 bg-surface p-3 w-56 -translate-x-1/2"
          style={{
            left: Math.min(Math.max(popPos.x, 124), (wrapRef.current?.clientWidth ?? 9999) - 124),
            top: Math.min(Math.max(popPos.y + 34, 8), (wrapRef.current?.clientHeight ?? 9999) - (selected.type === "map" ? 360 : 190)),
          }}
        >
          <p className="font-pixel text-sm text-ink font-bold">{selected.label}</p>
          {selected.sub && <p className="text-xs text-dim mt-0.5">{selected.sub}</p>}
          {selected.type === "map" && char && (() => {
            const st = mapStats[selected.entity_id];
            if (st === undefined) return null;
            if (st === null) return <p className="text-[10px] text-dim mt-2">예측 계산 중…</p>;
            if (!st.exp_per_cycle || !st.total_spawn) return <p className="text-[10px] text-dim mt-2">젠 정보가 없어 예측 불가</p>;
            const killsPerHour = eff * 60;
            const expH = (st.exp_per_cycle / st.total_spawn) * killsPerHour;
            const mesoH = (st.meso_per_cycle / st.total_spawn) * killsPerHour;
            const goal = Math.min(char.level + 5, 200);
            const fmtH = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))}분` : h < 100 ? `${h.toFixed(1)}시간` : `${Math.round(h)}시간`);
            const fmtN = (n: number) =>
              n >= 100000000 ? `${(n / 100000000).toFixed(1)}억` : n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만` : `${Math.round(n).toLocaleString()}`;
            return (
              <div className="mt-2 pt-2 border-t border-edge/60 space-y-1">
                <p className="text-[10px] font-pixel text-maple">⏱ 성장 예측 — Lv.{char.level} 기준</p>
                <p className="text-xs text-ink">시간당 EXP ≈ <b>{fmtN(expH)}</b></p>
                <p className="text-xs text-ink">다음 레벨까지 ≈ <b>{fmtH(expBetween(char.level, char.level + 1) / expH)}</b></p>
                <p className="text-xs text-ink">Lv.{goal}까지 ≈ <b>{fmtH(expBetween(char.level, goal) / expH)}</b></p>
                {st.meso_per_cycle > 0 && (
                  <p className="text-xs text-ink">기대 메소 ≈ <b>{fmtN(mesoH)}</b>/시간</p>
                )}
                <div className="flex items-center gap-1.5">
                  <input type="range" min={10} max={80} step={5} value={eff} onChange={(e) => setEff(Number(e.target.value))} className="flex-1 accent-[var(--c-maple)]" />
                  <span className="text-[10px] text-dim shrink-0">분당 {eff}마리</span>
                </div>
                <p className="text-[9px] text-dim leading-tight">
                  내 사냥 속도(분당 처치) × 이 맵 몹 평균 EXP 기준 근사 · 메소는 드랍 NPC 판매가 기준, 시세 미반영
                </p>
              </div>
            );
          })()}
          <div className="flex flex-col gap-1.5 mt-2">
            {selected.type === "char" ? (
              <button
                onClick={() => {
                  setShowSetup(true);
                  setSetupLevel(String(char?.level ?? ""));
                  setSetupJob(char?.job ?? "");
                  setSetupSubJob(char?.subJob ?? "");
                  setSetupNickname(char?.nickname ?? "");
                }}
                className="pixel-btn px-2 py-1.5 text-xs"
              >
                캐릭터 설정 변경
              </button>
            ) : (
              <>
                {EXPANDABLE.has(selected.type) && !expanded.has(selected.id) && (
                  <button onClick={() => expandNode(selected)} disabled={expandLoading} className="pixel-btn px-2 py-1.5 text-xs disabled:opacity-50">
                    {expandLoading ? "펼치는 중…" : "🔍 연결 펼치기"}
                  </button>
                )}
                {expanded.has(selected.id) && (
                  <button onClick={() => collapseNode(selected.id)} className="pixel-btn px-2 py-1.5 text-xs">
                    📕 가지 접기
                  </button>
                )}
                {selected.detail_url && (
                  <button onClick={() => router.push(selected.detail_url!)} className="pixel-btn px-2 py-1.5 text-xs">
                    {selected.type === "tool" ? "바로가기 →" : "상세 정보 →"}
                  </button>
                )}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setLinkingFrom(selected.id); setSelected(null); setPopPos(null); }}
                    className="flex-1 px-2 py-1.5 text-xs font-pixel border-2 border-edge text-dim hover:text-maple hover:border-maple"
                  >
                    🔗 연결
                  </button>
                  <button
                    onClick={() => removeNode(selected.id)}
                    className="flex-1 px-2 py-1.5 text-xs font-pixel border-2 border-edge text-dim hover:text-red-500 hover:border-red-500"
                  >
                    🗑 제거
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 연결 모드 안내 */}
      {linkingFrom && (
        <div className="pixel-panel absolute top-16 left-1/2 -translate-x-1/2 bg-surface px-4 py-2 text-sm text-ink z-20 flex items-center gap-2">
          🔗 연결할 노드를 클릭하세요
          <button onClick={() => setLinkingFrom(null)} className="text-xs text-dim hover:text-ink font-pixel">(취소: 빈 곳 클릭)</button>
        </div>
      )}

      {/* 우하단 버튼: 줌 리셋 + 도움말 */}
      {!needsSetup && (
        <div className="absolute bottom-3 right-3 flex gap-1.5 z-10">
          <button
            onClick={() => {
              const wrap = wrapRef.current;
              if (wrap) transformRef.current = { x: wrap.clientWidth / 2, y: wrap.clientHeight / 2, k: 1 };
            }}
            className="pixel-btn w-9 h-9 text-sm font-pixel"
            aria-label="화면 중앙으로"
            title="내 캐릭터로 화면 리셋"
          >
            ⌖
          </button>
          <button
            onClick={() => { setGuideStep(0); setShowGuide(true); }}
            className="pixel-btn w-9 h-9 text-sm font-pixel"
            aria-label="사용법 가이드"
          >
            ?
          </button>
        </div>
      )}

      {/* 사용법 가이드 */}
      {showGuide && !needsSetup && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowGuide(false)}>
          <div className="pixel-panel bg-surface p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const steps = [
                {
                  title: "① 노드를 클릭해 보세요",
                  emoji: "🖱️",
                  body: "노드를 클릭하면 정보 카드가 뜹니다. 「🔍 연결 펼치기」를 누르면 가지가 자라나요 — 사냥터를 펼치면 서식 몬스터가, 몬스터를 펼치면 드랍템(확률)과 출현 맵이 나옵니다. 꼬리에 꼬리를 물고 탐색해 보세요.",
                },
                {
                  title: "② 궁금한 건 검색으로 투입",
                  emoji: "🔍",
                  body: "상단 검색창에 아이템·몬스터·맵 이름을 치면 그래프에 노드로 추가되고 자동으로 펼쳐집니다. \"이 아이템 어디서 나와?\" → 검색 → 드랍 몹 → 출현 맵까지 한눈에.",
                },
                {
                  title: "③ 나만의 지도 만들기",
                  emoji: "📌",
                  body: "검색으로 넣은 노드는 내 캐릭터에 점선(📌)으로 붙습니다. 노드 카드의 「🔗 연결」로 아무 노드끼리 직접 이을 수 있어요 — 예: Lv.90 목표 ← 켄타PQ ← 얼음결정. 이 연결은 자동 저장되고(로그인 시 계정에), 다음에 와도 그대로 남아 있습니다. 「🗑 제거」로 정리, 우하단 ⌖로 화면 리셋.",
                },
              ];
              const s = steps[guideStep];
              return (
                <>
                  <p className="font-pixel text-sm text-maple font-bold mb-2">{s.emoji} {s.title}</p>
                  <p className="text-sm text-ink leading-relaxed mb-4">{s.body}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {steps.map((_, i) => (
                        <span key={i} className={`w-2 h-2 ${i === guideStep ? "bg-maple" : "bg-edge"}`} />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      {guideStep > 0 && (
                        <button onClick={() => setGuideStep(guideStep - 1)} className="px-3 py-1.5 text-xs font-pixel text-dim border-2 border-edge">
                          이전
                        </button>
                      )}
                      {guideStep < steps.length - 1 ? (
                        <button onClick={() => setGuideStep(guideStep + 1)} className="pixel-btn px-3 py-1.5 text-xs">
                          다음
                        </button>
                      ) : (
                        <button onClick={() => setShowGuide(false)} className="pixel-btn px-3 py-1.5 text-xs">
                          탐색 시작 ⚡
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 온보딩 / 설정 오버레이 */}
      {needsSetup && char !== undefined && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="pixel-panel bg-surface p-6 w-full max-w-sm">
            <h1 className="font-pixel text-lg text-maple font-bold mb-1">🧠 메랜 브레인</h1>
            <p className="text-xs text-dim mb-4">
              내 캐릭터를 중심으로 사냥터·퀘스트·드랍이 연결된 지식 그래프를 펼칩니다.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-xs font-pixel text-dim mb-1">닉네임 (선택)</label>
                <input
                  value={setupNickname}
                  onChange={(e) => setSetupNickname(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) applySetup(); }}
                  placeholder="게임 닉네임"
                  maxLength={12}
                  className="w-full pixel-panel bg-bg px-3 py-2 text-sm text-ink outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-pixel text-dim mb-1">레벨</label>
                <input
                  type="number" min={1} max={200} value={setupLevel}
                  onChange={(e) => { setSetupLevel(e.target.value); setSetupSubJob(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) applySetup(); }}
                  placeholder="예: 45"
                  className="w-full pixel-panel bg-bg px-3 py-2 text-sm text-ink outline-none"
                />
              </div>
            </div>
            <label className="block text-xs font-pixel text-dim mb-1">직업 계열 (선택)</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {JOBS.map((j) => (
                <button
                  key={j}
                  onClick={() => { setSetupJob(setupJob === j ? "" : j); setSetupSubJob(""); }}
                  className={`px-2.5 py-1.5 text-xs font-pixel border-2 ${
                    setupJob === j ? "border-maple text-maple bg-[color-mix(in_srgb,var(--c-maple)_12%,transparent)]" : "border-edge text-dim"
                  }`}
                >
                  {j}
                </button>
              ))}
            </div>
            {setupJob && parseInt(setupLevel, 10) >= 1 && (
              <>
                <label className="block text-xs font-pixel text-dim mb-1">
                  세부 직업 — Lv.{setupLevel} 기준 {jobTier(parseInt(setupLevel, 10))}차
                </label>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(JOB_TREE[setupJob]?.[jobTier(parseInt(setupLevel, 10))] ?? []).map((j) => (
                    <button
                      key={j}
                      onClick={() => setSetupSubJob(setupSubJob === j ? "" : j)}
                      className={`px-2.5 py-1.5 text-xs font-pixel border-2 ${
                        setupSubJob === j ? "border-maple text-maple bg-[color-mix(in_srgb,var(--c-maple)_12%,transparent)]" : "border-edge text-dim"
                      }`}
                    >
                      {j}
                    </button>
                  ))}
                </div>
              </>
            )}
            {!setupJob && <div className="mb-1" />}
            <div className="flex gap-2">
              <button onClick={applySetup} disabled={!setupLevel} className="pixel-btn flex-1 px-3 py-2 text-sm disabled:opacity-40">
                두뇌 연결 ⚡
              </button>
              {char && (
                <button onClick={() => setShowSetup(false)} className="px-3 py-2 text-sm font-pixel text-dim border-2 border-edge">
                  취소
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
