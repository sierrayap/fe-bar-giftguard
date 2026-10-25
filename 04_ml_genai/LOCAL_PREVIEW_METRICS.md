# GiftGuard ML — live MLflow run (workspace)

Captured 2026-10-22. CLI profile `fevm-sierra-yap-demo-dump`.

This replaces the earlier local sklearn preview. The numbers below are from
the registered UC model run, not the laptop training notebook.

```text
job: fe-bar-ml-train-score
job_id: 615474999578261
run_id: 475766527248666
result_state: SUCCESS
start: 2026-10-19T03:11:29.876Z
end:   2026-10-19T03:13:36.745Z
run_page: https://fevm-sierra-yap-demo-dump.cloud.databricks.com/?o=7474656648208740#job/615474999578261/run/475766527248666
```

## MLflow experiment and model

```text
experiment: /Users/sierra.yap@databricks.com/fe-bar-fraud-classifier
experiment_id: 2256951045581349
mlflow_run_name: fe-bar-fraud-xgb
mlflow_run_id: 7b51de2e00664b6198e6b1533d8743e8
status: FINISHED
uc_model: sierra_yap_demo_dump_catalog.fe-bar-ml.fe-bar-fraud-classifier
uc_model_version: 1
uc_model_status: READY
```

Command used:

```bash
databricks api get /api/2.0/mlflow/runs/get --profile fevm-sierra-yap-demo-dump \
  --json '{"run_id":"7b51de2e00664b6198e6b1533d8743e8"}'
```

## Logged metrics (verbatim)

```text
auc_pr=0.5827974487933015
roc_auc=0.8828482835425391
```

AUC-PR is the headline metric because labeled fraud is 1.53% of orders.

## Logged params (subset)

```text
objective=binary:logistic
eval_metric=aucpr
num_boost_round=120
max_depth=5
learning_rate=0.08
subsample=0.85
colsample_bytree=0.85
random_state=42
n_jobs=4
scale_pos_weight=64.46823324630112
features=face_value,account_age_hours,is_new_account,customer_orders_1h,customer_orders_24h,customer_amount_24h,device_account_count,geo_mismatch,is_max_denomination,instant_redeem_brand
```

`has_chargeback` is intentionally not in the feature list (label leakage).

## What this model did on gold (not a logged MLflow metric)

From `fe-bar-gold.fe-bar-card-risk-scores` after the job wrote scores:

```text
orders            100298
allow              93819
review              4140   ($100,485 face value)
block               2339   ($348,380 face value)
labeled fraud       1532   ($237,185)
case_summary rows     40   (ai_query)
```

The ~$2.4M annual-save figure in the talk track is a modeled extrapolation,
not a number this gold table contains. Do not quote it as a live metric.
