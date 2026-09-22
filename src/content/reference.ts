/** Static reference content for /learn. Sources listed in tasks/plan.md. */

export const ORDER_OF_OPERATIONS = [
  { step: "Surrender?", text: "Only possible on your first two cards, before anything else. If the answer is no (or the table doesn't offer it) move on." },
  { step: "Split?", text: "Only when you hold a pair (two 10-value cards count). Aces and 8s always; 5s and 10s never." },
  { step: "Double?", text: "Doubling is the strongest thing you can do — it means you're favoured. Rule it in or out before you think about hitting." },
  { step: "Hit or stand?", text: "The last question, not the first. Bust cards (12–16) stand against a weak dealer (2–6) and hit against 7–A." },
];

export const VEGAS_MINIMUMS = [
  { where: "Strip, main floor (Bellagio, Aria, Caesars, Venetian…)", min: "$25 – $100", payout: "6:5 most tables; 3:2 in high-limit", note: "Weekend nights jump to $50+." },
  { where: "Strip, value (Excalibur)", min: "$5 – $15", payout: "6:5", note: "Cheapest live play on the Strip — but the 6:5 makes it ~4× worse than a $10 3:2 table." },
  { where: "Stadium / electronic (Venetian, Resorts World)", min: "$5", payout: "Varies; check the screen", note: "Live dealer on a video feed; you play from a personal terminal." },
  { where: "Downtown (Plaza, Circa, Golden Nugget)", min: "$10 – $25", payout: "3:2", note: "Plaza advertises the most liberal rules; $10 3:2 is the realistic floor now." },
  { where: "Downtown (El Cortez)", min: "$5 – $10", payout: "3:2", note: "Old-school; single/double deck with S17 exists here." },
  { where: "Off-Strip / locals (Ellis Island, Silverton, Station casinos)", min: "$5", payout: "3:2", note: "Best odds per dollar in town for a $100 bankroll." },
];

export const CHIPS = [
  { value: 1, name: "White", color: "#e5e7eb", text: "#111" },
  { value: 5, name: "Red", color: "#dc2626", text: "#fff" },
  { value: 25, name: "Green", color: "#15803d", text: "#fff" },
  { value: 100, name: "Black", color: "#111827", text: "#fff" },
  { value: 500, name: "Purple", color: "#7e22ce", text: "#fff" },
];

export const TABLE_PROCEDURE = [
  { title: "Buying in", text: "Wait for the current hand to finish, lay cash flat on the felt (never hand it to the dealer). Say 'change' or tell the dealer the chip mix you want. Bring at least 10–20× the minimum: $100 is 10 units at a $10 table, 20 at $5." },
  { title: "Betting", text: "Stack chips in the circle before the deal, largest denomination on the bottom. Once the first card is out, don't touch your bet. Minimum and maximum are on the placard." },
  { title: "Hand signals (shoe game — don't touch the cards)", text: "Hit: tap the felt behind your cards. Stand: wave your hand flat over them. Double: put a second stack next to (not on top of) your bet and hold up one finger. Split: same second stack, hold up two fingers in a V. Surrender: say 'surrender' and draw a line behind your bet. Cameras need to see the signal; words alone don't count." },
  { title: "Insurance / even money", text: "When the dealer shows an ace they'll ask 'insurance?' — it's a side bet up to half your wager paying 2:1 if the dealer has blackjack. Basic strategy: never take it (nor even money on your own blackjack). A counter takes it at true count ≥ +3." },
  { title: "The peek", text: "In the US the dealer checks the hole card for blackjack when showing an ace or ten before anyone acts. In Europe/Canada (ENHC) there is no hole card, so you can lose doubles and splits to a dealer blackjack." },
  { title: "The shoe & cut card", text: "Six decks, a plastic cut card ~75% deep. When it comes out, the current round finishes and the dealer reshuffles. Continuous shuffle machines (CSMs) reshuffle every hand — fine for basic strategy, useless for counting." },
  { title: "Payouts", text: "Wins pay 1:1. Blackjack pays 3:2 ($15 on $10) — if the felt says 6:5 ($12 on $10), find another table. Dealer blackjack vs your blackjack is a push." },
  { title: "Etiquette", text: "Don't touch chips after the deal, don't tell others how to play, tip the dealer occasionally (a $1–5 chip, or a bet 'for the dealer' in front of your own). Phones off the table. Drinks are free-ish; play slow if you're taking them." },
  { title: "Walking away", text: "Colour up (ask for larger chips) when you leave and cash at the cage. Decide a stop-loss and a walk-away number before you sit — the sim in Bet shows why." },
];

export const PAYOUT_EXAMPLE = { bet: 10, threeTwo: 15, sixFive: 12 };
