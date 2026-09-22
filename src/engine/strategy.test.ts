import { test } from "node:test";
import assert from "node:assert/strict";
import type { Card, Rank } from "./cards.ts";
import { DEFAULT_RULES, type Rules } from "./rules.ts";
import type { Action } from "./round.ts";
import { advise, chartCode, DEALER_COLS, phrase } from "./strategy.ts";

const c = (r: Rank): Card => ({ rank: r, suit: "h" });
const ALL: Action[] = ["hit", "stand", "double", "split", "surrender"];
const S17: Rules = { ...DEFAULT_RULES, h17: false };
const ups = (s: string) => [...s].map((x) => (x === "A" ? 11 : x === "T" ? 10 : Number(x)));

const expectRow = (kind: "hard" | "soft" | "pair", value: number, rules: Rules, expected: string) => {
  const got = DEALER_COLS.map((up) => chartCode({ kind, value, up }, rules)).join(" ");
  assert.equal(got, expected.trim().split(/\s+/).join(" "), `${kind} ${value}`);
};

test("BJA 30 phrases (H17): hard totals", () => {
  const r = DEFAULT_RULES;
  for (const up of DEALER_COLS) assert.equal(chartCode({ kind: "hard", value: 8, up }, r), "H");
  for (const up of ups("3456")) assert.equal(chartCode({ kind: "hard", value: 9, up }, r), "Dh");
  for (const up of ups("2789TA")) assert.equal(chartCode({ kind: "hard", value: 9, up }, r), "H");
  for (const up of ups("23456789")) assert.equal(chartCode({ kind: "hard", value: 10, up }, r), "Dh");
  for (const up of ups("TA")) assert.equal(chartCode({ kind: "hard", value: 10, up }, r), "H");
  for (const up of DEALER_COLS) assert.equal(chartCode({ kind: "hard", value: 11, up }, r), "Dh");
  for (const up of ups("456")) assert.equal(chartCode({ kind: "hard", value: 12, up }, r), "S");
  for (const up of ups("23789TA")) assert.equal(chartCode({ kind: "hard", value: 12, up }, r), "H");
  for (const v of [13, 14, 15, 16]) {
    for (const up of ups("23456")) assert.equal(chartCode({ kind: "hard", value: v, up }, r), "S");
    for (const up of ups("78")) assert.equal(chartCode({ kind: "hard", value: v, up }, r), "H");
  }
  expectRow("hard", 15, r, "S S S S S H H H Rh Rh");
  expectRow("hard", 16, r, "S S S S S H H Rh Rh Rh");
  expectRow("hard", 17, r, "S S S S S S S S S Rs");
  for (const up of DEALER_COLS) assert.equal(chartCode({ kind: "hard", value: 18, up }, r), "S");
  for (const up of DEALER_COLS) assert.equal(chartCode({ kind: "hard", value: 5, up }, r), "H");
});

test("BJA 30 phrases (H17): soft totals", () => {
  const r = DEFAULT_RULES;
  expectRow("soft", 13, r, "H H H Dh Dh H H H H H");
  expectRow("soft", 14, r, "H H H Dh Dh H H H H H");
  expectRow("soft", 15, r, "H H Dh Dh Dh H H H H H");
  expectRow("soft", 16, r, "H H Dh Dh Dh H H H H H");
  expectRow("soft", 17, r, "H Dh Dh Dh Dh H H H H H");
  expectRow("soft", 18, r, "Ds Ds Ds Ds Ds S S H H H");
  expectRow("soft", 19, r, "S S S S Ds S S S S S");
  for (const up of DEALER_COLS) assert.equal(chartCode({ kind: "soft", value: 20, up }, r), "S");
});

test("BJA 30 phrases (H17): pairs", () => {
  const r = DEFAULT_RULES;
  expectRow("pair", 11, r, "P P P P P P P P P P");
  expectRow("pair", 10, r, "S S S S S S S S S S");
  expectRow("pair", 9, r, "P P P P P S P P S S");
  expectRow("pair", 8, r, "P P P P P P P P P Rp");
  expectRow("pair", 7, r, "P P P P P P H H H H");
  expectRow("pair", 6, r, "Ph P P P P H H H H H");
  expectRow("pair", 5, r, "Dh Dh Dh Dh Dh Dh Dh Dh H H");
  expectRow("pair", 4, r, "H H H Ph Ph H H H H H");
  expectRow("pair", 3, r, "Ph Ph P P P P H H H H");
  expectRow("pair", 2, r, "Ph Ph P P P P H H H H");
});

