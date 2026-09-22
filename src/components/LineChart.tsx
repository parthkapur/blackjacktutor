"use client";
import { useId, useRef, useState } from "react";
import styles from "./LineChart.module.css";

/** Single-series line with a dashed reference line, hover crosshair and tooltip. Values are y; x is index. */
export default function LineChart({ values, baseline, height = 160, format = (v: number) => String(v), xLabel = (i: number) => `#${i}`, marks = [] }: {
  values: number[]; baseline?: number; height?: number; format?: (v: number) => string; xLabel?: (i: number) => string;
  /** Indexes where a vertical divider is drawn (e.g. session boundaries). */
  marks?: number[];
}) {
  const id = useId();
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height, padL = 44, padR = 8, padT = 10, padB = 20;
  const n = values.length;
  if (n < 2) return <div className={styles.wrap} style={{ height }}><div className={styles.empty}>No hands yet.</div></div>;
  const all = baseline == null ? values : [...values, baseline];
  let min = Math.min(...all), max = Math.max(...all);
  if (max - min < 1) { max += 1; min -= 1; }
  const pad = (max - min) * 0.08;
  min -= pad; max += pad;
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const areaBase = baseline == null ? H - padB : y(baseline);
  const ticks = [min + pad, (min + max) / 2, max - pad];
  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - padL) / (W - padL - padR)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  return (
    <div className={styles.wrap}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-labelledby={id} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <title id={id}>Bankroll over {n} hands, from {format(values[0])} to {format(values[n - 1])}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line className={styles.grid} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
            <text className={styles.axis} x={padL - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {marks.map((m) => <line key={m} className={styles.grid} x1={x(m)} x2={x(m)} y1={padT} y2={H - padB} strokeDasharray="2 4" />)}
        {baseline != null && <line className={styles.base} x1={padL} x2={W - padR} y1={y(baseline)} y2={y(baseline)} />}
        <path className={styles.area} d={`${d}L${x(n - 1)},${areaBase}L${x(0)},${areaBase}Z`} />
        <path className={styles.line} d={d} />
        <text className={styles.axis} x={padL} y={H - 4}>{xLabel(0)}</text>
        <text className={styles.axis} x={W - padR} y={H - 4} textAnchor="end">{xLabel(n - 1)}</text>
        {hover != null && (
          <g>
            <line className={styles.cross} x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} />
            <circle className={styles.dot} cx={x(hover)} cy={y(values[hover])} r={5} />
          </g>
        )}
      </svg>
      {hover != null && (
        <div className={styles.tip} style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(values[hover]) / H) * 100}%` }}>
          {xLabel(hover)} · {format(values[hover])}
        </div>
      )}
    </div>
  );
}
