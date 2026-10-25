from pyspark import pipelines as dp
from pyspark.sql import functions as F
from pyspark.sql.window import Window

CATALOG = spark.conf.get("giftguard_catalog")  # noqa: F821
SILVER_SCHEMA = spark.conf.get("silver_schema")  # noqa: F821
GOLD_SCHEMA = spark.conf.get("gold_schema")  # noqa: F821


def silver(table: str) -> str:
    return f"`{CATALOG}`.`{SILVER_SCHEMA}`.`{table}`"


def gold(table: str) -> str:
    return f"`{CATALOG}`.`{GOLD_SCHEMA}`.`{table}`"


@dp.materialized_view(
    name=gold("fe-bar-order-features"),
    comment="Gold order-level fraud features: velocity, device fan-out, geo mismatch, account age.",
    cluster_by=["order_id"],
)
@dp.expect_or_drop("order_id_present", "order_id IS NOT NULL")
@dp.expect("non_negative_velocity", "customer_orders_1h >= 1")
def gold_order_features():
    orders = spark.read.table(silver("fe-bar-orders-enriched"))  # noqa: F821
    chargebacks = spark.read.table(silver("fe-bar-chargebacks")).select(  # noqa: F821
        F.col("order_id").alias("cb_order_id")
    )
    labels = spark.read.table(silver("fe-bar-fraud-labels")).select(  # noqa: F821
        "order_id", F.col("is_fraud").alias("label_is_fraud")
    )

    device_fanout = orders.groupBy("device_id").agg(
        F.approx_count_distinct("customer_id").alias("device_account_count")
    )

    ts_sec = F.col("order_ts").cast("long")
    w_cust = Window.partitionBy("customer_id").orderBy(ts_sec)
    w_1h = w_cust.rangeBetween(-3600, 0)
    w_24h = w_cust.rangeBetween(-86400, 0)

    featured = (
        orders.join(device_fanout, "device_id", "left")
        .withColumn(
            "account_age_hours",
            (F.col("order_ts").cast("long") - F.col("customer_signup_ts").cast("long")) / 3600.0,
        )
        .withColumn("is_new_account", (F.col("account_age_hours") < 48).cast("int"))
        .withColumn("customer_orders_1h", F.count("order_id").over(w_1h).cast("int"))
        .withColumn("customer_orders_24h", F.count("order_id").over(w_24h).cast("int"))
        .withColumn("customer_amount_24h", F.sum("face_value").over(w_24h).cast("int"))
        .withColumn(
            "geo_mismatch",
            (
                (F.col("ip_country") != F.col("account_country"))
                | (F.col("payment_country") != F.col("account_country"))
                | (F.col("ip_country") != F.col("payment_country"))
            ).cast("int"),
        )
        .withColumn(
            "is_max_denomination",
            (F.col("face_value") >= F.col("max_denomination")).cast("int"),
        )
        .withColumn("instant_redeem_brand", F.col("instant_redeem").cast("int"))
        .join(chargebacks, orders.order_id == chargebacks.cb_order_id, "left")
        .withColumn("has_chargeback", F.col("cb_order_id").isNotNull().cast("int"))
        .drop("cb_order_id")
        .join(labels, "order_id", "left")
        .select(
            "order_id",
            "customer_id",
            "brand_id",
            "brand_name",
            "order_ts",
            "face_value",
            "payment_method",
            "card_last4",
            "ip_address",
            "customer_email",
            "account_country",
            "ip_country",
            "payment_country",
            "device_id",
            F.round("account_age_hours", 2).alias("account_age_hours"),
            "is_new_account",
            "customer_orders_1h",
            "customer_orders_24h",
            "customer_amount_24h",
            F.coalesce("device_account_count", F.lit(1)).alias("device_account_count"),
            "geo_mismatch",
            "is_max_denomination",
            "instant_redeem_brand",
            "has_chargeback",
            F.col("label_is_fraud").cast("int").alias("is_fraud"),
        )
    )
    return featured


@dp.materialized_view(
    name=gold("fe-bar-label-kpis"),
    comment="Gold daily label-based KPI preview (actual fraud rate). Model $ blocked is written by the ML job.",
    cluster_by=["kpi_date"],
)
def gold_label_kpis():
    feats = spark.read.table(gold("fe-bar-order-features"))  # noqa: F821
    return (
        feats.withColumn("kpi_date", F.to_date("order_ts"))
        .groupBy("kpi_date")
        .agg(
            F.count("*").alias("order_count"),
            F.sum("is_fraud").alias("fraud_count"),
            F.round(F.avg("is_fraud"), 4).alias("fraud_rate"),
            F.sum(F.when(F.col("is_fraud") == 1, F.col("face_value")).otherwise(0)).alias(
                "fraud_face_value"
            ),
            F.sum("face_value").alias("gmv_face_value"),
        )
    )