test("S17 differs from H17 in exactly the six known cells", () => {
  const diffs: string[] = [];
  const rows: ["hard" | "soft" | "pair", number[]][] = [["hard", [5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]], ["soft", [13, 14, 15, 16, 17, 18, 19, 20]], ["pair", [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]]];
  for (const [kind, vals] of rows) for (const value of vals) for (const up of DEALER_COLS) {
    const a = chartCode({ kind, value, up }, DEFAULT_RULES);
    const b = chartCode({ kind, value, up }, S17);
    if (a !== b) diffs.push(`${kind}${value}v${up}:${a}>${b}`);
  }
  assert.deepEqual(diffs.sort(), ["hard11v11:Dh>H", "hard15v11:Rh>H", "hard17v11:Rs>S", "pair8v11:Rp>P", "soft18v2:Ds>S", "soft19v6:Ds>S"].sort());
});

test("resolver honours table availability", () => {
  const r = DEFAULT_RULES;
  // 11 vs A with no double allowed → hit
  assert.equal(advise([c("6"), c("5")], c("A"), ["hit", "stand"], r).action, "hit");
  assert.equal(advise([c("6"), c("5")], c("A"), ALL, r).action, "double");
  // soft 18 vs 3, can't double (after split w/o DAS) → stand
  assert.equal(advise([c("A"), c("7")], c("3"), ["hit", "stand"], r).action, "stand");
  // 2,2 vs 2: split with DAS, hit without
  assert.equal(advise([c("2"), c("2")], c("2"), ALL, r).action, "split");
  assert.equal(advise([c("2"), c("2")], c("2"), ALL, { ...r, das: false }).action, "hit");
  // 4,4 vs 5 without DAS → play as hard 8 → hit
  const a = advise([c("4"), c("4")], c("5"), ALL, { ...r, das: false });
  assert.equal(a.action, "hit");
  assert.equal(a.key.kind, "hard");
  // 8,8 vs A: surrender (H17) if allowed, else split
  assert.equal(advise([c("8"), c("8")], c("A"), ALL, r).action, "surrender");
  assert.equal(advise([c("8"), c("8")], c("A"), ["hit", "stand", "split"], r).action, "split");
  assert.equal(advise([c("8"), c("8")], c("A"), ALL, S17).action, "split");
  // 16 vs 10 no surrender → hit; 5,5 vs 6 → double
  assert.equal(advise([c("T"), c("6")], c("K"), ["hit", "stand"], r).action, "hit");
  assert.equal(advise([c("5"), c("5")], c("6"), ALL, r).action, "double");
  // 9,9 vs 7 → stand (chart row says S), key stays pair
  assert.equal(advise([c("9"), c("9")], c("7"), ALL, r).action, "stand");
  // three-card soft 18 vs 4 (no double possible) → stand
  assert.equal(advise([c("A"), c("3"), c("4")], c("4"), ["hit", "stand"], r).action, "stand");
});

test("phrases read like BJA", () => {
  assert.equal(phrase({ kind: "hard", value: 16, up: 2 }, DEFAULT_RULES), "Hard 16: surrender vs 9–A; stand vs 2–6; otherwise hit.");
  assert.equal(phrase({ kind: "soft", value: 18, up: 2 }, DEFAULT_RULES), "Soft 18 (A,7): double vs 2–6; hit vs 9–A; otherwise stand.");
  assert.equal(phrase({ kind: "pair", value: 9, up: 2 }, DEFAULT_RULES), "9,9: split vs 2, 3, 4, 5, 6, 8, 9; otherwise play as hard 18.");
  assert.equal(phrase({ kind: "pair", value: 11, up: 2 }, DEFAULT_RULES), "A,A: always split.");
  assert.equal(phrase({ kind: "hard", value: 11, up: 2 }, DEFAULT_RULES), "Hard 11: always double.");
  assert.equal(phrase({ kind: "soft", value: 17, up: 2 }, DEFAULT_RULES), "Soft 17 (A,6): double vs 3–6; otherwise hit.");
  assert.equal(phrase({ kind: "pair", value: 2, up: 2 }, DEFAULT_RULES), "2,2: split vs 2–7 (2–3 only if DAS); otherwise play as hard 4.");
  assert.equal(phrase({ kind: "hard", value: 18, up: 2 }, DEFAULT_RULES), "Hard 18: always stand.");
});
