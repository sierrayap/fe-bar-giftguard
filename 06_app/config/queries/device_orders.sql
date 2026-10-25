-- @param device_id STRING
-- Other orders seen on the same device fingerprint, across any customer.
-- This is a warehouse (gold table) query, not Lakebase -- it is useful for
-- spotting device-sharing fraud rings, which a single-customer point lookup
-- in Lakebase cannot see.
SELECT
  s.order_id,
  s.customer_id,
  s.brand_name,
  s.face_value,
  s.decision AS model_decision,
  f.order_ts
FROM `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-order-features` f
JOIN `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-card-risk-scores` s
  ON s.order_id = f.order_id
WHERE f.device_id = :device_id
ORDER BY f.order_ts DESC
LIMIT 20
