import { type Card, cardValue, handTotal, isPair } from "./cards.ts";
import type { Rules } from "./rules.ts";
import type { Action } from "./round.ts";

/**
 * Basic strategy for 4–8 decks, transcribed from Wizard of Odds (matches Blackjack Apprenticeship's chart).
 *  H hit · S stand · Dh double else hit · Ds double else stand · P split · Ph split if DAS else hit
 *  Rh surrender else hit · Rs surrender else stand · Rp surrender else split
 * Columns: dealer 2 3 4 5 6 7 8 9 T A.
 * ponytail: single/double-deck games reuse this chart (a handful of cells differ). Add a DD grid if you play pitch games.
 */
export type Code = "H" | "S" | "Dh" | "Ds" | "P" | "Ph" | "Rh" | "Rs" | "Rp";

const row = (s: string) => s.trim().split(/\s+/) as Code[];

const HARD_H17: Record<number, Code[]> = {
  8: row("H  H  H  H  H  H  H  H  H  H"),
  9: row("H  Dh Dh Dh Dh H  H  H  H  H"),
  10: row("Dh Dh Dh Dh Dh Dh Dh Dh H  H"),
  11: row("Dh Dh Dh Dh Dh Dh Dh Dh Dh Dh"),
  12: row("H  H  S  S  S  H  H  H  H  H"),
  13: row("S  S  S  S  S  H  H  H  H  H"),
  14: row("S  S  S  S  S  H  H  H  H  H"),
  15: row("S  S  S  S  S  H  H  H  Rh Rh"),
  16: row("S  S  S  S  S  H  H  Rh Rh Rh"),
  17: row("S  S  S  S  S  S  S  S  S  Rs"),
};
const SOFT_H17: Record<number, Code[]> = {
  13: row("H  H  H  Dh Dh H  H  H  H  H"),
  14: row("H  H  H  Dh Dh H  H  H  H  H"),
  15: row("H  H  Dh Dh Dh H  H  H  H  H"),
  16: row("H  H  Dh Dh Dh H  H  H  H  H"),
  17: row("H  Dh Dh Dh Dh H  H  H  H  H"),
  18: row("Ds Ds Ds Ds Ds S  S  H  H  H"),
  19: row("S  S  S  S  Ds S  S  S  S  S"),
};
const PAIR_H17: Record<number, Code[]> = {
  2: row("Ph Ph P  P  P  P  H  H  H  H"),
  3: row("Ph Ph P  P  P  P  H  H  H  H"),
  4: row("H  H  H  Ph Ph H  H  H  H  H"),
  6: row("Ph P  P  P  P  H  H  H  H  H"),
  7: row("P  P  P  P  P  P  H  H  H  H"),
  8: row("P  P  P  P  P  P  P  P  P  Rp"),
  9: row("P  P  P  P  P  S  P  P  S  S"),
  11: row("P  P  P  P  P  P  P  P  P  P"),
};

/** S17 differs from H17 in exactly six cells. */
const HARD_S17: Record<number, Code[]> = { ...HARD_H17, 11: row("Dh Dh Dh Dh Dh Dh Dh Dh Dh H"), 15: row("S  S  S  S  S  H  H  H  Rh H"), 17: row("S  S  S  S  S  S  S  S  S  S") };
const SOFT_S17: Record<number, Code[]> = { ...SOFT_H17, 18: row("S  Ds Ds Ds Ds S  S  H  H  H"), 19: row("S  S  S  S  S  S  S  S  S  S") };
const PAIR_S17: Record<number, Code[]> = { ...PAIR_H17, 8: row("P  P  P  P  P  P  P  P  P  P") };

export const DEALER_COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export type HandKind = "hard" | "soft" | "pair";
export interface CellKey { kind: HandKind; value: number; up: number }

export function chartCode(key: CellKey, rules: Pick<Rules, "h17">): Code {
  const col = DEALER_COLS.indexOf(key.up as (typeof DEALER_COLS)[number]);
  const tables = rules.h17 ? { hard: HARD_H17, soft: SOFT_H17, pair: PAIR_H17 } : { hard: HARD_S17, soft: SOFT_S17, pair: PAIR_S17 };
  if (key.kind === "hard") return key.value >= 18 ? "S" : key.value <= 8 ? "H" : tables.hard[key.value][col];
  if (key.kind === "soft") return key.value >= 20 ? "S" : tables.soft[Math.max(13, key.value)][col];
  // pairs of 5s and 10s are played as hard 10 / hard 20
  return tables.pair[key.value]?.[col] ?? chartCode({ kind: "hard", value: key.value * 2, up: key.up }, rules);
}

