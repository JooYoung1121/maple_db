"use client";

// 제물 맞추기(야구게임) 솔버 — 수호대의 제단 4개 석상에 올릴 제물 조합을
// Bulls & Cows 방식으로 좁혀 나간다. 4종 아이템 × 4석상 = 256가지 조합.
import { useMemo, useState } from "react";

const ITEMS = [
  { label: "용맹의 훈장", short: "훈장", emoji: "🎖️" },
  { label: "지혜의 두루마리", short: "두루마리", emoji: "📜" },
  { label: "오래된 음식", short: "음식", emoji: "🍖" },
  { label: "700년산 주니어 네키 술", short: "술", emoji: "🍶" },
] as const;

const MAX_TRIES = 7;
const STATUE_COUNT = 4;

type HistoryEntry = { guess: number[]; bulls: number; cows: number };

function decode(c: number): number[] {
  return [(c & 192) >> 6, (c & 48) >> 4, (c & 12) >> 2, c & 3];
}

// [정위치 개수(올바른), 아이템만 맞은 개수(틀린)] 반환
function score(solution: number, guess: number[]): [number, number] {
  const sol = decode(solution);
  const g = [...guess];
  let bulls = 0;
  let cows = 0;
  for (let i = 0; i < STATUE_COUNT; i++) {
    if (g[i] === sol[i]) {
      bulls++;
      g[i] = -2;
      sol[i] = -1;
    }
  }
  for (let i = 0; i < STATUE_COUNT; i++) {
    const f = sol.indexOf(g[i]);
    if (f > -1) {
      cows++;
      sol[f] = -1;
    }
  }
  return [bulls, cows];
}

function candidatesAfter(history: HistoryEntry[]): number[] {
  let cands = Array.from({ length: 256 }, (_, i) => i);
  for (const h of history) {
    cands = cands.filter((c) => {
      const [b, cw] = score(c, h.guess);
      return b === h.bulls && cw === h.cows;
    });
  }
  return cands;
}

// 다음 추천 배치. 1트: 모두 훈장 → 2트: (올+틀) 개수만큼 왼쪽부터 훈장, 나머지 두루마리
// → 3트부터: 후보 중 직전 배치에서 바꿔야 하는 석상 수가 가장 적은 조합.
function recommend(history: HistoryEntry[], candidates: number[]): number[] {
  if (history.length === 0) return [0, 0, 0, 0];
  if (history.length === 1) {
    const medals = history[0].bulls + history[0].cows;
    return Array.from({ length: STATUE_COUNT }, (_, i) => (i < medals ? 0 : 1));
  }
  const last = history[history.length - 1].guess;
  let best: number[] | null = null;
  let min = STATUE_COUNT + 1;
  for (const c of candidates) {
    const arr = decode(c);
    const d = arr.reduce((t, v, i) => t + (v !== last[i] ? 1 : 0), 0);
    if (d < min) {
      min = d;
      best = arr;
    }
  }
  return best ?? [0, 0, 0, 0];
}

