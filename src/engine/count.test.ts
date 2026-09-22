import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32, Shoe, type Card, type Rank } from "./cards.ts";
import { Counter, hiLo, runningCount, trueCount } from "./count.ts";
import { deviationAction } from "./deviations.ts";
import { DEFAULT_RULES } from "./rules.ts";

const c = (r: Rank): Card => ({ rank: r, suit: "c" });

test("hi-lo tags and running count", () => {
  assert.deepEqual(["2", "6", "7", "9", "T", "A"].map((r) => hiLo(r as Rank)), [1, 1, 0, 0, -1, -1]);
  assert.equal(runningCount("2345678TJQKA".split("").map((r) => c(r as Rank))), 5 - 5);
  assert.equal(trueCount(6, 3), 2);
  assert.equal(trueCount(3, 0.25), 6); // never divides by less than half a deck
});

test("counter follows a shoe and resets on shuffle", () => {
  const shoe = new Shoe(1, 0.5, mulberry32(9));
  const ctr = new Counter();
  for (let i = 0; i < 20; i++) shoe.draw();
  assert.equal(ctr.update(shoe), runningCount(shoe.dealt));
  shoe.shuffle();
  shoe.draw();
  assert.equal(ctr.update(shoe), runningCount(shoe.dealt));
  // a full single deck always counts to zero
  while (shoe.remaining) shoe.draw();
  assert.equal(ctr.update(shoe), 0);
});

test("index plays fire at the right counts", () => {
  const all = ["hit", "stand", "double", "split", "surrender"] as const;
  const r = DEFAULT_RULES;
  assert.equal(deviationAction([c("T"), c("6")], c("T"), 0, all, r), "stand"); // 16 v T at TC 0 → stand
  assert.equal(deviationAction([c("T"), c("6")], c("T"), -1, all, r), "hit");
  assert.equal(deviationAction([c("T"), c("5")], c("T"), 4, all, r), "surrender"); // Fab 4 beats I18 stand
  assert.equal(deviationAction([c("T"), c("5")], c("T"), 4, ["hit", "stand"], r), "stand"); // no surrender at table → I18 stand at +4
  assert.equal(deviationAction([c("T"), c("2")], c("3"), 2, all, r), "stand");
  assert.equal(deviationAction([c("T"), c("2")], c("4"), -1, all, r), "hit");
  assert.equal(deviationAction([c("K"), c("Q")], c("6"), 4, all, r), "split");
  assert.equal(deviationAction([c("K"), c("Q")], c("6"), 3, all, r), null);
  assert.equal(deviationAction([c("A"), c("7")], c("2"), 5, all, r), null); // soft hands: no index here
});
