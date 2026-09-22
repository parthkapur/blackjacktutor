import { type BetCtx, type BetState, type Last, systemById } from "./betting.ts";
import { mulberry32, Shoe, type Rng } from "./cards.ts";
import { Counter } from "./count.ts";
import { deviationAction } from "./deviations.ts";
import type { Rules } from "./rules.ts";
import { act, legalActions, startRound, takeInsurance, type Action } from "./round.ts";
import { advise } from "./strategy.ts";

export interface SimParams {
  rules: Rules;
  systemId: string;
  unit: number;
  bankroll: number;
  /** Hands per session (a session also ends on bust, stop-loss or win goal). */
  hands: number;
  sessions: number;
  stopLoss?: number;
  winGoal?: number;
  /** Use Illustrious 18 / Fab 4 index plays (only meaningful with the count system). */
  deviations?: boolean;
  seed?: number;
  /** How many session curves to keep for the fan chart. */
  keepCurves?: number;
}

export interface SimResult {
  finals: number[];
  bustRate: number;
  aheadRate: number;
  mean: number;
  median: number;
  p5: number;
  p95: number;
  meanDrawdown: number;
  meanHands: number;
  totalHands: number;
  totalWagered: number;
  /** Net result per $ wagered (negative = house edge you actually paid). */
  evPerWagered: number;
  curves: number[][];
  ms: number;
}

/** Play one round with basic strategy (plus optional count deviations). Returns net. */
export function playHand(shoe: Shoe, rules: Rules, bet: number, bankroll: number, tc: number | null, deviations: boolean): number {
  let s = startRound(shoe, rules, bet);
  if (s.phase === "insurance") {
    const take = tc != null && tc >= 3 && bankroll - bet >= bet / 2;
    s = takeInsurance(s, take, shoe, rules);
  }
  while (s.phase === "player") {
    const h = s.hands[s.active];
    const wagered = s.hands.reduce((a, x) => a + x.bet, 0) + s.insuranceBet;
    const legal = legalActions(s, rules).filter((a: Action) => (a === "double" || a === "split" ? bankroll - wagered >= h.bet : true));
    let a = advise(h.cards, s.dealer[0], legal, rules).action;
    if (deviations && tc != null) a = deviationAction(h.cards, s.dealer[0], tc, legal, rules) ?? a;
    s = act(s, a, shoe, rules);
  }
  return s.net;
}

export function simulate(p: SimParams): SimResult {
  const t0 = Date.now();
  const rng: Rng = p.seed != null ? mulberry32(p.seed) : Math.random;
  const sys = systemById(p.systemId);
  const useCount = sys.kind === "count" || !!p.deviations;
  const finals: number[] = [];
  const curves: number[][] = [];
  let bust = 0, ahead = 0, ddSum = 0, handsSum = 0, wagered = 0, net = 0;
  const keep = p.keepCurves ?? 24;

  for (let sIdx = 0; sIdx < p.sessions; sIdx++) {
    const shoe = new Shoe(p.rules.decks, p.rules.penetration, rng);
    const counter = new Counter();
    let bankroll = p.bankroll;
    let peak = bankroll, dd = 0;
    let state: BetState = {};
    let last: Last | undefined;
    const curve = sIdx < keep ? [bankroll] : null;
    let h = 0;
    for (; h < p.hands; h++) {
      if (shoe.pastCutCard) shoe.shuffle();
      const tc = useCount ? counter.tc(shoe) : null;
      const ctx: BetCtx = { unit: p.unit, bankroll, minBet: p.rules.minBet, maxBet: p.rules.maxBet, last, trueCount: tc ?? undefined };
      const r = sys.next(ctx, state);
      state = r.state;
      if (r.bet <= 0) break;
      const won = playHand(shoe, p.rules, r.bet, bankroll, tc, !!p.deviations);
      bankroll = Math.round((bankroll + won) * 100) / 100;
      wagered += r.bet;
      net += won;
      last = { outcome: won > 0 ? "win" : won < 0 ? "lose" : "push", bet: r.bet, net: won };
      if (curve) curve.push(bankroll);
      if (bankroll > peak) peak = bankroll;
      if (peak - bankroll > dd) dd = peak - bankroll;
      if (bankroll < p.rules.minBet) break;
      if (p.stopLoss != null && p.bankroll - bankroll >= p.stopLoss) break;
      if (p.winGoal != null && bankroll - p.bankroll >= p.winGoal) break;
    }
    finals.push(bankroll);
    if (bankroll < p.rules.minBet) bust++;
    if (bankroll > p.bankroll) ahead++;
    ddSum += dd;
    handsSum += h;
    if (curve) curves.push(curve);
  }

  const sorted = [...finals].sort((a, b) => a - b);
  const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
  return {
    finals, bustRate: bust / p.sessions, aheadRate: ahead / p.sessions,
    mean: finals.reduce((a, b) => a + b, 0) / p.sessions, median: q(0.5), p5: q(0.05), p95: q(0.95),
    meanDrawdown: ddSum / p.sessions, meanHands: handsSum / p.sessions, totalHands: handsSum, totalWagered: wagered,
    evPerWagered: wagered ? net / wagered : 0, curves, ms: Date.now() - t0,
  };
}
