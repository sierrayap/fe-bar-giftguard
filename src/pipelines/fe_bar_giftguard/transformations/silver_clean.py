from pyspark import pipelines as dp
from pyspark.sql import functions as F
from pyspark.sql.window import Window

CATALOG = spark.conf.get("giftguard_catalog")  # noqa: F821
BRONZE_SCHEMA = spark.conf.get("bronze_schema")  # noqa: F821
SILVER_SCHEMA = spark.conf.get("silver_schema")  # noqa: F821


def bronze(table: str) -> str:
    return f"`{CATALOG}`.`{BRONZE_SCHEMA}`.`{table}`"


def silver(table: str) -> str:
    return f"`{CATALOG}`.`{SILVER_SCHEMA}`.`{table}`"


def _latest(df, key: str, ts_col: str):
    w = Window.partitionBy(key).orderBy(F.col(ts_col).desc(), F.col("_ingested_at").desc())
    return (
        df.withColumn("_rn", F.row_number().over(w))
        .filter(F.col("_rn") == 1)
        .drop("_rn")
    )


@dp.materialized_view(
    name=silver("fe-bar-customers"),
    comment="Silver customers — typed, latest row per customer_id.",
    cluster_by=["customer_id"],
)
@dp.expect_or_drop("customer_id_present", "customer_id IS NOT NULL")
@dp.expect("email_looks_valid", "email IS NOT NULL AND email LIKE '%@%'")
@dp.expect("country_present", "country IS NOT NULL")
def silver_customers():
    src = spark.read.table(bronze("fe-bar-customers"))  # noqa: F821
    typed = (
        src.select(
            F.col("customer_id").cast("string").alias("customer_id"),
            F.to_timestamp("signup_ts").alias("signup_ts"),
            F.col("email").cast("string").alias("email"),
            F.col("country").cast("string").alias("country"),
            F.col("device_ids"),
            F.col("_ingested_at"),
            F.col("_source_file"),
            F.col("_rescued_data"),
        )
        .filter(F.col("_rescued_data").isNull())
    )
    return _latest(typed, "customer_id", "signup_ts")


@dp.materialized_view(
    name=silver("fe-bar-brands"),
    comment="Silver brand catalog — typed and deduped.",
    cluster_by=["brand_id"],
)
@dp.expect_or_drop("brand_id_present", "brand_id IS NOT NULL")
@dp.expect("max_denomination_positive", "max_denomination > 0")
def silver_brands():
    src = spark.read.table(bronze("fe-bar-brands"))  # noqa: F821
    typed = src.select(
        F.col("brand_id").cast("string").alias("brand_id"),
        F.col("brand_name").cast("string").alias("brand_name"),
        F.col("max_denomination").cast("int").alias("max_denomination"),
        F.col("instant_redeem").cast("boolean").alias("instant_redeem"),
        F.col("category").cast("string").alias("category"),
        F.col("_ingested_at"),
        F.col("_source_file"),
        F.col("_rescued_data"),
    )
    w = Window.partitionBy("brand_id").orderBy(F.col("_ingested_at").desc())
    return typed.withColumn("_rn", F.row_number().over(w)).filter(F.col("_rn") == 1).drop("_rn")


@dp.materialized_view(
    name=silver("fe-bar-orders"),
    comment="Silver orders — typed, deduped, referential checks vs customers and brands.",
    cluster_by=["order_id"],
)
@dp.expect_or_drop("order_id_present", "order_id IS NOT NULL")
@dp.expect_or_drop("customer_id_present", "customer_id IS NOT NULL")
@dp.expect("face_value_positive", "face_value > 0")
@dp.expect("face_value_reasonable", "face_value <= 1000")
@dp.expect("known_customer", "customer_found")
@dp.expect("known_brand", "brand_found")
def silver_orders():
    orders = spark.read.table(bronze("fe-bar-orders"))  # noqa: F821
    customers = spark.read.table(silver("fe-bar-customers")).select(  # noqa: F821
        F.col("customer_id").alias("_c_id")
    )
    brands = spark.read.table(silver("fe-bar-brands")).select(F.col("brand_id").alias("_b_id"))  # noqa: F821
    typed = (
        orders.select(
            F.col("order_id").cast("string").alias("order_id"),
            F.col("customer_id").cast("string").alias("customer_id"),
            F.col("brand_id").cast("string").alias("brand_id"),
            F.col("face_value").cast("int").alias("face_value"),
            F.col("payment_method").cast("string").alias("payment_method"),
            F.col("card_last4").cast("string").alias("card_last4"),
            F.col("device_id").cast("string").alias("device_id"),
            F.col("ip_address").cast("string").alias("ip_address"),
            F.col("ip_country").cast("string").alias("ip_country"),
            F.col("payment_country").cast("string").alias("payment_country"),
            F.to_timestamp("order_ts").alias("order_ts"),
            F.col("currency").cast("string").alias("currency"),
            F.col("_ingested_at"),
            F.col("_source_file"),
            F.col("_rescued_data"),
        )
        .filter(F.col("_rescued_data").isNull())
    )
    typed = _latest(typed, "order_id", "order_ts")
    typed = typed.join(customers, typed.customer_id == customers["_c_id"], "left")
    typed = typed.join(brands, typed.brand_id == brands["_b_id"], "left")
    return typed.withColumn("customer_found", F.col("_c_id").isNotNull()).withColumn(
        "brand_found", F.col("_b_id").isNotNull()
    ).drop("_c_id", "_b_id")


