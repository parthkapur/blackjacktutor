import { RANKS, type Card, type Rank, type Rng } from "./cards.ts";
import { DEALER_COLS, ROWS, type CellKey, type HandKind } from "./strategy.ts";

const SUITS = ["s", "h", "d", "c"] as const;
const pick = <T,>(arr: readonly T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];
const tens: Rank[] = ["T", "J", "Q", "K"];
const rankFor = (v: number, rng: Rng): Rank => (v === 11 || v === 1 ? "A" : v === 10 ? pick(tens, rng) : (String(v) as Rank));
const card = (v: number, rng: Rng): Card => ({ rank: rankFor(v, rng), suit: pick(SUITS, rng) });

/** Every drillable cell, for weighting. */
export const ALL_CELLS: CellKey[] = (["hard", "soft", "pair"] as HandKind[]).flatMap((kind) =>
  ROWS[kind].flatMap((value) => DEALER_COLS.map((up) => ({ kind, value, up }))),
);

/** Build a concrete two-card hand + dealer up card that lands in the given chart cell. */
export function cardsFor(key: CellKey, rng: Rng): { cards: Card[]; up: Card } {
  const up = card(key.up, rng);
  if (key.kind === "pair") return { cards: [card(key.value, rng), card(key.value, rng)], up };
  if (key.kind === "soft") return { cards: shuffle([card(11, rng), card(key.value - 11, rng)], rng), up };
  // hard: two different non-ace cards (no pair, no ace) summing to value
  const options: [number, number][] = [];
  for (let a = 2; a <= 10; a++) {
    const b = key.value - a;
    if (b >= 2 && b <= 10 && a !== b) options.push([a, b]);
  }
  const [a, b] = options.length ? pick(options, rng) : [key.value - 10, 10];
  return { cards: [card(a, rng), card(b, rng)], up };
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function weightedPick(weights: number[], rng: Rng): number {
  let total = 0;
  for (const w of weights) total += w;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

export { RANKS };
