"""Load gold card-risk scores into Lakebase serving table.

Used because this workspace cannot CREATE CATALOG for Lakebase synced tables.
"""

from __future__ import annotations

import os
import time

import psycopg
from databricks import sql
from databricks.sdk.core import Config

PROFILE_HOST = os.environ.get("DATABRICKS_HOST")
WAREHOUSE_ID = os.environ.get("DATABRICKS_WAREHOUSE_ID", "67a31e849c302489")
QUERY = """
SELECT
  order_id, customer_id, brand_name, face_value,
  fraud_score, decision, case_summary, order_ts
FROM `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-card-risk-scores`
WHERE decision IN ('review', 'block')
ORDER BY fraud_score DESC
LIMIT 500
"""


def main() -> None:
    cfg = Config()
    t0 = time.perf_counter()
    with sql.connect(
        server_hostname=cfg.host,
        http_path=f"/sql/1.0/warehouses/{WAREHOUSE_ID}",
        credentials_provider=lambda: cfg.authenticate,
    ) as conn:
        with conn.cursor() as cur:
            cur.execute(QUERY)
            cols = [c[0] for c in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    gold_ms = (time.perf_counter() - t0) * 1000
    print(f"gold_query_ms={gold_ms:.1f} flagged_rows={len(rows)}")

    pg = psycopg.connect(
        host=os.environ["PGHOST"],
        user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"],
        dbname=os.environ.get("PGDATABASE", "databricks_postgres"),
        sslmode="require",
    )
    t1 = time.perf_counter()
    with pg:
        with pg.cursor() as cur:
            cur.execute('CREATE SCHEMA IF NOT EXISTS "fe-bar-serving"')
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS "fe-bar-serving"."fe-bar-card-risk-scores" (
                  order_id TEXT PRIMARY KEY,
                  customer_id TEXT NOT NULL,
                  brand_name TEXT NOT NULL,
                  face_value NUMERIC(12,2) NOT NULL,
                  risk_score DOUBLE PRECISION NOT NULL,
                  decision TEXT NOT NULL,
                  case_summary TEXT,
                  event_ts TIMESTAMPTZ NOT NULL,
                  review_status TEXT NOT NULL DEFAULT 'OPEN',
                  reviewed_at TIMESTAMPTZ
                )
                """
            )
            cur.executemany(
                """
                INSERT INTO "fe-bar-serving"."fe-bar-card-risk-scores"
                  (order_id, customer_id, brand_name, face_value, risk_score, decision, case_summary, event_ts)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (order_id) DO UPDATE SET
                  risk_score=EXCLUDED.risk_score,
                  decision=EXCLUDED.decision,
                  case_summary=EXCLUDED.case_summary,
                  event_ts=EXCLUDED.event_ts
                """,
                [
                    (
                        r["order_id"],
                        r["customer_id"],
                        r["brand_name"],
                        r["face_value"],
                        float(r["fraud_score"]),
                        r["decision"],
                        r.get("case_summary"),
                        r["order_ts"],
                    )
                    for r in rows
                ],
            )
            t2 = time.perf_counter()
            cur.execute(
                'SELECT order_id, risk_score, decision FROM "fe-bar-serving"."fe-bar-card-risk-scores" ORDER BY risk_score DESC LIMIT 1'
            )
            sample = cur.fetchone()
            lookup_ms = (time.perf_counter() - t2) * 1000
    print(f"upsert_ms={(t1 and (time.perf_counter()-t1))*1000:.1f}")
    print(f"point_lookup_ms={lookup_ms:.1f} sample={sample}")


if __name__ == "__main__":
    main()
