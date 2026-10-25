"""Deterministic synthetic gift-card events for GiftGuard.

Demo scale defaults: 5_000 customers and 100_000 orders over ~18 months,
with ~1.5% overlapping fraud (velocity, device fan-out, geo mismatch,
max-denomination skew, new-account bursts). No real customer data.
"""

from __future__ import annotations

import hashlib
import json
import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

COUNTRIES = ["AU", "NZ", "US", "GB", "SG"]
PAYMENT_METHODS = ["visa", "mastercard", "amex", "paypal", "apple_pay"]
REDEEM_CHANNELS = ["app", "web", "pos", "partner"]

BRAND_SEEDS = [
    ("Amazon", 200, True),
    ("Apple", 200, True),
    ("Steam", 100, True),
    ("PlayStation", 100, True),
    ("Xbox", 100, True),
    ("Uber", 100, True),
    ("DoorDash", 100, True),
    ("Spotify", 60, True),
    ("Netflix", 100, True),
    ("Google Play", 100, True),
    ("Woolworths", 200, False),
    ("Coles", 200, False),
    ("Bunnings", 500, False),
    ("JB Hi-Fi", 200, False),
    ("Rebel", 200, False),
    ("The Iconic", 200, False),
    ("ASOS", 150, True),
    ("SEPHORA", 150, False),
    ("Nike", 200, False),
    ("Adidas", 200, False),
    ("Airbnb", 200, True),
    ("Qantas", 250, False),
    ("Hotel Tonight", 200, True),
    ("Bose", 200, False),
    ("Sony", 200, False),
    ("Nintendo", 100, True),
    ("EA", 50, True),
    ("Roblox", 50, True),
    ("Fortnite", 50, True),
    ("iTunes", 100, True),
    ("Bunnings+", 100, False),
    ("KMART", 100, False),
    ("Target", 100, False),
    ("Big W", 100, False),
    ("Officeworks", 200, False),
    ("Harvey Norman", 500, False),
    ("David Jones", 200, False),
    ("Myer", 200, False),
    ("Cotton On", 100, False),
    ("Cotton On Kids", 50, False),
    ("Lego", 100, False),
    ("Petbarn", 100, False),
    ("Chemist Warehouse", 100, False),
    ("Priceline", 100, False),
    ("BWS", 100, False),
    ("Dan Murphy's", 200, False),
    ("Event Cinemas", 50, True),
    ("Hoyts", 50, True),
    ("Ticketmaster", 200, True),
    ("Prezzee Choice", 200, True),
]


def _rng(seed: int) -> random.Random:
    return random.Random(seed)


def _id(prefix: str, n: int) -> str:
    return f"{prefix}-{n:08d}"


def _email(n: int, rnd: random.Random) -> str:
    domains = ["giftguard.example", "mail.test", "inbox.dev"]
    return f"customer.{n}.{rnd.randint(10, 99)}@{rnd.choice(domains)}"


def _ip(rnd: random.Random) -> str:
    return f"{rnd.randint(11, 220)}.{rnd.randint(0, 255)}.{rnd.randint(0, 255)}.{rnd.randint(1, 254)}"


def _device(rnd: random.Random) -> str:
    return f"dev-{rnd.randint(100000, 999999)}-{rnd.randint(1000, 9999)}"


def _iso(ts: datetime) -> str:
    return ts.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _hash_int(*parts: Any, mod: int = 10**9) -> int:
    h = hashlib.md5("|".join(str(p) for p in parts).encode()).hexdigest()
    return int(h[:12], 16) % mod


