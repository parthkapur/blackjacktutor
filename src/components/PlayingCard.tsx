import type { Card } from "@/engine/cards";
import styles from "./PlayingCard.module.css";

const SUIT_PATH: Record<Card["suit"], string> = {
  s: "M12 2C9 7 4 9.5 4 14a4 4 0 0 0 7 2.6c-.2 2-1 3.6-2.5 4.9h7c-1.5-1.3-2.3-2.9-2.5-4.9A4 4 0 0 0 20 14c0-4.5-5-7-8-12z",
  h: "M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z",
  d: "M12 2 20 12 12 22 4 12z",
  c: "M12 2a4 4 0 0 0-3.4 6.1A4 4 0 1 0 11 14.8c-.2 2-1 3.6-2.5 4.9h7c-1.5-1.3-2.3-2.9-2.5-4.9a4 4 0 1 0 2.4-6.7A4 4 0 0 0 12 2z",
};
const SUIT_NAME: Record<Card["suit"], string> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };
const RANK_NAME: Record<string, string> = { A: "ace", T: "10", J: "jack", Q: "queen", K: "king" };

const Suit = ({ suit }: { suit: Card["suit"] }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={SUIT_PATH[suit]} fill="currentColor" /></svg>
);

export default function PlayingCard({ card, hidden = false, animate = false, className = "" }: { card?: Card; hidden?: boolean; animate?: boolean; className?: string }) {
  if (hidden || !card) {
    return <div className={`${styles.card} ${styles.back} ${animate ? styles.enter : ""} ${className}`} role="img" aria-label="face-down card" />;
  }
  const red = card.suit === "h" || card.suit === "d";
  const rank = card.rank === "T" ? "10" : card.rank;
  return (
    <div className={`${styles.card} ${red ? styles.red : ""} ${animate ? styles.enter : ""} ${className}`} role="img" aria-label={`${RANK_NAME[card.rank] ?? card.rank} of ${SUIT_NAME[card.suit]}`}>
      <span className={styles.corner}>{rank}<Suit suit={card.suit} /></span>
      <span className={styles.pip}><Suit suit={card.suit} /></span>
      <span className={`${styles.corner} ${styles.br}`}>{rank}<Suit suit={card.suit} /></span>
    </div>
  );
}
