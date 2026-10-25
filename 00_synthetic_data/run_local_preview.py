#!/usr/bin/env python3
"""Local preview: generate demo-scale data, engineer features, train a classifier.

Writes text evidence under 00_synthetic_data/ and 04_ml_genai/. This is NOT the
workspace MLflow run — it proves the generator and metric story before deploy.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from giftguard.synthesize import engineer_order_features, generate_universe, summarize  # noqa: E402


def main() -> None:
    data = generate_universe(n_customers=5000, n_orders=100000, seed=42)
    stats = summarize(data)
    features = engineer_order_features(data)

    out = Path(__file__).resolve().parent
    (out / "DATA_SUMMARY.md").write_text(_summary_md(stats, data, features), encoding="utf-8")
    (out / "DATA_SUMMARY.json").write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")

    ml_dir = ROOT / "04_ml_genai"
    ml_dir.mkdir(exist_ok=True)
    metrics = _train_preview(features)
    (ml_dir / "LOCAL_PREVIEW_METRICS.md").write_text(_metrics_md(metrics), encoding="utf-8")
    (ml_dir / "LOCAL_PREVIEW_METRICS.json").write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")

    genie_dir = ROOT / "05_genie"
    genie_dir.mkdir(exist_ok=True)
    (genie_dir / "LOCAL_PREVIEW_ANSWERS.md").write_text(_genie_md(features, metrics), encoding="utf-8")

    print(json.dumps({"stats": stats, "metrics": metrics}, indent=2, default=str))


def _summary_md(stats: dict, data: dict, features: list[dict]) -> str:
    sample = data["orders"][:5]
    tag_lines = "\n".join(f"| {k} | {v} |" for k, v in stats["fraud_tag_counts"].items())
    return f"""# GiftGuard synthetic data summary (local preview)

