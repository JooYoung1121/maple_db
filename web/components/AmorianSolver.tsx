"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import {
  FEEDBACK, PLATFORM_LABELS, ROPE_LABELS, STORAGE_KEY, TREES,
  movement, newSession, queryText, replay, restoreSession,
  type PuzzleMode, type SolverSession,
} from "@/lib/amorianSolver";

const button = "min-h-11 px-4 py-2 border-2 border-edge bg-surface2 text-ink text-sm font-semibold hover:border-maple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maple disabled:opacity-40 disabled:cursor-not-allowed";

function Board({ mode, query }: { mode: PuzzleMode; query: number[] }) {
  if (mode === "rope") return (
    <div className="grid grid-cols-3 gap-2 my-4" aria-label="왼쪽부터 A, B, C 밧줄 인원">
      {query.map((count, i) => (
        <div key={i} className="relative min-h-28 border-2 border-edge bg-surface2 flex flex-col items-center justify-center gap-2 overflow-hidden">
          <div aria-hidden="true" className="absolute inset-y-0 w-1 bg-edge" />
          <span className="relative bg-surface2 px-1 text-xs text-ink">{ROPE_LABELS[i]}</span>
          <span className="relative bg-surface border-2 border-edge rounded-full w-14 h-14 flex items-center justify-center text-2xl font-bold tabular-nums">{count}<span className="sr-only">명</span></span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="space-y-2 my-4" aria-label="위 4개, 아래 5개 발판 배치">
      {[[1, 2, 3, 4], [5, 6, 7, 8, 9]].map((row, i) => (
        <div key={i} className={`grid gap-2 ${i === 0 ? "grid-cols-4 px-4" : "grid-cols-5"}`}>
          {row.map(n => {
            const selected = query.includes(n);
            return (
              <div key={n} className={`min-h-20 border-2 flex flex-col items-center justify-center gap-1 ${selected ? "border-maple bg-surface text-ink" : "border-edge bg-surface2 text-dim"}`}>
                <span className="text-2xl font-bold">{PLATFORM_LABELS[n - 1]}</span>
                <span className="text-xs whitespace-nowrap">{selected ? "● 배치" : "비움"}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function AmorianSolver() {
  const [session, setSession] = useState<SolverSession>(newSession);
  const [ready, setReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState("진행 기록 불러오는 중…");
  const [notice, setNotice] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const { mode, sessions } = session;
  const { node, solved, history } = replay(mode, sessions[mode]);
  const query = solved ? solved.answer : node.q;
  const previous = history.at(-1)?.query;
  const moves = movement(mode, previous, query);
  const moveCount = moves.reduce((n, move) => n + move.count, 0);
  const maxChecks = TREES[mode].remainingWorst;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const restored = restoreSession(raw);
        if (restored) setSession(restored);
        else setNotice("저장된 기록을 읽을 수 없어 새 퍼즐로 시작합니다.");
      }
    } catch { setNotice("브라우저 저장소에 접근할 수 없습니다. 현재 화면에서는 계속 사용할 수 있습니다."); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      setStorageStatus("이 브라우저에 자동저장됨");
    } catch { setStorageStatus("자동저장 불가 · 창을 닫으면 기록이 사라집니다"); }
  }, [session, ready]);

  function applyResult(result: number) {
    if (!ready || solved || confirmReset) return;
    if (!node.children[String(result)]) {
      setNotice("이전 입력과 맞지 않는 결과입니다. 배치와 NPC 결과를 확인하거나 한 단계 되돌려 주세요.");
      return;
    }
    setSession(prev => {
      const current = replay(prev.mode, prev.sessions[prev.mode]);
      if (current.solved || !current.node.children[String(result)]) return prev;
      return { ...prev, sessions: { ...prev.sessions, [prev.mode]: [...prev.sessions[prev.mode], result] } };
    });
    setNotice("");
  }

  function undo() {
    setSession(prev => ({ ...prev, sessions: { ...prev.sessions, [prev.mode]: prev.sessions[prev.mode].slice(0, -1) } }));
    setConfirmReset(false);
    setNotice("한 단계 되돌렸습니다. 실제 배치도 화면과 같은지 확인해 주세요.");
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (!ready || confirmReset || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']")) return;
    const key = event.key.toLowerCase();
    if (key === "z" || key === "backspace") {
      event.preventDefault();
      if (history.length) undo();
    } else if (key === "r" && history.length) {
      event.preventDefault(); setConfirmReset(true);
    } else if (/^[0-5]$/.test(key)) {
      event.preventDefault(); applyResult(Number(key));
    }
  }

  return (
    <section aria-label="아모리안 퍼즐 풀이" onKeyDown={onKeyDown} className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="퍼즐 선택">
        {(["rope", "platform"] as PuzzleMode[]).map(value => (
          <button key={value} disabled={!ready} aria-pressed={mode === value}
            onClick={() => { setSession(prev => ({ ...prev, mode: value })); setConfirmReset(false); setNotice(""); }}
            className={`${button} flex-1 ${mode === value ? "!border-maple !bg-surface" : ""}`}>
            {value === "rope" ? "2단계 · 밧줄" : "3단계 · 발판"}
          </button>
        ))}
      </div>
      <div className="pixel-panel p-4 sm:p-6 space-y-4" aria-busy={!ready}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>입력 <b>{history.length}회</b> · 남은 후보 <b>{solved ? 1 : node.candidates}개</b></p>
          <button className={button} disabled={!ready || !history.length} onClick={undo}>↶ 되돌리기</button>
        </div>
        <div className="border-2 border-maple bg-surface p-3 sm:p-4">
          <div aria-live="polite" aria-atomic="true">
            <p className="text-sm font-semibold text-maple">
              {solved ? solved.directClear ? "NPC 정답 판정 · 클리어" : "정답 후보 1개 · 마지막 배치 필요" : `지금 배치 · ${node.qno}번째 확인`}
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums" data-testid="solver-query">
              {mode === "rope" && "A / B / C = "}{queryText(mode, query)}
            </h2>
          </div>
          <p className="text-sm text-dim mt-2">{mode === "rope" ? "파장 제외 5명을 왼쪽 / 가운데 / 오른쪽 밧줄에 배치하세요." : "파장 제외 5명이 ‘● 배치’ 표시된 발판에 한 명씩 서세요."}</p>
          <Board mode={mode} query={query} />
          {solved?.directClear ? (
            <p className="text-sm font-semibold">입력한 정답 판정에 따라 풀이가 완료되었습니다.</p>
          ) : (
            <div className="border-t-2 border-edge pt-3 space-y-2">
              <p className="font-bold">{!previous ? "이 배치로 시작하세요" : moveCount ? `${moveCount}명만 이동하세요` : "이동 없이 그대로 유지하세요"}</p>
              <ul className="flex flex-wrap gap-2" aria-label="이동 안내">
                {moves.map((move, i) => (
                  <li key={i} className="border border-edge bg-surface2 px-3 py-2 text-sm font-semibold">
                    {mode === "rope" ? `${ROPE_LABELS[move.from]} → ${ROPE_LABELS[move.to]} · ${move.count}명` : `${PLATFORM_LABELS[move.from - 1]} → ${PLATFORM_LABELS[move.to - 1]} · 1명`}
                  </li>
                ))}
              </ul>
              {solved && <p className="text-sm font-semibold">아직 클리어 판정이 아닙니다. 위 배치로 이동한 뒤 NPC에게 한 번 더 확인하세요.</p>}
            </div>
          )}
        </div>

        {!solved && <div className="space-y-3">
          <p className="text-sm text-dim">① 화면대로 배치 → ② NPC에게 확인 → ③ 결과 입력</p>
          <h3 className="font-bold">{mode === "rope" ? "NPC가 알려준 일치 밧줄 수" : "나온 슬라임 수 / 정답 판정"}</h3>
          <div className={`grid gap-2 ${mode === "rope" ? "grid-cols-3" : "grid-cols-5"}`}>
            {FEEDBACK[mode].map(result => {
              const clear = result === (mode === "rope" ? 3 : 5);
              const possible = Boolean(node.children[String(result)]);
              const label = clear ? "정답" : mode === "rope" ? result === 0 ? "모두 다름" : "1줄 일치" : `${result}마리`;
              return <button key={result} className={`${button} !px-1 min-h-20 ${clear ? "!border-maple" : ""}`}
                disabled={!ready || confirmReset || !possible} onClick={() => applyResult(result)}
                aria-label={`${label} (${result})`} title={possible ? label : "이전 입력과 모순되는 결과"}>
                <span className="block text-2xl tabular-nums">{result}</span><span className="block text-xs mt-1">{label}</span>
              </button>;
            })}
          </div>
          <p className="text-xs text-dim">비활성 결과는 이전 입력과 모순됩니다. 예상과 다르면 되돌리기로 확인하세요.</p>
        </div>}

        <p role="status" className="text-sm text-ink min-h-5">{notice}</p>
        <details className="border-t-2 border-edge pt-3">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold">입력 기록 · 사용 방법</summary>
          <div className="text-sm space-y-3 mt-2">
            {history.length ? <ol className="space-y-2 list-decimal pl-5">
              {history.map((entry, i) => <li key={i}>
                {queryText(mode, entry.query)} → {entry.result === (mode === "rope" ? 3 : 5) ? "정답" : `${entry.result}${mode === "rope" ? "줄 일치" : "마리"}`}
              </li>)}
            </ol> : <p>아직 입력한 결과가 없습니다.</p>}
            <p>길드원 제공 v4 풀이표 기준: 밧줄 21가지 / 발판 126가지 후보에서 최대 {maxChecks}회 결과 입력으로 정답을 찾습니다. 추론으로 정답이 남으면 마지막 배치 후 NPC 확인이 한 번 더 필요할 수 있습니다.</p>
            <p>발판 표기와 이동 안내는 제공된 도구를 따릅니다. 게임 화면의 배치와 NPC 결과가 같은 규칙인지 확인해 주세요. 이동 안내는 인원 배치 기준이며 캐릭터별 실제 지형 이동 경로를 보장하지 않습니다.</p>
            <p>도우미 안에 포커스가 있을 때 숫자키로 결과 입력, Z/Backspace로 되돌리기, R로 초기화 확인. 다른 입력창이나 사이트 검색에서는 동작하지 않습니다.</p>
          </div>
        </details>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-edge pt-4">
          <p className="text-xs text-dim" role="status">{storageStatus}</p>
          <button className={button} disabled={!ready || !history.length} onClick={() => setConfirmReset(true)}>현재 퍼즐 초기화</button>
        </div>
        {confirmReset && <div className="border-2 border-maple p-4 space-y-3" role="group" aria-label="초기화 확인">
          <p className="text-sm">{mode === "rope" ? "밧줄" : "발판"} 기록만 지울까요? 다른 퍼즐 기록은 유지됩니다.</p>
          <div className="flex gap-2">
            <button className={button} onClick={() => {
              setSession(prev => ({ ...prev, sessions: { ...prev.sessions, [prev.mode]: [] } }));
              setConfirmReset(false); setNotice("현재 퍼즐을 초기화했습니다.");
            }}>초기화하기</button>
            <button className={button} onClick={() => setConfirmReset(false)}>취소</button>
          </div>
        </div>}
      </div>
    </section>
  );
}
