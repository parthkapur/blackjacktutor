import type { CellKey } from "@/engine/strategy";

export interface CellStat { seen: number; wrong: number }
export interface DrillStats { cells: Record<string, CellStat>; total: number; correct: number; streak: number; best: number }

export const DRILL_KEY = "bjt.drill";
export const EMPTY_DRILL: DrillStats = { cells: {}, total: 0, correct: 0, streak: 0, best: 0 };
export const cellId = (k: CellKey) => `${k.kind}:${k.value}:${k.up}`;

export function record(s: DrillStats, key: CellKey, correct: boolean): DrillStats {
  const id = cellId(key);
  const prev = s.cells[id] ?? { seen: 0, wrong: 0 };
  const streak = correct ? s.streak + 1 : 0;
  return {
    cells: { ...s.cells, [id]: { seen: prev.seen + 1, wrong: prev.wrong + (correct ? 0 : 1) } },
    total: s.total + 1,
    correct: s.correct + (correct ? 1 : 0),
    streak,
    best: Math.max(s.best, streak),
  };
}

/** Weight: unseen cells 3, seen-correct 1, each miss adds 4 (decays with successes). */
export function weight(st: CellStat | undefined): number {
  if (!st) return 3;
  const right = st.seen - st.wrong;
  return 1 + Math.max(0, st.wrong * 4 - right);
}
