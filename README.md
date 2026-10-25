# GiftGuard — Gift-Card Fraud Detection on Databricks

> **Outcome first (this run):** On **100,298** synthetic gift-card orders, GiftGuard **blocked 2,339**
> orders (**$348,380** face value; **$226,100** of that labeled fraud) and sent **4,140** to review
> (**$100,485**). Labeled fraud in the set is **$237,185**; **~80%** of fraud orders were caught at
> review or block. The fraud-ops team gets auto-generated case summaries and Genie natural-language
> analytics on the same governed gold tables.
>
> **Modeled scale (not this table):** on a ~$4M annual fraud book, a conservative catch rate maps to
> roughly **~$2.4M/year** saved. That is a model for a buyer conversation, not a claim from this demo run.
>
> _Industry: digital gift cards / fintech-retail (Prezzee-style). Built entirely on synthetic data._

---

## The problem

Digital gift cards are cash. Stolen-card purchases, account takeover, and reseller laundering show up
as chargebacks, merchant penalties, and a fraud team that cannot keep up. The business needs to
**score and triage fraudulent orders** without blocking legitimate buyers, and give fraud-ops a
queue they can actually work.

## What's built

An **integrated, end-to-end data journey** on Databricks — raw transactions in, a live fraud-ops app out:

```
  Synthetic raw           Lakeflow            Unity Catalog         ML + GenAI
  gift-card events  ──►   Declarative    ──►  governance,     ──►   fraud model +
  (UC Volume)             Pipeline            PII masking,          GenAI case
                          bronze→silver→gold  lineage               summaries
                                                   │                     │
                                                   ▼                     ▼
                              Genie Agent  ◄──  gold tables  ──►  Lakebase (Postgres)
                              NL analytics      (scores, KPIs)     low-latency serving
                                   │                                     │
                                   └──────────►  Databricks App  ◄───────┘
                                                 Fraud-Ops console
```

| Layer | What it does |
|-------|--------------|
| **Raw data** | Synthetic gift-card dataset (customers, orders, redemptions, chargebacks) landed as raw files in a UC Volume, with injected fraud patterns (velocity, device fan-out, geo mismatch, new-account bursts). |
| **Lakeflow** | Declarative Pipeline: Auto Loader into bronze streaming tables; silver/gold materialized views with data-quality expectations. |
| **Unity Catalog** | Comments, PII tagging + column masking on email/IP/payment fields, end-to-end lineage. |
| **Lakebase** | Gold risk scores loaded into Postgres for **sub-second point lookups** (demo lookup ~209–414 ms). |
| **ML + GenAI** | XGBoost fraud classifier (MLflow → UC Model Registry) scores each order; `ai_query()` writes plain-English case summaries for flagged orders. |
| **Genie Agent** | Genie Space over gold fraud tables for questions like "How much face value did we block versus review?" |
| **Databricks App** | Fraud-Ops console: KPI header, review queue, case detail + GenAI summary, Approve/Block/Escalate, Lakebase inspector, embedded Genie. |

## Business impact (this run)

| Metric | Result |
|--------|--------|
| Orders scored | **100,298** |
| Allow / Review / Block | **93,819** / **4,140** / **2,339** |
| Block face value | **$348,380** ($226,100 labeled fraud) |
| Review face value | **$100,485** |
| Total labeled fraud | **$237,185** |
| Fraud catch (review + block) | **~80%** of labeled fraud orders |
| Flag rate on all orders | **~5.2%** (mostly review, not hard decline) |
| Lakebase point lookup | **~209–414 ms** for a blocked order |
| Model (AUC-PR / ROC-AUC) | **0.583** / **0.883** |

Full text evidence lives in the numbered folders and `EXECUTION_EVIDENCE.md`.

## Repository map

| Path | Contents |
|------|----------|
| `00_synthetic_data/` | Data generator + printed data summary |
| `01_lakeflow_pipeline/` | Pipeline notebooks + run summary & expectation pass rates |
| `02_unity_catalog/` | DDL, PII tags/masking, lineage (as text) |
| `03_lakebase/` | Lakebase sync + serving-query evidence (with latency) |
| `04_ml_genai/` | Training notebook, MLflow metrics, GenAI summaries |
| `05_genie/` | Genie Space config + NL → SQL → result transcripts |
| `06_app/` | Databricks App (`app.yaml` + source) |
| `deck/` | Buyer presentation (`giftguard.md`) + HTML slides for live talk |
| `TALK_TRACK.md` | Spoken demo / Yoodli script |
| `EXECUTION_EVIDENCE.md` | Workspace resource links + headline numbers |
| `DECISIONS.md` | Key decisions & trade-offs |

## How to read the evidence

Follow the numbered folders top to bottom. Every stage commits **text-readable proof it ran** —
pipeline events, query results, model metrics, Genie transcripts — so the build can be verified
without opening the workspace UI.

## Workspace and naming

- Host: `https://fevm-sierra-yap-demo-dump.cloud.databricks.com`
- CLI profile: `fevm-sierra-yap-demo-dump`
- Catalog: `sierra_yap_demo_dump_catalog` (only name that is not `fe-bar`-prefixed)
- Schemas: `fe-bar-raw`, `fe-bar-bronze`, `fe-bar-silver`, `fe-bar-gold`, `fe-bar-ml`
- Volume: `fe-bar-giftcard-events`
- Jobs: `fe-bar-setup-and-generate`, `fe-bar-ml-train-score`
- Pipeline: `fe-bar-fraud-pipeline`
- Model: `fe-bar-fraud-classifier`
- App: `fe-bar-giftguard-fraud-ops`

Deploy with `databricks bundle deploy -t demo --profile fevm-sierra-yap-demo-dump`.
Demo scale is 5k customers / ~100k orders.

## Notes

- Built entirely on **synthetic data** — no real customer data of any kind.
- Scoring in this demo is **batch into Lakebase**, not a live Model Serving endpoint at checkout.
  The UC-registered model is ready for a serving deploy when you want real-time.
- AI coding tools were used to build this (documented in `DECISIONS.md`); the design, decisions,
  and narrative are the author's own.
