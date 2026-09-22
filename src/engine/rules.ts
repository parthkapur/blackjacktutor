export interface Rules {
  decks: 1 | 2 | 4 | 6 | 8;
  /** Dealer hits soft 17. */
  h17: boolean;
  /** Double after split. */
  das: boolean;
  surrender: "none" | "late";
  /** 1.5 = 3:2, 1.2 = 6:5, 1 = even money. */
  bjPays: 1.5 | 1.2 | 1;
  /** Re-split aces. */
  rsa: boolean;
  /** Max hands after splitting (2–4). */
  maxHands: 2 | 3 | 4;
  doubleOn: "any" | "9-11" | "10-11";
  /** Dealer peeks for blackjack (US). false = European no-hole-card. */
  peek: boolean;
  /** Fraction of the shoe dealt before the shuffle. */
  penetration: number;
  minBet: number;
  maxBet: number;
}

export interface Preset { id: string; name: string; where: string; rules: Rules }

const base: Rules = {
  decks: 6, h17: true, das: true, surrender: "late", bjPays: 1.5, rsa: false,
  maxHands: 4, doubleOn: "any", peek: true, penetration: 0.75, minBet: 10, maxBet: 1000,
};

export const PRESETS: Preset[] = [
  { id: "downtown10", name: "$10 · 6D · H17 · DAS · LS · 3:2", where: "Downtown Vegas (Plaza, Circa, El Cortez)", rules: base },
  { id: "locals5", name: "$5 · 6D · H17 · DAS · 3:2", where: "Locals / off-Strip (Ellis Island, Silverton)", rules: { ...base, surrender: "none", minBet: 5, maxBet: 500 } },
  { id: "strip65", name: "$15 · 8D · H17 · DAS · 6:5", where: "Strip low-limit (Excalibur, most Strip floors)", rules: { ...base, decks: 8, bjPays: 1.2, surrender: "none", minBet: 15, maxBet: 2000 } },
  { id: "strip25", name: "$25 · 6D · S17 · DAS · LS · 3:2", where: "Strip 3:2 floor / high-limit room", rules: { ...base, h17: false, minBet: 25, maxBet: 5000 } },
  { id: "dd", name: "$25 · 2D · H17 · DAS · 3:2", where: "Double deck (pitch game)", rules: { ...base, decks: 2, surrender: "none", penetration: 0.6, minBet: 25, maxBet: 2000 } },
  { id: "enhc", name: "€10 · 6D · S17 · DAS · ENHC", where: "Europe / Canada / Australia (no hole card)", rules: { ...base, h17: false, peek: false, surrender: "none", maxHands: 2 } },
];

export const DEFAULT_RULES = PRESETS[0].rules;

/**
 * Approximate house edge (%) for perfect basic strategy.
 * Wizard of Odds deltas relative to 8D / S17 / DAS / split-to-4 / no surrender / peek (≈0.43%).
 * ponytail: additive approximation; good to ±0.05%. Use a proper CA if precision matters.
 */
export function houseEdge(r: Rules): number {
  let e = 0.43;
  e -= { 1: 0.48, 2: 0.19, 4: 0.06, 6: 0.02, 8: 0 }[r.decks];
  if (r.h17) e += 0.22;
  if (!r.das) e += 0.14;
  if (r.surrender === "late") e -= 0.07;
  if (r.rsa) e -= 0.08;
  if (r.maxHands === 2) e += 0.1;
  else if (r.maxHands === 3) e += 0.01;
  if (r.doubleOn === "9-11") e += 0.09;
  else if (r.doubleOn === "10-11") e += 0.18;
  if (!r.peek) e += 0.11;
  if (r.bjPays === 1.2) e += 1.39;
  else if (r.bjPays === 1) e += 2.27;
  return Math.round(e * 100) / 100;
}

export const EDGE_TABLE: { rule: string; delta: number; note: string }[] = [
  { rule: "Blackjack pays 6:5 instead of 3:2", delta: -1.39, note: "The single worst common rule. Never play it." },
  { rule: "Blackjack pays 1:1 (even money)", delta: -2.27, note: "Seen on some electronic / party pits." },
  { rule: "Dealer hits soft 17 (H17)", delta: -0.22, note: "Most US shoe games are H17 now." },
  { rule: "No double after split", delta: -0.14, note: "Changes 4 pair-splitting cells." },
  { rule: "Double on 10–11 only", delta: -0.18, note: "Kills soft doubles and 9 vs 3–6." },
  { rule: "Double on 9–11 only", delta: -0.09, note: "Kills soft doubles." },
  { rule: "No re-splitting (2 hands max)", delta: -0.1, note: "" },
  { rule: "European no hole card (ENHC)", delta: -0.11, note: "You lose doubles/splits to a dealer BJ." },
  { rule: "Late surrender", delta: 0.07, note: "Small but free. Use it: 16 vs 9/10/A, 15 vs 10." },
  { rule: "Re-split aces", delta: 0.08, note: "" },
  { rule: "Single deck", delta: 0.48, note: "Almost always paired with 6:5 today — net negative." },
  { rule: "Double deck", delta: 0.19, note: "Usually $25+ and H17." },
  { rule: "4 decks", delta: 0.06, note: "" },
  { rule: "6 decks", delta: 0.02, note: "The standard shoe game." },
  { rule: "8 decks", delta: 0, note: "Baseline." },
  { rule: "Early surrender vs ace", delta: 0.39, note: "Rare." },
  { rule: "Dealer 22 pushes (Blackjack Switch / Free Bet)", delta: -6.91, note: "Compensated by other rules in those variants." },
];
