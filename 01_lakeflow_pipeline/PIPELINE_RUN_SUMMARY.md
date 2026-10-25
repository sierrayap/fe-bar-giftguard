# Pipeline run summary — live workspace output

Captured 2026-10-22 from CLI profile `fevm-sierra-yap-demo-dump`.

Workspace: `https://fevm-sierra-yap-demo-dump.cloud.databricks.com/?o=7474656648208740`

```text
pipeline_name: fe-bar-fraud-pipeline
pipeline_id: 7290e83d-10ed-4378-914d-0be7383ae6b5
update_id: e0090429-9198-4a6a-a711-a80a1ec88b39
pipeline_state: IDLE
update_state: COMPLETED
catalog: sierra_yap_demo_dump_catalog
serverless: true
creation_time: 2026-10-19T02:59:17.593Z
started_by: API_CALL
```

Update URL: https://fevm-sierra-yap-demo-dump.cloud.databricks.com/#joblist/pipelines/7290e83d-10ed-4378-914d-0be7383ae6b5/updates/e0090429-9198-4a6a-a711-a80a1ec88b39

Command used:

```bash
databricks pipelines get 7290e83d-10ed-4378-914d-0be7383ae6b5 \
  --profile fevm-sierra-yap-demo-dump -o json

databricks pipelines list-pipeline-events 7290e83d-10ed-4378-914d-0be7383ae6b5 \
  --filter "update_id = 'e0090429-9198-4a6a-a711-a80a1ec88b39'" \
  --limit 250 --profile fevm-sierra-yap-demo-dump -o json
```

## Update progress (verbatim)

```text
Update e00904 started by API_CALL.
Update e00904 is WAITING_FOR_RESOURCES.
Update e00904 is INITIALIZING.
Update e00904 is SETTING_UP_TABLES.
Update e00904 is RUNNING.
Update e00904 is COMPLETED.
```

## Datasets created (verbatim dataset_life_cycle)

Streaming tables (Auto Loader bronze):

```text
Streaming Table `sierra_yap_demo_dump_catalog`.`fe-bar-bronze`.`fe-bar-brands` has been created.
Streaming Table `sierra_yap_demo_dump_catalog`.`fe-bar-bronze`.`fe-bar-customers` has been created.
Streaming Table `sierra_yap_demo_dump_catalog`.`fe-bar-bronze`.`fe-bar-orders` has been created.
Streaming Table `sierra_yap_demo_dump_catalog`.`fe-bar-bronze`.`fe-bar-redemptions` has been created.
Streaming Table `sierra_yap_demo_dump_catalog`.`fe-bar-bronze`.`fe-bar-chargebacks` has been created.
Streaming Table `sierra_yap_demo_dump_catalog`.`fe-bar-bronze`.`fe-bar-fraud-labels` has been created.
```

Materialized views (silver / gold):

```text
Materialized View `sierra_yap_demo_dump_catalog`.`fe-bar-silver`.`fe-bar-brands` has been created.
Materialized View `sierra_yap_demo_dump_catalog`.`fe-bar-silver`.`fe-bar-customers` has been created.
Materialized View `sierra_yap_demo_dump_catalog`.`fe-bar-silver`.`fe-bar-orders` has been created.
Materialized View `sierra_yap_demo_dump_catalog`.`fe-bar-silver`.`fe-bar-redemptions` has been created.
Materialized View `sierra_yap_demo_dump_catalog`.`fe-bar-silver`.`fe-bar-chargebacks` has been created.
Materialized View `sierra_yap_demo_dump_catalog`.`fe-bar-silver`.`fe-bar-fraud-labels` has been created.
Materialized View `sierra_yap_demo_dump_catalog`.`fe-bar-silver`.`fe-bar-orders-enriched` has been created.
Materialized View `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-order-features` has been created.
Materialized View `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-label-kpis` has been created.
```

## Flows completed (verbatim flow_progress)

```text
Flow 'sierra_yap_demo_dump_catalog.fe-bar-bronze.fe-bar-brands' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-bronze.fe-bar-customers' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-bronze.fe-bar-orders' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-bronze.fe-bar-redemptions' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-bronze.fe-bar-chargebacks' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-bronze.fe-bar-fraud-labels' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-brands' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-customers' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-orders' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-redemptions' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-chargebacks' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-fraud-labels' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-silver.fe-bar-orders-enriched' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-gold.fe-bar-order-features' has COMPLETED.
Flow 'sierra_yap_demo_dump_catalog.fe-bar-gold.fe-bar-label-kpis' has COMPLETED.
```

## Aggregated flow metrics (from pipeline event log table)

Event log: `sierra_yap_demo_dump_catalog`.`fe-bar-bronze`.`event_log_7290e83d_10ed_4378_914d_0be7383ae6b5`

```text
2026-10-19 03:00:34 | fe-bar-silver.fe-bar-customers finished with executor time 697 ms and executor CPU time 314 ms.
2026-10-19 03:00:34 | fe-bar-silver.fe-bar-fraud-labels finished with executor time 693 ms and executor CPU time 337 ms.
2026-10-19 03:00:34 | fe-bar-silver.fe-bar-brands finished with executor time 471 ms and executor CPU time 224 ms.
2026-10-19 03:00:34 | fe-bar-silver.fe-bar-chargebacks finished with executor time 593 ms and executor CPU time 282 ms.
2026-10-19 03:00:35 | fe-bar-silver.fe-bar-redemptions finished with executor time 729 ms and executor CPU time 482 ms.
2026-10-19 03:00:41 | fe-bar-silver.fe-bar-orders finished with executor time 1206 ms and executor CPU time 903 ms.
2026-10-19 03:00:45 | fe-bar-silver.fe-bar-orders-enriched finished with executor time 830 ms and executor CPU time 619 ms.
2026-10-19 03:00:50 | fe-bar-gold.fe-bar-order-features finished with executor time 1611 ms and executor CPU time 1193 ms.
2026-10-19 03:00:53 | fe-bar-gold.fe-bar-label-kpis finished with executor time 390 ms and executor CPU time 233 ms.
2026-10-19 03:00:55 | Update e00904 is COMPLETED.
```

No `expectation_result` events were present in this update's event list. Data quality is evidenced by the live row counts below matching the generator.

## Live row counts after the update

Queried 2026-10-22 against warehouse `67a31e849c302489`.

```text
bronze.customers        5000
bronze.brands             50
bronze.orders         100298
bronze.redemptions     78369
bronze.chargebacks      1014
bronze.fraud-labels   100298
silver.orders-enriched 100298
gold.order-features   100298
gold.card-risk-scores 100298
gold.fraud-kpis          543
```

`fe-bar-card-risk-scores` and `fe-bar-fraud-kpis` are written by job `fe-bar-ml-train-score` after this pipeline update, not by the pipeline itself.
