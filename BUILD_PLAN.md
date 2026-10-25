# FE Bar Build Plan — Prezzee-style Gift-Card Fraud Platform

> **For the coding harness executing this:** This is an end-to-end Databricks build for an internal
> skills assessment (the "FE Bar"). Build it as an integrated data journey, not siloed demos. Read the
> **Hard Requirements** and **Execution-Evidence Rules** sections first — they are pass/fail gates.
>
> **Databricks skills to load before building:** `databricks-core` first (CLI/auth/profile), then as you
> reach each stage: `databricks-synthetic-data-gen`, `databricks-pipelines` (Lakeflow), `databricks-unity-catalog`,
> `databricks-lakebase`, `databricks-ml-training` + `databricks-model-serving`, `databricks-genie-agents`,
> `databricks-apps-python`.
>
> **Workspace/profile:** Do NOT auto-select. Confirm the target with the user (likely `e2-demo-field-eng`),
> then pass `--profile <name>` on every CLI call.

---

## 1. The customer problem (anchor everything to this)

**Industry:** Digital gift cards / fintech-retail (modeled on Prezzee — a digital gift-card platform).

**Specific problem:** Digital gift cards are a prime fraud target — stolen-card purchases, account takeover (ATO),
and reseller/laundering abuse. Fraud drives chargebacks, merchant penalties, and brand damage. The business needs to
**detect and block fraudulent transactions in near-real-time at purchase/redemption**, and give the fraud-operations
team the tooling to investigate flagged cases and tune thresholds.

**This is deliberately the fintech twin of the FE Bar's canonical "retail stockouts" example** — a specific,
operational, transaction-time problem with hard dollar KPIs.

### Quantified value (lead the narrative with this — refine numbers, but keep them concrete)
- Baseline: ~$500M annual GMV; fraud losses ~0.8% of GMV ≈ **$4M/yr** (chargebacks + write-offs + ops cost).
- Target: real-time scoring catches ~60% of fraud currently slipping through, **saving ≈ $2.4M/yr**,
  while holding the false-positive rate **< 2%** so legitimate buyers aren't blocked.
- Secondary: cut fraud-analyst investigation time per case by surfacing an auto-generated case summary.

> The FE Bar scores "did you lead with a quantified business outcome." Put the dollar figure in the **first**
> paragraph of the README and on slide 1 of the deck. Architecture comes later.

---

## 2. Hard Requirements (the six-layer journey — all must be present AND connected)

The data must flow visibly through every stage. "Disconnected layers stitched together" is the #1 failure mode.

| # | Stage | What to build | The connection to prove |
|---|-------|---------------|-------------------------|
| 1 | **Raw data** | Synthetic gift-card dataset landed as raw files in a UC Volume | Files exist in `/Volumes/...` |
| 2 | **Lakeflow** | Declarative Pipeline: raw files → bronze → silver → gold (medallion) | Pipeline reads the Volume from stage 1 |
| 3 | **Unity Catalog** | Catalog/schema, comments, PII tags + masking, lineage | Tables from stage 2 are governed; lineage graph connects them |
| 4 | **Lakebase** | Sync the gold "card risk / transaction score" serving table to Lakebase Postgres | App (stage 7) reads scores from Lakebase at low latency |
| 5 | **ML + GenAI** | (a) Fraud-scoring ML model (MLflow → UC → Model Serving); (b) GenAI case-summary via `ai_query` | Model trains on silver/gold features from stage 2; scores feed stage 4 |
| 6 | **Genie Agent** | Genie Space over gold fraud tables for natural-language Q&A | Points at the governed gold tables from stages 2–3 |
| 7 | **Databricks App** | Fraud-Ops console surfacing flagged txns, review actions, KPIs, embedded Genie | Reads Lakebase (stage 4) + model endpoint (stage 5) + Genie (stage 6) |

**No real customer data — ever.** Everything is synthetic. Do not pull from `go/solution-builder`.

---

## 3. Stage-by-stage build spec

### Stage 1 — Synthetic raw data
Generate with Faker/Mimesis (local) or `dbldatagen` (on cluster). Land as raw JSON/CSV in a UC Volume
(e.g. `/Volumes/<catalog>/raw/giftcard_events/`). Target scale: ~200k customers, ~2M transactions over 18 months.

**Entities:**
- `customers` — id, signup_date, email (synthetic), country, device_ids[]
- `brands` — gift-card brand/merchant catalog (e.g. 50 retail brands), denomination ranges
- `orders` — order_id, customer_id, brand_id, face_value, payment_method, device_id, ip_country, ts
- `redemptions` — redemption events (card used), redeemer_id, ts, channel
- `chargebacks` — subset of orders later disputed (this seeds some labels)
- `fraud_labels` — ground-truth `is_fraud` flag per order (for training/eval only)

