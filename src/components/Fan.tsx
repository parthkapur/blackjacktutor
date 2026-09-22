import { useId } from "react";
import styles from "./Fan.module.css";

/** A few dozen session trajectories overlaid — shows the spread, not any one path. */
export default function Fan({ curves, start, minBet, hands, height = 170, format = (v: number) => String(v) }: {
  curves: number[][]; start: number; minBet: number; hands: number; height?: number; format?: (v: number) => string;
}) {
  const id = useId();
  if (!curves.length) return null;
  const W = 600, H = height, padL = 44, padR = 8, padT = 8, padB = 20;
  const max = Math.max(start * 1.5, ...curves.map((c) => Math.max(...c)));
  const x = (i: number) => padL + (i / Math.max(1, hands)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-labelledby={id}>
      <title id={id}>{curves.length} sample sessions of up to {hands} hands</title>
      {[0.5, 1].map((f) => <text key={f} className={styles.axis} x={padL - 6} y={y(max * f) + 4} textAnchor="end">{format(Math.round(max * f))}</text>)}
      <line className={styles.base} x1={padL} x2={W - padR} y1={y(start)} y2={y(start)} />
      <text className={styles.axis} x={padL - 6} y={y(start) + 4} textAnchor="end">{format(start)}</text>
      <line className={styles.floor} x1={padL} x2={W - padR} y1={y(minBet)} y2={y(minBet)} />
      {curves.map((c, k) => (
        <path key={k} className={styles.line} d={c.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")} />
      ))}
      <text className={styles.axis} x={padL} y={H - 4}>hand 0</text>
      <text className={styles.axis} x={W - padR} y={H - 4} textAnchor="end">hand {hands}</text>
    </svg>
  );
}
