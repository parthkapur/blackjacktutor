import { type Card, type Shoe, handTotal, isNatural, isPair, cardValue } from "./cards.ts";
import type { Rules } from "./rules.ts";

export type Action = "hit" | "stand" | "double" | "split" | "surrender";
export type Result = "win" | "lose" | "push" | "blackjack" | "surrender";

export interface PlayerHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  surrendered: boolean;
  fromSplit: boolean;
  splitAces: boolean;
  done: boolean;
  result?: Result;
  /** Net for this hand: +bet on win, −bet on loss, 0 push, etc. */
  net?: number;
}

export type Phase = "insurance" | "player" | "settled";

export interface RoundState {
  phase: Phase;
  dealer: Card[];
  hands: PlayerHand[];
  active: number;
  insuranceBet: number;
  dealerBlackjack: boolean;
  /** Total net for the round including insurance; set when settled. */
  net: number;
}

const hand = (cards: Card[], bet: number, extra: Partial<PlayerHand> = {}): PlayerHand => ({
  cards, bet, doubled: false, surrendered: false, fromSplit: false, splitAces: false, done: false, ...extra,
});

export function startRound(shoe: Shoe, rules: Rules, bet: number): RoundState {
  const p1 = shoe.draw();
  const d1 = shoe.draw();
  const p2 = shoe.draw();
  const dealer = rules.peek ? [d1, shoe.draw()] : [d1];
  const s: RoundState = {
    phase: "player", dealer, hands: [hand([p1, p2], bet)], active: 0, insuranceBet: 0, dealerBlackjack: false, net: 0,
  };
  if (d1.rank === "A") {
    s.phase = "insurance";
    return s;
  }
  return afterInsurance(s, shoe, rules);
}

/** Resolve dealer peek (if any) and player natural; move to player phase or settle. */
function afterInsurance(s: RoundState, shoe: Shoe, rules: Rules): RoundState {
  if (rules.peek && isNatural(s.dealer)) {
    s.dealerBlackjack = true;
    return settle(s, rules);
  }
  if (isNatural(s.hands[0].cards)) {
    s.hands[0].done = true;
    return finish(s, shoe, rules);
  }
  s.phase = "player";
  return s;
}

export function takeInsurance(s: RoundState, take: boolean, shoe: Shoe, rules: Rules): RoundState {
  if (s.phase !== "insurance") return s;
  s.insuranceBet = take ? s.hands[0].bet / 2 : 0;
  return afterInsurance(s, shoe, rules);
}

export function legalActions(s: RoundState, rules: Rules): Action[] {
  if (s.phase !== "player") return [];
  const h = s.hands[s.active];
  if (h.done) return [];
  const acts: Action[] = ["hit", "stand"];
  const two = h.cards.length === 2;
  if (two && canDouble(h, rules)) acts.push("double");
  if (two && isPair(h.cards) && s.hands.length < rules.maxHands && (!h.splitAces || rules.rsa)) acts.push("split");
  if (two && !h.fromSplit && rules.surrender === "late" && s.hands.length === 1) acts.push("surrender");
  return acts;
}

function canDouble(h: PlayerHand, rules: Rules): boolean {
  if (h.splitAces) return false;
  if (h.fromSplit && !rules.das) return false;
  const t = handTotal(h.cards);
  if (rules.doubleOn === "any") return true;
  if (t.soft) return false;
  return rules.doubleOn === "9-11" ? t.total >= 9 && t.total <= 11 : t.total >= 10 && t.total <= 11;
}

export function act(s: RoundState, a: Action, shoe: Shoe, rules: Rules): RoundState {
  if (!legalActions(s, rules).includes(a)) throw new Error(`illegal action ${a}`);
  const h = s.hands[s.active];
  switch (a) {
    case "hit":
      h.cards.push(shoe.draw());
      if (handTotal(h.cards).total >= 21) h.done = true;
      break;
    case "stand":
      h.done = true;
      break;
    case "double":
      h.cards.push(shoe.draw());
      h.bet *= 2;
      h.doubled = true;
      h.done = true;
      break;
    case "surrender":
      h.surrendered = true;
      h.done = true;
      break;
    case "split": {
      const aces = h.cards[0].rank === "A";
      const second = hand([h.cards.pop()!, shoe.draw()], h.bet, { fromSplit: true, splitAces: aces });
      h.cards.push(shoe.draw());
      h.fromSplit = true;
      h.splitAces = aces;
      s.hands.splice(s.active + 1, 0, second);
      if (aces && !rules.rsa) {
        h.done = true;
        second.done = true;
      } else if (aces) {
        // may re-split aces but not hit them
        if (!isPair(h.cards)) h.done = true;
        if (!isPair(second.cards)) second.done = true;
      }
      break;
    }
  }
  return advance(s, shoe, rules);
}

function advance(s: RoundState, shoe: Shoe, rules: Rules): RoundState {
  while (s.active < s.hands.length && s.hands[s.active].done) s.active++;
  if (s.active >= s.hands.length) return finish(s, shoe, rules);
  return s;
}

/** All player hands done: dealer plays if anything is still live, then settle. */
function finish(s: RoundState, shoe: Shoe, rules: Rules): RoundState {
  if (!rules.peek && s.dealer.length === 1) s.dealer.push(shoe.draw());
  const live = s.hands.some((h) => !h.surrendered && handTotal(h.cards).total <= 21);
  const playerNatural = s.hands.length === 1 && !s.hands[0].fromSplit && isNatural(s.hands[0].cards);
  if (live && !playerNatural) {
    for (;;) {
      const t = handTotal(s.dealer);
      if (t.total > 17 || (t.total === 17 && !(t.soft && rules.h17))) break;
      s.dealer.push(shoe.draw());
    }
  }
  s.dealerBlackjack = isNatural(s.dealer);
  return settle(s, rules);
}

function settle(s: RoundState, rules: Rules): RoundState {
  const dt = handTotal(s.dealer).total;
  let net = 0;
  for (const h of s.hands) {
    const pt = handTotal(h.cards).total;
    const natural = !h.fromSplit && s.hands.length === 1 && isNatural(h.cards);
    let r: Result;
    if (h.surrendered) r = "surrender";
    else if (s.dealerBlackjack) r = natural ? "push" : "lose";
    else if (natural) r = "blackjack";
    else if (pt > 21) r = "lose";
    else if (dt > 21 || pt > dt) r = "win";
    else if (pt === dt) r = "push";
    else r = "lose";
    h.result = r;
    h.done = true;
    h.net = r === "win" ? h.bet : r === "blackjack" ? h.bet * rules.bjPays : r === "push" ? 0 : r === "surrender" ? -h.bet / 2 : -h.bet;
    net += h.net;
  }
  if (s.insuranceBet) net += s.dealerBlackjack ? s.insuranceBet * 2 : -s.insuranceBet;
  s.net = Math.round(net * 100) / 100;
  s.phase = "settled";
  return s;
}

export const upcard = (s: RoundState): Card => s.dealer[0];
export const upValue = (s: RoundState): number => cardValue(s.dealer[0].rank);