function GuessChips({ guess, size = "sm" }: { guess: number[]; size?: "sm" | "xs" }) {
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {guess.map((v, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 border border-edge bg-surface2 ${
            size === "sm" ? "px-2 py-0.5 text-xs" : "px-1.5 py-0.5 text-[11px]"
          }`}
        >
          {ITEMS[v].emoji} {ITEMS[v].short}
        </span>
      ))}
    </span>
  );
}

export default function OfferingSolver() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [guess, setGuess] = useState<number[]>([0, 0, 0, 0]);
  const [bulls, setBulls] = useState(0);
  const [cows, setCows] = useState(0);

  const candidates = useMemo(() => candidatesAfter(history), [history]);
  const recommended = useMemo(() => recommend(history, candidates), [history, candidates]);

  const solved = history.length > 0 && history[history.length - 1].bulls === STATUE_COUNT;
  const failed = !solved && history.length >= MAX_TRIES;
  const conflict = candidates.length === 0 && history.length > 0 && !solved;
  const feedbackInvalid = bulls + cows > STATUE_COUNT;

  function submit() {
    if (solved || failed || feedbackInvalid) return;
    setHistory([...history, { guess: [...guess], bulls, cows }]);
    setBulls(0);
    setCows(0);
  }

  function undo() {
    setHistory(history.slice(0, -1));
    setBulls(0);
    setCows(0);
  }

  function reset() {
    setHistory([]);
    setGuess([0, 0, 0, 0]);
    setBulls(0);
    setCows(0);
  }

  return (
    <div className="space-y-4">
      {/* 사용법 */}
      <section className="pixel-panel p-5 space-y-2">
        <h2 className="font-pixel text-sm text-ink">🧭 사용법</h2>
        <ol className="list-decimal list-inside text-sm text-dim space-y-1 leading-relaxed">
          <li>
            게임에서 아래 <b className="text-ink">추천 배치</b>대로 4개 석상에 제물을 올리고 결과를 확인한다.
          </li>
          <li>
            NPC가 알려주는 <b className="text-ink">올바른</b>(아이템·위치 모두 정답) / <b className="text-ink">틀린</b>
            (아이템은 맞지만 위치가 다름) 개수를 입력하고 제출한다.
          </li>
          <li>남은 후보가 좁혀지며 다음 배치를 추천한다. 보통 4~5트 안에 정답이 나온다.</li>
        </ol>
      </section>

      {/* 상태 */}
      <section className="pixel-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="font-pixel text-sm text-ink">🗿 시도 {Math.min(history.length + 1, MAX_TRIES)} / {MAX_TRIES}</h2>
          <span className="pixel-badge text-xs">남은 후보 {candidates.length}개</span>
          {solved && <span className="font-pixel text-xs text-slime">🎉 정답을 찾았습니다!</span>}
          {failed && <span className="font-pixel text-xs text-mush">시도 횟수를 모두 사용했습니다</span>}
        </div>

        {conflict && (
          <div className="border-2 border-mush bg-mush/10 p-3 text-sm text-ink">
            입력한 결과들이 서로 모순되어 남은 후보가 없습니다. 직전 입력을 <b>되돌리기</b>로 취소하고 다시 입력해
            주세요.
          </div>
        )}

        {!solved && !failed && !conflict && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-dim">추천 배치:</span>
            <GuessChips guess={recommended} />
            <button
              type="button"
              onClick={() => setGuess([...recommended])}
              className="pixel-btn px-3 py-1.5 text-xs font-pixel"
            >
              추천 배치 적용
            </button>
          </div>
        )}

        {/* 석상별 제물 선택 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {guess.map((sel, statue) => (
            <div key={statue} className="border-2 border-edge p-2 space-y-1.5">
              <div className="font-pixel text-xs text-dim text-center">석상 {statue + 1}</div>
              {ITEMS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setGuess(guess.map((v, i) => (i === statue ? idx : v)))}
                  className={`w-full px-2 py-1.5 text-xs border-2 transition-colors text-left ${
                    sel === idx
                      ? "border-maple bg-maple/10 text-maple font-bold"
                      : "border-edge text-dim hover:text-maple"
                  }`}
                >
                  {item.emoji} {item.short}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-dim self-center">빠른 설정:</span>
          {ITEMS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setGuess([idx, idx, idx, idx])}
              className="px-2.5 py-1 border-2 border-edge text-dim hover:text-maple transition-colors"
            >
              모두 {item.short}
            </button>
          ))}
        </div>

        {/* 결과 입력 */}
        <div className="border-t-2 border-edge pt-4 space-y-3">
          {(
            [
              ["올바른 (아이템·위치 정답)", bulls, setBulls],
              ["틀린 (아이템만 맞음)", cows, setCows],
            ] as [string, number, (v: number) => void][]
          ).map(([label, value, setter]) => (
            <div key={label} className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-dim w-48">{label}</span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setter(n)}
                    className={`w-9 h-9 border-2 font-pixel text-sm transition-colors ${
                      value === n ? "border-maple bg-maple/10 text-maple" : "border-edge text-dim hover:text-maple"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {feedbackInvalid && (
            <p className="text-xs text-mush">올바른 + 틀린 개수의 합은 4를 넘을 수 없습니다.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={solved || failed || feedbackInvalid}
              className="pixel-btn px-5 py-2 text-sm font-pixel disabled:opacity-40 disabled:cursor-not-allowed"
            >
              제출
            </button>
            {history.length > 0 && (
              <button
                type="button"
                onClick={undo}
                className="px-4 py-2 text-sm font-pixel border-2 border-edge text-dim hover:text-maple transition-colors"
              >
                ↩ 되돌리기
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 text-sm font-pixel border-2 border-edge text-dim hover:text-mush transition-colors"
            >
              처음부터
            </button>
          </div>
        </div>
      </section>

      {/* 히스토리 */}
      {history.length > 0 && (
        <section className="pixel-panel p-5 space-y-2">
          <h2 className="font-pixel text-sm text-ink">📜 시도 기록</h2>
          <ul className="space-y-1.5 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="font-pixel text-xs text-dim w-8">{i + 1}트</span>
                <GuessChips guess={h.guess} size="xs" />
                <span className="text-xs text-dim">
                  → 올 <b className="text-ink">{h.bulls}</b> · 틀 <b className="text-ink">{h.cows}</b> · 모두 틀림{" "}
                  {STATUE_COUNT - h.bulls - h.cows}
                </span>
              </li>
            ))}
          </ul>
          {candidates.length > 0 && candidates.length <= 5 && !solved && (
            <div className="pt-2 border-t-2 border-edge space-y-1">
              <div className="text-xs text-dim">남은 후보 전체:</div>
              {candidates.map((c) => (
                <div key={c}>
                  <GuessChips guess={decode(c)} size="xs" />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
