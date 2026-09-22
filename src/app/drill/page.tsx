"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CountDrill from "@/components/CountDrill";
import PlayingCard from "@/components/PlayingCard";
import RulesPicker from "@/components/RulesPicker";
import StrategyGrid, { describe } from "@/components/StrategyGrid";
import { handTotal, type Card } from "@/engine/cards";
import { ALL_CELLS, cardsFor, weightedPick } from "@/engine/deal";
import type { Action } from "@/engine/round";
import { advise, type Advice, type CellKey } from "@/engine/strategy";
import { cellId, DRILL_KEY, EMPTY_DRILL, record, weight, type DrillStats } from "@/lib/drillStats";
import { useLocalStorage } from "@/lib/storage";
import { useRules } from "@/lib/useRules";
import styles from "./page.module.css";

const ACTIONS: { a: Action; label: string; key: string }[] = [
  { a: "hit", label: "Hit", key: "H" },
  { a: "stand", label: "Stand", key: "S" },
  { a: "double", label: "Double", key: "D" },
  { a: "split", label: "Split", key: "P" },
  { a: "surrender", label: "Surrender", key: "R" },
];

interface Q { key: CellKey; cards: Card[]; up: Card; legal: Action[]; advice: Advice; rulesKey: string }

export default function DrillPage() {
  const [rules, setRules] = useRules();
  const [stats, setStats, ready] = useLocalStorage<DrillStats>(DRILL_KEY, EMPTY_DRILL);
  const [q, setQ] = useState<Q | null>(null);
  const [answer, setAnswer] = useState<Action | null>(null);
  const [showHeat, setShowHeat] = useState(false);
  const [mode, setMode] = useLocalStorage<"strategy" | "count">("bjt.drillMode", "strategy");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const next = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const weights = ALL_CELLS.map((k) => weight(stats.cells[cellId(k)]));
    const key = ALL_CELLS[weightedPick(weights, Math.random)];
    const { cards, up } = cardsFor(key, Math.random);
    const legal: Action[] = ["hit", "stand"];
    const t = handTotal(cards);
    const dblOk = rules.doubleOn === "any" || (!t.soft && (rules.doubleOn === "9-11" ? t.total >= 9 && t.total <= 11 : t.total >= 10 && t.total <= 11));
    if (dblOk) legal.push("double");
    if (key.kind === "pair") legal.push("split");
    if (rules.surrender === "late") legal.push("surrender");
    setQ({ key, cards, up, legal, advice: advise(cards, up, legal, rules), rulesKey: JSON.stringify(rules) });
    setAnswer(null);
  }, [rules, stats.cells]);

  // First question (and a fresh one whenever the rules change) needs client-side randomness, so it lives in an effect.
  const rulesKey = JSON.stringify(rules);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ready && q?.rulesKey !== rulesKey) next();
  }, [ready, q?.rulesKey, rulesKey, next]);

  const respond = useCallback((a: Action) => {
    if (!q || answer) return;
    setAnswer(a);
    const correct = a === q.advice.action;
    setStats((s) => record(s, q.advice.key, correct));
    if (correct) timer.current = setTimeout(next, 700);
  }, [q, answer, next, setStats]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode !== "strategy" || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const k = e.key.toUpperCase();
      if (answer && (k === "ENTER" || k === " " || k === "N")) { e.preventDefault(); next(); return; }
      const act = ACTIONS.find((x) => x.key === k);
      if (act && q?.legal.includes(act.a)) { e.preventDefault(); respond(act.a); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, answer, respond, next, mode]);

  const acc = stats.total ? Math.round((100 * stats.correct) / stats.total) : null;
  const heat = useMemo(() => (k: CellKey) => { const c = stats.cells[cellId(k)]; return c ? (c.seen - c.wrong) / c.seen : null; }, [stats.cells]);
  const total = q ? handTotal(q.cards) : null;
  const correct = answer && q ? answer === q.advice.action : null;

  return (
    <div className="page">
      <header className={styles.top}>
        <div>
          <span className="eyebrow">Drill</span>
          <h1>{mode === "strategy" ? "Basic strategy drill" : "Card counting drill"}</h1>
          <div className="seg" role="group" aria-label="Drill type" style={{ marginTop: "var(--space-2)" }}>
            <button type="button" aria-pressed={mode === "strategy"} onClick={() => setMode("strategy")}>Strategy</button>
            <button type="button" aria-pressed={mode === "count"} onClick={() => setMode("count")}>Counting</button>
          </div>
        </div>
        {mode === "strategy" && <div className={styles.stats} aria-live="off">
          <div className={styles.stat}><span>Accuracy</span><strong>{acc == null ? "—" : `${acc}%`}</strong></div>
          <div className={styles.stat}><span>Streak</span><strong>{stats.streak}</strong></div>
          <div className={styles.stat}><span>Best</span><strong>{stats.best}</strong></div>
          <div className={styles.stat}><span>Hands</span><strong>{stats.total}</strong></div>
        </div>}
      </header>

      {mode === "count" && <section className={styles.felt} aria-label="Counting drill"><CountDrill decks={rules.decks} /></section>}
      {mode === "strategy" && <>
      <div className="card"><RulesPicker rules={rules} onChange={setRules} compact /></div>

      <section className={styles.felt} aria-label="Drill table">
        <div className={styles.seat}>
          <span className={styles.label}>Dealer shows</span>
          <div className={styles.cards}>{q && <PlayingCard key={q.up.rank + q.up.suit + stats.total} card={q.up} animate dealIndex={0} />}</div>
        </div>
        <div className={styles.seat}>
          <span className={styles.label}>You</span>
          <div className={styles.cards}>
            {q?.cards.map((c, i) => <PlayingCard key={`${stats.total}-${i}`} card={c} animate dealIndex={i} />)}
          </div>
          {total && <span className={styles.total}>{total.soft ? "soft " : ""}{total.total}{q?.key.kind === "pair" ? " · pair" : ""}</span>}
        </div>

        <div className={styles.actions} role="group" aria-label="Your move">
          {ACTIONS.map(({ a, label, key }) => {
            const legal = q?.legal.includes(a);
            const cls = answer
              ? a === q?.advice.action ? styles.right : a === answer ? styles.wrong : ""
              : "";
            return (
              <button key={a} type="button" className={`${styles.action} ${cls}`} disabled={!legal || !!answer} onClick={() => respond(a)} aria-label={`${label} (key ${key})`}>
                {label}<span className={`kbd ${styles.kbd}`}>{key}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.feedback} role="status" aria-live="polite">
          {answer && q ? (
            <>
              <strong>{correct ? "Correct." : `No — ${describe(q.advice.code, rules)}.`}</strong>
              <span>{q.advice.why}</span>
              {!correct && <button type="button" className={`btn ${styles.next}`} onClick={next}>Next <span className="kbd">↵</span></button>}
            </>
          ) : (
            <span style={{ opacity: 0.8 }}>Order of operations: surrender → split → double → hit/stand.</span>
          )}
        </div>
      </section>

      <section className="card">
        <div className={styles.heatHead}>
          <div>
            <h2>Your weak spots</h2>
            <p className="muted" style={{ fontSize: "var(--text-sm)" }}>Green = you get it right; red = you keep missing it. Missed cells come up more often.</p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button type="button" className="btn" aria-pressed={showHeat} onClick={() => setShowHeat((v) => !v)}>{showHeat ? "Hide heatmap" : "Show heatmap"}</button>
            <button type="button" className="btn" onClick={() => { if (confirm("Reset drill history?")) setStats(EMPTY_DRILL); }}>Reset</button>
          </div>
        </div>
        {showHeat && <div style={{ marginTop: "var(--space-4)" }}><StrategyGrid rules={rules} heat={heat} showPhrase={false} highlight={q?.advice.key} /></div>}
      </section>
      </>}
    </div>
  );
}
