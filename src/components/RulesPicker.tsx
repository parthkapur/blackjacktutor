"use client";
import { houseEdge, PRESETS, type Rules } from "@/engine/rules";
import styles from "./RulesPicker.module.css";

function Seg<T extends string | number | boolean>({ label, value, options, onChange }: {
  label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className={styles.field} role="group" aria-label={label}>
      <span>{label}</span>
      <div className={`seg ${styles.seg}`}>
        {options.map((o) => (
          <button key={String(o.v)} type="button" aria-pressed={o.v === value} onClick={() => onChange(o.v)}>{o.l}</button>
        ))}
      </div>
    </div>
  );
}

export default function RulesPicker({ rules, onChange, compact = false }: { rules: Rules; onChange: (r: Rules) => void; compact?: boolean }) {
  const presetId = PRESETS.find((p) => JSON.stringify(p.rules) === JSON.stringify(rules))?.id ?? "custom";
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => onChange({ ...rules, [k]: v });
  const edge = houseEdge(rules);
  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <label className={styles.field}>
          <span>Table preset</span>
          <select className={styles.select} value={presetId} onChange={(e) => { const p = PRESETS.find((x) => x.id === e.target.value); if (p) onChange(p.rules); }}>
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="custom" disabled>Custom</option>
          </select>
        </label>
        <div className={styles.edge}>
          <span className="muted">House edge</span>
          <strong className="num" style={{ color: edge > 1 ? "var(--danger)" : edge > 0.7 ? "var(--accent)" : "var(--success)" }}>{edge.toFixed(2)}%</strong>
        </div>
      </div>
      {presetId !== "custom" && <p className={styles.where}>{PRESETS.find((p) => p.id === presetId)?.where}</p>}
      {!compact && (
        <div className={styles.grid}>
          <Seg label="Decks" value={rules.decks} options={[1, 2, 4, 6, 8].map((v) => ({ v: v as Rules["decks"], l: String(v) }))} onChange={(v) => set("decks", v)} />
          <Seg label="Dealer soft 17" value={rules.h17} options={[{ v: true, l: "H17" }, { v: false, l: "S17" }]} onChange={(v) => set("h17", v)} />
          <Seg label="Blackjack pays" value={rules.bjPays} options={[{ v: 1.5 as const, l: "3:2" }, { v: 1.2 as const, l: "6:5" }, { v: 1 as const, l: "1:1" }]} onChange={(v) => set("bjPays", v)} />
          <Seg label="Double after split" value={rules.das} options={[{ v: true, l: "Yes" }, { v: false, l: "No" }]} onChange={(v) => set("das", v)} />
          <Seg label="Surrender" value={rules.surrender} options={[{ v: "late" as const, l: "Late" }, { v: "none" as const, l: "None" }]} onChange={(v) => set("surrender", v)} />
          <Seg label="Double on" value={rules.doubleOn} options={[{ v: "any" as const, l: "Any" }, { v: "9-11" as const, l: "9–11" }, { v: "10-11" as const, l: "10–11" }]} onChange={(v) => set("doubleOn", v)} />
          <Seg label="Max hands (splits)" value={rules.maxHands} options={[2, 3, 4].map((v) => ({ v: v as Rules["maxHands"], l: String(v) }))} onChange={(v) => set("maxHands", v)} />
          <Seg label="Re-split aces" value={rules.rsa} options={[{ v: true, l: "Yes" }, { v: false, l: "No" }]} onChange={(v) => set("rsa", v)} />
          <Seg label="Dealer hole card" value={rules.peek} options={[{ v: true, l: "Peek (US)" }, { v: false, l: "ENHC" }]} onChange={(v) => set("peek", v)} />
          <label className={styles.field}>
            <span>Minimum bet ($)</span>
            <input type="number" inputMode="numeric" min={1} step={1} value={rules.minBet} onChange={(e) => set("minBet", Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label className={styles.field}>
            <span>Maximum bet ($)</span>
            <input type="number" inputMode="numeric" min={rules.minBet} step={1} value={rules.maxBet} onChange={(e) => set("maxBet", Math.max(rules.minBet, Number(e.target.value) || rules.minBet))} />
          </label>
          <label className={styles.field}>
            <span>Penetration (%)</span>
            <input type="number" inputMode="numeric" min={40} max={95} step={5} value={Math.round(rules.penetration * 100)} onChange={(e) => set("penetration", Math.min(0.95, Math.max(0.4, (Number(e.target.value) || 75) / 100)))} />
          </label>
        </div>
      )}
    </div>
  );
}
