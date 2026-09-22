"use client";
import Link from "next/link";
import LineChart from "@/components/LineChart";
import { houseEdge } from "@/engine/rules";
import { phrase, type CellKey } from "@/engine/strategy";
import { cellId, DRILL_KEY, EMPTY_DRILL, type DrillStats } from "@/lib/drillStats";
import { money, pct, shortDate, signed } from "@/lib/format";
import { BANKROLL_KEY, CURRENT_KEY, SESSIONS_KEY, START_BANKROLL, type Session } from "@/lib/session";
import { useLocalStorage } from "@/lib/storage";
import { useRules } from "@/lib/useRules";
import styles from "./page.module.css";

const rulesName = (s: Session) => `$${s.rules.minBet} · ${s.rules.decks}D · ${s.rules.h17 ? "H17" : "S17"}${s.rules.das ? " · DAS" : ""}${s.rules.surrender === "late" ? " · LS" : ""} · ${s.rules.bjPays === 1.5 ? "3:2" : s.rules.bjPays === 1.2 ? "6:5" : "1:1"}`;
const cellName = (k: CellKey) => `${k.kind === "pair" ? (k.value === 11 ? "A,A" : k.value === 10 ? "T,T" : `${k.value},${k.value}`) : k.kind === "soft" ? `A,${k.value - 11}` : k.value} v ${k.up === 11 ? "A" : k.up === 10 ? "T" : k.up}`;

