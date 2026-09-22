import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32 } from "./cards.ts";
import { ALL_CELLS, cardsFor } from "./deal.ts";
import { keyFor } from "./strategy.ts";

test("cardsFor lands in the requested cell for every cell", () => {
  const rng = mulberry32(7);
  for (const key of ALL_CELLS) {
    for (let i = 0; i < 5; i++) {
      const { cards, up } = cardsFor(key, rng);
      assert.deepEqual(keyFor(cards, up), key, JSON.stringify({ key, cards, up }));
    }
  }
  assert.equal(ALL_CELLS.length, 270);
});
