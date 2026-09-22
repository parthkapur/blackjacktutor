import type { Card, Rank, Shoe } from "./cards.ts";

/** Hi-Lo tags: 2–6 = +1, 7–9 = 0, T–A = −1. */
export const hiLo = (r: Rank): number => (r === "A" || "TJQK".includes(r) ? -1 : r <= "6" && r >= "2" ? 1 : 0);

export const runningCount = (cards: readonly Card[]) => cards.reduce((a, c) => a + hiLo(c.rank), 0);

/** True count = running count per remaining deck; never divide by less than half a deck. */
export const trueCount = (rc: number, decksRemaining: number) => rc / Math.max(0.5, decksRemaining);

/** Incremental counter that follows a shoe's dealt list and resets on shuffle. */
export class Counter {
  rc = 0;
  private seen = 0;
  update(shoe: Shoe): number {
    if (shoe.dealt.length < this.seen) { this.rc = 0; this.seen = 0; }
    for (; this.seen < shoe.dealt.length; this.seen++) this.rc += hiLo(shoe.dealt[this.seen].rank);
    return this.rc;
  }
  tc(shoe: Shoe): number {
    return trueCount(this.update(shoe), shoe.decksRemaining);
  }
}