**Inject realistic, non-linear fraud patterns** (~1.5% of orders) so the ML has signal:
- **Velocity:** many high-value orders from one customer/device in a short window
- **Device/account sharing:** one device_id across many customer_ids (ATO ring)
- **Geo mismatch:** payment country ≠ IP country ≠ account country
- **Face-value skew:** fraud skews toward max denominations + instantly-redeemable brands
- **New-account burst:** fraud concentrated in accounts < 48h old
Keep fraud a minority class with messy, overlapping signals — not trivially separable.

**Commit:** the generator script + a printed summary (row counts, fraud base rate, class balance) as text.

### Stage 2 — Lakeflow Declarative Pipeline (ingest + medallion)
Use a Lakeflow Spark Declarative Pipeline (serverless) with Auto Loader reading the Volume:
- **Bronze:** streaming tables, raw ingest of each entity, `_rescued_data` + ingest metadata
- **Silver:** cleaned/typed, dedup, joined `orders` ⟕ `customers` ⟕ `brands`; expectations (`@dlt.expect`) on
  nulls / valid face values / referential integrity — **report the expectation pass rates** (great evidence)
- **Gold:** feature + serving tables:
  - `gold.order_features` — engineered features (velocity counts, device fan-out, geo-mismatch flags, account age)
  - `gold.card_risk_scores` — one row per order with model score + decision (seeded post-stage-5)
  - `gold.fraud_kpis` — daily aggregates (fraud rate, $ blocked, FP rate) for Genie + app

### Stage 3 — Unity Catalog governance
- Three-level namespace: `<catalog>.giftcard_fraud.{bronze,silver,gold}` (or schema-per-layer).
- Table + column `COMMENT`s on every gold table (Genie reads these — invest here).
- **PII handling:** tag `email`, `ip`, payment fields with governed tags; apply a column mask or dynamic view
  so non-privileged roles see masked values. Document it.
- Capture a **lineage screenshot's data as text** — i.e. list the lineage edges, since the evaluator reads text.

### Stage 4 — Lakebase (operational serving)
- Provision a Lakebase (Postgres) instance.
- Sync `gold.card_risk_scores` (and a `card_status` lookup) into Lakebase as a synced table / reverse-ETL,
  so the Fraud-Ops app does **sub-second lookups** at transaction time instead of hitting the lakehouse.
- Prove it: commit a query against Lakebase returning a scored order by id, with latency noted.
- **Trade-off to document:** why Lakebase for serving (OLTP point lookups, app-facing) vs. querying Delta directly
  (analytical, higher latency). This is exactly the "decisions & trade-offs" signal the rubric rewards.

### Stage 5 — Intelligence (ML + GenAI)
**ML (core):**
- Train a gradient-boosted fraud classifier (LightGBM/XGBoost or sklearn) on `gold.order_features`.
- Track with **MLflow**; log metrics (AUC-PR — the right metric for imbalanced fraud — precision@k, FP rate,
  $ saved at chosen threshold). Register the model in **Unity Catalog**.
- Deploy to **Model Serving**. Batch-score orders to populate `gold.card_risk_scores`.
- **Commit the printed metrics and a confusion matrix as text**, plus a threshold table (precision/recall/$-impact
  at several cutoffs) — this is your value quantification evidence.

**GenAI (adds the "AI mindset" signal):**
- Use `ai_query()` (or a small Agent) to generate a plain-English **case summary** per flagged order
  ("3 high-value orders in 10 min from a 1-day-old account; device seen on 12 other accounts; IP≠billing country").
- Store summaries on the gold table so the app and Genie can show them.

### Stage 6 — Genie Agent
- Create a Genie Space over `gold.fraud_kpis`, `gold.card_risk_scores`, `gold.order_features`.
- Curate: good table/column comments (stage 3), 5–8 example questions, a few SQL instructions/joins.
- Validate with real NL questions and **commit the Q→generated-SQL→result transcripts as text**:
  - "What was the fraud rate by brand last week?"
  - "Show the top 10 highest-value blocked orders yesterday."
  - "How much fraud $ did we block this month vs last?"

### Stage 7 — Databricks App (Fraud-Ops console)
Build with the `databricks-apps-python` skill (Streamlit or Dash is fine; or FastAPI+React if you prefer).
- **KPI header:** fraud rate, $ blocked (MTD), false-positive rate, cases open — from `gold.fraud_kpis`.
- **Review queue:** flagged transactions pulled from **Lakebase** (stage 4) for low latency; each row shows the
  model score + the GenAI case summary; analyst can Approve / Block / Escalate (write the decision back).
