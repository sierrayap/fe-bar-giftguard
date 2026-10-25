# Databricks notebook source
# MAGIC %md
# MAGIC # fe-bar-setup-and-generate
# MAGIC
# MAGIC Creates hyphenated GiftGuard schemas, the raw volume, PII mask functions,
# MAGIC and lands synthetic JSON events for Auto Loader.

# COMMAND ----------

import json
import sys
from pathlib import Path

dbutils.widgets.text("catalog", "sierra_yap_demo_dump_catalog")
dbutils.widgets.text("raw_schema", "fe-bar-raw")
dbutils.widgets.text("bronze_schema", "fe-bar-bronze")
dbutils.widgets.text("silver_schema", "fe-bar-silver")
dbutils.widgets.text("gold_schema", "fe-bar-gold")
dbutils.widgets.text("ml_schema", "fe-bar-ml")
dbutils.widgets.text("volume_name", "fe-bar-giftcard-events")
dbutils.widgets.text("customer_count", "5000")
dbutils.widgets.text("order_count", "100000")

CATALOG = dbutils.widgets.get("catalog")
RAW_SCHEMA = dbutils.widgets.get("raw_schema")
BRONZE_SCHEMA = dbutils.widgets.get("bronze_schema")
SILVER_SCHEMA = dbutils.widgets.get("silver_schema")
GOLD_SCHEMA = dbutils.widgets.get("gold_schema")
ML_SCHEMA = dbutils.widgets.get("ml_schema")
VOLUME_NAME = dbutils.widgets.get("volume_name")
N_CUSTOMERS = int(dbutils.widgets.get("customer_count"))
N_ORDERS = int(dbutils.widgets.get("order_count"))


def q(*parts: str) -> str:
    return ".".join(f"`{p}`" for p in parts)


# COMMAND ----------

# MAGIC %md
# MAGIC ## Unity Catalog schemas, volume, and mask functions

# COMMAND ----------

for schema in (RAW_SCHEMA, BRONZE_SCHEMA, SILVER_SCHEMA, GOLD_SCHEMA, ML_SCHEMA):
    spark.sql(
        f"CREATE SCHEMA IF NOT EXISTS {q(CATALOG, schema)} "
        f"COMMENT 'GiftGuard {schema} layer — synthetic gift-card fraud platform'"
    )

spark.sql(
    f"CREATE VOLUME IF NOT EXISTS {q(CATALOG, RAW_SCHEMA, VOLUME_NAME)} "
    "COMMENT 'Raw JSON gift-card events for the fe-bar-fraud-pipeline Auto Loader'"
)

# Mask functions live in fe-bar-ml so they are reusable across layers.
# Unmasked values are visible to members of fe-bar-fraud-ops (create the
# account group before demoing) or to the deploying user.
spark.sql(
    f"""
    CREATE OR REPLACE FUNCTION {q(CATALOG, ML_SCHEMA, "fe-bar-mask-email")}(email STRING)
    RETURN CASE
      WHEN is_account_group_member('fe-bar-fraud-ops') THEN email
      WHEN current_user() LIKE '%sierra.yap%' THEN email
      ELSE regexp_replace(email, '^[^@]+', '****')
    END
    """
)
spark.sql(
    f"""
    CREATE OR REPLACE FUNCTION {q(CATALOG, ML_SCHEMA, "fe-bar-mask-ip")}(ip STRING)
    RETURN CASE
      WHEN is_account_group_member('fe-bar-fraud-ops') THEN ip
      WHEN current_user() LIKE '%sierra.yap%' THEN ip
      ELSE regexp_replace(ip, '(\\\\d+)\\\\.(\\\\d+)\\\\.(\\\\d+)\\\\.(\\\\d+)', '*.*.*.$4')
    END
    """
)
spark.sql(
    f"""
    CREATE OR REPLACE FUNCTION {q(CATALOG, ML_SCHEMA, "fe-bar-mask-card")}(last4 STRING)
    RETURN CASE
      WHEN is_account_group_member('fe-bar-fraud-ops') THEN last4
      WHEN current_user() LIKE '%sierra.yap%' THEN last4
      ELSE concat('****', right(last4, 4))
    END
    """
)

print("Created schemas, volume, and fe-bar-mask-* functions")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Generate synthetic events

# COMMAND ----------

def _import_synthesize():
    here = Path.cwd()
    search = [here, *here.parents]
    for p in search:
        src = p / "src"
        if (src / "giftguard" / "synthesize.py").exists():
            sys.path.insert(0, str(src))
            from giftguard.synthesize import generate_universe, summarize

            return generate_universe, summarize
    # Bundle layout: notebooks live under src/notebooks
    for p in search:
        if (p / "giftguard" / "synthesize.py").exists():
            sys.path.insert(0, str(p))
            from giftguard.synthesize import generate_universe, summarize

            return generate_universe, summarize
    raise ImportError("giftguard.synthesize not found on workspace path")


generate_universe, summarize = _import_synthesize()
data = generate_universe(n_customers=N_CUSTOMERS, n_orders=N_ORDERS, seed=42)
stats = summarize(data)
print(json.dumps(stats, indent=2))

# COMMAND ----------

volume_root = f"/Volumes/{CATALOG}/{RAW_SCHEMA}/{VOLUME_NAME}"
entities = ["customers", "brands", "orders", "redemptions", "chargebacks", "fraud_labels"]

for entity in entities:
    dest = f"{volume_root}/{entity}"
    sdf = spark.createDataFrame(data[entity])
    sdf.write.mode("overwrite").json(dest)
    print(f"Wrote {sdf.count()} rows -> {dest}")

print(f"Raw landing complete under {volume_root}")
print("DATA_SUMMARY")
print(json.dumps(stats, indent=2))
