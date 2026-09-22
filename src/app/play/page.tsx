"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chip, ChipStack } from "@/components/Chip";
import PlayingCard from "@/components/PlayingCard";
import RulesPicker from "@/components/RulesPicker";
import { handTotal, Shoe } from "@/engine/cards";
import { type BetState, type Last, SYSTEMS, systemById } from "@/engine/betting";
import { Counter } from "@/engine/count";
import { deviationAction, DEVIATIONS } from "@/engine/deviations";
import type { Rules } from "@/engine/rules";
import { act, legalActions, startRound, takeInsurance, type Action, type RoundState } from "@/engine/round";
import { advise, type Advice } from "@/engine/strategy";
import { addHand, archiveSession, BANKROLL_KEY, CURRENT_KEY, newSession, START_BANKROLL, type Decision, type Session } from "@/lib/session";
import { useLocalStorage } from "@/lib/storage";
import { useRules } from "@/lib/useRules";
import styles from "./page.module.css";

type Coach = "off" | "after" | "hint";
const ACTIONS: { a: Action; label: string; key: string }[] = [
  { a: "hit", label: "Hit", key: "H" }, { a: "stand", label: "Stand", key: "S" }, { a: "double", label: "Double", key: "D" },
  { a: "split", label: "Split", key: "P" }, { a: "surrender", label: "Surrender", key: "R" },
];
const RACK = [1, 5, 25, 100];
import { money } from "@/lib/format";

