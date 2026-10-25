import type { Application } from 'express';
import { asAnalyst, ReviewDecisionBody, type ReviewDecision } from '../../shared/review-actions';
import { memoryListDecisions, memoryUpsertDecision } from '../memory-store';

interface AppKitWithLakebase {
  lakebase?: {
    query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  };
  server: {
    extend(fn: (app: Application) => void): void;
  };
}

const SCORE_TABLE_CANDIDATES = [
  process.env.LAKEBASE_SCORES_TABLE,
  '"fe-bar-serving"."fe-bar-card-risk-scores"',
  'app.card_risk_scores',
  'public.card_risk_scores',
  'public."fe-bar-card-risk-scores"',
].filter((value): value is string => typeof value === 'string' && isSafeTableRef(value));

function isSafeTableRef(name: string): boolean {
  return /^[A-Za-z0-9_."-]+$/.test(name);
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
}

export interface RuntimeStatus {
  warehouseConfigured: boolean;
  lakebaseConnected: boolean;
  lakebaseScoresTable: string | null;
  genieConfigured: boolean;
  writeStore: 'lakebase' | 'memory';
}

export async function setupFraudOpsRoutes(appkit: AppKitWithLakebase): Promise<RuntimeStatus> {
  const status: RuntimeStatus = {
    warehouseConfigured: Boolean(process.env.DATABRICKS_WAREHOUSE_ID),
    lakebaseConnected: false,
    lakebaseScoresTable: null,
    genieConfigured: Boolean(process.env.DATABRICKS_GENIE_SPACE_ID),
    writeStore: 'memory',
  };

  if (appkit.lakebase) {
    try {
      await appkit.lakebase.query('SELECT 1');
      await appkit.lakebase.query('CREATE SCHEMA IF NOT EXISTS app');
      await appkit.lakebase.query(`
        CREATE TABLE IF NOT EXISTS app.review_decisions (
          order_id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          note TEXT,
          analyst TEXT NOT NULL,
          decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      status.lakebaseConnected = true;
      status.writeStore = 'lakebase';
      status.lakebaseScoresTable = await detectScoresTable(appkit);
      console.log('[giftguard] Lakebase connected; write store = lakebase');
    } catch (err) {
      console.warn('[giftguard] Lakebase unavailable; using SQL warehouse reads + in-memory writes:', (err as Error).message);
    }
  } else {
    console.warn('[giftguard] Lakebase plugin not registered; SQL warehouse fallback is active');
  }

  appkit.server.extend((app) => {
    app.get('/api/whoami', (req, res) => {
      res.json({
        email: req.header('x-forwarded-email') ?? null,
        user: req.header('x-forwarded-user') ?? null,
      });
    });

    app.get('/api/status', (_req, res) => {
      res.json(status);
    });

    app.get('/api/queue', async (_req, res) => {
      if (!status.lakebaseConnected || !status.lakebaseScoresTable || !appkit.lakebase) {
        res.json({ source: 'sql-warehouse', rows: null, ms: 0 });
        return;
      }
      try {
        const table = status.lakebaseScoresTable;
        const { result, ms } = await timed(() =>
          appkit.lakebase!.query(
            `SELECT order_id, customer_id, brand_name, face_value,
                    risk_score AS fraud_score,
                    decision AS model_decision,
                    case_summary,
                    event_ts AS scored_at
             FROM ${table}
             WHERE LOWER(CAST(decision AS TEXT)) IN ('flag', 'flagged', 'review', 'block', 'escalate')
                OR CAST(risk_score AS DOUBLE PRECISION) >= 0.50
             ORDER BY CAST(risk_score AS DOUBLE PRECISION) DESC
             LIMIT 50`,
          ),
        );
        res.json({ source: 'lakebase', rows: result.rows, ms });
      } catch (err) {
        console.warn('[giftguard] Lakebase queue read failed; client should use warehouse SQL:', (err as Error).message);
        res.json({ source: 'sql-warehouse', rows: null, ms: 0 });
      }
    });

    app.get('/api/reviews', async (_req, res) => {
      if (status.writeStore === 'lakebase' && appkit.lakebase) {
        try {
          const { result, ms } = await timed(() =>
            appkit.lakebase!.query(
              'SELECT order_id, action, note, analyst, decided_at FROM app.review_decisions ORDER BY decided_at DESC',
            ),
          );
          res.json({ source: 'lakebase', rows: result.rows, ms });
          return;
        } catch (err) {
          console.warn('[giftguard] Lakebase review read failed; using memory:', (err as Error).message);
        }
      }
      res.json({ source: 'memory', rows: memoryListDecisions(), ms: 0 });
    });

    // Live point lookup straight against the Lakebase scores table for one
    // order_id. Separate from /api/queue so the UI can demonstrate a single
    // Lakebase round trip with its own measured latency, on demand.
    app.get('/api/lakebase/order/:orderId', async (req, res) => {
      if (!status.lakebaseConnected || !status.lakebaseScoresTable || !appkit.lakebase) {
        res.status(503).json({ backend: 'unavailable', ms: 0, row: null, error: 'Lakebase is not connected on this deployment.' });
        return;
      }
      const table = status.lakebaseScoresTable;
      const sqlText = `SELECT order_id, customer_id, brand_name, face_value,
       risk_score AS fraud_score, decision AS model_decision, case_summary,
       event_ts AS scored_at, review_status, reviewed_at
FROM ${table}
WHERE order_id = $1`;
      try {
        const { result, ms } = await timed(() => appkit.lakebase!.query(sqlText, [req.params.orderId]));
        res.json({ backend: 'lakebase', table, sql: sqlText, ms, row: result.rows[0] ?? null });
      } catch (err) {
        res.status(500).json({ backend: 'lakebase', table, sql: sqlText, ms: 0, row: null, error: (err as Error).message });
      }
    });

    // Live Lakebase lookup of every order tied to one customer_id -- a
    // multi-row relational read (not a single-key fetch), run on demand from
    // a case so analysts can see related activity for the same buyer.
    app.get('/api/lakebase/customer/:customerId', async (req, res) => {
      if (!status.lakebaseConnected || !status.lakebaseScoresTable || !appkit.lakebase) {
        res.status(503).json({ backend: 'unavailable', ms: 0, rows: [], error: 'Lakebase is not connected on this deployment.' });
        return;
      }
      const table = status.lakebaseScoresTable;
      const sqlText = `SELECT order_id, brand_name, face_value,
       risk_score AS fraud_score, decision AS model_decision,
       event_ts AS scored_at
FROM ${table}
WHERE customer_id = $1
ORDER BY event_ts DESC
LIMIT 25`;
      try {
        const { result, ms } = await timed(() => appkit.lakebase!.query(sqlText, [req.params.customerId]));
        res.json({ backend: 'lakebase', table, sql: sqlText, ms, rows: result.rows });
      } catch (err) {
        res.status(500).json({ backend: 'lakebase', table, sql: sqlText, ms: 0, rows: [], error: (err as Error).message });
      }
    });

    app.post('/api/reviews', async (req, res) => {
      const parsed = ReviewDecisionBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid review payload', details: parsed.error.flatten() });
        return;
      }

      const decision: ReviewDecision = {
        order_id: parsed.data.order_id,
        action: parsed.data.action,
        note: parsed.data.note ?? null,
        analyst: asAnalyst(req.header('x-forwarded-email')),
        decided_at: new Date().toISOString(),
      };

      if (status.writeStore === 'lakebase' && appkit.lakebase) {
        try {
          const { result, ms } = await timed(() =>
            appkit.lakebase!.query(
              `INSERT INTO app.review_decisions (order_id, action, note, analyst, decided_at)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (order_id) DO UPDATE SET
                 action = EXCLUDED.action,
                 note = EXCLUDED.note,
                 analyst = EXCLUDED.analyst,
                 decided_at = EXCLUDED.decided_at
               RETURNING order_id, action, note, analyst, decided_at`,
              [decision.order_id, decision.action, decision.note, decision.analyst, decision.decided_at],
            ),
          );
          res.status(201).json({ source: 'lakebase', row: result.rows[0], ms });
          return;
        } catch (err) {
          console.warn('[giftguard] Lakebase write failed; storing in memory:', (err as Error).message);
        }
      }

      res.status(201).json({ source: 'memory', row: memoryUpsertDecision(decision), ms: 0 });
    });
  });

  return status;
}

async function detectScoresTable(appkit: AppKitWithLakebase): Promise<string | null> {
  if (!appkit.lakebase) return null;
  for (const table of SCORE_TABLE_CANDIDATES) {
    try {
      await appkit.lakebase.query(`SELECT 1 FROM ${table} LIMIT 1`);
      console.log(`[giftguard] Using Lakebase scores table ${table}`);
      return table;
    } catch {
      // Try the next candidate — synced tables may not be attached yet.
    }
  }
  return null;
}
