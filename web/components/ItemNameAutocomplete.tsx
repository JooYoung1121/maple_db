"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SearchSuggestion } from "@/lib/types";
import { entityIconUrl, hideIconOnError } from "@/lib/icons";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function ItemNameAutocomplete({ value, onChange, className }: {
  value: string;
  onChange: (value: string) => void;
  className: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<{ query: string; items: SearchSuggestion[]; failed: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const query = value.trim();
  const current = result?.query === query ? result : null;
  const items = current?.items ?? [];
  const visible = open && query.length > 0;

  useEffect(() => {
    if (!open || !query) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, type: "item", limit: "8" });
        const response = await fetch(`${API_BASE}/api/search/suggest?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("suggestions unavailable");
        const body = await response.json();
        if (!Array.isArray(body.suggestions)) throw new Error("invalid suggestions");
        if (!controller.signal.aborted) setResult({ query, items: body.suggestions, failed: false });
      } catch {
        if (!controller.signal.aborted) setResult({ query, items: [], failed: true });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, query]);

  useEffect(() => {
    if (visible && active >= 0) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, visible]);

  function select(item: SearchSuggestion) {
    onChange(item.name_kr || item.name);
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  }

  return <div className="relative min-w-48 flex-1">
    <label htmlFor={id} className="mb-1 block text-xs text-dim">아이템 이름</label>
    <input id={id} ref={input} value={value} required maxLength={100} autoComplete="off"
      role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={`${id}-list`}
      aria-activedescendant={visible && active >= 0 && active < items.length ? `${id}-option-${active}` : undefined}
      aria-describedby={`${id}-hint`}
      onChange={(event) => { onChange(event.target.value); setActive(-1); setOpen(true); }}
      onFocus={() => { setOpen(true); setActive(-1); }}
      onBlur={() => { setOpen(false); setActive(-1); }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) {
          if (event.key === "Enter") event.preventDefault();
          return;
        }
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); setActive(-1); return; }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          if (items.length) setActive((index) => event.key === "ArrowDown"
            ? (index + 1) % items.length : (index <= 0 ? items.length - 1 : index - 1));
        } else if (event.key === "Enter") {
          if (visible && active >= 0 && items[active]) { event.preventDefault(); select(items[active]); }
          else setOpen(false);
        }
      }}
      placeholder="예: 크리센트, 혼돈 목걸이, 드래곤" className={className} />
    <span id={`${id}-hint`} className="sr-only">방향키로 아이템을 고르고 Enter로 이름을 입력하세요. 검색 버튼을 누르면 매물을 조회합니다.</span>
    {visible && <div className="absolute z-40 mt-1 w-full rounded border border-edge bg-surface shadow-lg">
      <ul ref={list} id={`${id}-list`} role="listbox" aria-label="아이템 이름 자동완성" className="max-h-72 overflow-y-auto">
        {items.map((item, index) => <li key={item.entity_id} role="presentation">
          <button type="button" role="option" id={`${id}-option-${index}`} aria-selected={index === active} tabIndex={-1}
            onPointerDown={(event) => event.preventDefault()} onClick={() => select(item)} onMouseEnter={() => setActive(index)}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-ink ${index === active ? "bg-surface2" : "hover:bg-surface2"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entityIconUrl("item", item.entity_id)} alt="" width={32} height={32} loading="lazy"
              className="h-8 w-8 shrink-0 object-contain" onError={hideIconOnError} />
            <span>{item.name_kr || item.name}</span>
          </button>
        </li>)}
      </ul>
      {items.length === 0 && <p role="status" className="px-3 py-3 text-xs text-dim">
        {!current ? "아이템을 찾는 중…" : current.failed ? "자동완성을 불러오지 못했습니다. 이름을 직접 입력해 검색할 수 있습니다." : "일치하는 아이템이 없습니다. 입력한 이름으로 검색할 수 있습니다."}
      </p>}
    </div>}
  </div>;
}
