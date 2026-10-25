# GiftGuard lineage — live `system.access.table_lineage`

Captured 2026-10-22 from warehouse `67a31e849c302489`, CLI profile `fevm-sierra-yap-demo-dump`.

Command used:

```sql
SELECT event_date, source_table_full_name, target_table_full_name
FROM system.access.table_lineage
WHERE (target_table_full_name LIKE '%fe-bar%'
    OR source_table_full_name LIKE '%fe-bar%')
  AND COALESCE(source_table_full_name, '') LIKE '%sierra_yap_demo_dump_catalog%'
  AND COALESCE(target_table_full_name, '') LIKE '%sierra_yap_demo_dump_catalog%'
  AND event_date >= current_date() - 30
GROUP BY event_date, source_table_full_name, target_table_full_name
ORDER BY event_date DESC, target_table_full_name
LIMIT 200;
```

## Distinct source → target edges (15 rows)

These are the unique edges returned. Volume → bronze Auto Loader reads do not always appear as table-to-table edges in `system.access.table_lineage`; bronze tables are streaming tables created by pipeline update `e0090429-9198-4a6a-a711-a80a1ec88b39` (see `01_lakeflow_pipeline/PIPELINE_RUN_SUMMARY.md`).

```text
sierra_yap_demo_dump_catalog.fe-bar-bronze.fe-bar-brands
  -> sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-brands

sierra_yap_demo_dump_catalog.fe-bar-bronze.fe-bar-customers
  -> sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-customers

sierra_yap_demo_dump_catalog.fe-bar-bronze.fe-bar-orders
  -> sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-orders

sierra_yap_demo_dump_catalog.fe-bar-bronze.fe-bar-redemptions
  -> sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-redemptions

sierra_yap_demo_dump_catalog.fe-bar-bronze.fe-bar-chargebacks
  -> sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-chargebacks

sierra_yap_demo_dump_catalog.fe-bar-bronze.fe-bar-fraud-labels
  -> sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-fraud-labels

sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-customers
  -> sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-orders

sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-brands
  -> sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-orders

sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-orders
  -> sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-orders-enriched

sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-customers
  -> sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-orders-enriched

sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-brands
  -> sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-orders-enriched

sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-orders-enriched
  -> sierra_yap_demo_dump_catalog.fe-bar-gold.fe-bar-order-features

sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-chargebacks
  -> sierra_yap_demo_dump_catalog.fe-bar-gold.fe-bar-order-features

sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-fraud-labels
  -> sierra_yap_demo_dump_catalog.fe-bar-gold.fe-bar-order-features

sierra_yap_demo_dump_catalog.fe-bar-gold.fe-bar-order-features
  -> sierra_yap_demo_dump_catalog.fe-bar-gold.fe-bar-label-kpis
```

## What this graph is

- Bronze streaming tables ingest JSON from volume `/Volumes/sierra_yap_demo_dump_catalog/fe-bar-raw/fe-bar-giftcard-events/`.
- Silver MVs clean and join bronze.
- Gold `fe-bar-order-features` is the feature table used to train `sierra_yap_demo_dump_catalog.fe-bar-ml.fe-bar-fraud-classifier`.
- Gold `fe-bar-card-risk-scores` / `fe-bar-fraud-kpis` are written by job run `475766527248666` (notebook), so they may not show as pipeline lineage edges.
- Lakebase `"fe-bar-serving"."fe-bar-card-risk-scores"` is loaded from gold (no synced UC catalog in this workspace).

## Live gold counts confirming the graph produced data

```text
gold.order-features   100298 rows, 1532 labeled fraud, $237185 labeled fraud USD
gold.card-risk-scores 100298 rows
  decision=allow  93819  face_value_sum=2998845
  decision=review  4140  face_value_sum=100485
  decision=block   2339  face_value_sum=348380
  case_summaries     40
```
