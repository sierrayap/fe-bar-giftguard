# GiftGuard Fraud-Ops Console (`fe-bar-giftguard-fraud-ops`)

Databricks App for the GiftGuard demo. Fraud-ops analysts review flagged gift-card orders, read GenAI case summaries, take Approve / Block / Escalate actions, and ask Genie questions without leaving the console.

**Framework:** Databricks AppKit 0.76.1 (React + TypeScript + Express).

This folder is deployable source. It is **not** deployed from this step.

## What the app shows

- **KPI cards** — fraud rate, dollars blocked, false-positive rate, cases open from Unity Catalog gold KPIs
- **Trend chart** — last 30 available days of fraud rate and dollars blocked
- **Flagged-order queue** — score, brand, amount, and GenAI summary
- **Case detail** — features (velocity, device fan-out, geo mismatch, account age) plus Approve / Block / Escalate
- **Genie question area** — starter questions, streamed answers, generated SQL, AI disclaimer, signed-in identity

## Data sources and fallback

| Source | Used for | Binding |
|--------|----------|---------|
| SQL warehouse | Gold KPIs, queue fallback, order detail | `fe-bar-sql-warehouse` → `DATABRICKS_WAREHOUSE_ID` |
| Lakebase | Low-latency queue (if synced table exists) and durable review writes | `fe-bar-postgres` → `LAKEBASE_ENDPOINT` / `PG*` |
| Genie space | Natural-language analytics | `fe-bar-genie-space` → `DATABRICKS_GENIE_SPACE_ID` |

If Lakebase is not attached, or the synced scores table is not present yet, the UI reads the queue and case details from the warehouse SQL files in `config/queries/`. Review writes then land in process memory so the live demo still works; they persist to `app.review_decisions` when Lakebase is connected.

No credentials are hardcoded. Auth uses the Databricks Apps service principal plus user OBO scopes `sql` and `dashboards.genie`.

## Expected Unity Catalog tables

Catalog: `sierra_yap_demo_dump_catalog`  
Schema: `fe-bar-gold`

| Table | Role |
|-------|------|
| `fe-bar-fraud-kpis` | Daily KPIs (`kpi_date`, `fraud_rate`, `dollars_blocked`, `false_positive_rate`, `cases_open`) |
| `fe-bar-card-risk-scores` | Per-order score + `case_summary` + `model_decision` |
| `fe-bar-order-features` | Velocity, device fan-out, geo mismatch, account age |

Hyphenated identifiers are quoted in SQL. Re-run `npm run typegen` after the gold tables exist so generated types refresh from live schemas.

## Required app resources

Create the app as **`fe-bar-giftguard-fraud-ops`**. Attach these resources (names must begin with `fe-bar`):

1. **`fe-bar-sql-warehouse`** — SQL warehouse, permission `CAN_USE`
2. **`fe-bar-postgres`** — Lakebase / Postgres (`fe-bar-giftguard-serving` / `production` / `databricks-postgres`), permission `CAN_CONNECT_AND_CREATE`
3. **`fe-bar-genie-space`** — GiftGuard Genie space, permission `CAN_RUN`

`app.yaml` maps those keys with `valueFrom`. Set the Genie space ID at deploy time (`DATABRICKS_GENIE_SPACE_ID` / `--var genie_space_id=...`). Do not put a space ID in client source.

Target workspace: `https://fevm-sierra-yap-demo-dump.cloud.databricks.com`  
Profile used while scaffolding: `fevm-sierra-yap-demo-dump`

## Local development

```bash
cd 06_app
cp .env.example .env   # fill warehouse / Lakebase / optional Genie ID from your profile
npm install
npm run dev
```

Build for a later deploy (not run here):

```bash
npm run build
npm start
```

## Project layout

```
06_app/
  app.yaml                 # command + valueFrom resource env
  databricks.yml           # app + fe-bar-* resources
  config/queries/          # warehouse SQL (analytics plugin)
  server/                  # AppKit backend, review routes
  client/src/              # React fraud-ops UI
  shared/                  # review action contract + query types
```
