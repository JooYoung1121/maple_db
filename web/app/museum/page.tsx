"use client";

import { useCallback, useEffect, useState } from "react";
import { getMuseum, type MuseumEntry } from "@/lib/api";

const PER_PAGE = 40;

function iconUrl(type: "mob" | "item", id: number): string {
  return `https://maplestory.io/api/gms/92/${type === "mob" ? "mob" : "item"}/${id}/icon`;
}

export default function MuseumPage() {
  const [type, setType] = useState<"mob" | "item">("mob");
  const [entries, setEntries] = useState<MuseumEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getMuseum({ type, q: q || undefined, page, per_page: PER_PAGE })
      .then((d) => {
        setEntries(d.entries);
        setTotal(d.total);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [type, q, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 font-pixel">🗃️ 이세계 도감</h1>
      <p className="text-dim mb-1">
        <strong className="text-ink">메이플랜드에는 없는</strong> 몬스터와 아이템 모음 — GMS 전용, 다른 지역,
        후대 패치의 흔적들을 재미로 구경하는 곳입니다.
      </p>
      <p className="font-pixel text-[11px] text-mush mb-5">
        ※ 여기 있는 것들은 메랜에서 만날 수 없으며, 퀴즈·오늘의 몬스터 등 게임에도 출제되지 않습니다.
      </p>

      {/* 탭 + 검색 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex bg-surface2 p-1">
          {(["mob", "item"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setPage(1); setQ(""); setInputVal(""); }}
              className={`px-4 py-2 text-sm transition ${type === t ? "pixel-btn" : "font-pixel text-dim hover:text-maple"}`}
            >
              {t === "mob" ? "몬스터" : "아이템"}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setQ(inputVal); setPage(1); }}
          className="flex gap-2 flex-1 min-w-[200px]"
        >
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="이름 검색 (한글/영문)..."
            className="pixel-input px-3 py-2 flex-1"
          />
          <button type="submit" className="px-4 py-2 pixel-btn text-sm">검색</button>
        </form>
        <span className="font-pixel text-xs text-dim">{total.toLocaleString()}개</span>
      </div>

      {loading ? (
        <div className="text-center py-20 text-dim">
          <div className="w-8 h-8 border-2 border-maple border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          도감 로딩 중...
        </div>
      ) : entries.length === 0 ? (
        <div className="pixel-panel p-8 text-center text-dim">
          {q ? `"${q}" 검색 결과가 없습니다.` : "표시할 항목이 없습니다."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {entries.map((e) => (
              <div key={e.id} className="pixel-card p-3 flex flex-col items-center text-center gap-1">
                <img
                  src={iconUrl(type, e.id)}
                  alt=""
                  loading="lazy"
                  className="w-14 h-14 object-contain [image-rendering:pixelated]"
                  onError={(ev) => { ev.currentTarget.style.visibility = "hidden"; }}
                />
                <div className="text-sm font-medium text-ink leading-tight">{e.name_kr}</div>
                {e.name && e.name !== e.name_kr && (
                  <div className="text-[11px] text-dim truncate w-full">{e.name}</div>
                )}
                <div className="font-pixel text-[10px] text-dim">
                  {type === "mob"
                    ? <>Lv.{e.level ?? "?"}{e.is_boss ? " · 보스" : ""} · HP {(e.hp ?? 0).toLocaleString()}</>
                    : <>{e.subcategory ?? e.category ?? ""}</>}
                </div>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-4">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="px-2 py-1 font-pixel text-xs text-dim disabled:opacity-30 hover:text-maple">«</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 pixel-card font-pixel text-xs text-dim disabled:opacity-30">이전</button>
              <span className="font-pixel text-xs text-ink">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 pixel-card font-pixel text-xs text-dim disabled:opacity-30">다음</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="px-2 py-1 font-pixel text-xs text-dim disabled:opacity-30 hover:text-maple">»</button>
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-dim mt-6">
        기준: KMS 한글명은 있으나 메이플랜드 레퍼런스 목록에 없는 항목. 데이터 출처는 옛 GMS(v92) 수집분이라
        실제 다른 서버·시기의 모습과 다를 수 있습니다. 여기 있는 항목이 메랜에 실제로 존재한다면 제보해주세요!
      </p>
    </div>
  );
}
