# Lakebase serving (config only — not provisioned)

Checkout cannot wait on a lakehouse scan. `gold`.`fe-bar-card-risk-scores` and
`gold`.`fe-bar-card-status` are the OLTP serving copies.

**Why Lakebase vs Delta:** Delta is the analytical system of record (Genie,
KPI trends, retraining). Lakebase is Postgres for **primary-key lookups**
(`order_id`) at checkout latency. Same governed gold table, different engine.

## Intended resources (all `fe-bar` prefixed)

| Resource | Name |
|----------|------|
| Lakebase project | `fe-bar-serving` |
| Synced table | `fe-bar-card-risk-scores` |
| Status lookup | `fe-bar-card-status` |
| Source | `sierra_yap_demo_dump_catalog`.`fe-bar-gold`.`fe-bar-card-risk-scores` |

Autoscaling Lakebase (not the retired provisioned tier):

```bash
# After workspace deploy of gold tables — do not run until asked
databricks postgres --help
```

See `sync.sh` for the intended synced-table flow and `QUERY_EVIDENCE.md` for
the lookup the app will issue.
