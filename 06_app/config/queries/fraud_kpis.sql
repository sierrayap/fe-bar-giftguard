-- Header snapshot over the last 30 days that actually have volume.
-- The synthetic series has a thin tail (latest calendar day is ~5 quiet orders),
-- so we ignore days with fewer than 20 orders.
WITH active AS (
  SELECT *
  FROM `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-fraud-kpis`
  WHERE order_count >= 20
),
window_end AS (
  SELECT MAX(kpi_date) AS kpi_date FROM active
)
SELECT
  w.kpi_date,
  ROUND(SUM(a.fraud_count) / NULLIF(SUM(a.order_count), 0), 4) AS fraud_rate,
  SUM(a.dollars_blocked) AS dollars_blocked,
  ROUND(
    SUM(a.false_positive_rate * a.order_count) / NULLIF(SUM(a.order_count), 0),
    4
  ) AS false_positive_rate,
  (
    SELECT COUNT(*)
    FROM `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-card-risk-scores`
    WHERE decision = 'review'
  ) AS cases_open
FROM active a
CROSS JOIN window_end w
WHERE a.kpi_date >= DATE_SUB(w.kpi_date, 29)
GROUP BY w.kpi_date
