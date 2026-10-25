"""Pipeline configuration helpers.

Hyphenated UC names are quoted. Pipeline `configuration` keys from the DAB
resource are read from Spark conf.
"""

from pyspark.sql import SparkSession

spark: SparkSession  # injected by Lakeflow


def _conf(key: str, default: str) -> str:
    value = spark.conf.get(key, default)
    return value or default


CATALOG = _conf("giftguard_catalog", "sierra_yap_demo_dump_catalog")
RAW_SCHEMA = _conf("raw_schema", "fe-bar-raw")
BRONZE_SCHEMA = _conf("bronze_schema", "fe-bar-bronze")
SILVER_SCHEMA = _conf("silver_schema", "fe-bar-silver")
GOLD_SCHEMA = _conf("gold_schema", "fe-bar-gold")
VOLUME_NAME = _conf("volume_name", "fe-bar-giftcard-events")


def q(*parts: str) -> str:
    return ".".join(f"`{p}`" for p in parts)


def bronze(name: str) -> str:
    return q(CATALOG, BRONZE_SCHEMA, name)


def silver(name: str) -> str:
    return q(CATALOG, SILVER_SCHEMA, name)


def gold(name: str) -> str:
    return q(CATALOG, GOLD_SCHEMA, name)


def volume_path(entity: str) -> str:
    return f"/Volumes/{CATALOG}/{RAW_SCHEMA}/{VOLUME_NAME}/{entity}"
