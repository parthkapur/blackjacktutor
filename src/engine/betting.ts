export type Outcome = "win" | "lose" | "push";
export interface Last { outcome: Outcome; bet: number; net: number }
export interface BetCtx {
  unit: number;
  bankroll: number;
  minBet: number;
  maxBet: number;
  /** Previous round, if any. */
  last?: Last;
  /** Hi-Lo true count at the start of the round (only used by the count-based system). */
  trueCount?: number;
}
/** Systems carry a small state between rounds; kept as plain JSON so it can live in React state. */
export type BetState = Record<string, number>;

export interface BettingSystem {
  id: string;
  name: string;
  kind: "flat" | "negative" | "positive" | "count";
  blurb: string;
  blowsUp: string;
  next(ctx: BetCtx, state: BetState): { bet: number; state: BetState };
}

/** Table max, bankroll, and minimum all clamp the intended bet. Returns 0 when you can't cover the minimum. */
export function clamp(intended: number, ctx: BetCtx): number {
  const cap = Math.min(ctx.maxBet, ctx.bankroll);
  if (cap < ctx.minBet) return 0;
  return Math.max(ctx.minBet, Math.min(cap, Math.round(intended)));
}

export const DEFAULT_RAMP: Record<string, number> = { "1": 1, "2": 2, "3": 4, "4": 8 };
export const rampBet = (tc: number, unit: number, ramp = DEFAULT_RAMP) => {
  const key = String(Math.max(1, Math.min(4, Math.floor(tc))));
  return unit * (ramp[key] ?? 1);
};

export const SYSTEMS: BettingSystem[] = [
  {
    id: "flat", name: "Flat betting", kind: "flat",
    blurb: "Bet the same amount every hand.",
    blowsUp: "It doesn't — you just lose the house edge slowly. Lowest variance of anything here.",
    next: (ctx) => ({ bet: clamp(ctx.unit, ctx), state: {} }),
  },
  {
    id: "martingale", name: "Martingale", kind: "negative",
    blurb: "Double after every loss; back to one unit after a win. One win recovers everything plus a unit.",
    blowsUp: "Seven losses in a row needs a 128-unit bet. With $100 at $10 you're capped after the 3rd loss and the whole cycle is lost. Losing 5+ straight happens about once per 40 hands.",
    next: (ctx) => {
      const want = !ctx.last ? ctx.unit : ctx.last.outcome === "lose" ? ctx.last.bet * 2 : ctx.last.outcome === "push" ? ctx.last.bet : ctx.unit;
      return { bet: clamp(want, ctx), state: {} };
    },
  },
  {
    id: "dalembert", name: "D'Alembert", kind: "negative",
    blurb: "Add one unit after a loss, remove one after a win.",
    blowsUp: "Gentler than Martingale, but you still bet most when you're losing, and blackjack's ~43/49 win/loss split means the ladder mostly climbs.",
    next: (ctx, s) => {
      const level = ctx.last ? Math.max(1, (s.level ?? 1) + (ctx.last.outcome === "lose" ? 1 : ctx.last.outcome === "win" ? -1 : 0)) : 1;
      return { bet: clamp(level * ctx.unit, ctx), state: { level } };
    },
  },
  {
    id: "oscar", name: "Oscar's Grind", kind: "negative",
    blurb: "Aim for +1 unit per cycle. Same bet after a loss, one unit more after a win, never more than needed to finish the cycle.",
    blowsUp: "Long cycles stuck deep underwater; capped by the table max or your bankroll just like the others.",
    next: (ctx, s) => {
      let profit = s.profit ?? 0;
      let level = s.level ?? 1;
      if (ctx.last) {
        profit += ctx.last.net / ctx.unit;
        if (profit >= 1) { profit = 0; level = 1; }
        else if (ctx.last.outcome === "win") level = Math.min(level + 1, Math.max(1, Math.ceil(1 - profit)));
      }
      return { bet: clamp(level * ctx.unit, ctx), state: { profit, level } };
    },
  },
  {
    id: "paroli", name: "Paroli", kind: "positive",
    blurb: "Double after a win, up to three wins in a row, then reset. Reset after any loss.",
    blowsUp: "It can't bust you fast — you're pressing the house's money. It also can't beat the edge; it just reshapes the swings into small losses and occasional 7-unit pops.",
    next: (ctx, s) => {
      const streak = ctx.last ? (ctx.last.outcome === "win" ? ((s.streak ?? 0) + 1) % 3 : ctx.last.outcome === "push" ? s.streak ?? 0 : 0) : 0;
      return { bet: clamp(ctx.unit * 2 ** streak, ctx), state: { streak } };
    },
  },
  {
    id: "1326", name: "1-3-2-6", kind: "positive",
    blurb: "Bet 1, 3, 2, 6 units on consecutive wins; any loss (or finishing the sequence) restarts at 1.",
    blowsUp: "Same as Paroli: bounded downside, no change in expectation. Four wins in a row (~3.5%) pays 12 units.",
    next: (ctx, s) => {
      const seq = [1, 3, 2, 6];
      const step = ctx.last ? (ctx.last.outcome === "win" ? ((s.step ?? 0) + 1) % 4 : ctx.last.outcome === "push" ? s.step ?? 0 : 0) : 0;
      return { bet: clamp(seq[step] * ctx.unit, ctx), state: { step } };
    },
  },
  {
    id: "hilo", name: "Hi-Lo count spread", kind: "count",
    blurb: "Bet the minimum until the true count is +2, then ramp: TC2 → 2 units, TC3 → 4, TC4+ → 8. The only system here that changes expectation.",
    blowsUp: "Needs a bankroll of hundreds of units for the ramp to survive variance — with 10 units the risk of ruin is enormous even with an edge. Casinos also back off obvious spreads.",
    next: (ctx) => ({ bet: clamp(rampBet(ctx.trueCount ?? 0, ctx.unit), ctx), state: {} }),
  },
];

export const systemById = (id: string) => SYSTEMS.find((s) => s.id === id) ?? SYSTEMS[0];
