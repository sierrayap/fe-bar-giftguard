-- Flagged-order review queue from gold serving table.
SELECT
  s.order_id,
  s.customer_id,
  s.brand_name,
  s.face_value,
  s.fraud_score,
  s.decision AS model_decision,
  s.case_summary,
  s.order_ts AS scored_at
FROM `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-card-risk-scores` s
WHERE LOWER(CAST(s.decision AS STRING)) IN ('review', 'block', 'flag', 'flagged', 'escalate')
   OR CAST(s.fraud_score AS DOUBLE) >= 0.50
ORDER BY CAST(s.fraud_score AS DOUBLE) DESC, s.order_ts DESC
LIMIT 50
