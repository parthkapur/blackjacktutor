import { test } from "node:test";
import assert from "node:assert/strict";
import { type BetCtx, type BetState, type Outcome, rampBet, systemById } from "./betting.ts";

/** Run a system through a W/L/P string, returning the bet placed each round. */
function run(id: string, seq: string, ctx: Partial<BetCtx> = {}): number[] {
  const sys = systemById(id);
  const base: BetCtx = { unit: 10, bankroll: 10_000, minBet: 10, maxBet: 10_000, ...ctx };
  let state: BetState = {};
  let last: BetCtx["last"];
  let bankroll = base.bankroll;
  const bets: number[] = [];
  for (const ch of seq + "x") {
    const r = sys.next({ ...base, bankroll, last }, state);
    state = r.state;
    bets.push(r.bet);
    if (ch === "x") break;
    const outcome: Outcome = ch === "W" ? "win" : ch === "L" ? "lose" : "push";
    last = { outcome, bet: r.bet, net: outcome === "win" ? r.bet : outcome === "lose" ? -r.bet : 0 };
    bankroll += last.net;
  }
  return bets;
}

test("flat", () => assert.deepEqual(run("flat", "WLLW"), [10, 10, 10, 10, 10]));

test("martingale doubles on loss, resets on win, holds on push", () => {
  assert.deepEqual(run("martingale", "LLLW"), [10, 20, 40, 80, 10]);
  assert.deepEqual(run("martingale", "LPL"), [10, 20, 20, 40]);
});

test("martingale is capped by bankroll and table max", () => {
  assert.deepEqual(run("martingale", "LLLL", { bankroll: 100 }), [10, 20, 40, 30, 0]);
  assert.deepEqual(run("martingale", "LLLL", { maxBet: 50 }), [10, 20, 40, 50, 50]);
});

test("d'alembert ladder", () => assert.deepEqual(run("dalembert", "LLWWW"), [10, 20, 30, 20, 10, 10]));

test("paroli presses three wins then resets", () => {
  assert.deepEqual(run("paroli", "WWWW"), [10, 20, 40, 10, 20]);
  assert.deepEqual(run("paroli", "WL"), [10, 20, 10]);
});

test("1-3-2-6", () => {
  assert.deepEqual(run("1326", "WWWW"), [10, 30, 20, 60, 10]);
  assert.deepEqual(run("1326", "WWL"), [10, 30, 20, 10]);
});

test("oscar's grind: same after loss, +1 after win, never overshoots +1 unit", () => {
  // L L W W → bets 1,1,1(after L),2(after W: profit −1 → need 2),… cycle closes at +1
  assert.deepEqual(run("oscar", "LLWW"), [10, 10, 10, 20, 10]);
  // L W → profit 0 after win; next bet capped at 1 unit (need exactly +1)
  assert.deepEqual(run("oscar", "LW"), [10, 10, 10]);
});

test("hi-lo ramp", () => {
  assert.equal(rampBet(-2, 10), 10);
  assert.equal(rampBet(1.9, 10), 10);
  assert.equal(rampBet(2, 10), 20);
  assert.equal(rampBet(3.5, 10), 40);
  assert.equal(rampBet(7, 10), 80);
});
