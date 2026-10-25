-- Table + column comments. Gold comments are what Genie reads — keep them business-facing.

COMMENT ON TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` IS
  'One row per gift-card order with engineered fraud features: 1h/24h velocity, device fan-out, geo mismatch, account age, max-denomination and instant-brand flags. Train/score input for fe-bar-fraud-classifier.';

COMMENT ON TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-card-risk-scores` IS
  'Serving table: model score, allow/review/block decision, and GenAI case summary per order. Synced to Lakebase for checkout lookups; queried by Genie and the Fraud-Ops app.';

COMMENT ON TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-fraud-kpis` IS
  'Daily aggregates for the business: order count, fraud rate, dollars blocked, false-positive rate, open review cases.';

COMMENT ON TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-card-status` IS
  'Thin point-lookup of order_id → card_status + fraud_score for checkout. Prefer Lakebase over Delta for this path.';

COMMENT ON TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-label-kpis` IS
  'Label-only daily fraud rate from the Lakeflow pipeline (before model scores exist).';

ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN order_id COMMENT 'Gift-card order identifier';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN customer_id COMMENT 'Synthetic customer identifier';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN brand_name COMMENT 'Gift-card brand / merchant name';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN face_value COMMENT 'Card face value in the order currency';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN account_age_hours COMMENT 'Hours between customer signup and this order';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN is_new_account COMMENT '1 if account is younger than 48 hours';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN customer_orders_1h COMMENT 'Orders from this customer in the prior 1 hour (inclusive)';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN customer_orders_24h COMMENT 'Orders from this customer in the prior 24 hours';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN customer_amount_24h COMMENT 'Sum of face_value from this customer in the prior 24 hours';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN device_account_count COMMENT 'Distinct customers observed on this device_id (ATO / device fan-out)';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN geo_mismatch COMMENT '1 if account, IP, and payment countries are not all equal';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN is_max_denomination COMMENT '1 if face_value is at the brand maximum';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN instant_redeem_brand COMMENT '1 if the brand is instantly redeemable (higher cash-out risk)';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-order-features` ALTER COLUMN is_fraud COMMENT 'Ground-truth label for training/eval only — do not use as a serving feature';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-fraud-kpis` ALTER COLUMN kpi_date COMMENT 'UTC calendar date of the orders in the aggregate';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-fraud-kpis` ALTER COLUMN dollars_blocked COMMENT 'Face value of true-positive blocked orders that day';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-fraud-kpis` ALTER COLUMN false_positive_rate COMMENT 'Share of legitimate orders that were flagged review or block';
ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-fraud-kpis` ALTER COLUMN cases_open COMMENT 'Orders currently in the review queue';
