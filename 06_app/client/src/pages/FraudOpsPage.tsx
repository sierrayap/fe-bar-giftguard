import { Alert, AlertDescription, Badge, useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CaseDetail } from '../components/CaseDetail';
import { CaseDetailModal } from '../components/CaseDetailModal';
import { GeniePanel } from '../components/GeniePanel';
import { KpiHeader } from '../components/KpiHeader';
import { LakebaseInspector } from '../components/LakebaseInspector';
import { QueryTraceLog } from '../components/QueryTraceLog';
import { ReviewQueue } from '../components/ReviewQueue';
import { loadLakebaseQueue, loadReviews, loadStatus, loadWhoAmI, submitReview } from '../lib/api';
import type { FlaggedOrder, QueryTraceEntry, ReviewAction, ReviewDecision, RuntimeStatus, WhoAmI } from '../lib/types';

export function FraudOpsPage() {
  const warehouseQueue = useAnalyticsQuery('flagged_orders', {});
  const [whoami, setWhoami] = useState<WhoAmI | null>(null);
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [lakebaseOrders, setLakebaseOrders] = useState<FlaggedOrder[] | null>(null);
  const [queueSource, setQueueSource] = useState('sql-warehouse');
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [caseModalId, setCaseModalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [trace, setTrace] = useState<QueryTraceEntry[]>([]);
  const caseAnchorRef = useRef<HTMLDivElement | null>(null);

  const logTrace = useCallback((entry: QueryTraceEntry) => {
    setTrace((current) => [entry, ...current].slice(0, 12));
  }, []);

  // Used by anything that can select a case from off-screen (the Lakebase
  // inspector and linked-activity lists). Plain queue clicks don't need this
  // since the case panel sits right next to the queue already.
  const jumpToCase = useCallback((orderId: string) => {
    setSelectedId(orderId);
    caseAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast.success(`Opened ${orderId}`, { description: 'Scrolled up to the case panel.' });
  }, []);

  useEffect(() => {
    loadWhoAmI()
      .then(setWhoami)
      .catch(() => setWhoami(null));
    loadStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
    const queueStart = Date.now();
    loadLakebaseQueue()
      .then((payload) => {
        setQueueSource(payload.source);
        if (payload.source === 'lakebase' && payload.rows) {
          setLakebaseOrders(payload.rows);
        }
        logTrace({
          id: `queue-${Date.now()}`,
          at: new Date().toISOString(),
          label: 'Flagged queue load',
          backend: payload.source === 'lakebase' ? 'lakebase' : 'warehouse',
          ms: payload.ms ?? Date.now() - queueStart,
          detail: payload.rows ? `${payload.rows.length} rows` : 'fell back to SQL warehouse',
        });
      })
      .catch(() => {
        setQueueSource('sql-warehouse');
      });
    loadReviews()
      .then((payload) => {
        const next: Record<string, ReviewDecision> = {};
        for (const row of payload.rows ?? []) next[row.order_id] = row;
        setDecisions(next);
        logTrace({
          id: `reviews-${Date.now()}`,
          at: new Date().toISOString(),
          label: 'Review decisions load',
          backend: payload.source === 'lakebase' ? 'lakebase' : 'memory',
          ms: payload.ms ?? 0,
          detail: `${payload.rows?.length ?? 0} rows`,
        });
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orders = useMemo<FlaggedOrder[]>(() => {
    if (lakebaseOrders) return lakebaseOrders;
    return (warehouseQueue.data ?? []).map((row) => ({
      order_id: row.order_id,
      customer_id: row.customer_id,
      brand_name: row.brand_name,
      face_value: row.face_value,
      fraud_score: row.fraud_score,
      model_decision: row.model_decision,
      case_summary: row.case_summary ?? "",
      scored_at: row.scored_at,
    }));
  }, [lakebaseOrders, warehouseQueue.data]);

  useEffect(() => {
    if (!selectedId && orders[0]) setSelectedId(orders[0].order_id);
  }, [orders, selectedId]);

  // Takes orderId explicitly rather than closing over selectedId -- the
  // case popup can be open on a different order than the sidebar, and
  // actions must land on whichever case actually triggered them.
  async function onAction(orderId: string, action: ReviewAction, note?: string): Promise<boolean> {
    setBusy(true);
    setActionError(null);
    try {
      const result = await submitReview(orderId, action, note);
      setDecisions((current) => ({ ...current, [orderId]: result.row }));
      logTrace({
        id: `review-write-${Date.now()}`,
        at: new Date().toISOString(),
        label: `${action} · ${orderId}`,
        backend: result.source === 'lakebase' ? 'lakebase' : 'memory',
        ms: result.ms ?? 0,
        detail: 'app.review_decisions upsert',
      });
      return true;
    } catch (err) {
      setActionError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">GiftGuard · Fraud-Ops console</p>
          <h1 className="text-3xl font-semibold text-foreground">Stop fraud without blocking real buyers</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Review flagged gift-card orders, read the GenAI case summary, drill into linked activity, and approve, block,
            or escalate. The pilot's modeled annual save is roughly $2.4M; this console shows the live, labeled gold
            numbers behind that estimate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{whoami?.email ?? 'Signed in'}</Badge>
          <Badge variant="outline">{queueSource === 'lakebase' ? 'Queue: Lakebase' : 'Queue: SQL warehouse'}</Badge>
          <Badge variant="outline">Writes: {status?.writeStore ?? 'memory'}</Badge>
        </div>
      </header>

      <KpiHeader />

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div ref={caseAnchorRef} className="grid gap-4 lg:grid-cols-2">
        <ReviewQueue
          orders={orders}
          loading={warehouseQueue.loading && !lakebaseOrders}
          error={lakebaseOrders ? null : warehouseQueue.error}
          selectedId={selectedId}
          onSelect={setSelectedId}
          decisions={decisions}
          source={queueSource}
        />
        <CaseDetail
          orderId={selectedId}
          decision={selectedId ? decisions[selectedId] : undefined}
          busy={busy}
          lakebaseAvailable={Boolean(status?.lakebaseConnected)}
          onAction={onAction}
          onSelect={jumpToCase}
          onTrace={logTrace}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LakebaseInspector
          defaultOrderId={selectedId}
          lakebaseAvailable={Boolean(status?.lakebaseConnected)}
          onOpenCase={setCaseModalId}
          onTrace={logTrace}
        />
        <QueryTraceLog entries={trace} />
      </div>

      <GeniePanel configured={Boolean(status?.genieConfigured)} analystEmail={whoami?.email ?? null} />

      <CaseDetailModal
        orderId={caseModalId}
        decision={caseModalId ? decisions[caseModalId] : undefined}
        busy={busy}
        lakebaseAvailable={Boolean(status?.lakebaseConnected)}
        onAction={onAction}
        onSelect={setCaseModalId}
        onTrace={logTrace}
        onClose={() => setCaseModalId(null)}
      />
    </div>
  );
}