Generated {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")} UTC with `src/giftguard/synthesize.py` seed=42.

> Workspace job `fe-bar-setup-and-generate` writes the same universe as JSON
> under `/Volumes/sierra_yap_demo_dump_catalog/fe-bar-raw/fe-bar-giftcard-events/`.

## Row counts

| Entity | Rows |
|--------|------|
| customers | {stats["customers"]} |
| brands | {stats["brands"]} |
| orders | {stats["orders"]} |
| redemptions | {stats["redemptions"]} |
| chargebacks | {stats["chargebacks"]} |
| fraud_labels | {stats["fraud_labels"]} |

## Class balance

| Metric | Value |
|--------|-------|
| Fraud orders | {stats["fraud_orders"]} |
| Fraud base rate | {stats["fraud_base_rate"]:.2%} |
| Fraud face value (synth currency units) | {stats["fraud_face_value_aud"]:,} |
| Local gold features engineered | {len(features):,} |

## Injected fraud pattern tags (non-exclusive)

| Tag | Orders |
|-----|--------|
{tag_lines}

## Sample raw orders (first 5, not a random sample)

```json
{json.dumps(sample, indent=2)}
```

All identifiers, emails, IPs, and card last-4s are synthetic.
"""


def _train_preview(features: list[dict]) -> dict:
    try:
        import numpy as np
        from sklearn.ensemble import HistGradientBoostingClassifier
        from sklearn.metrics import (
            average_precision_score,
            confusion_matrix,
            precision_score,
            recall_score,
            roc_auc_score,
        )
        from sklearn.model_selection import train_test_split
    except ImportError as exc:
        return {"error": f"sklearn not available locally: {exc}"}

    cols = [
        "face_value",
        "account_age_hours",
        "is_new_account",
        "customer_orders_1h",
        "customer_orders_24h",
        "customer_amount_24h",
        "device_account_count",
        "geo_mismatch",
        "is_max_denomination",
        "instant_redeem_brand",
    ]
    X = np.array([[row[c] for c in cols] for row in features], dtype=float)
    y = np.array([row["is_fraud"] for row in features], dtype=int)
    values = np.array([row["face_value"] for row in features], dtype=float)
    X_train, X_test, y_train, y_test, v_train, v_test = train_test_split(
        X, y, values, test_size=0.25, random_state=42, stratify=y
    )
    clf = HistGradientBoostingClassifier(
        max_depth=5,
        learning_rate=0.08,
        max_iter=120,
        random_state=42,
    )
    clf.fit(X_train, y_train)
    proba = clf.predict_proba(X_test)[:, 1]
    auc_pr = float(average_precision_score(y_test, proba))
    roc = float(roc_auc_score(y_test, proba))
    table = []
    chosen = None
    for thr in (0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60):
        pred = (proba >= thr).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_test, pred, labels=[0, 1]).ravel()
        rec = float(recall_score(y_test, pred, zero_division=0))
        row = {
            "threshold": thr,
            "precision": round(float(precision_score(y_test, pred, zero_division=0)), 4),
            "recall": round(rec, 4),
            "fp_rate": round(float(fp / max(fp + tn, 1)), 4),
            "tp": int(tp),
            "fp": int(fp),
            "tn": int(tn),
            "fn": int(fn),
            "test_fraud_face_value_caught": float(v_test[(pred == 1) & (y_test == 1)].sum()),
            "modeled_annual_save_usd": round(4_000_000 * rec, 0),
        }
        table.append(row)
        if thr == 0.35:
            chosen = row
    return {
        "backend": "sklearn.HistGradientBoostingClassifier (local preview)",
        "workspace_model": "sierra_yap_demo_dump_catalog.`fe-bar-ml`.`fe-bar-fraud-classifier`",
        "auc_pr": round(auc_pr, 4),
        "roc_auc": round(roc, 4),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "fraud_base_rate": round(float(y.mean()), 4),
        "threshold_table": table,
        "chosen": chosen,
        "confusion_matrix_at_0.35": {
            "tn": chosen["tn"],
            "fp": chosen["fp"],
            "fn": chosen["fn"],
            "tp": chosen["tp"],
        },
    }


def _metrics_md(metrics: dict) -> str:
    if "error" in metrics:
        return f"# Local ML preview failed\n\n{metrics['error']}\n"
    lines = [
        f"| {r['threshold']:.2f} | {r['precision']:.3f} | {r['recall']:.3f} | {r['fp_rate']:.3%} | {r['tp']} | {r['fp']} | ${r['modeled_annual_save_usd']:,.0f} |"
        for r in metrics["threshold_table"]
    ]
    c = metrics["chosen"]
    return f"""# GiftGuard ML local preview (not the workspace MLflow run)

Trained on locally engineered `fe-bar-order-features` equivalents.
Workspace job `fe-bar-ml-train-score` re-trains with XGBoost + MLflow and
registers `{metrics["workspace_model"]}`.

| Metric | Value |
|--------|-------|
| Backend | {metrics["backend"]} |
| AUC-PR | {metrics["auc_pr"]} |
| ROC-AUC | {metrics["roc_auc"]} |
| Train / test rows | {metrics["n_train"]} / {metrics["n_test"]} |
| Label base rate | {metrics["fraud_base_rate"]:.2%} |
| Chosen threshold | 0.35 |
| Precision / recall / FP rate | {c["precision"]:.3f} / {c["recall"]:.3f} / {c["fp_rate"]:.2%} |
| Confusion (tn, fp, fn, tp) | {c["tn"]}, {c["fp"]}, {c["fn"]}, {c["tp"]} |
| Modeled annual save at recall | ${c["modeled_annual_save_usd"]:,.0f} |

## Threshold table

| threshold | precision | recall | fp_rate | tp | fp | modeled $ save |
|-----------|-----------|--------|---------|----|----|----------------|
{chr(10).join(lines)}

AUC-PR is the headline metric because fraud is ~1.5% of orders. The 0.35 cut
is the demo default aimed at ~60% recall with a low single-digit FP rate;
re-tune after the workspace run.
"""


def _genie_md(features: list[dict], metrics: dict) -> str:
    from collections import defaultdict

    by_brand = defaultdict(lambda: {"n": 0, "fraud": 0, "value": 0})
    for row in features:
        b = by_brand[row["brand_name"]]
        b["n"] += 1
        b["fraud"] += row["is_fraud"]
        if row["is_fraud"]:
            b["value"] += row["face_value"]
    ranked = sorted(by_brand.items(), key=lambda kv: kv[1]["fraud"] / max(kv[1]["n"], 1), reverse=True)[:8]
    brand_tbl = "\n".join(
        f"| {name} | {v['n']} | {v['fraud']} | {v['fraud']/v['n']:.2%} | {v['value']} |"
        for name, v in ranked
    )
    top = sorted([r for r in features if r["is_fraud"]], key=lambda r: r["face_value"], reverse=True)[:10]
    top_tbl = "\n".join(
        f"| {r['order_id']} | {r['brand_name']} | {r['face_value']} | {r['account_country']} |"
        for r in top
    )
    return f"""# Local preview answers for the Genie talk-track questions

These are **computed from the same synthetic gold features**, not from a live
Genie Space. After deploy, replace with Conversation API transcripts.

## Q: What was the fraud rate by brand last week?

Genie is expected to `GROUP BY brand_name` on `{ "`fe-bar-gold`.`fe-bar-order-features`" }`
or `{ "`fe-bar-gold`.`fe-bar-card-risk-scores`" }`. Local stand-in (full 18-month window):

| brand_name | orders | fraud | fraud_rate | fraud_face_value |
|------------|--------|-------|------------|------------------|
{brand_tbl}

## Q: Show the top 10 highest-value blocked / fraud orders

| order_id | brand_name | face_value | account_country |
|----------|------------|------------|-----------------|
{top_tbl}

## Q: How much fraud $ did we block this month vs last?

Local model recall at the chosen threshold is {metrics.get("chosen", {}).get("recall")}.
Applied to the $4M baseline that is **${metrics.get("chosen", {}).get("modeled_annual_save_usd", 0):,.0f}/yr**.
Live Genie should read `{ "`fe-bar-gold`.`fe-bar-fraud-kpis`" }.dollars_blocked`.
"""


if __name__ == "__main__":
    main()
