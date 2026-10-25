# GiftGuard FE Bar — execution evidence

Workspace: `https://fevm-sierra-yap-demo-dump.cloud.databricks.com/?o=7474656648208740`  
Catalog: `sierra_yap_demo_dump_catalog` (only identifier not prefixed `fe-bar`)  
CLI profile: `fevm-sierra-yap-demo-dump`

## Outcome first

On **100,298** gold gift-card orders, the registered classifier **blocked 2,339** orders (**$348,380** face value, **$226,100** of that labeled fraud) and sent **4,140** to review (**$100,485**). Labeled fraud is **1,532** orders / **$237,185**. Flag+block recall vs labels is **80.2%**; flag rate on all orders is **5.23%**. Forty GenAI case summaries were written with `ai_query`. Lakebase point lookup for a blocked order completed in **414 ms**. Genie answered block vs review face value from gold.

## Layer evidence

| Layer | Resource | Evidence |
|---|---|---|
| Raw | Job `fe-bar-setup-and-generate` | [run 549118035440036](https://fevm-sierra-yap-demo-dump.cloud.databricks.com/jobs/358418634243564/runs/549118035440036?o=7474656648208740) SUCCESS |
| Lakeflow | Pipeline `fe-bar-fraud-pipeline` | [update e0090429-9198-4a6a-a711-a80a1ec88b39](https://fevm-sierra-yap-demo-dump.cloud.databricks.com/#joblist/pipelines/7290e83d-10ed-4378-914d-0be7383ae6b5/updates/e0090429-9198-4a6a-a711-a80a1ec88b39) COMPLETED — bronze Auto Loader ST → silver/gold MVs |
| UC gold | `fe-bar-gold.fe-bar-order-features` | 100,298 orders, 1,532 labeled fraud, $237,185 labeled fraud USD |
| UC gold | `fe-bar-gold.fe-bar-card-risk-scores` | allow 93,819 / review 4,140 / block 2,339; 40 `case_summary` rows |
| ML | Job `fe-bar-ml-train-score` | [run 475766527248666](https://fevm-sierra-yap-demo-dump.cloud.databricks.com/jobs/615474999578261/runs/475766527248666?o=7474656648208740) SUCCESS; experiment `/Users/sierra.yap@databricks.com/fe-bar-fraud-classifier`; UC model `fe-bar-ml.fe-bar-fraud-classifier` |
| Lakebase | Project `fe-bar-giftguard-serving` | Table `"fe-bar-serving"."fe-bar-card-risk-scores"`: 503 rows; `upsert_ms=2956.3`; `point_lookup_ms=414.4` for `ord-00098728` (risk_score 0.995, block) |
| Genie | `fe-bar GiftGuard Fraud Analytics` | space `01f1cb6b49081479ab1dcbb15703bb42`; Q: block vs review face value → **$348,380** block vs **$100,485** review |
| App | `fe-bar-giftguard-fraud-ops` | https://fe-bar-giftguard-fraud-ops-7474656648208740.aws.databricksapps.com — started |

## Notes

- Schemas/volume already existed; DAB manages jobs + pipeline only.
- Lakebase UC synced catalog was not created (no `CREATE CATALOG`); serving table is loaded from gold.
- App SP `9dfdd8eb-43c9-4464-b2b1-34e9e8209710` granted `USE CATALOG` / `USE SCHEMA` / `SELECT` on gold.