export const ROWS: Record<HandKind, number[]> = {
  hard: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  soft: [13, 14, 15, 16, 17, 18, 19],
  pair: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

/** Classify a player hand into its chart row. */
export function keyFor(cards: readonly Card[], up: Card, opts: { canSplit?: boolean } = {}): CellKey {
  const upv = up.rank === "A" ? 11 : cardValue(up.rank);
  if (isPair(cards) && opts.canSplit !== false) {
    const v = cards[0].rank === "A" ? 11 : cardValue(cards[0].rank);
    return { kind: "pair", value: v, up: upv };
  }
  const t = handTotal(cards);
  return { kind: t.soft ? "soft" : "hard", value: t.total, up: upv };
}

export interface Advice { code: Code; action: Action; key: CellKey; why: string }

/** Final action after applying what the table actually allows. */
export function resolve(code: Code, legal: readonly Action[], rules: Rules): Action {
  const can = (a: Action) => legal.includes(a);
  switch (code) {
    case "H": return "hit";
    case "S": return "stand";
    case "Dh": return can("double") ? "double" : "hit";
    case "Ds": return can("double") ? "double" : "stand";
    case "P": return can("split") ? "split" : "hit";
    case "Ph": return can("split") && rules.das ? "split" : "hit";
    case "Rh": return can("surrender") ? "surrender" : "hit";
    case "Rs": return can("surrender") ? "surrender" : "stand";
    case "Rp": return can("surrender") ? "surrender" : can("split") ? "split" : "hit";
  }
}

export function advise(cards: readonly Card[], up: Card, legal: readonly Action[], rules: Rules): Advice {
  let key = keyFor(cards, up, { canSplit: legal.includes("split") });
  let code = chartCode(key, rules);
  // If the chart says split-if-DAS and we can't, or the pair row resolves to a non-split, fall through to the total row.
  if (key.kind === "pair") {
    const a = resolve(code, legal, rules);
    if (a !== "split" && a !== "surrender") {
      key = keyFor(cards, up, { canSplit: false });
      code = chartCode(key, rules);
    }
  }
  return { code, action: resolve(code, legal, rules), key, why: phrase(key, rules) };
}

const upName = (u: number) => (u === 11 ? "A" : String(u));
const range = (codes: Code[], pred: (c: Code) => boolean): string => {
  const cols = DEALER_COLS.filter((_, i) => pred(codes[i])).map(upName);
  if (!cols.length) return "";
  if (cols.length === 1) return cols[0];
  const contiguous = cols.every((c, i) => i === 0 || DEALER_COLS.indexOf(Number(c === "A" ? 11 : c) as never) === DEALER_COLS.indexOf(Number(cols[i - 1] === "A" ? 11 : cols[i - 1]) as never) + 1);
  return contiguous ? `${cols[0]}–${cols[cols.length - 1]}` : cols.join(", ");
};

/** BJA-style one-liner for a chart row (regenerated from the table so it never drifts). */
export function phrase(key: CellKey, rules: Pick<Rules, "h17">): string {
  const codes = DEALER_COLS.map((up) => chartCode({ ...key, up }, rules));
  const label = key.kind === "pair" ? (key.value === 11 ? "A" : String(key.value)) : "";
  const name = key.kind === "pair" ? `${label},${label}` : key.kind === "soft" ? `Soft ${key.value} (A,${key.value - 11})` : `Hard ${key.value}`;
  const cat = (c: Code) => (c.startsWith("R") ? "surrender" : c === "P" || c === "Ph" ? "split" : c === "Dh" || c === "Ds" ? "double" : c === "S" ? "stand" : "hit");
  const cats = codes.map(cat);
  const count = (k: string) => cats.filter((x) => x === k).length;
  // BJA convention: hard totals end in "otherwise hit", soft totals in "otherwise stand" (when a stand exists).
  const fallback = key.kind === "pair" ? `play as ${key.value === 11 ? "soft 12" : `hard ${key.value * 2}`}` : key.kind === "hard" ? (count("hit") ? "hit" : "stand") : count("stand") ? "stand" : "hit";
  const fallbackCat = fallback === "stand" ? "stand" : fallback === "hit" ? "hit" : "";
  if (cats.every((c) => c === cats[0])) return `${name}: always ${cats[0]}.`;
  const parts: string[] = [];
  for (const k of ["surrender", "split", "double", "stand", "hit"]) {
    if (k === fallbackCat || !count(k)) continue;
    if (key.kind === "pair" && (k === "stand" || k === "hit")) continue;
    const das = k === "split" && codes.some((c) => c === "Ph") ? " (2–3 only if DAS)".replace("2–3", range(codes, (c) => c === "Ph")) : "";
    parts.push(`${k} vs ${range(codes, (c) => cat(c) === k)}${das}`);
  }
  return `${name}: ${parts.join("; ")}; otherwise ${fallback}.`;
}
