import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Skeleton,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { useEffect, useRef, useState } from 'react';
import { ActionDialog } from './ActionDialog';
import { fetchLakebaseCustomer } from '../lib/api';
import { formatCurrency, formatRate, formatScore, formatWhen, toNumber } from '../lib/formatters';
import type { LakebaseCustomerResult, QueryTraceEntry, ReviewAction, ReviewDecision } from '../lib/types';

export interface CaseDetailContentProps {
  orderId: string;
  decision?: ReviewDecision;
  busy: boolean;
  lakebaseAvailable: boolean;
  onAction: (orderId: string, action: ReviewAction, note?: string) => Promise<boolean>;
  onSelect: (orderId: string) => void;
  onTrace: (entry: QueryTraceEntry) => void;
}

/**
 * The actual case body: facts, GenAI summary, linked activity, decision
 * history, and the approve/block/escalate buttons. Self-contained so it can
 * be dropped into the sidebar card or a popup dialog with the same
 * behavior -- only the surrounding chrome differs between the two.
 */
export function CaseDetailContent({ orderId, decision, busy, lakebaseAvailable, onAction, onSelect, onTrace }: CaseDetailContentProps) {
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);
  const detail = useAnalyticsQuery('order_detail', { order_id: sql.string(orderId) }, { autoStart: true });
  const row = detail.data?.[0];

  const deviceOrders = useAnalyticsQuery(
    'device_orders',
    row?.device_id ? { device_id: sql.string(row.device_id) } : null,
    { autoStart: Boolean(row?.device_id) },
  );
  const deviceTraceStart = useRef<number | null>(null);
  const deviceTraceLogged = useRef<string | null>(null);
  useEffect(() => {
    if (deviceOrders.loading) {
      deviceTraceStart.current = Date.now();
      return;
    }
    if (!row?.device_id) return;
    if (deviceTraceLogged.current === row.device_id) return;
    if (deviceOrders.data === null && !deviceOrders.error) return;
    const ms = deviceTraceStart.current ? Date.now() - deviceTraceStart.current : 0;
    deviceTraceLogged.current = row.device_id;
    onTrace({
      id: `device-${row.device_id}-${Date.now()}`,
      at: new Date().toISOString(),
      label: `Device fan-out · ${row.device_id}`,
      backend: deviceOrders.error ? 'unavailable' : 'warehouse',
      ms,
      detail: deviceOrders.error ?? `${deviceOrders.data?.length ?? 0} orders on this device`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceOrders.loading]);

  const [linkedCustomer, setLinkedCustomer] = useState<LakebaseCustomerResult | null>(null);
  const [linkedCustomerLoading, setLinkedCustomerLoading] = useState(false);

  async function loadLinkedCustomer(customerId: string) {
    setLinkedCustomerLoading(true);
    try {
      const payload = await fetchLakebaseCustomer(customerId);
      setLinkedCustomer(payload);
      onTrace({
        id: `lb-customer-${Date.now()}`,
        at: new Date().toISOString(),
        label: `Same-customer lookup · ${customerId}`,
        backend: payload.backend,
        ms: payload.ms,
        detail: payload.table ?? payload.error ?? `${payload.rows.length} rows`,
      });
    } catch (err) {
      setLinkedCustomer({ backend: 'unavailable', ms: 0, rows: [], error: (err as Error).message });
    } finally {
      setLinkedCustomerLoading(false);
    }
  }

  useEffect(() => {
    setLinkedCustomer(null);
    setPendingAction(null);
  }, [orderId]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-semibold text-foreground">{orderId}</p>
        {row && (
          <Badge variant={toNumber(row.fraud_score) >= 0.8 ? 'destructive' : 'secondary'}>{formatScore(row.fraud_score)}</Badge>
        )}
      </div>

      {detail.loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
      {detail.error && (
        <Alert variant="destructive">
          <AlertDescription>{detail.error}</AlertDescription>
        </Alert>
      )}
      {row && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Fact label="Brand" value={row.brand_name} />
            <Fact label="Face value" value={formatCurrency(row.face_value)} />
            <Fact label="Customer" value={row.customer_id} />
            <Fact label="Model decision" value={row.model_decision} />
            <Fact label="Payment" value={row.payment_method ?? '—'} />
            <Fact label="Order time" value={formatWhen(row.order_ts ?? row.scored_at)} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">GenAI case summary</h3>
            <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm text-foreground">
              {row.case_summary || 'No ai_query() summary is stored on this order yet.'}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">Why it was flagged</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Fact label="Account age (hours)" value={row.account_age_hours == null ? '—' : String(toNumber(row.account_age_hours))} />
              <Fact label="Velocity 1h / 24h" value={`${row.velocity_1h ?? '—'} / ${row.velocity_24h ?? '—'}`} />
              <Fact label="Device fan-out" value={row.device_fanout == null ? '—' : String(row.device_fanout)} />
              <Fact
                label="Geo mismatch"
                value={Number(row.geo_mismatch) === 1 ? 'Yes' : Number(row.geo_mismatch) === 0 ? 'No' : '—'}
                tone={Number(row.geo_mismatch) === 1 ? 'bad' : undefined}
              />
              <Fact label="IP country" value={row.ip_country ?? '—'} />
              <Fact label="Account country" value={row.account_country ?? '—'} />
              <Fact label="Device" value={row.device_id ?? '—'} />
              <Fact label="False-positive budget" value={`hold ${formatRate(0.02)}`} />
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">Linked activity</h3>
              <Button
                size="sm"
                variant="outline"
                disabled={!lakebaseAvailable || linkedCustomerLoading}
                onClick={() => void loadLinkedCustomer(row.customer_id)}
              >
                {linkedCustomerLoading ? 'Querying Lakebase…' : 'Check Lakebase for this customer'}
              </Button>
            </div>

            {linkedCustomer && linkedCustomer.backend === 'lakebase' && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {linkedCustomer.rows.length} order(s) for {row.customer_id} in {linkedCustomer.table} · {linkedCustomer.ms} ms
                </p>
                <div className="max-h-48 space-y-1 overflow-auto">
                  {linkedCustomer.rows
                    .filter((r) => r.order_id !== orderId)
                    .map((r) => (
                      <button
                        key={r.order_id}
                        type="button"
                        onClick={() => onSelect(r.order_id)}
                        className="flex w-full items-center justify-between gap-2 rounded-md border p-2 text-left text-sm hover:bg-muted"
                      >
                        <span>
                          {r.order_id} · {r.brand_name} · {formatCurrency(r.face_value)}
                        </span>
                        <Badge variant={r.model_decision === 'block' ? 'destructive' : 'outline'}>{r.model_decision}</Badge>
                      </button>
                    ))}
                  {linkedCustomer.rows.filter((r) => r.order_id !== orderId).length === 0 && (
                    <p className="text-xs text-muted-foreground">No other orders for this customer in Lakebase.</p>
                  )}
                </div>
              </div>
            )}
            {linkedCustomer && linkedCustomer.backend === 'unavailable' && (
              <Alert variant="destructive">
                <AlertDescription>{linkedCustomer.error ?? 'Lakebase lookup failed.'}</AlertDescription>
              </Alert>
            )}

            {row.device_id && (
              <div className="space-y-2 border-t pt-2">
                <p className="text-xs text-muted-foreground">
                  SQL warehouse · other orders seen on device {row.device_id}
                  {deviceOrders.loading ? ' · loading…' : ''}
                </p>
                {deviceOrders.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{deviceOrders.error}</AlertDescription>
                  </Alert>
                )}
                <div className="max-h-48 space-y-1 overflow-auto">
                  {(deviceOrders.data ?? [])
                    .filter((r) => r.order_id !== orderId)
                    .map((r) => (
                      <button
                        key={r.order_id}
                        type="button"
                        onClick={() => onSelect(r.order_id)}
                        className="flex w-full items-center justify-between gap-2 rounded-md border p-2 text-left text-sm hover:bg-muted"
                      >
                        <span>
                          {r.order_id} · {r.brand_name} · {formatCurrency(r.face_value)} · {r.customer_id}
                        </span>
                        <Badge variant={r.model_decision === 'block' ? 'destructive' : 'outline'}>{r.model_decision}</Badge>
                      </button>
                    ))}
                  {!deviceOrders.loading && (deviceOrders.data ?? []).filter((r) => r.order_id !== orderId).length === 0 && (
                    <p className="text-xs text-muted-foreground">No other orders on this device.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {decision && (
        <Alert variant={decision.action === 'block' ? 'destructive' : 'default'}>
          <AlertDescription>
            <p>
              Last action: {decision.action} by {decision.analyst} at {formatWhen(decision.decided_at)}
            </p>
            {decision.note && <p className="mt-1 whitespace-pre-wrap text-xs">{decision.note}</p>}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => setPendingAction('approve')}>
            Approve
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => setPendingAction('block')}>
            Block
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setPendingAction('escalate')}>
            Escalate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Approve releases a legitimate buyer. Block stops card issuance with a reason on record. Escalate hands the
          case off to another team with priority and context.
        </p>
      </div>

      <ActionDialog
        action={pendingAction}
        orderId={orderId}
        busy={busy}
        onClose={() => setPendingAction(null)}
        onConfirm={(action, note) => onAction(orderId, action, note)}
      />
    </div>
  );
}

export function CaseDetail({
  orderId,
  decision,
  busy,
  lakebaseAvailable,
  onAction,
  onSelect,
  onTrace,
}: {
  orderId: string | null;
  decision?: ReviewDecision;
  busy: boolean;
  lakebaseAvailable: boolean;
  onAction: (orderId: string, action: ReviewAction, note?: string) => Promise<boolean>;
  onSelect: (orderId: string) => void;
  onTrace: (entry: QueryTraceEntry) => void;
}) {
  if (!orderId) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Case summary</CardTitle>
          <CardDescription>Select a flagged order to inspect features and decide</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No case selected</EmptyTitle>
              <EmptyDescription>Open an order from the review queue.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Case detail</CardTitle>
        <CardDescription>Model score plus GenAI case narrative and engineered features</CardDescription>
      </CardHeader>
      <CardContent>
        <CaseDetailContent
          orderId={orderId}
          decision={decision}
          busy={busy}
          lakebaseAvailable={lakebaseAvailable}
          onAction={onAction}
          onSelect={onSelect}
          onTrace={onTrace}
        />
      </CardContent>
    </Card>
  );
}

export function Fact({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={tone === 'bad' ? 'text-sm font-medium text-destructive' : 'text-sm text-foreground'}>{value}</p>
    </div>
  );
}
