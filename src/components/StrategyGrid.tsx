"use client";
import { useState } from "react";
import type { Rules } from "@/engine/rules";
import { chartCode, DEALER_COLS, phrase, ROWS, type CellKey, type Code, type HandKind } from "@/engine/strategy";
import styles from "./StrategyGrid.module.css";

const LABEL: Record<Code, string> = { H: "H", S: "S", Dh: "D", Ds: "Ds", P: "P", Ph: "P*", Rh: "R", Rs: "Rs", Rp: "Rp" };
const rowName = (kind: HandKind, v: number) => (kind === "pair" ? (v === 11 ? "A,A" : v === 10 ? "T,T" : `${v},${v}`) : kind === "soft" ? `A,${v - 11}` : String(v));
const upName = (u: number) => (u === 11 ? "A" : u === 10 ? "T" : String(u));
const sameKey = (a?: CellKey | null, b?: CellKey | null) => !!a && !!b && a.kind === b.kind && a.value === b.value && a.up === b.up;

export default function StrategyGrid({ rules, highlight, onlyKind, showPhrase = true, heat }: {
  rules: Rules; highlight?: CellKey | null; onlyKind?: HandKind; showPhrase?: boolean;
  /** Accuracy 0–1 per cell (null = unseen). When given, cells are tinted by accuracy instead of action. */
  heat?: (key: CellKey) => number | null;
}) {
  const [picked, setPicked] = useState<CellKey | null>(null);
  const shown = picked ?? highlight ?? null;
  const kinds: HandKind[] = onlyKind ? [onlyKind] : ["hard", "soft", "pair"];
  const dimmed = (code: Code) =>
    (code === "Ph" && !rules.das) || (code.startsWith("R") && rules.surrender !== "late") || ((code === "Dh" || code === "Ds") && rules.doubleOn !== "any");
  return (
    <div className={styles.wrap}>
      {showPhrase && (
        <div className={styles.phrase} aria-live="polite">
          {shown ? (
            <><strong>{phrase(shown, rules)}</strong>{" "}<span className="muted">— vs dealer {upName(shown.up)}: {describe(chartCode(shown, rules), rules)}</span></>
          ) : (
            <span className="muted">Tap any cell for the rule in plain words.</span>
          )}
        </div>
      )}
      {kinds.map((kind) => (
        <div key={kind} className={styles.section}>
          <span className="eyebrow">{kind === "hard" ? "Hard totals" : kind === "soft" ? "Soft totals" : "Pairs"}</span>
          <div className={styles.table} role="grid" aria-label={`${kind} totals basic strategy`}>
            <div className={styles.head} aria-hidden="true" />
            {DEALER_COLS.map((u) => <div key={u} className={styles.head} role="columnheader">{upName(u)}</div>)}
            {ROWS[kind].map((v) => (
              <RowCells key={v} kind={kind} v={v} rules={rules} shown={shown} setPicked={setPicked} dimmed={dimmed} heat={heat} />
            ))}
          </div>
        </div>
      ))}
      {!heat && <div className={styles.legend} aria-label="Legend">
        <span><i style={{ background: "var(--act-hit)" }} />H hit</span>
        <span><i style={{ background: "var(--act-stand)" }} />S stand</span>
        <span><i style={{ background: "var(--act-double)" }} />D double (else hit) · Ds double (else stand)</span>
        <span><i style={{ background: "var(--act-split)" }} />P split · P* split only if DAS</span>
        <span><i style={{ background: "var(--act-surrender)" }} />R surrender (else hit / Rs stand / Rp split)</span>
      </div>}
    </div>
  );
}

function RowCells({ kind, v, rules, shown, setPicked, dimmed, heat }: {
  kind: HandKind; v: number; rules: Rules; shown: CellKey | null; setPicked: (k: CellKey | null) => void; dimmed: (c: Code) => boolean;
  heat?: (key: CellKey) => number | null;
}) {
  return (
    <>
      <div className={styles.rowhead} role="rowheader">{rowName(kind, v)}</div>
      {DEALER_COLS.map((up) => {
        const key: CellKey = { kind, value: v, up };
        const code = chartCode(key, rules);
        const active = sameKey(shown, key);
        const acc = heat ? heat(key) : undefined;
        const heatStyle = heat
          ? acc == null
            ? { background: "var(--bg-sunken)", color: "var(--fg-muted)" }
            : { background: `color-mix(in srgb, var(--success) ${Math.round(acc * 100)}%, var(--danger))`, color: "#fff" }
          : undefined;
        return (
          <button
            key={up}
            type="button"
            role="gridcell"
            style={heatStyle}
            className={`${styles.cell} ${heat ? "" : styles[code]} ${!heat && dimmed(code) ? styles.dim : ""}`}
            aria-selected={active}
            aria-label={`${rowName(kind, v)} versus ${upName(up)}: ${describe(code, rules)}`}
            onClick={() => setPicked(active ? null : key)}
          >
            {LABEL[code]}
          </button>
        );
      })}
    </>
  );
}

export function describe(code: Code, rules: Rules): string {
  const noSur = rules.surrender !== "late";
  switch (code) {
    case "H": return "hit";
    case "S": return "stand";
    case "Dh": return "double, else hit";
    case "Ds": return "double, else stand";
    case "P": return "split";
    case "Ph": return rules.das ? "split (because DAS)" : "hit (no DAS, so don't split)";
    case "Rh": return noSur ? "hit (surrender not offered)" : "surrender, else hit";
    case "Rs": return noSur ? "stand (surrender not offered)" : "surrender, else stand";
    case "Rp": return noSur ? "split (surrender not offered)" : "surrender, else split";
  }
}
