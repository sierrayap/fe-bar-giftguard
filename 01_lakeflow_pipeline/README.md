# fe-bar-fraud-pipeline

Triggered **serverless** Lakeflow Spark Declarative Pipeline (`pyspark.pipelines`).

- Resource: `resources/fe-bar-fraud-pipeline.pipeline.yml`
- Code: `src/pipelines/fe_bar_giftguard/transformations/`
- Default catalog/schema: `sierra_yap_demo_dump_catalog`.`fe-bar-bronze`
- Cross-schema publish uses quoted names: `` `fe-bar-silver`.`fe-bar-orders` ``

## Run order

1. Job `fe-bar-setup-and-generate` (volume files must exist first)
2. Pipeline `fe-bar-fraud-pipeline` (triggered, not continuous)
3. Job `fe-bar-ml-train-score` (writes scores / KPIs the pipeline does not own)

## Expectations (report these pass rates from the pipeline event log)

| Dataset | Expectation | Action |
|---------|-------------|--------|
| silver `fe-bar-customers` | customer_id_present | drop |
| silver `fe-bar-customers` | email_looks_valid, country_present | warn |
| silver `fe-bar-brands` | brand_id_present / max_denomination_positive | drop / warn |
| silver `fe-bar-orders` | order_id_present, customer_id_present | drop |
| silver `fe-bar-orders` | face_value_positive, face_value_reasonable | warn |
| silver `fe-bar-orders` | known_customer, known_brand | warn |
| gold `fe-bar-order-features` | order_id_present / non_negative_velocity | drop / warn |

Live pass rates are **not** in this repo yet — the bundle has not been deployed.
After the first update, paste the event-log excerpt into `PIPELINE_RUN_SUMMARY.md`.
