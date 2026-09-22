export const money = (n: number) => {
  const abs = Math.abs(n);
  const whole = Number.isInteger(abs);
  return (n < 0 ? "−" : "") + "$" + abs.toLocaleString(undefined, { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
};
export const signed = (n: number) => (n > 0 ? "+" : "") + money(n);
export const pct = (num: number, den: number) => (den ? `${Math.round((100 * num) / den)}%` : "—");
export const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
