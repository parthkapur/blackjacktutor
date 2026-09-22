"use client";
import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { CellKey } from "@/engine/strategy";
import RulesPicker from "@/components/RulesPicker";
import StrategyGrid from "@/components/StrategyGrid";
import { CHIPS, ORDER_OF_OPERATIONS, PAYOUT_EXAMPLE, TABLE_PROCEDURE, VEGAS_MINIMUMS } from "@/content/reference";
import { DEVIATIONS } from "@/engine/deviations";
import { DEFAULT_RAMP } from "@/engine/betting";
import { EDGE_TABLE, houseEdge } from "@/engine/rules";
import { useRules } from "@/lib/useRules";
import styles from "./page.module.css";

const BANKROLL = 100;

export default function LearnPage() {
  return <Suspense><Learn /></Suspense>;
}

function Learn() {
  const [rules, setRules] = useRules();
  const params = useSearchParams();
  const highlight = useMemo<CellKey | null>(() => {
    const c = params.get("cell");
    if (!c) return null;
    const [kind, value, up] = c.split(":");
    return kind && value && up ? ({ kind, value: +value, up: +up } as CellKey) : null;
  }, [params]);
  useEffect(() => { if (highlight) document.getElementById("chart")?.scrollIntoView({ block: "start" }); }, [highlight]);
  const edge = houseEdge(rules);
  const units = Math.floor(BANKROLL / rules.minBet);
  const handsPerHour = 70; // heads-up shoe game; a full table is ~50
  const lossPerHour = (rules.minBet * handsPerHour * edge) / 100;

  return (
    <div className="page">
      <header className={styles.hero}>
        <span className="eyebrow">Learn</span>
        <h1>Basic strategy, rules that matter, and what a real table looks like</h1>
        <p className={styles.lede}>Set the rules of the game you&apos;ll actually play. The chart, the drill and the table all follow this setting.</p>
        <nav className={styles.toc} aria-label="On this page">
          <a href="#rules">Your table</a><a href="#chart">Strategy chart</a><a href="#order">Order of operations</a>
          <a href="#variations">Rule variations</a><a href="#vegas">Vegas minimums</a><a href="#procedure">Table procedure</a><a href="#counting">Counting</a>
        </nav>
      </header>

      <section id="rules" className={`card ${styles.section}`}>
        <h2>Your table</h2>
        <RulesPicker rules={rules} onChange={setRules} />
        <div className={styles.stats} aria-label="What $100 means at this table">
          <div className={styles.stat}><span>$100 bankroll</span><strong>{units} units</strong></div>
          <div className={styles.stat}><span>House edge (basic strategy)</span><strong>{edge.toFixed(2)}%</strong></div>
          <div className={styles.stat}><span>Expected loss / hour at min bet</span><strong>${lossPerHour.toFixed(2)}</strong></div>
          <div className={styles.stat}><span>Cost of one $10 blackjack at 6:5</span><strong>−${(PAYOUT_EXAMPLE.threeTwo - PAYOUT_EXAMPLE.sixFive).toFixed(0)}</strong></div>
        </div>
        <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
          ~{handsPerHour} hands/hour heads-up. Expected loss is the average; a real session swings ±$50–100 either way — that variance is the whole point of the Bet lab.
        </p>
      </section>

      <section id="chart" className={`card ${styles.section}`}>
        <h2>Strategy chart <span className="muted" style={{ fontWeight: 400, fontSize: "var(--text-md)" }}> {rules.decks}D · {rules.h17 ? "H17" : "S17"} · {rules.das ? "DAS" : "no DAS"} · {rules.surrender === "late" ? "LS" : "no surrender"}</span></h2>
        <p className="muted">Rows are your hand, columns the dealer&apos;s up card. Faded cells are moves this table doesn&apos;t allow — the fallback is in the tooltip. Never take insurance.</p>
        <StrategyGrid rules={rules} highlight={highlight} />
      </section>

      <section id="order" className={`card ${styles.section}`}>
        <h2>Order of operations</h2>
        <p className="muted">Ask these four questions in this order, every hand. Most mistakes come from asking &ldquo;hit or stand?&rdquo; first.</p>
        <ol className={styles.steps} style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {ORDER_OF_OPERATIONS.map((s) => (
            <li key={s.step} className={styles.step}><h3>{s.step}</h3><p>{s.text}</p></li>
          ))}
        </ol>
      </section>

      <section id="variations" className={`card ${styles.section}`}>
        <h2>Which rules matter</h2>
        <p className="muted">Effect on your expected return vs an 8-deck, S17, DAS, no-surrender baseline (≈0.43% house edge). Payout first, then soft 17, then decks; everything else is noise by comparison.</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Rule</th><th>Effect</th><th>Notes</th></tr></thead>
            <tbody>
              {[...EDGE_TABLE].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).map((r) => (
                <tr key={r.rule}>
                  <td>{r.rule}</td>
                  <td className={`${styles.delta} ${r.delta > 0 ? styles.good : r.delta < 0 ? styles.bad : ""}`}>{r.delta > 0 ? "+" : ""}{r.delta.toFixed(2)}%</td>
                  <td className="muted">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.payout} aria-label="3:2 versus 6:5 on a $10 blackjack">
          <div><span className="muted">3:2 on ${PAYOUT_EXAMPLE.bet}</span><strong className={styles.good}>${PAYOUT_EXAMPLE.threeTwo}</strong></div>
          <div><span className="muted">6:5 on ${PAYOUT_EXAMPLE.bet}</span><strong className={styles.bad}>${PAYOUT_EXAMPLE.sixFive}</strong></div>
          <div><span className="muted">Blackjacks per 100 hands</span><strong>≈4.7</strong><span className="muted" style={{ fontSize: "var(--text-xs)" }}>→ 6:5 costs ~$14/100 hands at $10</span></div>
        </div>
      </section>

      <section id="vegas" className={`card ${styles.section}`}>
        <h2>Vegas minimums (2026)</h2>
        <p className="muted">Where $100 goes. Tuesday-morning numbers; Friday night adds $10–25 everywhere.</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Where</th><th>Minimum</th><th>Payout</th><th>Notes</th></tr></thead>
            <tbody>
              {VEGAS_MINIMUMS.map((v) => (
                <tr key={v.where}><td>{v.where}</td><td className={styles.delta}>{v.min}</td><td>{v.payout}</td><td className="muted">{v.note}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="procedure" className={`card ${styles.section}`}>
        <h2>Table procedure & etiquette</h2>
        <div className={styles.chips} aria-label="Chip colours">
          {CHIPS.map((c) => (
            <div key={c.value} className={styles.chip}><i style={{ background: c.color, color: c.text }}>{c.value}</i>{c.name}</div>
          ))}
        </div>
        <div className={styles.proc}>
          {TABLE_PROCEDURE.map((p) => (
            <article key={p.title}><h3>{p.title}</h3><p>{p.text}</p></article>
          ))}
        </div>
      </section>

      <section id="counting" className={`card ${styles.section}`}>
        <h2>Counting (Hi-Lo)</h2>
        <p className="muted">Basic strategy gets you to −{edge.toFixed(2)}%. Counting is the only thing that gets past zero — and only with a bankroll far bigger than $100. Learn it anyway: it&apos;s the reason the bet lab&apos;s last row is different.</p>
        <ol className={styles.steps} style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <li className={styles.step}><h3>Tag every card</h3><p>2–6 = <b>+1</b> · 7–9 = <b>0</b> · 10, J, Q, K, A = <b>−1</b>. A full deck sums to zero. Keep a <em>running count</em> from the shuffle. Practice in Drill → Counting.</p></li>
          <li className={styles.step}><h3>Convert to a true count</h3><p>True count = running count ÷ decks remaining. RC +6 with 3 decks left is TC +2. Eyeball decks left from the discard tray; the shoe meter on the table shows it.</p></li>
          <li className={styles.step}><h3>Bet the count</h3><p>Each +1 of true count is worth ≈ +0.5%; you&apos;re a favourite from about TC +2. Ramp: {Object.entries(DEFAULT_RAMP).map(([tc, u]) => `TC${tc}${tc === "4" ? "+" : ""} → ${u}u`).join(" · ")}. Never bet more when the count is negative — that is the whole trick.</p></li>
          <li className={styles.step}><h3>Deviate at the indices</h3><p>A few chart cells flip when the count is extreme. Below are the ones that matter (Schlesinger&apos;s Illustrious 18 and Fab 4). Turn on &ldquo;Index plays&rdquo; at the table and the coach expects them.</p></li>
        </ol>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Hand</th><th>vs</th><th>At true count</th><th>Play</th><th>Set</th></tr></thead>
            <tbody>
              {DEVIATIONS.map((d) => (
                <tr key={`${d.hand}-${d.up}-${d.action}`}>
                  <td>{d.hand === "insurance" ? "Insurance" : d.hand}</td>
                  <td>{d.up === 11 ? "A" : d.up}</td>
                  <td className={styles.delta}>{d.below ? "≤" : "≥"} {d.index > 0 ? "+" : ""}{d.index}</td>
                  <td>{d.hand === "insurance" ? "take it" : d.action}</td>
                  <td className="muted">{d.group === "I18" ? "Illustrious 18" : "Fab 4"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
