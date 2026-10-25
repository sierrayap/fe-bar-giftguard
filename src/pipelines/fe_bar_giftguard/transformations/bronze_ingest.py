from pyspark import pipelines as dp
from pyspark.sql import functions as F

CATALOG = spark.conf.get("giftguard_catalog")  # noqa: F821
RAW_SCHEMA = spark.conf.get("raw_schema")  # noqa: F821
BRONZE_SCHEMA = spark.conf.get("bronze_schema")  # noqa: F821
VOLUME_NAME = spark.conf.get("volume_name")  # noqa: F821


def bronze(table: str) -> str:
    return f"`{CATALOG}`.`{BRONZE_SCHEMA}`.`{table}`"


def volume_path(entity: str) -> str:
    return f"/Volumes/{CATALOG}/{RAW_SCHEMA}/{VOLUME_NAME}/{entity}"


def _autoload(entity: str):
    return (
        spark.readStream.format("cloudFiles")  # noqa: F821
        .option("cloudFiles.format", "json")
        .option("cloudFiles.inferColumnTypes", "true")
        .option("cloudFiles.includeExistingFiles", "true")
        .option("rescuedDataColumn", "_rescued_data")
        .load(volume_path(entity))
        .withColumn("_ingested_at", F.current_timestamp())
        .withColumn("_source_file", F.col("_metadata.file_path"))
    )


@dp.table(
    name=bronze("fe-bar-customers"),
    comment="Bronze customers — raw Auto Loader ingest from the gift-card events volume.",
    cluster_by=["customer_id"],
)
def fe_bar_customers():
    return _autoload("customers")


@dp.table(
    name=bronze("fe-bar-brands"),
    comment="Bronze brand catalog — raw Auto Loader ingest.",
    cluster_by=["brand_id"],
)
def fe_bar_brands():
    return _autoload("brands")


@dp.table(
    name=bronze("fe-bar-orders"),
    comment="Bronze gift-card orders — raw Auto Loader ingest.",
    cluster_by=["order_id"],
)
def fe_bar_orders():
    return _autoload("orders")


@dp.table(
    name=bronze("fe-bar-redemptions"),
    comment="Bronze redemptions — raw Auto Loader ingest.",
    cluster_by=["redemption_id"],
)
def fe_bar_redemptions():
    return _autoload("redemptions")


@dp.table(
    name=bronze("fe-bar-chargebacks"),
    comment="Bronze chargebacks — raw Auto Loader ingest.",
    cluster_by=["chargeback_id"],
)
def fe_bar_chargebacks():
    return _autoload("chargebacks")


@dp.table(
    name=bronze("fe-bar-fraud-labels"),
    comment="Bronze ground-truth fraud labels — training/eval only, not a serving input.",
    cluster_by=["order_id"],
)
def fe_bar_fraud_labels():
    return _autoload("fraud_labels")
