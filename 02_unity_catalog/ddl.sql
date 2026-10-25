-- GiftGuard Unity Catalog DDL
-- Catalog is the sole identifier that does not start with fe-bar.
-- Hyphenated schemas/tables MUST be quoted.

CREATE SCHEMA IF NOT EXISTS sierra_yap_demo_dump_catalog.`fe-bar-raw`
COMMENT 'GiftGuard raw landing zone — UC Volume of synthetic gift-card events';

CREATE SCHEMA IF NOT EXISTS sierra_yap_demo_dump_catalog.`fe-bar-bronze`
COMMENT 'GiftGuard bronze — Auto Loader append-only ingest of raw files';

CREATE SCHEMA IF NOT EXISTS sierra_yap_demo_dump_catalog.`fe-bar-silver`
COMMENT 'GiftGuard silver — typed, deduped, quality-checked entities';

CREATE SCHEMA IF NOT EXISTS sierra_yap_demo_dump_catalog.`fe-bar-gold`
COMMENT 'GiftGuard gold — order features, risk scores, and fraud KPIs';

CREATE SCHEMA IF NOT EXISTS sierra_yap_demo_dump_catalog.`fe-bar-ml`
COMMENT 'GiftGuard ML — registered model, mask functions, experiment artifacts';

CREATE VOLUME IF NOT EXISTS sierra_yap_demo_dump_catalog.`fe-bar-raw`.`fe-bar-giftcard-events`
COMMENT 'Raw JSON gift-card events for fe-bar-fraud-pipeline';

-- Mask functions: unmasked for account group fe-bar-fraud-ops (create before the demo)
-- or the deploying engineer.
CREATE OR REPLACE FUNCTION sierra_yap_demo_dump_catalog.`fe-bar-ml`.`fe-bar-mask-email`(email STRING)
RETURN CASE
  WHEN is_account_group_member('fe-bar-fraud-ops') THEN email
  WHEN current_user() LIKE '%sierra.yap%' THEN email
  ELSE regexp_replace(email, '^[^@]+', '****')
END;

CREATE OR REPLACE FUNCTION sierra_yap_demo_dump_catalog.`fe-bar-ml`.`fe-bar-mask-ip`(ip STRING)
RETURN CASE
  WHEN is_account_group_member('fe-bar-fraud-ops') THEN ip
  WHEN current_user() LIKE '%sierra.yap%' THEN ip
  ELSE regexp_replace(ip, '(\\d+)\\.(\\d+)\\.(\\d+)\\.(\\d+)', '*.*.*.$4')
END;

CREATE OR REPLACE FUNCTION sierra_yap_demo_dump_catalog.`fe-bar-ml`.`fe-bar-mask-card`(last4 STRING)
RETURN CASE
  WHEN is_account_group_member('fe-bar-fraud-ops') THEN last4
  WHEN current_user() LIKE '%sierra.yap%' THEN last4
  ELSE concat('****', right(last4, 4))
END;

-- Applied after fe-bar-ml-train-score writes the serving table:
-- ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-card-risk-scores`
--   ALTER COLUMN email SET MASK sierra_yap_demo_dump_catalog.`fe-bar-ml`.`fe-bar-mask-email`;
-- ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-card-risk-scores`
--   ALTER COLUMN ip_address SET MASK sierra_yap_demo_dump_catalog.`fe-bar-ml`.`fe-bar-mask-ip`;
-- ALTER TABLE sierra_yap_demo_dump_catalog.`fe-bar-gold`.`fe-bar-card-risk-scores`
--   ALTER COLUMN card_last4 SET MASK sierra_yap_demo_dump_catalog.`fe-bar-ml`.`fe-bar-mask-card`;
