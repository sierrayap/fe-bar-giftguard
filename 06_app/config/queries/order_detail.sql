-- @param order_id STRING
SELECT
  s.order_id,
  s.customer_id,
  s.brand_name,
  s.face_value,
  s.fraud_score,
  s.decision AS model_decision,
  s.case_summary,
  s.order_ts AS scored_at,
  s.email,
  s.ip_address,
  s.card_last4,
  s.is_fraud,
  f.payment_method,
  f.order_ts,
  f.account_age_hours,
  f.customer_orders_1h AS velocity_1h,
  f.customer_orders_24h AS velocity_24h,
  f.device_account_count AS device_fanout,
  f.geo_mismatch,
  f.ip_country,
  f.account_country,
  f.device_id
FROM `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-card-risk-scores` s
LEFT JOIN `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-order-features` f
  ON s.order_id = f.order_id
WHERE s.order_id = :order_id
LIMIT 1
