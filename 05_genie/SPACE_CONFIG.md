# Genie Space — fe-bar-fraud-analytics

Do not create the space until gold tables exist. Design:

| Field | Value |
|-------|-------|
| Display name | fe-bar GiftGuard Fraud Analytics |
| Space ID | `01f1cb6b49081479ab1dcbb15703bb42` |
| Warehouse | workspace serverless / default SQL warehouse |
| Tables | `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-fraud-kpis` |
| | `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-card-risk-scores` |
| | `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-order-features` |

## Example questions

1. What was the fraud rate by brand last week?
2. Show the top 10 highest-value blocked orders yesterday.
3. How much fraud $ did we block this month vs last?
4. What is the false-positive rate this week?
5. Which devices appear on the most distinct customer accounts?
6. How many review-queue cases are open today?
7. What share of fraud is on accounts younger than 48 hours?
8. Which instant-redeem brands have the highest fraud face value?

## SQL instructions to pin on the space

- `is_fraud` on `fe-bar-order-features` is the **label**, not the model decision.
- `decision` on `fe-bar-card-risk-scores` is allow / review / block.
- `dollars_blocked` on `fe-bar-fraud-kpis` is true-positive blocked face value.
- Join scores to features on `order_id`.
- Hyphenated schema/table names must be quoted in generated SQL.

Local stand-in answers: `LOCAL_PREVIEW_ANSWERS.md`.
