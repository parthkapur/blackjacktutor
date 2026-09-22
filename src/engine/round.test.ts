import { test } from "node:test";
import assert from "node:assert/strict";
import { Shoe, handTotal, isNatural, mulberry32, type Card, type Rank } from "./cards.ts";
import { DEFAULT_RULES, houseEdge, type Rules } from "./rules.ts";
import { act, legalActions, startRound, takeInsurance } from "./round.ts";

const c = (r: Rank): Card => ({ rank: r, suit: "s" });
const cards = (s: string) => [...s].map((ch) => c(ch as Rank));

/** A shoe that deals a fixed sequence (burn card first), then falls back to random. */
function rigged(seq: string): Shoe {
  const shoe = new Shoe(6, 0.75, mulberry32(1));
  const q = cards("2" + seq); // leading card is burned by shuffle()
  const orig = shoe.draw.bind(shoe);
  shoe.shuffle = () => {};
  shoe.draw = () => q.shift() ?? orig();
  shoe.draw(); // burn
  return shoe;
}

test("hand totals", () => {
  assert.deepEqual(handTotal(cards("A6")), { total: 17, soft: true });
  assert.deepEqual(handTotal(cards("A6T")), { total: 17, soft: false });
  assert.deepEqual(handTotal(cards("AA")), { total: 12, soft: true });
  assert.deepEqual(handTotal(cards("TT5")), { total: 25, soft: false });
  assert.equal(isNatural(cards("AK")), true);
  assert.equal(isNatural(cards("A55")), false);
});

test("player natural pays 3:2 (and 6:5)", () => {
  // deal order: P, D, P, D(hole)
  let s = startRound(rigged("A9K7"), DEFAULT_RULES, 10);
  assert.equal(s.phase, "settled");
  assert.equal(s.hands[0].result, "blackjack");
  assert.equal(s.net, 15);
  s = startRound(rigged("A9K7"), { ...DEFAULT_RULES, bjPays: 1.2 }, 10);
  assert.equal(s.net, 12);
});

test("dealer H17 hits A-6, S17 stands", () => {
  // P: T,8 = 18. D: A up, 6 hole → soft 17; next card 3 → 20 beats 18.
  const seq = "TA86" + "3";
  let s = startRound(rigged(seq), DEFAULT_RULES, 10);
  s = takeInsurance(s, false, rigged(seq), DEFAULT_RULES);
  assert.equal(s.phase, "player");
  const shoe = rigged(seq);
  s = startRound(shoe, DEFAULT_RULES, 10);
  s = takeInsurance(s, false, shoe, DEFAULT_RULES);
  s = act(s, "stand", shoe, DEFAULT_RULES);
  assert.equal(handTotal(s.dealer).total, 20);
  assert.equal(s.net, -10);

  const shoe2 = rigged(seq);
  const s17: Rules = { ...DEFAULT_RULES, h17: false };
  let t = startRound(shoe2, s17, 10);
  t = takeInsurance(t, false, shoe2, s17);
  t = act(t, "stand", shoe2, s17);
  assert.equal(handTotal(t.dealer).total, 17);
  assert.equal(t.net, 10);
});

test("insurance pays 2:1 when dealer has blackjack; player natural pushes", () => {
  const shoe = rigged("TA6K");
  let s = startRound(shoe, DEFAULT_RULES, 10);
  assert.equal(s.phase, "insurance");
  s = takeInsurance(s, true, shoe, DEFAULT_RULES);
  assert.equal(s.phase, "settled");
  assert.equal(s.dealerBlackjack, true);
  assert.equal(s.net, -10 + 10); // lose 10, insurance 5 pays 10
});

test("late surrender returns half", () => {
  const shoe = rigged("T9695");
  let s = startRound(shoe, DEFAULT_RULES, 10);
  assert.ok(legalActions(s, DEFAULT_RULES).includes("surrender"));
  s = act(s, "surrender", shoe, DEFAULT_RULES);
  assert.equal(s.net, -5);
  assert.equal(s.hands[0].result, "surrender");
});

