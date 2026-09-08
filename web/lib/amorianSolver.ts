import data from "../data/amorianSolver.json";

// Decision trees contributed by a guild member:
// amoria_pq_solver_easy_v4_movement.html. Preserve queries and branch ordering.
export type PuzzleMode = "rope" | "platform";
export interface PuzzleNode {
  q: number[];
  qno: number;
  candidates: number;
  remainingWorst: number;
  children: Record<string, { type: "node"; node: PuzzleNode } | Solution>;
}
export interface Solution {
  type: "solved";
  answer: number[];
  candidates: number;
  directClear: boolean;
}
export interface HistoryEntry { query: number[]; result: number }
export interface SolverSession {
  version: 1;
  mode: PuzzleMode;
  sessions: Record<PuzzleMode, number[]>;
}
// JSON imports widen discriminant strings; the exhaustive regression test
// validates every node and branch in these checked-in tables.
export const TREES = data as Record<PuzzleMode, PuzzleNode>;
export const PLATFORM_LABELS = ["A", "2", "B", "3", "C", "6", "D", "9", "5"];
export const ROPE_LABELS = ["A · 왼쪽", "B · 가운데", "C · 오른쪽"];
export const STORAGE_KEY = "maple-amorian-solver-v1";
export const FEEDBACK: Record<PuzzleMode, number[]> = { rope: [0, 1, 3], platform: [1, 2, 3, 4, 5] };

export function newSession(): SolverSession {
  return { version: 1, mode: "rope", sessions: { rope: [], platform: [] } };
}

export function replay(mode: PuzzleMode, results: readonly unknown[]) {
  let node = TREES[mode];
  let solved: Solution | null = null;
  const history: HistoryEntry[] = [];
  const valid: number[] = [];
  for (const result of results) {
    if (solved || typeof result !== "number" || !FEEDBACK[mode].includes(result)) break;
    const child = node.children[String(result)];
    if (!child) break;
    history.push({ query: node.q, result });
    valid.push(result);
    if (child.type === "solved") solved = child;
    else node = child.node;
  }
  return { node, solved, history, valid };
}

/** Validate persisted input, never trust cached nodes or inferred answers. */
export function restoreSession(raw: string): SolverSession | null {
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !["rope", "platform"].includes(value.mode) ||
        !Array.isArray(value.sessions?.rope) || !Array.isArray(value.sessions?.platform)) return null;
    const rope = replay("rope", value.sessions.rope).valid;
    const platform = replay("platform", value.sessions.platform).valid;
    // Reject incomplete/corrupt histories rather than silently present a different step.
    if (rope.length !== value.sessions.rope.length || platform.length !== value.sessions.platform.length) return null;
    return { version: 1, mode: value.mode, sessions: { rope, platform } };
  } catch { return null; }
}

export function queryText(mode: PuzzleMode, query: number[]) {
  return mode === "rope" ? query.join(" / ") : query.map(n => PLATFORM_LABELS[n - 1]).join(" · ");
}

export interface Move { from: number; to: number; count: number }
export function movement(mode: PuzzleMode, from: number[] | undefined, to: number[]): Move[] {
  if (!from) return [];
  if (mode === "platform") {
    const leaving = from.filter(n => !to.includes(n));
    const entering = to.filter(n => !from.includes(n));
    return leaving.map((n, i) => ({ from: n, to: entering[i], count: 1 }));
  }
  const diff = from.map((n, i) => n - to[i]);
  const moves: Move[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3 && diff[i] > 0; j++) {
      if (diff[j] >= 0) continue;
      const count = Math.min(diff[i], -diff[j]);
      moves.push({ from: i, to: j, count });
      diff[i] -= count;
      diff[j] += count;
    }
  }
  return moves;
}
