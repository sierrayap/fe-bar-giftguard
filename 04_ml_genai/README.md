# ML + GenAI

- Job: `fe-bar-ml-train-score` → `src/notebooks/04_train_and_score.py`
- Model: `sierra_yap_demo_dump_catalog`.`fe-bar-ml`.`fe-bar-fraud-classifier`
- Serving tables written by the job (not pipeline-owned):
  - `fe-bar-gold`.`fe-bar-card-risk-scores`
  - `fe-bar-gold`.`fe-bar-card-status`
  - `fe-bar-gold`.`fe-bar-fraud-kpis`
- GenAI: `ai_query('databricks-meta-llama-3-3-70b-instruct', ...)` on the top flagged
  orders, with a deterministic template fallback if the endpoint is unavailable.

Local sklearn preview metrics (same features, not the UC model):
`LOCAL_PREVIEW_METRICS.md`.
