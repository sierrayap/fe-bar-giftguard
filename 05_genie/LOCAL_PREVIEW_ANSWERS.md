# Genie live transcripts — fe-bar GiftGuard Fraud Analytics

Space ID: `01f1cb6b49081479ab1dcbb15703bb42`
Captured 2026-10-22 via `databricks genie list-conversations` / `list-conversation-messages` / `start-conversation`.
CLI profile: `fevm-sierra-yap-demo-dump`.

These are live Conversation API answers, not local stand-ins.

## Q1. How much face value did we block versus review?

Conversation: `01f1cb6c8cee11d8a6a059c90e596aa4`
Message: `01f1cb6c8d00175ca7c08af3e8cb89b8`
Status: COMPLETED
Statement: `01f1cb6c-9003-1cda-8eb8-0c32228da6d6`

Generated SQL:

```sql
SELECT `decision`, COUNT(*) AS `orders`, SUM(`face_value`) AS `usd`
FROM `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-card-risk-scores`
WHERE `decision` IS NOT NULL
  AND `face_value` IS NOT NULL
  AND `decision` IN ('block', 'review')
GROUP BY `decision`
ORDER BY `usd` DESC
```

Result:

```text
decision  orders  usd
block     2339    348380
review    4140    100485
```

Genie answer (verbatim):

```text
We blocked $348,380 in face value versus $100,485 sent to review. Block also
covered fewer orders (2,339) than review (4,140), which means the average
face value per blocked order was higher.
```

## Q2. What is the labeled fraud rate by brand across the full gold table, not just last week?

Conversation: `01f1cda6c11a1cfa81bb752c7eb87623`
Status: COMPLETED
Statement: `01f1cda6-c457-17f3-a870-1ce832a5288f`
Result rows: 50

Generated SQL:

```sql
SELECT `brand_name`,
       COUNT(*) AS `order_count`,
       SUM(`is_fraud`) AS `fraud_count`,
       100 * TRY_DIVIDE(SUM(`is_fraud`), COUNT(*)) AS `labeled_fraud_rate`
FROM `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-order-features`
WHERE `brand_name` IS NOT NULL
GROUP BY `brand_name`
ORDER BY `labeled_fraud_rate` DESC, `order_count` DESC
```

Genie answer (verbatim excerpt):

```text
Across the full gold table, Bunnings has the highest labeled fraud rate at
11.03% (247 of 2,239 orders), while the other brands shown are much lower,
ranging from 1.75% down to 0.73%. Examples include:
- Bunnings — 11.03% labeled fraud rate (247 of 2,239 orders)
- Myer — 1.75% (34 of 1,940)
- Bose — 1.74% (35 of 2,013)
- Cotton On Kids — 1.71% (35 of 2,050)
- Dan Murphy's — 0.73% (14 of 1,929)
```

Warehouse confirmation of the same ranking (top 8):

```text
brand_name       orders  fraud  fraud_rate  fraud_face_value
Bunnings           2239    247      0.1103            118400
Myer               1940     34      0.0175              3830
Bose               2013     35      0.0174              3500
Cotton On Kids     2050     35      0.0171              1135
Prezzee Choice     1972     33      0.0167              5020
Uber               1991     33      0.0166              2815
The Iconic         2015     33      0.0164              4035
Rebel              1977     32      0.0162              2965
```

## Q3. Show the top 10 highest-value blocked orders overall, not just yesterday.

Conversation: `01f1cda6ae281c7a83cf4f880d0fd9fe`
Status: COMPLETED
Result rows: 10

Generated SQL:

```sql
SELECT order_id, brand_name, face_value, fraud_score, decision
FROM `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-card-risk-scores`
WHERE decision = 'block' AND face_value IS NOT NULL
ORDER BY face_value DESC
LIMIT 10
```

Genie answer (verbatim excerpt):

```text
Examples include these 10 highest-value blocked orders overall shown in the
results; all have a face value of 500, so there is a tie at the top.

- Bunnings — order ord-00098757 — 500 — fraud score 0.9907
- Bunnings — order ord-00098721 — 500 — fraud score 0.9951
- Bunnings — order ord-00098730 — 500 — fraud score 0.9931
- Bunnings — order ord-00098661 — 500 — fraud score 0.9946
- Bunnings — order ord-00098724 — 500 — fraud score 0.9949

Across all 10 returned orders, Bunnings appears 9 times and Harvey Norman
appears once, with fraud scores ranging from 0.9744 to 0.9953.
```

Warehouse confirmation (same filter):

```text
order_id       brand_name  face_value  decision
ord-00098728   Bunnings           500  block
ord-00098729   Bunnings           500  block
ord-00098765   Bunnings           500  block
ord-00098723   Bunnings           500  block
ord-00098726   Bunnings           500  block
ord-00098727   Bunnings           500  block
ord-00098521   Bunnings           500  block
ord-00098752   Bunnings           500  block
ord-00098563   Bunnings           500  block
ord-00098544   Bunnings           500  block
```

## Note on the original starter questions that say "last week" / "yesterday"

Those questions were also asked live. The synthetic series has a thin tail, so
Genie correctly returned almost nothing:

- Conversation `01f1cda320701128bfd0284acce2200c`
  Q: "What was the fraud rate by brand last week?"
  A: "Last week, Target had 7 orders, 0 fraudulent orders, and a fraud rate of 0.0%."
- Conversation `01f1cd14a9e71ce790d65991d1f3ef56`
  Q: "Show the top 10 highest-value blocked orders yesterday."
  A: "There were no blocked orders returned for yesterday in this data."

Use Q1–Q3 above in the talk track; they are the live answers over the full gold table.
