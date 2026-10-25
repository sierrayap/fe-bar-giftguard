# GiftGuard decisions and trade-offs

AI coding tools (Cursor / Claude skills for DABs, Lakeflow, UC, ML) drafted
implementation; product choices and the $2.4M narrative are authored here.

## Why this problem

Gift-card fraud is the fintech twin of "retail stockouts": a transaction-time
decision with a dollar KPI. Baseline ~$4M/yr losses; target ~60% catch at
<2% false positives → **~$2.4M/yr**.

## Demo scale vs BUILD_PLAN scale

BUILD_PLAN asked for ~200k customers / ~2M orders. This build uses **5k / 100k**
so serverless jobs and the triggered pipeline finish in a demo window while
keeping the same fraud mix (velocity, ATO device rings, geo mismatch,
max-denomination, new-account bursts). Regeneration knobs are job parameters.

## Medallion split

- **Bronze** streaming tables + Auto Loader from the UC Volume (the only raw
  landing zone).
- **Silver / gold features** as materialized views. Triggered mode plus
  windowed velocity and customer/brand joins are simpler and correct as batch
  reads. Streaming windows would add state cost without changing the story.
- **`fe-bar-card-risk-scores` is job-written**, not a pipeline MV. A
  pipeline-owned MV cannot be batch-scored in place. The pipeline stops at
  features + label KPIs; the ML job owns scores, status, and model KPIs.

## Model and metric

- Gradient-boosted trees (XGBoost on the workspace job; HistGradientBoosting
  for the local preview).
- **AUC-PR** is the headline metric — ROC-AUC is too flattering at a 1.5%
  base rate.
- Default threshold **0.35**, then `review` vs `block` at a higher band so
  the app has a queue instead of a binary knife.
- Labels are intentionally noisy (~25% of injected fraud unlabeled, a thin
  friendly-fraud false-label rate, legit holiday bursts) so the model is not
  a single IF-THEN rule. Local preview metrics will move after each generator
  change; the workspace XGBoost run is the number to quote.
- `has_chargeback` is **not** a model feature (leakage: chargebacks arrive
  weeks later).

## Lakebase vs Delta

Delta for analytics and training; Lakebase (`fe-bar-giftguard-serving`) for
`order_id` point lookups at checkout. Same gold table, right engine. A managed
synced table was not available because this workspace user cannot
`CREATE CATALOG` for the Lakebase UC catalog; the app reads a dedicated
Postgres table `fe-bar-serving.fe-bar-card-risk-scores` that is loaded from gold.

## PII

Column masks on email / IP / card last-4. Unmasked for account group
`fe-bar-fraud-ops` (must be created) or the deploying user. All values are
synthetic.

## Naming

Every schema, volume, table, job, pipeline, function, and model starts with
`fe-bar`. The catalog `sierra_yap_demo_dump_catalog` is the only exception.
Hyphenated identifiers are quoted in SQL and in `pyspark.pipelines` names.

## What AI was used for

Scaffolding the DAB, Lakeflow `dp` tables, generator, and notebooks. Threshold
policy, leakage call, and Lakebase trade-off are explicit human decisions.