export default function HomePage() {
  const [rules] = useRules();
  const [bankroll] = useLocalStorage<number>(BANKROLL_KEY, START_BANKROLL);
  const [archived] = useLocalStorage<Session[]>(SESSIONS_KEY, []);
  const [current] = useLocalStorage<Session | null>(CURRENT_KEY, null);
  const [drill] = useLocalStorage<DrillStats>(DRILL_KEY, EMPTY_DRILL);

  const sessions = current && current.hands.length ? [...archived, current] : archived;
  const agg = (() => {
    const hands = sessions.reduce((a, s) => a + s.hands.length, 0);
    const net = sessions.reduce((a, s) => a + (s.end - s.start), 0);
    const decisions = sessions.reduce((a, s) => a + s.decisions, 0);
    const mistakes = sessions.reduce((a, s) => a + s.mistakes, 0);
    const wins = sessions.reduce((a, s) => a + s.wins, 0);
    const losses = sessions.reduce((a, s) => a + s.losses, 0);
    const pushes = sessions.reduce((a, s) => a + s.pushes, 0);
    // one continuous curve; each session's curve is re-based so a rebuy doesn't look like a win
    const curve: number[] = [];
    const marks: number[] = [];
    let offset = 0;
    for (const s of sessions) {
      if (curve.length) { offset = curve[curve.length - 1] - s.curve[0]; marks.push(curve.length - 1); }
      const pts = curve.length ? s.curve.slice(1) : s.curve;
      for (const v of pts) curve.push(v + offset);
    }
    // weak spots: table mistakes + drill misses
    const miss = new Map<string, { key: CellKey; n: number }>();
    for (const s of sessions) for (const h of s.hands) for (const d of h.decisions) if (!d.correct) { const id = cellId(d.key); miss.set(id, { key: d.key, n: (miss.get(id)?.n ?? 0) + 1 }); }
    for (const [id, c] of Object.entries(drill.cells)) if (c.wrong) { const [kind, value, up] = id.split(":"); const key = { kind, value: +value, up: +up } as CellKey; miss.set(id, { key, n: (miss.get(id)?.n ?? 0) + c.wrong }); }
    const weak = [...miss.values()].sort((a, b) => b.n - a.n).slice(0, 6);
    return { hands, net, decisions, mistakes, wins, losses, pushes, curve, marks, weak };
  })();

  const edge = houseEdge(rules);
  const units = Math.floor(START_BANKROLL / rules.minBet);
  const evPerHour = -(rules.minBet * 70 * edge) / 100;
  // ponytail: variance ≈ 1.15 units/hand for basic strategy; 1σ over an hour ≈ 1.15·√70·bet
  const sigmaHour = 1.15 * Math.sqrt(70) * rules.minBet;

  return (
    <div className="page">
      <header className={styles.hero}>
        <span className="eyebrow">Dashboard</span>
        <h1>{agg.hands ? `${agg.hands} hands in. ${agg.net >= 0 ? "Up" : "Down"} ${money(Math.abs(agg.net))}.` : "Your blackjack playground"}</h1>
        <p className="muted">Learn the chart, drill it until it&apos;s automatic, understand what betting systems really do, then sit down at a realistic table with $100.</p>
        <div className={styles.actions}>
          <Link className="btn btn-primary" href="/play">Sit down</Link>
          <Link className="btn" href="/drill">Drill</Link>
          <Link className="btn" href="/learn">Learn</Link>
          <Link className="btn" href="/bet">Betting lab</Link>
        </div>
      </header>

      <div className={styles.tiles}>
        <div className={styles.tile}><span>Bankroll</span><strong>{money(bankroll)}</strong></div>
        <div className={styles.tile}><span>All-time net</span><strong className={agg.net > 0 ? styles.pos : agg.net < 0 ? styles.neg : ""}>{signed(agg.net)}</strong></div>
        <div className={styles.tile}><span>Hands played</span><strong>{agg.hands}</strong></div>
        <div className={styles.tile}><span>Strategy accuracy</span><strong>{pct(agg.decisions - agg.mistakes, agg.decisions)}</strong></div>
        <div className={styles.tile}><span>W / L / P</span><strong style={{ fontSize: "var(--text-lg)" }}>{agg.wins} / {agg.losses} / {agg.pushes}</strong></div>
      </div>

      <div className={styles.two}>
        <section className={`card ${styles.section}`}>
          <div className={styles.head}><h2>Bankroll</h2><span className="muted" style={{ fontSize: "var(--text-sm)" }}>Dashed line = starting $100 · dotted = new session</span></div>
          <LineChart values={agg.curve} height={200} baseline={START_BANKROLL} format={money} xLabel={(i) => `hand ${i}`} marks={agg.marks} />
        </section>

        <section className={`card ${styles.section}`}>
          <div className={styles.head}><h2>Reality check</h2><Link href="/learn#rules" className="muted" style={{ fontSize: "var(--text-sm)" }}>change table →</Link></div>
          <div className={styles.reality}>
            <div><span>Your table</span><strong style={{ fontSize: "var(--text-md)" }}>${rules.minBet} · {rules.decks}D · {rules.h17 ? "H17" : "S17"} · {rules.bjPays === 1.5 ? "3:2" : "6:5"}</strong></div>
            <div><span>House edge</span><strong>{edge.toFixed(2)}%</strong></div>
            <div><span>$100 =</span><strong>{units} units</strong></div>
            <div><span>Expected / hour</span><strong className={styles.neg}>{money(evPerHour)}</strong></div>
            <div><span>Typical hour (±1σ)</span><strong>±{money(Math.round(sigmaHour))}</strong></div>
          </div>
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>The edge is small; the swing is not. At {units} units you&apos;ll go broke in a session fairly often even playing perfectly — that&apos;s luck, not skill. Perfect play just makes it as cheap as possible.</p>
        </section>
      </div>

      <div className={styles.two}>
        <section className={`card ${styles.section}`}>
          <h2>Sessions</h2>
          {sessions.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>When</th><th>Table</th><th className={styles.num}>Hands</th><th className={styles.num}>Net</th><th className={styles.num}>Peak / low</th><th className={styles.num}>Accuracy</th></tr></thead>
                <tbody>
                  {[...sessions].reverse().map((s) => (
                    <tr key={s.id}>
                      <td>{shortDate(s.startedAt)}{!s.endedAt && <span className="muted"> · live</span>}</td>
                      <td className="muted">{rulesName(s)}</td>
                      <td className={styles.num}>{s.hands.length}</td>
                      <td className={`${styles.num} ${s.end - s.start > 0 ? styles.pos : s.end - s.start < 0 ? styles.neg : ""}`}>{signed(s.end - s.start)}</td>
                      <td className={styles.num}>{money(s.peak)} / {money(s.trough)}</td>
                      <td className={styles.num}>{pct(s.decisions - s.mistakes, s.decisions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}><span>No sessions yet.</span><Link className="btn btn-primary" href="/play">Play your first hand</Link></div>
          )}
        </section>

        <section className={`card ${styles.section}`}>
          <h2>Weak spots</h2>
          {agg.weak.length ? (
            <div className={styles.weak}>
              {agg.weak.map((w) => (
                <Link key={cellId(w.key)} href={`/learn?cell=${cellId(w.key)}#chart`} className={styles.weakRow}>
                  <b>{cellName(w.key)}</b>
                  <span style={{ fontSize: "var(--text-sm)" }}>{phrase(w.key, rules)}</span>
                  <small>×{w.n}</small>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.empty}><span>Mistakes from the table and the drill show up here.</span><Link className="btn" href="/drill">Start drilling</Link></div>
          )}
        </section>
      </div>
    </div>
  );
}
