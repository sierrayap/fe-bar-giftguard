# Lakebase lookup evidence — live

Captured 2026-10-22 against project `fe-bar-giftguard-serving`, branch `production`,
database `databricks_postgres`. CLI profile `fevm-sierra-yap-demo-dump`.

Host: `ep-bold-hall-d2577qmp.database.us-east-1.cloud.databricks.com`

This workspace could not `CREATE CATALOG` for a Lakebase synced table, so gold
scores were loaded into Postgres table `"fe-bar-serving"."fe-bar-card-risk-scores"`.

## Point lookup (live)

```sql
SELECT order_id, customer_id, brand_name, face_value, risk_score, decision
FROM "fe-bar-serving"."fe-bar-card-risk-scores"
WHERE order_id = 'ord-00098728';
```

```text
table= "fe-bar-serving"."fe-bar-card-risk-scores"
rows=503
point_lookup_ms=209.3
order_id=ord-00098728
customer_id=cus-00003122
brand_name=Bunnings
face_value=500.00
risk_score=0.99542737
decision=block
```

Earlier load of the same table (from the original sync script, kept as the
write-path measurement):

```text
flagged_rows_loaded=500+
upsert_ms=2956.3
point_lookup_ms=414.4
sample=('ord-00098728', 0.99542737, 'block')
```

## How this is used by the app

The Fraud-Ops app reads this table through AppKit `lakebase.query()`:

- `GET /api/queue` lists flagged rows from Lakebase
- `GET /api/lakebase/order/:orderId` is the same PK lookup the inspector runs
- `POST /api/reviews` upserts into `app.review_decisions` on the same instance

App logs after the scores-table GRANT:

```text
2026-10-21T06:16:06Z [APP] [giftguard] Using Lakebase scores table "fe-bar-serving"."fe-bar-card-risk-scores"
2026-10-21T06:16:06Z [APP] [giftguard] Lakebase connected; write store = lakebase
```
