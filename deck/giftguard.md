# GiftGuard

**Stop gift-card fraud without blocking real buyers.**

---

## 1. The outcome (this run)

On **100,298** synthetic gift-card orders:

| Decision | Orders | Face value |
|----------|--------|------------|
| Allow | 93,819 | — |
| Review | 4,140 | $100,485 |
| Block | 2,339 | $348,380 ($226,100 labeled fraud) |

- Total labeled fraud in the set: **$237,185**
- Fraud orders caught at review or block: **~80%**
- Flag rate on all orders: **~5.2%** (mostly review, not hard decline)
- Analyst time: auto GenAI case summary instead of raw feature dumps

**Modeled annual story (not this table):** a ~$4M fraud book at a conservative catch rate maps to
roughly **~$2.4M/year** saved. Use the run numbers above when you need something you can defend.

---

## 2. The problem (buyer language)

Digital gift cards are cash. Stolen cards, account takeover, and reseller
laundering show up as chargebacks, merchant penalties, and a fraud team
that cannot keep up. A $500M GMV book at 0.8% leakage is a **$4M** problem.

---

## 3. What we built (one journey)

Raw events in a UC Volume → Lakeflow bronze/silver/gold → governed tables →
fraud model + GenAI summary → Lakebase lookup → Genie + Fraud-Ops app.

One order, one score, one queue.

---

## 4. Business impact

- Dollars: **$226,100** of **$237,185** labeled fraud stopped at block alone on this run.
- Customers: false flags are a first-class KPI (~5% of good orders in review/block; dial via threshold).
- Team: plain-English case summaries instead of raw feature dumps; Genie for weekly questions.

---

## 5. Two altitudes

**Sponsor:** serverless pattern, no new vendor estate; risk is false positives and we tune that
with a threshold table, not a rebuild.

**Domain owner:** review queue from Lakebase, override in the console,
Genie for "how much face value did we block versus review?" without a ticket to analytics.

---

## 6. What's next

- 2–4 week pilot on a slice of real order history in shadow mode (score, do not decline).
- Optionally put the UC-registered model behind Model Serving for checkout-time scoring.
- Scheduled retrain on new labels; monitor AUC-PR drift.
- Scale the generator from demo 100k orders toward production volumes.

---

## Presentation assets

- `deck/giftguard.md` — this buyer deck (submit as PDF/txt/md)
- `deck/giftguard-slides.html` — live talk slides aligned to `TALK_TRACK.md`
- `TALK_TRACK.md` — spoken script for the demo / Yoodli role-play
