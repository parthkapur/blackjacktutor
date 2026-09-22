"use client";
import { useId, useState } from "react";
import styles from "./Histogram.module.css";

/** Distribution of session-ending bankrolls. Bars below `start` are tinted as losses, above as wins. */
export default function Histogram({ values, start, bins = 24, height = 150, format = (v: number) => String(v) }: {
  values: number[]; start: number; bins?: number; height?: number; format?: (v: number) => string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (!values.length) return null;
  const W = 600, H = height, padL = 8, padR = 8, padT = 8, padB = 20;
  const min = 0;
  const max = Math.max(start * 1.1, ...values);
  const step = (max - min) / bins;
  const counts = new Array(bins).fill(0) as number[];
  for (const v of values) counts[Math.min(bins - 1, Math.max(0, Math.floor((v - min) / step)))]++;
  const peak = Math.max(...counts);
  const bw = (W - padL - padR) / bins;
  const x = (i: number) => padL + i * bw;
  const y = (c: number) => padT + (1 - c / peak) * (H - padT - padB);
  const startX = padL + ((start - min) / (max - min)) * (W - padL - padR);
  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-labelledby={id} onPointerLeave={() => setHover(null)}>
        <title id={id}>Distribution of final bankrolls across {values.length} sessions</title>
        <line className={styles.grid} x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} />
        {counts.map((c, i) => {
          const lo = min + i * step;
          const win = lo + step / 2 >= start;
          return (
            <rect key={i} className={styles.bar} x={x(i) + 1} width={Math.max(1, bw - 2)} y={y(c)} height={H - padB - y(c)} rx={3}
              fill={win ? "var(--success)" : "var(--danger)"} opacity={hover === i ? 1 : 0.85}
              onPointerEnter={() => setHover(i)} />
          );
        })}
        <line className={styles.start} x1={startX} x2={startX} y1={padT} y2={H - padB} />
        <text className={styles.axis} x={startX} y={H - 6} textAnchor="middle">start {format(start)}</text>
        <text className={styles.axis} x={padL} y={H - 6}>{format(min)}</text>
        <text className={styles.axis} x={W - padR} y={H - 6} textAnchor="end">{format(max)}</text>
      </svg>
      {hover != null && (
        <div className={styles.tip} style={{ left: `${((x(hover) + bw / 2) / W) * 100}%`, top: `${(y(counts[hover]) / H) * 100}%` }}>
          {format(min + hover * step)}–{format(min + (hover + 1) * step)} · {counts[hover]} ({Math.round((100 * counts[hover]) / values.length)}%)
        </div>
      )}
    </div>
  );
}
