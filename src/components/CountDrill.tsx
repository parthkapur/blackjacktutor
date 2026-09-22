"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import PlayingCard from "@/components/PlayingCard";
import { mulberry32, Shoe, type Card } from "@/engine/cards";
import { hiLo, runningCount } from "@/engine/count";
import { useLocalStorage } from "@/lib/storage";
import styles from "./CountDrill.module.css";

const SPEEDS = [0.7, 1, 1.5, 2.5];
const LENGTHS = [20, 52, 104];
interface CountStats { bySpeed: Record<string, { n: number; correct: number }> }
type Phase = "idle" | "running" | "answer" | "result";

export default function CountDrill({ decks }: { decks: number }) {
  const [speed, setSpeed] = useLocalStorage<number>("bjt.count.speed", 1);
  const [len, setLen] = useLocalStorage<number>("bjt.count.len", 52);
  const [pairs, setPairs] = useLocalStorage<boolean>("bjt.count.pairs", false);
  const [stats, setStats] = useLocalStorage<CountStats>("bjt.countDrill", { bySpeed: {} });
  const [phase, setPhase] = useState<Phase>("idle");
  const [seq, setSeq] = useState<Card[]>([]);
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const step = pairs ? 2 : 1;

  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const start = useCallback(() => {
    stop();
    const shoe = new Shoe(decks, 1, mulberry32(Date.now() % 2 ** 31));
    const cards: Card[] = [];
    for (let k = 0; k < len; k++) cards.push(shoe.draw());
    setSeq(cards);
    setI(0);
    setGuess("");
    setPhase("running");
  }, [decks, len]);

  useEffect(() => {
    if (phase !== "running") return;
    timer.current = setInterval(() => {
      setI((k) => {
        if (k + step >= seq.length) { stop(); setPhase("answer"); return k; }
        return k + step;
      });
    }, 1000 / speed);
    return stop;
  }, [phase, speed, step, seq.length]);

  useEffect(() => { if (phase === "answer") inputRef.current?.focus(); }, [phase]);

  const truth = runningCount(seq);
  const submit = () => {
    if (phase !== "answer" || guess.trim() === "" || Number.isNaN(Number(guess))) return;
    const correct = Number(guess) === truth;
    const key = String(speed);
    const prev = stats.bySpeed[key] ?? { n: 0, correct: 0 };
    setStats({ bySpeed: { ...stats.bySpeed, [key]: { n: prev.n + 1, correct: prev.correct + (correct ? 1 : 0) } } });
    setPhase("result");
  };

  const visible = phase === "running" ? seq.slice(i, i + step) : [];
  const acc = (sp: number) => { const s = stats.bySpeed[String(sp)]; return s ? `${Math.round((100 * s.correct) / s.n)}% of ${s.n}` : "—"; };

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <div className="seg" role="group" aria-label="Speed (cards per second)">
          {SPEEDS.map((s) => <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} disabled={phase === "running"}>{s}/s</button>)}
        </div>
        <div className="seg" role="group" aria-label="Number of cards">
          {LENGTHS.map((l) => <button key={l} type="button" aria-pressed={len === l} onClick={() => setLen(l)} disabled={phase === "running"}>{l} cards</button>)}
        </div>
        <div className="seg" role="group" aria-label="Cards at a time">
          <button type="button" aria-pressed={!pairs} onClick={() => setPairs(false)} disabled={phase === "running"}>Singles</button>
          <button type="button" aria-pressed={pairs} onClick={() => setPairs(true)} disabled={phase === "running"}>Pairs</button>
        </div>
      </div>

      <div className={styles.stage} aria-live="polite">
        {phase === "idle" && (
          <>
            <p className={styles.hint}>Hi-Lo: 2–6 count <b>+1</b>, 7–9 <b>0</b>, 10–A <b>−1</b>. Cards flash by; keep the running count in your head, then type it. Pairs mode is how you&apos;ll actually see them at the table — cancel a high with a low and skip the arithmetic.</p>
            <button type="button" className="btn btn-accent" onClick={start}>Start</button>
          </>
        )}
        {phase === "running" && (
          <>
            <div className={`${styles.cards} ${pairs ? styles.pair : ""}`}>
              {visible.map((c, k) => <PlayingCard key={`${i}-${k}`} card={c} animate dealIndex={k} />)}
            </div>
            <div className={styles.progress}><i style={{ width: `${(100 * (i + step)) / seq.length}%` }} /></div>
          </>
        )}
        {phase === "answer" && (
          <form className={styles.answer} onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <label htmlFor="rc" style={{ fontSize: "var(--text-lg)" }}>Running count?</label>
            <input id="rc" ref={inputRef} inputMode="numeric" pattern="-?[0-9]*" value={guess} onChange={(e) => setGuess(e.target.value)} autoComplete="off" />
            <button type="submit" className="btn btn-accent">Check</button>
          </form>
        )}
        {phase === "result" && (
          <div className={styles.result}>
            <strong>{Number(guess) === truth ? "Correct." : `Off by ${Math.abs(Number(guess) - truth)}.`}</strong>
            <span>Running count was <b className="num">{truth > 0 ? "+" : ""}{truth}</b>{Number(guess) !== truth && <> (you said {guess})</>}</span>
            <small>{seq.filter((c) => hiLo(c.rank) > 0).length} low · {seq.filter((c) => hiLo(c.rank) === 0).length} neutral · {seq.filter((c) => hiLo(c.rank) < 0).length} high</small>
            <button type="button" className="btn btn-accent" onClick={start} autoFocus>Again</button>
          </div>
        )}
      </div>

      <div className={styles.stats}>
        {SPEEDS.map((s) => <span key={s}>{s}/s <b>{acc(s)}</b></span>)}
      </div>
    </div>
  );
}