- **Ad-hoc question box:** embed the **Genie** space so a manager asks questions in NL without leaving the app.
- Wire real auth/resources per the skill. Deploy via `app.yaml`.

---

## 4. Execution-Evidence Rules (pass/fail — read carefully)

The FE Bar evaluator **reads text only; it cannot see images.** A screenshot or screen recording does **not**
count as execution evidence. Source code alone fails the Build domain. For every stage you MUST commit
**text-readable proof it ran**:
- Notebooks committed **with their output cells visible** (execute, then save the `.ipynb` with outputs — or
  export to `.md`/`.py` with outputs inline).
- Pipeline run → commit the run summary / event log excerpt + expectation pass rates as text.
- SQL steps → commit the query **and its result rows** (markdown table or CSV in the repo).
- ML → commit printed metrics, threshold table, confusion matrix as text (not a plot image alone).
- Lakebase → commit a query + returned row + noted latency.
- Genie → commit the NL-question → SQL → result transcripts.
- App → commit the code; the running app is demoed live in the roleplay (that's where visuals count).

---

## 5. Repository structure
```
fe-bar-prezzee/
├── README.md                 # LEAD with the quantified business outcome, then architecture + how data flows
├── DECISIONS.md              # decisions & trade-offs (Lakebase vs Delta, model choice, threshold, AUC-PR, etc.)
├── 00_synthetic_data/        # generator script + printed data-summary (stage 1)
├── 01_lakeflow_pipeline/     # DLT/SDP notebooks + committed run summary & expectation rates (stage 2)
├── 02_unity_catalog/         # DDL, comments, PII tags/masking, lineage-as-text (stage 3)
├── 03_lakebase/              # sync config + query evidence (stage 4)
├── 04_ml_genai/             # training notebook w/ outputs, MLflow run id, metrics, ai_query summaries (stage 5)
├── 05_genie/                 # space config + NL→SQL→result transcripts (stage 6)
├── 06_app/                   # Databricks App (app.yaml + source) (stage 7)
└── deck/                     # business presentation exported as PDF/.md (see §6)
```
- **GitHub repo must be readable by the validator**: make it **public**, or connect GitHub in the submission form
  if it's in a private EMU org. Submission is blocked if the repo can't be read.

---

## 6. Deck (separate required deliverable — draft it too)
A business-audience deck, exported as **PDF or .txt/.md** and attached in the deck field. Outline:
1. **The outcome** — "$2.4M/yr fraud reduction, FP rate < 2%" (no architecture yet)
2. The problem in the buyer's language — chargebacks, brand trust, analyst burnout
3. What we built — the live journey, one slide, data flowing left→right
4. Business impact in buyer KPIs — $ saved, fraud rate ↓, time-to-detect ↓
5. For the executive sponsor (ROI, risk, time-to-value) **and** the domain owner (how fraud-ops uses it daily)
6. What's next / scale

---

## 7. Roleplay prep (Customer Skills — scored separately in the AI roleplay)
You'll demo to a **business** persona (CFO/sponsor) and a **technical** persona (data lead/architect) at once.
- **Tell-show-tell**, lead with the outcome, keep it tight.
- Business pushback to expect: cost, risk, time-to-value, false-positive friction on real customers.
- Technical pushback to expect: data quality, model drift/retraining, scoring latency, PII/security, why Lakebase.
- Be ready to **switch altitude mid-answer**.

---

## 8. Guardrails / attestation
- 100% synthetic or public data; no real Prezzee or customer data, records, or identifiers.
- This must be **your own build**, not generated from `go/solution-builder`.
- Using AI tools to build is explicitly encouraged — document the tools/prompts/patterns used (it's rewarded).
- Optionally capture the coding-harness conversation/session ID in case the submission is flagged.

---

## 9. Suggested build order (minimize rework)
1. Confirm workspace/profile with the user.
2. Stage 1 (synthetic data) → 2 (Lakeflow) → 3 (UC) — get the data journey landing in gold first.
3. Stage 5 (ML + GenAI) → backfill `gold.card_risk_scores`.
4. Stage 4 (Lakebase sync) → 6 (Genie) → 7 (App) — the serving + surfacing layers.
5. Write README (outcome-first) + DECISIONS.md as you go; verify all execution evidence is committed as text.
6. Draft the deck. Push to a readable GitHub repo.
