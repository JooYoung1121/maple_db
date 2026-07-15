"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { searchChosung } from "@/lib/api";

const TYPE_FILTERS = [
  { key: "", label: "전체" },
  { key: "mob", label: "몬스터" },
  { key: "item", label: "아이템" },
  { key: "map", label: "맵" },
  { key: "npc", label: "NPC" },
];

const DETAIL_PATHS: Record<string, string> = { mob: "/mobs", item: "/items", map: "/maps", npc: "/npcs" };

/* 초성 입력 도우미 키패드 */
const CHO_KEYS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

export default function ChosungPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [mode, setMode] = useState<"exact" | "prefix">("exact");
  const [results, setResults] = useState<{ type: string; type_label: string; id: number; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const query = q.replace(/\s/g, "");
    if (!query) { setResults([]); setTotal(0); return; }
    setLoading(true);
    const t = setTimeout(() => {
      searchChosung(query, type || undefined, mode)
        .then((d) => { setResults(d.results); setTotal(d.total); })
        .catch(() => { setResults([]); setTotal(0); })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, type, mode]);

  function copyName(name: string) {
    navigator.clipboard.writeText(name).then(() => {
      setCopied(name);
      setTimeout(() => setCopied(""), 1200);
    });
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 font-pixel">🔤 초성퀴즈 검색기</h1>
      <p className="text-sm text-dim mb-6">
        인게임 초성퀴즈용 — 초성을 입력하면 메랜DB에 등재된 몬스터·아이템·맵·NPC 이름에서 찾아드립니다.
        결과를 누르면 이름이 복사됩니다.
      </p>

      <div className="pixel-panel p-4 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="초성 입력 (예: ㅈㅎㅂㅅ)"
          className="w-full pixel-input px-4 py-3 text-lg font-mono mb-3"
          autoFocus
        />
        {/* 초성 키패드 (모바일 편의) */}
        <div className="flex flex-wrap gap-1 mb-3">
          {CHO_KEYS.map((c) => (
            <button
              key={c}
              onClick={() => setQ((prev) => prev + c)}
              className="w-9 h-9 bg-surface2 border-2 border-edge text-sm hover:border-maple hover:text-maple transition-colors"
            >
              {c}
            </button>
          ))}
          <button
            onClick={() => setQ((prev) => prev.slice(0, -1))}
            className="px-3 h-9 bg-surface2 border-2 border-edge text-sm text-dim hover:border-red-400 hover:text-red-500 transition-colors"
          >
            ⌫
          </button>
          <button
            onClick={() => setQ("")}
            className="px-3 h-9 bg-surface2 border-2 border-edge text-sm text-dim hover:border-red-400 hover:text-red-500 transition-colors"
          >
            지우기
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`px-2.5 py-1 text-xs transition-colors ${type === t.key ? "pixel-btn" : "bg-surface2 font-pixel text-dim hover:text-maple"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setMode("exact")}
              className={`px-2.5 py-1 text-xs transition-colors ${mode === "exact" ? "pixel-btn" : "bg-surface2 font-pixel text-dim hover:text-maple"}`}
            >
              글자수 일치
            </button>
            <button
              onClick={() => setMode("prefix")}
              className={`px-2.5 py-1 text-xs transition-colors ${mode === "prefix" ? "pixel-btn" : "bg-surface2 font-pixel text-dim hover:text-maple"}`}
            >
              앞부분 일치
            </button>
          </div>
        </div>
      </div>

      {loading && <div className="text-center py-8 text-dim text-sm">검색 중...</div>}

      {!loading && q.trim() && (
        <div className="pixel-panel">
          <p className="px-4 py-2.5 text-xs text-dim border-b border-edge/60">
            {total}건{total > 200 ? " (상위 200건 표시)" : ""}
          </p>
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-dim">
              일치하는 이름이 없습니다 — &quot;앞부분 일치&quot; 모드도 시도해 보세요
            </p>
          ) : (
            <div className="divide-y divide-edge/40">
              {results.map((r) => (
                <div key={`${r.type}-${r.id}`} className="flex items-center gap-2 px-4 py-2">
                  <span className="pixel-badge text-[10px] shrink-0">{r.type_label}</span>
                  <button
                    onClick={() => copyName(r.name)}
                    className="flex-1 text-left text-sm font-medium hover:text-maple transition-colors"
                    title="클릭하면 복사"
                  >
                    {r.name}
                    {copied === r.name && <span className="text-maple text-xs ml-2">복사됨!</span>}
                  </button>
                  <Link
                    href={`${DETAIL_PATHS[r.type]}/${r.id}`}
                    className="text-xs text-dim hover:text-maple shrink-0"
                  >
                    상세 →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pixel-panel p-5 mt-6">
        <h2 className="font-bold mb-3 font-pixel">참고사항</h2>
        <ul className="space-y-1.5">
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            검색 풀은 이 사이트에 등재된 메이플랜드 이름들입니다. 인게임 퀴즈 정답이 여기 없는 단어일 수도 있습니다.
          </li>
          <li className="text-sm text-dim flex gap-2">
            <span className="text-maple flex-shrink-0">-</span>
            공백은 무시하고 비교합니다 (예: &quot;주황버섯의 갓&quot; = ㅈㅎㅂㅅㅇㄱ).
          </li>
        </ul>
      </div>
    </div>
  );
}
