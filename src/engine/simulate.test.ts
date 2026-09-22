import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RULES } from "./rules.ts";
import { simulate } from "./simulate.ts";

const base = { rules: DEFAULT_RULES, unit: 10, bankroll: 100, hands: 100, seed: 1 };

test("flat betting loses roughly the house edge (within noise)", () => {
  const r = simulate({ ...base, systemId: "flat", sessions: 2000, bankroll: 100_000, keepCurves: 0 });
  assert.ok(r.totalHands === 200_000, String(r.totalHands));
  // 6D H17 DAS LS ≈ −0.56%; allow generous noise band
  assert.ok(r.evPerWagered > -0.012 && r.evPerWagered < 0.002, `ev ${r.evPerWagered}`);
  assert.ok(r.ms < 6000, `took ${r.ms}ms`);
});

test("martingale busts far more often than flat with 10 units", () => {
  const flat = simulate({ ...base, systemId: "flat", sessions: 1000, keepCurves: 0 });
  const mart = simulate({ ...base, systemId: "martingale", sessions: 1000, keepCurves: 0 });
  assert.ok(mart.bustRate > flat.bustRate + 0.1, `${mart.bustRate} vs ${flat.bustRate}`);
});

test("count spread has positive expectation, flat does not", () => {
  const r = { ...DEFAULT_RULES, maxBet: 10_000 };
  const flat = simulate({ ...base, rules: r, systemId: "flat", sessions: 800, hands: 500, bankroll: 100_000, keepCurves: 0 });
  const hilo = simulate({ ...base, rules: r, systemId: "hilo", sessions: 800, hands: 500, bankroll: 100_000, deviations: true, keepCurves: 0 });
  assert.ok(hilo.evPerWagered > flat.evPerWagered, `${hilo.evPerWagered} > ${flat.evPerWagered}`);
  assert.ok(hilo.evPerWagered > 0, `hilo ev ${hilo.evPerWagered}`);
});