def generate_universe(
    n_customers: int = 5000,
    n_orders: int = 100000,
    seed: int = 42,
    start: datetime | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Return entity lists with overlapping, non-linear fraud signals."""
    rnd = _rng(seed)
    start = start or datetime(2024, 4, 1, tzinfo=timezone.utc)
    end = start + timedelta(days=540)
    span_seconds = int((end - start).total_seconds())

    brands = []
    for i, (name, max_denom, instant) in enumerate(BRAND_SEEDS, start=1):
        denoms = [10, 25, 50, 100]
        if max_denom >= 200:
            denoms.append(200)
        if max_denom >= 250:
            denoms.append(250)
        if max_denom >= 500:
            denoms.append(500)
        brands.append(
            {
                "brand_id": _id("brd", i),
                "brand_name": name,
                "max_denomination": max_denom,
                "instant_redeem": instant,
                "category": "digital" if instant else "retail",
                "denominations": denoms,
            }
        )

    customers: list[dict[str, Any]] = []
    for i in range(1, n_customers + 1):
        signup = start + timedelta(seconds=rnd.randint(0, span_seconds - 7 * 86400))
        country = rnd.choice(COUNTRIES)
        n_devices = 1 if rnd.random() < 0.85 else 2
        devices = [_device(rnd) for _ in range(n_devices)]
        customers.append(
            {
                "customer_id": _id("cus", i),
                "signup_ts": _iso(signup),
                "email": _email(i, rnd),
                "country": country,
                "device_ids": devices,
            }
        )

    # Shared-device ATO ring: a handful of devices appear on many accounts.
    ring_devices = [_device(rnd) for _ in range(5)]
    ring_customers = rnd.sample(customers, k=min(80, n_customers))
    for idx, cust in enumerate(ring_customers):
        cust["device_ids"].append(ring_devices[idx % len(ring_devices)])

    customer_by_id = {c["customer_id"]: c for c in customers}
    brand_by_id = {b["brand_id"]: b for b in brands}

    # Organic orders first, then overlay fraud bursts so labels stay minority.
    n_fraud = max(int(n_orders * 0.015), 200)
    n_legit = n_orders - n_fraud

    orders: list[dict[str, Any]] = []
    labels: list[dict[str, Any]] = []
    order_num = 1

    def add_order(
        customer: dict[str, Any],
        brand: dict[str, Any],
        ts: datetime,
        *,
        is_fraud: bool,
        face_value: int | None = None,
        device_id: str | None = None,
        ip_country: str | None = None,
        payment_country: str | None = None,
        fraud_tags: list[str] | None = None,
    ) -> dict[str, Any]:
        nonlocal order_num
        denoms = brand["denominations"]
        if face_value is None:
            # Organic demand skews small; fraud callers pass max denoms.
            weights = [40, 30, 18, 8] + [2] * (len(denoms) - 4)
            face_value = rnd.choices(denoms, weights=weights[: len(denoms)], k=1)[0]
        device_id = device_id or rnd.choice(customer["device_ids"])
        payment_country = payment_country or customer["country"]
        if ip_country is None:
            ip_country = customer["country"] if rnd.random() < 0.94 else rnd.choice(COUNTRIES)
        rec = {
            "order_id": _id("ord", order_num),
            "customer_id": customer["customer_id"],
            "brand_id": brand["brand_id"],
            "face_value": face_value,
            "payment_method": rnd.choice(PAYMENT_METHODS),
            "card_last4": f"{rnd.randint(0, 9999):04d}",
            "device_id": device_id,
            "ip_address": _ip(rnd),
            "ip_country": ip_country,
            "payment_country": payment_country,
            "order_ts": _iso(ts),
            "currency": "AUD" if customer["country"] in {"AU", "NZ"} else "USD",
        }
        orders.append(rec)
        labels.append(
            {
                "order_id": rec["order_id"],
                "is_fraud": is_fraud,
                "fraud_tags": fraud_tags or ([] if not is_fraud else ["organic_noise"]),
            }
        )
        order_num += 1
        return rec

    for _ in range(n_legit):
        cust = rnd.choice(customers)
        brand = rnd.choice(brands)
        signup = datetime.fromisoformat(cust["signup_ts"].replace("Z", "+00:00"))
        latest = min(end, signup + timedelta(days=rnd.randint(1, 400)))
        delta = max(int((latest - signup).total_seconds()), 3600)
        ts = signup + timedelta(seconds=rnd.randint(3600, delta))
        add_order(cust, brand, ts, is_fraud=False)

    remaining_fraud = n_fraud

    # 1) Velocity bursts: many high-value orders from one customer/device.
    velocity_customers = rnd.sample(customers, k=25)
    for cust in velocity_customers:
        if remaining_fraud <= 0:
            break
        burst_n = min(rnd.randint(8, 14), remaining_fraud)
        brand = max(brands, key=lambda b: b["max_denomination"])
        signup = datetime.fromisoformat(cust["signup_ts"].replace("Z", "+00:00"))
        burst_start = signup + timedelta(days=rnd.randint(2, 30), hours=rnd.randint(0, 12))
        device = cust["device_ids"][0]
        for j in range(burst_n):
            ts = burst_start + timedelta(minutes=4 * j + rnd.randint(0, 2))
            add_order(
                cust,
                brand,
                ts,
                is_fraud=True,
                face_value=brand["max_denomination"],
                device_id=device,
                fraud_tags=["velocity", "face_value_skew"],
            )
        remaining_fraud -= burst_n

    # 2) Device / account sharing (ATO ring).
    for device in ring_devices:
        if remaining_fraud <= 0:
            break
        victims = [c for c in ring_customers if device in c["device_ids"]]
        take = min(len(victims), remaining_fraud, 12)
        for cust in victims[:take]:
            brand = rnd.choice([b for b in brands if b["instant_redeem"]])
            signup = datetime.fromisoformat(cust["signup_ts"].replace("Z", "+00:00"))
            ts = signup + timedelta(hours=rnd.randint(6, 72))
            add_order(
                cust,
                brand,
                ts,
                is_fraud=True,
                face_value=brand["max_denomination"],
                device_id=device,
                fraud_tags=["device_fanout", "ato_ring"],
            )
            remaining_fraud -= 1

    # 3) Geo mismatch + 4) max denom + 5) new-account burst.
    while remaining_fraud > 0:
        cust = rnd.choice(customers)
        brand = rnd.choice(brands)
        signup = datetime.fromisoformat(cust["signup_ts"].replace("Z", "+00:00"))
        tags: list[str] = []
        ts = signup + timedelta(hours=rnd.randint(1, 36))
        tags.append("new_account_burst")
        ip_country = cust["country"]
        payment_country = cust["country"]
        face_value = None
        if rnd.random() < 0.7:
            other = [c for c in COUNTRIES if c != cust["country"]]
            ip_country = rnd.choice(other)
            payment_country = rnd.choice(other + [cust["country"]])
            tags.append("geo_mismatch")
        if rnd.random() < 0.65 or brand["instant_redeem"]:
            face_value = brand["max_denomination"]
            tags.append("face_value_skew")
            if brand["instant_redeem"]:
                tags.append("instant_brand")
        add_order(
            cust,
            brand,
            ts,
            is_fraud=True,
            face_value=face_value,
            ip_country=ip_country,
            payment_country=payment_country,
            fraud_tags=tags,
        )
        remaining_fraud -= 1

    # Messy legit lookalikes so the class boundary is not a single rule.
    legit_orders = [o for o, lab in zip(orders, labels) if not lab["is_fraud"]]
    for rec in rnd.sample(legit_orders, k=min(2500, len(legit_orders))):
        rec["ip_country"] = rnd.choice([c for c in COUNTRIES if c != rec["payment_country"]] or COUNTRIES)
    # Holiday-style legit velocity: a few good customers really do buy many cards.
    for cust in rnd.sample(customers, k=40):
        brand = rnd.choice(brands)
        signup = datetime.fromisoformat(cust["signup_ts"].replace("Z", "+00:00"))
        burst_start = signup + timedelta(days=rnd.randint(10, 80))
        for j in range(rnd.randint(5, 9)):
            add_order(
                cust,
                brand,
                burst_start + timedelta(minutes=6 * j),
                is_fraud=False,
                face_value=brand["max_denomination"] if rnd.random() < 0.4 else None,
                device_id=cust["device_ids"][0],
            )

    # Label noise: some fraud never gets a chargeback/label; some friendly-fraud labels.
    for lab in labels:
        if lab["is_fraud"] and rnd.random() < 0.25:
            lab["is_fraud"] = False
            lab["fraud_tags"] = ["unlabeled_fraud"]
        elif (not lab["is_fraud"]) and rnd.random() < 0.004:
            lab["is_fraud"] = True
            lab["fraud_tags"] = ["friendly_fraud_noise"]

    redemptions: list[dict[str, Any]] = []
    chargebacks: list[dict[str, Any]] = []
    label_by_order = {lab["order_id"]: lab for lab in labels}
    redeem_n = 0
    cb_n = 0
    for rec in orders:
        lab = label_by_order[rec["order_id"]]
        ts = datetime.fromisoformat(rec["order_ts"].replace("Z", "+00:00"))
        # Instant brands redeem quickly; fraud often redeems immediately.
        redeem_p = 0.93 if lab["is_fraud"] else 0.78
        if rnd.random() < redeem_p:
            redeem_n += 1
            delay_min = rnd.randint(2, 40) if lab["is_fraud"] else rnd.randint(30, 20000)
            redemptions.append(
                {
                    "redemption_id": _id("rdm", redeem_n),
                    "order_id": rec["order_id"],
                    "redeemer_id": rec["customer_id"] if rnd.random() < 0.9 else _id("cus", rnd.randint(1, n_customers)),
                    "channel": rnd.choice(REDEEM_CHANNELS),
                    "redeem_ts": _iso(ts + timedelta(minutes=delay_min)),
                }
            )
        # Chargebacks seed some labels but are delayed and incomplete.
        cb_p = 0.42 if lab["is_fraud"] else 0.004
        if rnd.random() < cb_p:
            cb_n += 1
            chargebacks.append(
                {
                    "chargeback_id": _id("cbk", cb_n),
                    "order_id": rec["order_id"],
                    "reason": "fraudulent" if lab["is_fraud"] else rnd.choice(["not_received", "duplicate", "friendly"]),
                    "amount": rec["face_value"],
                    "chargeback_ts": _iso(ts + timedelta(days=rnd.randint(8, 45))),
                }
            )

    # Brands persisted without the python-only denominations list.
    brands_out = [
        {k: v for k, v in b.items() if k != "denominations"} for b in brands
    ]

    return {
        "customers": customers,
        "brands": brands_out,
        "orders": orders,
        "redemptions": redemptions,
        "chargebacks": chargebacks,
        "fraud_labels": labels,
        "_brand_denoms": {b["brand_id"]: brand_by_id[b["brand_id"]]["denominations"] for b in brands},
        "_customer_by_id": customer_by_id,
        "_brand_by_id": {b["brand_id"]: {k: v for k, v in b.items() if k != "denominations"} | {"denominations": brand_by_id[b["brand_id"]]["denominations"]} for b in brands},
    }


def summarize(data: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    labels = data["fraud_labels"]
    orders = data["orders"]
    n_fraud = sum(1 for lab in labels if lab["is_fraud"])
    fraud_value = sum(
        o["face_value"] for o, lab in zip(orders, labels) if lab["is_fraud"]
    )
    legit_value = sum(
        o["face_value"] for o, lab in zip(orders, labels) if not lab["is_fraud"]
    )
    tag_counts: dict[str, int] = defaultdict(int)
    for lab in labels:
        for tag in lab["fraud_tags"]:
            tag_counts[tag] += 1
    return {
        "customers": len(data["customers"]),
        "brands": len(data["brands"]),
        "orders": len(orders),
        "redemptions": len(data["redemptions"]),
        "chargebacks": len(data["chargebacks"]),
        "fraud_labels": len(labels),
        "fraud_orders": n_fraud,
        "fraud_base_rate": round(n_fraud / len(orders), 4) if orders else 0,
        "fraud_face_value_aud": fraud_value,
        "legit_face_value": legit_value,
        "fraud_tag_counts": dict(sorted(tag_counts.items(), key=lambda kv: -kv[1])),
    }


def write_json_dataset(data: dict[str, list[dict[str, Any]]], dest: Path, records_per_file: int = 20000) -> None:
    """Write entity JSON files (json-lines) into dest/<entity>/part-*.json."""
    dest.mkdir(parents=True, exist_ok=True)
    for entity in ("customers", "brands", "orders", "redemptions", "chargebacks", "fraud_labels"):
        rows = data[entity]
        folder = dest / entity
        folder.mkdir(parents=True, exist_ok=True)
        for existing in folder.glob("*.json"):
            existing.unlink()
        if not rows:
            (folder / "part-00000.json").write_text("", encoding="utf-8")
            continue
        for i in range(0, len(rows), records_per_file):
            chunk = rows[i : i + records_per_file]
            part = folder / f"part-{i // records_per_file:05d}.json"
            with part.open("w", encoding="utf-8") as fh:
                for row in chunk:
                    payload = dict(row)
                    if entity == "customers":
                        payload = dict(row)
                    fh.write(json.dumps(payload) + "\n")


def engineer_order_features(data: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """Local preview of gold.fe-bar-order-features (same semantics as the pipeline)."""
    customers = {c["customer_id"]: c for c in data["customers"]}
    brands = {b["brand_id"]: b for b in data["brands"]}
    labels = {lab["order_id"]: lab for lab in data["fraud_labels"]}
    chargeback_orders = {c["order_id"] for c in data["chargebacks"]}

    parsed = []
    for rec in data["orders"]:
        ts = datetime.fromisoformat(rec["order_ts"].replace("Z", "+00:00"))
        parsed.append((ts, rec))
    parsed.sort(key=lambda x: (x[1]["customer_id"], x[0]))

    by_customer: dict[str, list[tuple[datetime, dict[str, Any]]]] = defaultdict(list)
    by_device_customers: dict[str, set[str]] = defaultdict(set)
    for ts, rec in parsed:
        by_customer[rec["customer_id"]].append((ts, rec))
        by_device_customers[rec["device_id"]].add(rec["customer_id"])

    features = []
    for cust_id, rows in by_customer.items():
        cust = customers[cust_id]
        signup = datetime.fromisoformat(cust["signup_ts"].replace("Z", "+00:00"))
        for idx, (ts, rec) in enumerate(rows):
            window_1h = 0
            window_24h = 0
            amount_24h = 0
            for j in range(idx, -1, -1):
                pts, prec = rows[j]
                age = (ts - pts).total_seconds()
                if age <= 3600:
                    window_1h += 1
                if age <= 86400:
                    window_24h += 1
                    amount_24h += prec["face_value"]
                else:
                    break
            brand = brands[rec["brand_id"]]
            account_age_hours = max((ts - signup).total_seconds() / 3600.0, 0.0)
            geo_mismatch = int(
                rec["ip_country"] != cust["country"]
                or rec["payment_country"] != cust["country"]
                or rec["ip_country"] != rec["payment_country"]
            )
            lab = labels[rec["order_id"]]
            features.append(
                {
                    "order_id": rec["order_id"],
                    "customer_id": rec["customer_id"],
                    "brand_id": rec["brand_id"],
                    "brand_name": brand["brand_name"],
                    "order_ts": rec["order_ts"],
                    "face_value": rec["face_value"],
                    "payment_method": rec["payment_method"],
                    "account_country": cust["country"],
                    "ip_country": rec["ip_country"],
                    "payment_country": rec["payment_country"],
                    "account_age_hours": round(account_age_hours, 2),
                    "is_new_account": int(account_age_hours < 48),
                    "customer_orders_1h": window_1h,
                    "customer_orders_24h": window_24h,
                    "customer_amount_24h": amount_24h,
                    "device_account_count": len(by_device_customers[rec["device_id"]]),
                    "geo_mismatch": geo_mismatch,
                    "is_max_denomination": int(rec["face_value"] >= brand["max_denomination"]),
                    "instant_redeem_brand": int(bool(brand["instant_redeem"])),
                    "has_chargeback": int(rec["order_id"] in chargeback_orders),
                    "is_fraud": int(bool(lab["is_fraud"])),
                }
            )
    return features
