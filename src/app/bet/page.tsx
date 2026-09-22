"use client";
import Link from "next/link";
import { useState } from "react";
import Fan from "@/components/Fan";
import Histogram from "@/components/Histogram";
import RulesPicker from "@/components/RulesPicker";
import { SYSTEMS, systemById } from "@/engine/betting";
import { simulate, type SimResult } from "@/engine/simulate";
import { money, pct } from "@/lib/format";
import { START_BANKROLL } from "@/lib/session";
import { useLocalStorage } from "@/lib/storage";
import { useRules } from "@/lib/useRules";
import styles from "./page.module.css";

interface Params { systemId: string; unit: number; bankroll: number; hands: number; sessions: number; stopLoss: number; winGoal: number; deviations: boolean }
/** 1σ of return-per-$ for N hands, with per-hand SD ≈ 1.15 units. */
const noise = (hands: number) => (hands ? 1.15 / Math.sqrt(hands) : 0);
const DEFAULTS: Params = { systemId: "flat", unit: 10, bankroll: START_BANKROLL, hands: 100, sessions: 1000, stopLoss: 0, winGoal: 0, deviations: true };

export default function BetPage() {
  const [rules, setRules] = useRules();
  const [p, setP] = useLocalStorage<Params>("bjt.bet", DEFAULTS);
  const [, setTableSystem] = useLocalStorage<string>("bjt.system", "manual");
  const [result, setResult] = useState<{ p: Params; r: SimResult } | null>(null);
  const [compare, setCompare] = useState<{ id: string; r: SimResult }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const sys = systemById(p.systemId);
  const set = <K extends keyof Params>(k: K, v: Params[K]) => setP({ ...p, [k]: v });
  const num = (k: keyof Params, min: number, max: number) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Math.max(min, Math.min(max, Number(e.target.value) || min)) as never);
  const args = (systemId: string, sessions = p.sessions) => ({
    rules, systemId, unit: p.unit, bankroll: p.bankroll, hands: p.hands, sessions,
    stopLoss: p.stopLoss || undefined, winGoal: p.winGoal || undefined, deviations: p.deviations,
  });

  // ponytail: sims run on the main thread inside a rAF so the button repaints first; 1k×100 hands ≈ 300 ms. Web Worker if you push to 100k sessions.
  const run = () => {
    setBusy(true);
    requestAnimationFrame(() => { setResult({ p, r: simulate(args(p.systemId)) }); setBusy(false); });
  };
  const runCompare = () => {
    setBusy(true);
    requestAnimationFrame(() => { setCompare(SYSTEMS.map((s) => ({ id: s.id, r: simulate(args(s.id, Math.min(p.sessions, 1000))) }))); setBusy(false); });
  };

  const r = result?.r;
  const units = Math.floor(p.bankroll / p.unit);

  return (
    <div className="page">
      <header className={styles.hero}>
        <span className="eyebrow">Bet</span>
        <h1>Betting lab</h1>
        <p className="muted">Pick a system, run a few thousand sessions with perfect basic strategy, and look at what actually happens to $100. Only one of these changes the expectation — the rest only change the shape of the ride.</p>
      </header>

      <section className={styles.section}>
        <div className={styles.systems} role="group" aria-label="Betting systems">
          {SYSTEMS.map((s) => (
            <button key={s.id} type="button" className={styles.sys} aria-pressed={s.id === p.systemId} onClick={() => set("systemId", s.id)}>
              <h3>{s.name}<span className={`${styles.kind} ${styles[s.kind]}`}>{s.kind === "negative" ? "chase losses" : s.kind === "positive" ? "press wins" : s.kind}</span></h3>
              <p>{s.blurb}</p>
            </button>
          ))}
        </div>
        <div className={styles.blow}><strong>Where {sys.name} breaks:</strong> {sys.blowsUp}</div>
      </section>

      <section className={`card ${styles.section}`}>
        <div className={styles.head}><h2>Setup</h2><span className="muted" style={{ fontSize: "var(--text-sm)" }}>{units} units · {rules.decks}D {rules.h17 ? "H17" : "S17"} · edge from Learn</span></div>
        <RulesPicker rules={rules} onChange={setRules} compact />
        <div className={styles.params}>
          <label className={styles.field}><span>Unit / base bet ($)</span><input type="number" inputMode="numeric" min={rules.minBet} value={p.unit} onChange={num("unit", 1, 10_000)} /></label>
          <label className={styles.field}><span>Bankroll ($)</span><input type="number" inputMode="numeric" min={1} value={p.bankroll} onChange={num("bankroll", 1, 1_000_000)} /></label>
          <label className={styles.field}><span>Hands per session</span><input type="number" inputMode="numeric" min={10} max={5000} value={p.hands} onChange={num("hands", 10, 5000)} /></label>
          <label className={styles.field}><span>Sessions</span><input type="number" inputMode="numeric" min={100} max={20000} step={100} value={p.sessions} onChange={num("sessions", 100, 20000)} /></label>
          <label className={styles.field}><span>Stop-loss ($, 0 = none)</span><input type="number" inputMode="numeric" min={0} value={p.stopLoss} onChange={num("stopLoss", 0, 1_000_000)} /></label>
          <label className={styles.field}><span>Walk-away win ($, 0 = none)</span><input type="number" inputMode="numeric" min={0} value={p.winGoal} onChange={num("winGoal", 0, 1_000_000)} /></label>
          {sys.kind === "count" && <label className={styles.check}><input type="checkbox" checked={p.deviations} onChange={(e) => set("deviations", e.target.checked)} />Use Illustrious 18 / Fab 4</label>}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-accent" onClick={run} disabled={busy}>{busy ? "Running…" : `Run ${sys.name}`}</button>
          <button type="button" className="btn" onClick={runCompare} disabled={busy}>Compare all systems</button>
          <Link href="/play" className="btn" onClick={() => setTableSystem(p.systemId)}>Use {sys.name} at the table →</Link>
        </div>
      </section>

      {r && (
        <>
          <section className={styles.section}>
            <div className={styles.head}><h2>{systemById(result!.p.systemId).name}: {result!.p.sessions.toLocaleString()} sessions of up to {result!.p.hands} hands</h2><span className="muted" style={{ fontSize: "var(--text-sm)" }}>{r.totalHands.toLocaleString()} hands in {r.ms} ms</span></div>
            <div className={styles.tiles}>
              <div className={styles.tile}><span>Busted</span><strong className={r.bustRate > 0.5 ? styles.neg : ""}>{pct(r.bustRate * 100, 100)}</strong></div>
              <div className={styles.tile}><span>Ended ahead</span><strong className={r.aheadRate >= 0.5 ? styles.pos : ""}>{pct(r.aheadRate * 100, 100)}</strong></div>
              <div className={styles.tile}><span>Median final</span><strong>{money(r.median)}</strong></div>
              <div className={styles.tile}><span>Mean final</span><strong>{money(Math.round(r.mean * 100) / 100)}</strong></div>
              <div className={styles.tile}><span>5% / 95%</span><strong style={{ fontSize: "var(--text-md)" }}>{money(r.p5)} / {money(r.p95)}</strong></div>
              <div className={styles.tile}><span>Return per $ bet</span><strong className={r.evPerWagered >= 0 ? styles.pos : styles.neg}>{(r.evPerWagered * 100).toFixed(2)}%</strong><span>±{(noise(r.totalHands) * 100).toFixed(2)}% noise</span></div>
            </div>
          </section>
          <div className={styles.two}>
            <section className={`card ${styles.section}`}>
              <div className={styles.head}><h3>Where sessions end</h3><span className="muted" style={{ fontSize: "var(--text-xs)" }}>red = below start · green = above</span></div>
              <Histogram values={r.finals} start={result!.p.bankroll} format={money} />
            </section>
            <section className={`card ${styles.section}`}>
              <div className={styles.head}><h3>{r.curves.length} sample sessions</h3><span className="muted" style={{ fontSize: "var(--text-xs)" }}>avg {Math.round(r.meanHands)} hands · avg drawdown {money(Math.round(r.meanDrawdown))}</span></div>
              <Fan curves={r.curves} start={result!.p.bankroll} minBet={rules.minBet} hands={result!.p.hands} format={money} />
            </section>
          </div>
        </>
      )}

      {compare && (
        <section className={`card ${styles.section}`}>
          <div className={styles.head}><h2>All systems, same table, same bankroll</h2><span className="muted" style={{ fontSize: "var(--text-sm)" }}>{Math.min(p.sessions, 1000).toLocaleString()} sessions each</span></div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>System</th><th>Busted</th><th className={styles.num}>Ahead</th><th className={styles.num}>Median</th><th className={styles.num}>Mean</th><th className={styles.num}>95th pct</th><th className={styles.num}>Avg hands</th><th className={styles.num}>Return / $</th></tr></thead>
              <tbody>
                {compare.map(({ id, r }) => (
                  <tr key={id} className={id === p.systemId ? styles.sel : ""}>
                    <td>{systemById(id).name}</td>
                    <td><span className={styles.bar} style={{ width: `${Math.round(r.bustRate * 80)}px` }} aria-hidden="true" /><span className="num">{pct(r.bustRate * 100, 100)}</span></td>
                    <td className={styles.num}>{pct(r.aheadRate * 100, 100)}</td>
                    <td className={styles.num}>{money(r.median)}</td>
                    <td className={styles.num}>{money(Math.round(r.mean))}</td>
                    <td className={styles.num}>{money(r.p95)}</td>
                    <td className={styles.num}>{Math.round(r.meanHands)}</td>
                    <td className={styles.num}><span className={Math.abs(r.evPerWagered) > noise(r.totalHands) ? (r.evPerWagered >= 0 ? styles.pos : styles.neg) : "muted"}>{(r.evPerWagered * 100).toFixed(2)}%</span> <span className="muted">±{(noise(r.totalHands) * 100).toFixed(2)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>Read the last column first (grey = indistinguishable from zero at this sample size): every progression pays the same edge per dollar. The systems only differ in how they distribute that loss across sessions — many small losses and a rare big win (press systems) or many small wins and a rare wipe-out (chase systems). The count spread is the only positive number, and only with a bankroll far bigger than $100.</p>
        </section>
      )}
    </div>
  );
}
