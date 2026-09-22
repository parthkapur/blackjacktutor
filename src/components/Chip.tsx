import { CHIPS } from "@/content/reference";
import styles from "./Chip.module.css";

export const chipFor = (v: number) => [...CHIPS].reverse().find((c) => v >= c.value) ?? CHIPS[0];

export function Chip({ value, onClick, disabled, size, label }: { value: number; onClick?: () => void; disabled?: boolean; size?: number; label?: string }) {
  const c = chipFor(value);
  const style = { background: c.color, color: c.text, ...(size ? ({ "--chip-s": `${size}px` } as React.CSSProperties) : {}) };
  if (onClick) {
    return <button type="button" className={styles.chip} style={style} onClick={onClick} disabled={disabled} aria-label={label ?? `Add $${value} chip`}>{value}</button>;
  }
  return <span className={styles.chip} style={style} aria-hidden="true">{value}</span>;
}

/** Break an amount into casino chips (largest first) and draw them as a fanned stack. */
export function ChipStack({ amount, size = 36 }: { amount: number; size?: number }) {
  const chips: number[] = [];
  let rest = Math.round(amount);
  for (const c of [...CHIPS].reverse()) while (rest >= c.value && chips.length < 12) { chips.push(c.value); rest -= c.value; }
  return (
    <span className={styles.stack} style={{ "--chip-s": `${size}px`, width: size, height: size + chips.length * 4 } as React.CSSProperties} aria-label={`$${amount} bet`} role="img">
      {chips.map((v, i) => (
        <span key={i} className={styles.layer} style={{ transform: `translateY(${-i * 4}px)`, zIndex: i }}><Chip value={v} size={size} /></span>
      ))}
    </span>
  );
}
