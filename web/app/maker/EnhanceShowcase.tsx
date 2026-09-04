"use client";

import { useCallback, useEffect, useState } from "react";
import { getEnhanceShowcaseList, type EnhanceShowcase } from "@/lib/api";
import { STAT_LABEL, GRADE_COLOR, orderedStatEntries, type Stats } from "@/lib/enhanceSim";

const hideImg = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = "hidden"; };

// 강화 결과 1건 카드 (갤러리·공유 링크 공용)
export function ShowcaseCard({ s, rank }: { s: EnhanceShowcase; rank?: number }) {
  const stats = orderedStatEntries(s.final_stats as Stats);
  const gradeColor = GRADE_COLOR[s.grade_key ?? "white"] ?? "text-ink";
  const date = (() => {
    try { return new Date(s.created_at * 1000).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }); }
    catch { return ""; }
  })();
  return (
    <div className="pixel-card p-3 flex gap-3">
      <div className="flex flex-col items-center gap-1 shrink-0">
        {rank != null && (
          <span className={`font-pixel text-sm ${rank === 1 ? "text-yellow-500" : rank === 2 ? "text-gray-400" : rank === 3 ? "text-orange-400" : "text-dim"}`}>
            {rank}
          </span>
        )}
        <div className="w-12 h-12 flex items-center justify-center border-2 border-edge bg-surface2">
          {s.icon_url && <img src={s.icon_url} alt="" onError={hideImg} className="w-9 h-9 object-contain [image-rendering:pixelated]" />}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-pixel text-sm">
          <span className={gradeColor}>{s.item_name}{s.success_count > 0 && ` (+${s.success_count})`}</span>
          {s.grade_name && <span className={`ml-2 text-[11px] ${gradeColor}`}>{s.grade_name}{s.grade_sum > 0 ? ` +${s.grade_sum}` : ""}</span>}
        </p>
        <p className="text-xs text-ink mt-1 leading-relaxed">
          {stats.length ? stats.map(([k, v]) => `${STAT_LABEL[k]} +${v}`).join(" · ") : "-"}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-dim mt-1">
          <span>👤 {s.nickname}</span>
          {s.level > 0 && <span>LEV {s.level}</span>}
          <span className="text-green-600">성공 {s.success_count}</span>
          <span className="text-red-400">실패 {s.fail_count}</span>
          {s.used_accel ? <span className="text-maple">촉진제</span> : null}
          {s.cost > 0 && <span>{s.cost.toLocaleString("ko-KR")} 메소</span>}
          {date && <span className="ml-auto">{date}</span>}
        </div>
      </div>
    </div>
  );
}

const KIND_FILTERS = ["", "활", "석궁", "단검", "클로", "두손검", "한손검", "창", "폴암", "스태프", "완드"];

export default function EnhanceShowcaseGallery() {
  const [list, setList] = useState<EnhanceShowcase[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<"grade" | "recent">("grade");
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getEnhanceShowcaseList({ sort, kind: kind || undefined, per_page: 50 })
      .then((d) => { setList(d.showcase); setTotal(d.total); })
      .catch(() => { setList([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [sort, kind]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="pixel-panel p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-pixel text-sm text-ink">🏆 강화 명예의전당</h2>
          <span className="text-xs text-dim">총 {total}건</span>
          <button onClick={load} className="ml-auto text-xs text-dim hover:text-maple font-pixel">새로고침</button>
        </div>
        <p className="text-xs text-dim mt-1">유저들이 강화 시뮬로 만든 결과 — 등급(증가분) 순으로 겨뤄보세요.</p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="flex gap-1">
            {(["grade", "recent"] as const).map((s) => (
              <button key={s} onClick={() => setSort(s)}
                className={`px-3 py-1.5 text-xs font-pixel border-2 transition-colors ${sort === s ? "border-maple text-maple bg-surface2" : "border-edge text-dim hover:text-maple"}`}>
                {s === "grade" ? "등급순" : "최신순"}
              </button>
            ))}
          </div>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="pixel-input px-2 py-1.5 text-xs">
            {KIND_FILTERS.map((k) => <option key={k} value={k}>{k || "전체 장비"}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="pixel-panel p-10 text-center text-dim text-sm">불러오는 중...</div>
      ) : list.length === 0 ? (
        <div className="pixel-panel p-10 text-center text-dim text-sm">
          아직 등록된 강화 결과가 없습니다. &ldquo;강화 시뮬&rdquo;에서 강화 후 명예의전당에 등록해보세요!
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((s, i) => (
            <ShowcaseCard key={s.id} s={s} rank={sort === "grade" ? i + 1 : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
