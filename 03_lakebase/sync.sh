#!/usr/bin/env bash
# Intended Lakebase sync — not executed in this pass.
set -euo pipefail
PROFILE="${DATABRICKS_CONFIG_PROFILE:-fevm-sierra-yap-demo-dump}"
CATALOG="sierra_yap_demo_dump_catalog"
GOLD="fe-bar-gold"

echo "Create/use Lakebase project fe-bar-serving, then sync:"
echo "  source: ${CATALOG}.\`${GOLD}\`.\`fe-bar-card-risk-scores\`"
echo "  source: ${CATALOG}.\`${GOLD}\`.\`fe-bar-card-status\`"
echo "CLI profile: ${PROFILE}"
echo "Use: databricks postgres create-synced-table (see lakebase skill references/synced-tables.md)"
