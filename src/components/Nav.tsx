"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";

const items = [
  { href: "/", label: "Home", d: "M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" },
  { href: "/learn", label: "Learn", d: "M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h14" },
  { href: "/drill", label: "Drill", d: "M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5m-5-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm9-8-6 6" },
  { href: "/bet", label: "Bet", d: "M3 17l6-6 4 4 8-8M14 7h7v7" },
  { href: "/play", label: "Play", d: "M6 3h9l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 5 4 8m0-8-4 8" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className={styles.nav} aria-label="Primary">
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-hidden="true" tabIndex={-1}>
          Blackjack<span>Tutor</span>
        </Link>
        <div className={styles.links}>
          {items.map((it) => {
            const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
            return (
              <Link key={it.href} href={it.href} className={styles.link} aria-current={active ? "page" : undefined}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={it.d} />
                </svg>
                {it.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
