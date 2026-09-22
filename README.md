# Blackjack Tutor

Personal blackjack playground: learn basic strategy, drill it, understand betting systems by simulation, and practice at a realistic $100 table.

```sh
npm install
npm run dev      # http://localhost:3000
npm test         # engine tests (node --test, no framework)
```

| Route    | What                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| `/`      | Dashboard: bankroll curve across sessions, accuracy, weak spots, "reality check"       |
| `/learn` | Interactive strategy chart that follows your table rules, rule-variation edge table, Vegas minimums, table procedure, Hi-Lo + index plays |
| `/drill` | Basic-strategy flashcards weighted toward your misses (+ heatmap); card-counting drill |
| `/bet`   | Monte-Carlo lab: flat, Martingale, D'Alembert, Oscar's Grind, Paroli, 1-3-2-6, Hi-Lo spread |
| `/play`  | Table: chips, shoe with cut card, insurance/peek, splits/doubles/surrender, coach, count HUD, system bet suggestions |

Everything is client-side; state lives in `localStorage`. The game engine (`src/engine/`) is plain TypeScript with no React, shared by the table, the drill and the simulator.

Strategy source: 4–8 deck H17/S17 charts (Wizard of Odds), cross-checked against Blackjack Apprenticeship's chart. Index plays: Illustrious 18 + Fab 4.