@dp.materialized_view(
    name=silver("fe-bar-redemptions"),
    comment="Silver redemptions — typed and deduped.",
    cluster_by=["redemption_id"],
)
@dp.expect_or_drop("redemption_id_present", "redemption_id IS NOT NULL")
@dp.expect("order_id_present", "order_id IS NOT NULL")
def silver_redemptions():
    src = spark.read.table(bronze("fe-bar-redemptions"))  # noqa: F821
    typed = src.select(
        F.col("redemption_id").cast("string").alias("redemption_id"),
        F.col("order_id").cast("string").alias("order_id"),
        F.col("redeemer_id").cast("string").alias("redeemer_id"),
        F.col("channel").cast("string").alias("channel"),
        F.to_timestamp("redeem_ts").alias("redeem_ts"),
        F.col("_ingested_at"),
        F.col("_source_file"),
        F.col("_rescued_data"),
    )
    return _latest(typed, "redemption_id", "redeem_ts")


@dp.materialized_view(
    name=silver("fe-bar-chargebacks"),
    comment="Silver chargebacks — delayed disputes used as a partial label signal.",
    cluster_by=["chargeback_id"],
)
@dp.expect_or_drop("chargeback_id_present", "chargeback_id IS NOT NULL")
@dp.expect("amount_positive", "amount > 0")
def silver_chargebacks():
    src = spark.read.table(bronze("fe-bar-chargebacks"))  # noqa: F821
    typed = src.select(
        F.col("chargeback_id").cast("string").alias("chargeback_id"),
        F.col("order_id").cast("string").alias("order_id"),
        F.col("reason").cast("string").alias("reason"),
        F.col("amount").cast("int").alias("amount"),
        F.to_timestamp("chargeback_ts").alias("chargeback_ts"),
        F.col("_ingested_at"),
        F.col("_source_file"),
        F.col("_rescued_data"),
    )
    return _latest(typed, "chargeback_id", "chargeback_ts")


@dp.materialized_view(
    name=silver("fe-bar-fraud-labels"),
    comment="Silver ground-truth labels — one row per order, training/eval only.",
    cluster_by=["order_id"],
)
@dp.expect_or_drop("order_id_present", "order_id IS NOT NULL")
@dp.expect("label_is_boolean", "is_fraud IS NOT NULL")
def silver_fraud_labels():
    src = spark.read.table(bronze("fe-bar-fraud-labels"))  # noqa: F821
    typed = src.select(
        F.col("order_id").cast("string").alias("order_id"),
        F.col("is_fraud").cast("boolean").alias("is_fraud"),
        F.col("fraud_tags"),
        F.col("_ingested_at"),
        F.col("_rescued_data"),
    )
    w = Window.partitionBy("order_id").orderBy(F.col("_ingested_at").desc())
    return typed.withColumn("_rn", F.row_number().over(w)).filter(F.col("_rn") == 1).drop("_rn")


@dp.materialized_view(
    name=silver("fe-bar-orders-enriched"),
    comment="Silver orders joined to customers and brands — the clean fact used by gold features.",
    cluster_by=["order_id"],
)
def silver_orders_enriched():
    orders = spark.read.table(silver("fe-bar-orders"))  # noqa: F821
    customers = spark.read.table(silver("fe-bar-customers")).select(  # noqa: F821
        "customer_id",
        F.col("signup_ts").alias("customer_signup_ts"),
        F.col("email").alias("customer_email"),
        F.col("country").alias("account_country"),
        F.col("device_ids").alias("account_device_ids"),
    )
    brands = spark.read.table(silver("fe-bar-brands")).select(  # noqa: F821
        "brand_id", "brand_name", "max_denomination", "instant_redeem", "category"
    )
    return orders.join(customers, "customer_id", "inner").join(brands, "brand_id", "inner")
