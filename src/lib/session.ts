import type { Rules } from "@/engine/rules";
import type { Result } from "@/engine/round";
import type { CellKey, Code } from "@/engine/strategy";
import { readStorage, writeStorage } from "./storage";

export interface Decision { key: CellKey; code: Code; correct: boolean; took: string; should: string }
export interface HandRecord { bet: number; net: number; results: Result[]; decisions: Decision[]; at: number }

export interface Session {
  id: string;
  startedAt: number;
  endedAt?: number;
  rules: Rules;
  system: string;
  start: number;
  end: number;
  curve: number[];
  hands: HandRecord[];
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  decisions: number;
  mistakes: number;
  peak: number;
  trough: number;
}

export const SESSIONS_KEY = "bjt.sessions";
export const CURRENT_KEY = "bjt.session";
export const BANKROLL_KEY = "bjt.bankroll";
export const START_BANKROLL = 100;

export function newSession(rules: Rules, bankroll: number, system = "manual"): Session {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    startedAt: Date.now(), rules, system, start: bankroll, end: bankroll, curve: [bankroll],
    hands: [], wins: 0, losses: 0, pushes: 0, blackjacks: 0, decisions: 0, mistakes: 0, peak: bankroll, trough: bankroll,
  };
}

export function addHand(s: Session, h: HandRecord): Session {
  const end = Math.round((s.end + h.net) * 100) / 100;
  const wins = h.results.filter((r) => r === "win" || r === "blackjack").length;
  const losses = h.results.filter((r) => r === "lose" || r === "surrender").length;
  const pushes = h.results.filter((r) => r === "push").length;
  return {
    ...s, end, curve: [...s.curve, end], hands: [...s.hands, h],
    wins: s.wins + wins, losses: s.losses + losses, pushes: s.pushes + pushes,
    blackjacks: s.blackjacks + h.results.filter((r) => r === "blackjack").length,
    decisions: s.decisions + h.decisions.length, mistakes: s.mistakes + h.decisions.filter((d) => !d.correct).length,
    peak: Math.max(s.peak, end), trough: Math.min(s.trough, end),
  };
}

export function loadSessions(): Session[] {
  return readStorage<Session[]>(SESSIONS_KEY, []);
}
export function archiveSession(s: Session): void {
  if (!s.hands.length) return;
  const all = loadSessions();
  all.push({ ...s, endedAt: Date.now() });
  // ponytail: cap at 200 sessions; localStorage is ~5MB, each session with curve is a few KB
  writeStorage(SESSIONS_KEY, all.slice(-200));
}
