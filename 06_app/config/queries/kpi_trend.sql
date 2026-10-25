-- Daily KPIs for the last 90 days of days that actually have volume.
-- Skips the quiet tail of the synthetic series so the chart is not a flat zero line.
WITH active AS (
  SELECT *
  FROM `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-fraud-kpis`
  WHERE order_count >= 20
),
window_end AS (
  SELECT MAX(kpi_date) AS kpi_date FROM active
)
SELECT
  a.kpi_date,
  a.fraud_rate,
  a.dollars_blocked,
  a.false_positive_rate
FROM active a
CROSS JOIN window_end w
WHERE a.kpi_date >= DATE_SUB(w.kpi_date, 89)
ORDER BY a.kpi_date
LIMIT 90
