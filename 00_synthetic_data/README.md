# Stage 1 — Synthetic raw data

- Generator: `src/giftguard/synthesize.py` (seed=42)
- Databricks job: `fe-bar-setup-and-generate`
- Local evidence: `python3 00_synthetic_data/run_local_preview.py`
- Landing path after deploy:
  `/Volumes/sierra_yap_demo_dump_catalog/fe-bar-raw/fe-bar-giftcard-events/{customers,brands,orders,redemptions,chargebacks,fraud_labels}`

Demo scale: **5,000 customers**, **100,000 orders**, ~1.5% fraud with
overlapping velocity / device-fan-out / geo / max-denom / new-account signals.