test("double takes one card and doubles the bet", () => {
  // P: 6,5 = 11 vs D: 6 (hole 9). Double → T = 21. Dealer 15 → draws 2 → 17.
  const shoe = rigged("6659" + "T2");
  let s = startRound(shoe, DEFAULT_RULES, 10);
  s = act(s, "double", shoe, DEFAULT_RULES);
  assert.equal(s.hands[0].cards.length, 3);
  assert.equal(s.hands[0].bet, 20);
  assert.equal(s.net, 20);
});

test("split aces get one card each; A+T after split is 21, not blackjack", () => {
  // P: A,A vs D: 6 (hole 9). Split: first hand gets T, second gets 9. Dealer 15 → 7 → 22 bust.
  const shoe = rigged("A6A9" + "T9" + "7");
  let s = startRound(shoe, DEFAULT_RULES, 10);
  s = act(s, "split", shoe, DEFAULT_RULES);
  assert.equal(s.phase, "settled");
  assert.equal(s.hands.length, 2);
  assert.equal(s.hands[0].result, "win");
  assert.equal(s.hands[0].net, 10); // not 15
  assert.equal(s.net, 20);
});

test("split 8s, then double after split (DAS) allowed, not allowed without DAS", () => {
  const shoe = rigged("8686" + "32");
  let s = startRound(shoe, DEFAULT_RULES, 10);
  s = act(s, "split", shoe, DEFAULT_RULES);
  assert.ok(legalActions(s, DEFAULT_RULES).includes("double"));
  assert.ok(!legalActions(s, DEFAULT_RULES).includes("surrender"));
  const noDas: Rules = { ...DEFAULT_RULES, das: false };
  const shoe2 = rigged("8686" + "32");
  let t = startRound(shoe2, noDas, 10);
  t = act(t, "split", shoe2, noDas);
  assert.ok(!legalActions(t, noDas).includes("double"));
});

test("ENHC: dealer blackjack after player doubles loses the doubled bet", () => {
  const r: Rules = { ...DEFAULT_RULES, peek: false };
  // P: 6,5 vs D: T. Double → 4 (15). Dealer hole A → BJ.
  const shoe = rigged("6T5" + "4" + "A");
  let s = startRound(shoe, r, 10);
  assert.equal(s.dealer.length, 1);
  s = act(s, "double", shoe, r);
  assert.equal(s.dealerBlackjack, true);
  assert.equal(s.net, -20);
});

test("dealer does not draw when every player hand is bust", () => {
  const shoe = rigged("T6T9" + "9");
  let s = startRound(shoe, DEFAULT_RULES, 10);
  s = act(s, "hit", shoe, DEFAULT_RULES);
  assert.equal(handTotal(s.hands[0].cards).total, 29);
  assert.equal(s.dealer.length, 2);
  assert.equal(s.net, -10);
});

test("shoe deals every card exactly once and burns one", () => {
  const shoe = new Shoe(1, 0.75, mulberry32(42));
  assert.equal(shoe.remaining, 51);
  const seen = new Map<string, number>();
  seen.set(shoe.dealt[0].rank + shoe.dealt[0].suit, 1);
  for (let i = 0; i < 51; i++) {
    const k = shoe.draw();
    seen.set(k.rank + k.suit, (seen.get(k.rank + k.suit) ?? 0) + 1);
  }
  assert.equal(seen.size, 52);
  assert.ok([...seen.values()].every((v) => v === 1));
  assert.equal(shoe.pastCutCard, true);
});

test("house edge estimate", () => {
  assert.equal(houseEdge(DEFAULT_RULES), 0.56); // 6D H17 DAS LS
  assert.equal(houseEdge({ ...DEFAULT_RULES, bjPays: 1.2, surrender: "none", decks: 8 }), 2.04);
});
