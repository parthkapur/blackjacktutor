export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"] as const;
export type Rank = (typeof RANKS)[number];
export type Suit = "s" | "h" | "d" | "c";
export interface Card { rank: Rank; suit: Suit }

export const cardValue = (r: Rank): number => (r === "A" ? 1 : "TJQK".includes(r) ? 10 : Number(r));

/** Best total ≤ 21 (or minimum if bust) and whether an ace is counted as 11. */
export function handTotal(cards: readonly Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.rank);
    if (c.rank === "A") aces++;
  }
  const soft = aces > 0 && total + 10 <= 21;
  return { total: soft ? total + 10 : total, soft };
}

export const isBust = (cards: readonly Card[]) => handTotal(cards).total > 21;
export const isPair = (cards: readonly Card[]) =>
  cards.length === 2 && cardValue(cards[0].rank) === cardValue(cards[1].rank);
/** Natural: exactly two cards totalling 21 (not after a split). */
export const isNatural = (cards: readonly Card[]) => cards.length === 2 && handTotal(cards).total === 21;

export type Rng = () => number;

/** Small seedable PRNG so tests and simulations are reproducible. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Shoe {
  private cards: Card[] = [];
  private pos = 0;
  readonly cutCard: number;
  /** All cards dealt since the last shuffle, in order (for counting / replay). */
  dealt: Card[] = [];

  readonly decks: number;
  readonly penetration: number;
  private rng: Rng;

  constructor(decks: number, penetration: number, rng: Rng = Math.random) {
    this.decks = decks;
    this.penetration = penetration;
    this.rng = rng;
    this.cutCard = Math.floor(decks * 52 * penetration);
    this.shuffle();
  }

  shuffle(): void {
    const cards: Card[] = [];
    for (let d = 0; d < this.decks; d++)
      for (const suit of ["s", "h", "d", "c"] as const) for (const rank of RANKS) cards.push({ rank, suit });
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    this.cards = cards;
    this.pos = 0;
    this.dealt = [];
    this.draw(); // burn card
  }

  draw(): Card {
    if (this.pos >= this.cards.length) this.shuffle();
    const c = this.cards[this.pos++];
    this.dealt.push(c);
    return c;
  }

  /** True once the cut card has been passed — shuffle before the next round. */
  get pastCutCard(): boolean {
    return this.pos >= this.cutCard;
  }
  get remaining(): number {
    return this.cards.length - this.pos;
  }
  get decksRemaining(): number {
    return this.remaining / 52;
  }
  get total(): number {
    return this.cards.length;
  }
}
