"use client";

interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  const pages: (number | string)[] = [];
  const range = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - range && i <= page + range)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="font-pixel px-3 py-2 text-[12px] disabled:opacity-30 text-dim hover:text-maple"
      >
        이전
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-2 text-dim">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`font-pixel text-[12px] ${page === p ? "pixel-btn px-3 py-1.5" : "px-3 py-2 text-dim hover:text-maple"}`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="font-pixel px-3 py-2 text-[12px] disabled:opacity-30 text-dim hover:text-maple"
      >
        다음
      </button>
    </div>
  );
}
