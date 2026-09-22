import { type Card, handTotal, isPair } from "./cards.ts";
import type { Rules } from "./rules.ts";
import type { Action } from "./round.ts";

/**
 * Hi-Lo index plays: the Illustrious 18 + Fab 4 (Don Schlesinger). Multi-deck, generic indices.
 * Action applies when true count >= index (or <= for the "fall" plays marked `below`).
 */
export interface Deviation { hand: string; up: number; index: number; action: Action; below?: boolean; note: string; group: "I18" | "Fab4" }

export const DEVIATIONS: Deviation[] = [
  { hand: "insurance", up: 11, index: 3, action: "stand", note: "Take insurance at TC +3 or more", group: "I18" },
  { hand: "16", up: 10, index: 0, action: "stand", note: "Stand 16 vs 10 at TC 0+ (hit below)", group: "I18" },
  { hand: "15", up: 10, index: 4, action: "stand", note: "Stand 15 vs 10 at TC +4", group: "I18" },
  { hand: "T,T", up: 5, index: 5, action: "split", note: "Split tens vs 5 at TC +5", group: "I18" },
  { hand: "T,T", up: 6, index: 4, action: "split", note: "Split tens vs 6 at TC +4", group: "I18" },
  { hand: "10", up: 10, index: 4, action: "double", note: "Double 10 vs 10 at TC +4", group: "I18" },
  { hand: "12", up: 3, index: 2, action: "stand", note: "Stand 12 vs 3 at TC +2", group: "I18" },
  { hand: "12", up: 2, index: 3, action: "stand", note: "Stand 12 vs 2 at TC +3", group: "I18" },
  { hand: "11", up: 11, index: 1, action: "double", note: "Double 11 vs A at TC +1 (S17 games)", group: "I18" },
  { hand: "9", up: 2, index: 1, action: "double", note: "Double 9 vs 2 at TC +1", group: "I18" },
  { hand: "10", up: 11, index: 4, action: "double", note: "Double 10 vs A at TC +4", group: "I18" },
  { hand: "9", up: 7, index: 3, action: "double", note: "Double 9 vs 7 at TC +3", group: "I18" },
  { hand: "16", up: 9, index: 5, action: "stand", note: "Stand 16 vs 9 at TC +5", group: "I18" },
  { hand: "13", up: 2, index: -1, action: "hit", below: true, note: "Hit 13 vs 2 at TC −1 or less", group: "I18" },
  { hand: "12", up: 4, index: 0, action: "hit", below: true, note: "Hit 12 vs 4 at TC below 0", group: "I18" },
  { hand: "12", up: 5, index: -2, action: "hit", below: true, note: "Hit 12 vs 5 at TC −2 or less", group: "I18" },
  { hand: "12", up: 6, index: -1, action: "hit", below: true, note: "Hit 12 vs 6 at TC −1 or less", group: "I18" },
  { hand: "13", up: 3, index: -2, action: "hit", below: true, note: "Hit 13 vs 3 at TC −2 or less", group: "I18" },
  { hand: "14", up: 10, index: 3, action: "surrender", note: "Surrender 14 vs 10 at TC +3", group: "Fab4" },
  { hand: "15", up: 10, index: 0, action: "surrender", note: "Surrender 15 vs 10 at TC 0+ (hit below)", group: "Fab4" },
  { hand: "15", up: 9, index: 2, action: "surrender", note: "Surrender 15 vs 9 at TC +2", group: "Fab4" },
  { hand: "15", up: 11, index: 1, action: "surrender", note: "Surrender 15 vs A at TC +1", group: "Fab4" },
];

// Surrender is decided first at the table, so Fab 4 plays are checked before the Illustrious 18.
const ORDERED = [...DEVIATIONS].sort((a, b) => Number(b.action === "surrender") - Number(a.action === "surrender"));

const upVal = (c: Card) => (c.rank === "A" ? 11 : "TJQK".includes(c.rank) ? 10 : Number(c.rank));

/** Returns the index-play action if one applies at this true count and is legal, else null. */
export function deviationAction(cards: readonly Card[], up: Card, tc: number, legal: readonly Action[], rules: Rules): Action | null {
  const t = handTotal(cards);
  const u = upVal(up);
  const names: string[] = [];
  if (isPair(cards) && upVal(cards[0]) === 10) names.push("T,T");
  if (!t.soft) names.push(String(t.total));
  for (const d of ORDERED) {
    if (d.hand === "insurance" || d.up !== u || !names.includes(d.hand)) continue;
    if (d.hand === "11" && rules.h17) continue; // H17 basic strategy already doubles 11 vs A
    const fires = d.below ? tc <= d.index : tc >= d.index;
    if (!fires) {
      // "stand at index" also means "hit below index" for the fall-back cases where basic strategy stands
      if (d.hand === "16" && d.up === 10 && !d.below && tc < d.index && legal.includes("hit")) return "hit";
      if (d.hand === "15" && d.up === 10 && d.action === "surrender" && tc < d.index && legal.includes("hit")) return "hit";
      continue;
    }
    if (legal.includes(d.action)) return d.action;
    if (d.action === "surrender" && legal.includes("hit")) continue; // no surrender at this table → fall through to other plays
    if (d.action === "double" && legal.includes("hit")) return "hit";
    if (d.action === "split") continue;
  }
  return null;
}
