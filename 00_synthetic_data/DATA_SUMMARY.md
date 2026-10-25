# GiftGuard synthetic data summary

Generated 2026-10-18 23:39 UTC with `src/giftguard/synthesize.py` seed=42.

Workspace job `fe-bar-setup-and-generate` wrote the same universe as JSON
under `/Volumes/sierra_yap_demo_dump_catalog/fe-bar-raw/fe-bar-giftcard-events/`.

Live job run (CLI `jobs get-run`):

```text
job: fe-bar-setup-and-generate
job_id: 358418634243564
run_id: 549118035440036
result_state: SUCCESS
start: 2026-10-19T02:57:44.751Z
end:   2026-10-19T02:59:02.437Z
run_page: https://fevm-sierra-yap-demo-dump.cloud.databricks.com/jobs/358418634243564/runs/549118035440036?o=7474656648208740
```

Live bronze counts after the pipeline (warehouse `67a31e849c302489`, 2026-10-22)
match the generator: customers 5000, brands 50, orders 100298, redemptions 78369,
chargebacks 1014, fraud_labels 100298.

## Row counts

| Entity | Rows |
|--------|------|
| customers | 5000 |
| brands | 50 |
| orders | 100298 |
| redemptions | 78369 |
| chargebacks | 1014 |
| fraud_labels | 100298 |

## Class balance

| Metric | Value |
|--------|-------|
| Fraud orders | 1532 |
| Fraud base rate | 1.53% |
| Fraud face value (synth currency units) | 237,185 |
| Local gold features engineered | 100,298 |

## Injected fraud pattern tags (non-exclusive)

| Tag | Orders |
|-----|--------|
| face_value_skew | 914 |
| new_account_burst | 865 |
| geo_mismatch | 599 |
| friendly_fraud_noise | 398 |
| unlabeled_fraud | 366 |
| instant_brand | 366 |
| velocity | 224 |
| device_fanout | 45 |
| ato_ring | 45 |

## Sample raw orders (first 5, not a random sample)

```json
[
  {
    "order_id": "ord-00000001",
    "customer_id": "cus-00003097",
    "brand_id": "brd-00000020",
    "face_value": 25,
    "payment_method": "mastercard",
    "card_last4": "7638",
    "device_id": "dev-623637-6420",
    "ip_address": "160.97.63.226",
    "ip_country": "GB",
    "payment_country": "GB",
    "order_ts": "2025-09-14T14:58:06Z",
    "currency": "USD"
  },
  {
    "order_id": "ord-00000002",
    "customer_id": "cus-00001428",
    "brand_id": "brd-00000049",
    "face_value": 10,
    "payment_method": "amex",
    "card_last4": "4424",
    "device_id": "dev-215593-8383",
    "ip_address": "32.204.9.22",
    "ip_country": "US",
    "payment_country": "NZ",
    "order_ts": "2025-06-03T20:51:36Z",
    "currency": "AUD"
  },
  {
    "order_id": "ord-00000003",
    "customer_id": "cus-00004726",
    "brand_id": "brd-00000039",
    "face_value": 25,
    "payment_method": "apple_pay",
    "card_last4": "7208",
    "device_id": "dev-722748-3519",
    "ip_address": "11.60.241.1",
    "ip_country": "NZ",
    "payment_country": "NZ",
    "order_ts": "2024-08-16T11:59:05Z",
    "currency": "AUD"
  },
  {
    "order_id": "ord-00000004",
    "customer_id": "cus-00004215",
    "brand_id": "brd-00000050",
    "face_value": 25,
    "payment_method": "visa",
    "card_last4": "7856",
    "device_id": "dev-847391-4289",
    "ip_address": "130.52.28.121",
    "ip_country": "NZ",
    "payment_country": "NZ",
    "order_ts": "2025-07-27T09:18:35Z",
    "currency": "AUD"
  },
  {
    "order_id": "ord-00000005",
    "customer_id": "cus-00002337",
    "brand_id": "brd-00000004",
    "face_value": 10,
    "payment_method": "apple_pay",
    "card_last4": "6214",
    "device_id": "dev-823176-8339",
    "ip_address": "126.77.150.106",
    "ip_country": "US",
    "payment_country": "US",
    "order_ts": "2024-06-02T21:44:21Z",
    "currency": "USD"
  }
]
```

All identifiers, emails, IPs, and card last-4s are synthetic.