export default function PlayPage() {
  const [rules, setRules] = useRules();
  const [bankroll, setBankroll, ready] = useLocalStorage<number>(BANKROLL_KEY, START_BANKROLL);
  const [session, setSession] = useLocalStorage<Session | null>(CURRENT_KEY, null);
  const [coach, setCoach] = useLocalStorage<Coach>("bjt.coach", "after");
  const shoeRef = useRef<Shoe | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [bet, setBet] = useState(0);
  const [lastBet, setLastBet] = useState(0);
  const [shoeInfo, setShoeInfo] = useState({ remaining: 0, total: 0, shuffled: false });
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const decisions = useRef<Decision[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [systemId, setSystemId] = useLocalStorage<string>("bjt.system", "manual");
  const [betPrefs] = useLocalStorage<{ unit: number }>("bjt.bet", { unit: rules.minBet });
  const [showCount, setShowCount] = useLocalStorage<boolean>("bjt.showCount", false);
  const [useDeviations, setUseDeviations] = useLocalStorage<boolean>("bjt.deviations", false);
  const counter = useRef(new Counter());
  const [betState, setBetState] = useState<BetState>({});
  const [lastRound, setLastRound] = useState<Last | undefined>(undefined);
  const [count, setCount] = useState({ rc: 0, tc: 0 });
  const [peek, setPeek] = useState(false);

  const shoe = useCallback(() => {
    if (!shoeRef.current || shoeRef.current.decks !== rules.decks || shoeRef.current.penetration !== rules.penetration) {
      shoeRef.current = new Shoe(rules.decks, rules.penetration);
      counter.current = new Counter();
    }
    return shoeRef.current;
  }, [rules.decks, rules.penetration]);

  const syncShoe = (shuffled = false) => {
    const s = shoe();
    setShoeInfo({ remaining: s.remaining, total: s.total, shuffled });
    const rc = counter.current.update(s);
    setCount({ rc, tc: counter.current.tc(s) });
  };
  useEffect(() => { syncShoe(); }, [shoe]); // eslint-disable-line react-hooks/exhaustive-deps

  const inRound = !!round && round.phase !== "settled";
  const wagered = round && round.phase !== "settled" ? round.hands.reduce((a, h) => a + h.bet, 0) + round.insuranceBet : 0;
  const available = bankroll - wagered;
  const sessionNet = session ? session.end - session.start : 0;

  // ---- settle
  const finish = (r: RoundState) => {
    const results = r.hands.map((h) => h.result!);
    setLastRound({ outcome: r.net > 0 ? "win" : r.net < 0 ? "lose" : "push", bet: r.hands[0].bet, net: r.net });
    setBankroll((b) => Math.round((b + r.net) * 100) / 100);
    setSession((cur) => addHand(cur ?? newSession(rules, bankroll, systemId), { bet: r.hands[0].bet, net: r.net, results, decisions: decisions.current, at: Date.now() }));
  };

  // ---- betting system suggestion (T10)
  const system = systemId === "manual" ? null : systemById(systemId);
  const suggestion = (() => {
    if (!system || round) return null;
    const unit = Math.max(rules.minBet, betPrefs.unit || rules.minBet);
    const { bet } = system.next({ unit, bankroll, minBet: rules.minBet, maxBet: rules.maxBet, last: lastRound, trueCount: count.tc }, betState);
    return bet;
  })();
  const takeSuggestion = () => {
    if (!system || suggestion == null) return;
    const unit = Math.max(rules.minBet, betPrefs.unit || rules.minBet);
    const r = system.next({ unit, bankroll, minBet: rules.minBet, maxBet: rules.maxBet, last: lastRound, trueCount: count.tc }, betState);
    setBetState(r.state);
    setBet(r.bet);
  };

  const addChip = (v: number) => setBet((b) => Math.min(rules.maxBet, available, b + v));
  const canDeal = bet >= rules.minBet && bet <= Math.min(rules.maxBet, bankroll);

  const deal = useCallback(() => {
    if (!canDeal) return;
    const s = shoe();
    let shuffled = false;
    if (s.pastCutCard) { s.shuffle(); shuffled = true; }
    setSession((cur) => cur ?? newSession(rules, bankroll, systemId));
    decisions.current = [];
    setFeedback(null);
    setLastBet(bet);
    const r = startRound(s, rules, bet);
    setRound(r);
    syncShoe(shuffled);
    if (r.phase === "settled") finish(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canDeal, bet, rules, bankroll, shoe]);

  const legal = useMemo<Action[]>(() => {
    if (!round || round.phase !== "player") return [];
    const h = round.hands[round.active];
    return legalActions(round, rules).filter((a) => (a === "double" || a === "split" ? available >= h.bet : true));
  }, [round, rules, available]);

  const advice = useMemo<Advice | null>(() => {
    if (!round || round.phase !== "player") return null;
    const h = round.hands[round.active];
    // For the coach, judge against what the table allows (not the bankroll).
    const legalAll = legalActions(round, rules);
    const a = advise(h.cards, round.dealer[0], legalAll, rules);
    if (useDeviations) {
      const dev = deviationAction(h.cards, round.dealer[0], count.tc, legalAll, rules);
      if (dev && dev !== a.action) {
        const d = DEVIATIONS.find((x) => x.action === dev) ;
        return { ...a, action: dev, why: `Index play at TC ${count.tc.toFixed(1)}: ${d?.note ?? dev}. (Basic strategy: ${a.action}.)` };
      }
    }
    return a;
  }, [round, rules, useDeviations, count.tc]);

  const doAction = useCallback((a: Action) => {
    if (!round || !legal.includes(a) || !advice) return;
    const correct = a === advice.action;
    decisions.current.push({ key: advice.key, code: advice.code, correct, took: a, should: advice.action });
    if (coach !== "off") setFeedback(correct ? { ok: true, text: `${cap(a)} — correct.` } : { ok: false, text: `Book says ${advice.action}. ${advice.why}` });
    else setFeedback(null);
    const next = act(round, a, shoe(), rules);
    setRound({ ...next });
    syncShoe();
    if (next.phase === "settled") finish(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, legal, advice, coach, rules, shoe]);

  const insure = useCallback((take: boolean) => {
    if (!round || round.phase !== "insurance") return;
    if (take && available < round.hands[0].bet / 2) return;
    const shouldTake = useDeviations && count.tc >= 3;
    if (coach !== "off") setFeedback(take === shouldTake ? { ok: true, text: take ? `Insurance at TC ${count.tc.toFixed(1)} — correct.` : "No insurance — correct." } : { ok: false, text: shouldTake ? `At TC ${count.tc.toFixed(1)} insurance is +EV — take it.` : "Basic strategy never takes insurance (only a counter at TC ≥ +3)." });
    const next = takeInsurance(round, take, shoe(), rules);
    setRound({ ...next });
    syncShoe();
    if (next.phase === "settled") finish(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, available, coach, rules, shoe, useDeviations, count.tc]);

  const nextHand = useCallback(() => {
    setRound(null);
    setFeedback(null);
    setBet(Math.min(lastBet, bankroll, rules.maxBet));
  }, [lastBet, bankroll, rules.maxBet]);

  const walkAway = () => {
    if (session) archiveSession(session);
    setBetState({});
    setLastRound(undefined);
    setSession(null);
    setRound(null);
    setFeedback(null);
  };
  const rebuy = () => {
    walkAway();
    setBankroll(START_BANKROLL);
    setBet(0);
  };

  // ---- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "SELECT") return;
      const k = e.key.toUpperCase();
      if (!round) { if (k === "ENTER") { e.preventDefault(); deal(); } return; }
      if (round.phase === "settled") { if (k === "ENTER" || k === " ") { e.preventDefault(); nextHand(); } return; }
      if (round.phase === "insurance") { if (k === "Y") insure(true); if (k === "N") insure(false); return; }
      const a = ACTIONS.find((x) => x.key === k);
      if (a) { e.preventDefault(); doAction(a.a); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [round, deal, nextHand, insure, doAction]);

  const busted = ready && bankroll < rules.minBet && !inRound;
  const dealerTotal = round ? handTotal(round.dealer) : null;
  const revealed = round?.phase === "settled";
  const pen = shoeInfo.total ? 1 - shoeInfo.remaining / shoeInfo.total : 0;

  return (
    <div className="page">
      <header className={styles.top}>
        <div>
          <span className="eyebrow">Play</span>
          <h1>Table</h1>
        </div>
        <div className={styles.kpis}>
          <div className={styles.kpi}><span>Bankroll</span><strong>{money(bankroll)}</strong></div>
          <div className={styles.kpi}><span>Session</span><strong className={sessionNet > 0 ? styles.pos : sessionNet < 0 ? styles.neg : ""}>{sessionNet >= 0 ? "+" : ""}{money(sessionNet)}</strong></div>
          <div className={styles.kpi}><span>Hands</span><strong>{session?.hands.length ?? 0}</strong></div>
          <div className={styles.kpi}><span>Accuracy</span><strong>{session?.decisions ? `${Math.round((100 * (session.decisions - session.mistakes)) / session.decisions)}%` : "—"}</strong></div>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className="seg" role="group" aria-label="Coach">
          {(["off", "after", "hint"] as Coach[]).map((c) => (
            <button key={c} type="button" aria-pressed={coach === c} onClick={() => setCoach(c)}>{c === "off" ? "Coach off" : c === "after" ? "Coach after" : "Hint first"}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <label className={styles.selectWrap}>
            <span className="visually-hidden">Betting system</span>
            <select className={styles.select} value={systemId} onChange={(e) => { setSystemId(e.target.value); setBetState({}); }} disabled={inRound}>
              <option value="manual">Bet by hand</option>
              {SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <button type="button" className="btn" aria-pressed={showCount} onClick={() => setShowCount(!showCount)}>Count HUD</button>
          <button type="button" className="btn" aria-pressed={useDeviations} onClick={() => setUseDeviations(!useDeviations)} title="Coach uses Illustrious 18 / Fab 4 index plays">Index plays</button>
          <button type="button" className="btn" onClick={() => setShowRules((v) => !v)} aria-expanded={showRules} disabled={inRound}>Table rules</button>
          <button type="button" className="btn" onClick={walkAway} disabled={inRound || !session}>Walk away</button>
        </div>
      </div>
      {showRules && <div className="card"><RulesPicker rules={rules} onChange={(r: Rules) => { setRules(r); shoeRef.current = null; }} /></div>}

      <section className={styles.felt} aria-label="Blackjack table">
        <div className={styles.placard}>
          <b>${rules.minBet}–${rules.maxBet}</b><br />
          {rules.decks} decks · {rules.h17 ? "H17" : "S17"} · {rules.das ? "DAS" : "no DAS"}<br />
          BJ pays {rules.bjPays === 1.5 ? "3:2" : rules.bjPays === 1.2 ? "6:5" : "1:1"}{rules.surrender === "late" ? " · LS" : ""}
        </div>
        <div className={styles.shoe} aria-label={`Shoe: ${shoeInfo.remaining} cards left`}>
          <span>{shoeInfo.shuffled ? "Shuffled · " : ""}{Math.round(pen * 100)}% dealt · {(shoeInfo.remaining / 52).toFixed(1)} decks left</span>
          <div className={styles.meter}><i style={{ width: `${pen * 100}%` }} /></div>
          {showCount && (
            <button type="button" className={styles.hud} onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} onKeyDown={(e) => { if (e.key === " ") setPeek(true); }} onKeyUp={() => setPeek(false)} aria-label="Hold to reveal the running and true count">
              {peek ? <><b>RC {count.rc > 0 ? "+" : ""}{count.rc}</b> · TC {count.tc > 0 ? "+" : ""}{count.tc.toFixed(1)}</> : "hold to reveal count"}
            </button>
          )}
        </div>

        <div className={styles.dealer}>
          <span className={styles.label}>Dealer {round && (revealed || !rules.peek || round.dealer.length > 2) && dealerTotal && <span className={styles.total}>{dealerTotal.total > 21 ? "bust" : dealerTotal.total}</span>}</span>
          <div className={styles.cards}>
            {round?.dealer.map((c, i) => (
              <PlayingCard key={`${c.rank}${c.suit}${i}`} card={c} hidden={i === 1 && !revealed} animate dealIndex={i} className={i === 1 && revealed ? styles.reveal : ""} />
            ))}
          </div>
        </div>

        <div className={styles.player}>
          <div className={styles.hands}>
            {round ? round.hands.map((h, i) => {
              const t = handTotal(h.cards);
              const isActive = round.phase === "player" && i === round.active;
              return (
                <div key={i} className={`${styles.hand} ${isActive ? styles.active : ""}`} aria-current={isActive ? "true" : undefined}>
                  <div className={styles.cards}>
                    {h.cards.map((c, j) => <PlayingCard key={`${c.rank}${c.suit}${j}`} card={c} animate dealIndex={j} flat={h.doubled && j === 2} className={h.doubled && j === 2 ? styles.dbl : ""} />)}
                  </div>
                  <span className={styles.label}>
                    <span className={styles.total}>{t.total > 21 ? "bust" : `${t.soft && t.total < 21 ? "soft " : ""}${t.total}`}</span>
                    {h.result && <span className={`${styles.badge} ${styles[h.result === "surrender" ? "lose" : h.result]}`}>{h.result === "blackjack" ? "Blackjack" : h.result === "surrender" ? "Surrendered" : h.result}{h.net ? ` ${h.net > 0 ? "+" : ""}${money(h.net)}` : ""}</span>}
                  </span>
                  <ChipStack amount={h.bet} />
                </div>
              );
            }) : (
              <div className={styles.betSpot}>
                <div className={styles.circle}>{bet > 0 ? <ChipStack amount={bet} size={40} /> : <span style={{ opacity: 0.6, fontSize: 12 }}>BET</span>}</div>
                <span>{bet > 0 ? money(bet) : `min ${money(rules.minBet)}`}</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.dock}>
          {busted ? (
            <div className={styles.busted}>
              <strong>You&apos;re felted. {money(bankroll)} left, table minimum is {money(rules.minBet)}.</strong>
              <span className="muted" style={{ color: "rgba(255,255,255,0.75)" }}>That&apos;s the variance the Bet lab is about. Rebuy and try a different plan.</span>
              <button type="button" className={`${styles.action} ${styles.primary}`} onClick={rebuy}>Rebuy $100</button>
            </div>
          ) : !round ? (
            <>
              <div className={styles.rack} role="group" aria-label="Chips">
                {RACK.map((v) => <Chip key={v} value={v} onClick={() => addChip(v)} disabled={bet + v > Math.min(rules.maxBet, available)} />)}
              </div>
              <div className={styles.row}>
                <button type="button" className={styles.action} onClick={() => setBet(0)} disabled={!bet}>Clear</button>
                <button type="button" className={styles.action} onClick={() => setBet(Math.min(rules.minBet, available))} disabled={available < rules.minBet}>Min</button>
                <button type="button" className={styles.action} onClick={() => setBet(Math.min(lastBet || rules.minBet, available, rules.maxBet))} disabled={!lastBet}>Rebet</button>
                <button type="button" className={`${styles.action} ${styles.primary}`} onClick={deal} disabled={!canDeal}>Deal <span className={`kbd ${styles.kbd}`}>↵</span></button>
              </div>
              {system && suggestion != null && (
                <div className={styles.row}>
                  <span className={styles.coach}>{system.name} says <strong>{suggestion ? money(suggestion) : "you can't cover the minimum"}</strong>{system.kind === "count" ? ` (TC ${count.tc > 0 ? "+" : ""}${count.tc.toFixed(1)})` : ""}</span>
                  {suggestion > 0 && <button type="button" className={styles.action} style={{ minHeight: 40 }} onClick={takeSuggestion}>Use it</button>}
                </div>
              )}
              <div className={styles.msg}>{bet > 0 && bet < rules.minBet ? `Minimum bet is ${money(rules.minBet)}` : session ? "" : "Place a bet to start a session."}</div>
            </>
          ) : round.phase === "insurance" ? (
            <>
              <div className={styles.msg}><strong>Dealer shows an ace. Insurance?</strong><span>Costs {money(round.hands[0].bet / 2)}, pays 2:1 if the dealer has blackjack.</span></div>
              <div className={styles.row}>
                <button type="button" className={styles.action} onClick={() => insure(true)} disabled={available < round.hands[0].bet / 2}>Yes <span className={`kbd ${styles.kbd}`}>Y</span></button>
                <button type="button" className={`${styles.action} ${styles.primary}`} onClick={() => insure(false)}>No <span className={`kbd ${styles.kbd}`}>N</span></button>
              </div>
            </>
          ) : round.phase === "player" ? (
            <>
              {coach === "hint" && advice && <div className={styles.coach}>Book: <strong>{advice.action}</strong> — {advice.why}</div>}
              <div className={styles.actions} role="group" aria-label="Actions">
                {ACTIONS.map(({ a, label, key }) => (
                  <button key={a} type="button" className={`${styles.action} ${coach === "hint" && advice?.action === a ? styles.hint : ""}`} disabled={!legal.includes(a)} onClick={() => doAction(a)}>
                    {label}<span className={`kbd ${styles.kbd}`}>{key}</span>
                  </button>
                ))}
              </div>
              {feedback && <div className={`${styles.coach} ${feedback.ok ? styles.good : styles.bad}`} role="status">{feedback.text}</div>}
            </>
          ) : (
            <>
              <div className={styles.msg} role="status" aria-live="polite">
                <strong>{round.net > 0 ? `You win ${money(round.net)}` : round.net < 0 ? `You lose ${money(-round.net)}` : "Push"}</strong>
                {round.dealerBlackjack && <span>Dealer blackjack.</span>}
                {round.insuranceBet > 0 && <span>Insurance {round.dealerBlackjack ? `paid ${money(round.insuranceBet * 2)}` : `lost ${money(round.insuranceBet)}`}.</span>}
              </div>
              {feedback && !feedback.ok && <div className={`${styles.coach} ${styles.bad}`} role="status">{feedback.text}</div>}
              <button type="button" className={`${styles.action} ${styles.primary}`} onClick={nextHand}>Next hand <span className={`kbd ${styles.kbd}`}>↵</span></button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
