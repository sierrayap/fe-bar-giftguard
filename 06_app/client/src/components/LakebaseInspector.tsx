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
  Input,
} from '@databricks/appkit-ui/react';
import { useState } from 'react';
import { fetchLakebaseOrder } from '../lib/api';
import { formatCurrency, formatScore } from '../lib/formatters';
import type { LakebaseOrderResult, QueryTraceEntry } from '../lib/types';

export function LakebaseInspector({
  defaultOrderId,
  lakebaseAvailable,
  onOpenCase,
  onTrace,
}: {
  defaultOrderId: string | null;
  lakebaseAvailable: boolean;
  onOpenCase: (orderId: string) => void;
  onTrace: (entry: QueryTraceEntry) => void;
}) {
  const [orderId, setOrderId] = useState(defaultOrderId ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LakebaseOrderResult | null>(null);
  const [showSql, setShowSql] = useState(false);

  async function runLookup() {
    const target = orderId.trim();
    if (!target) return;
    setLoading(true);
    try {
      const payload = await fetchLakebaseOrder(target);
      setResult(payload);
      onTrace({
        id: `lb-order-${Date.now()}`,
        at: new Date().toISOString(),
        label: `Point lookup · ${target}`,
        backend: payload.backend,
        ms: payload.ms,
        detail: payload.table ?? payload.error,
      });
    } catch (err) {
      setResult({ backend: 'unavailable', ms: 0, row: null, error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Lakebase inspector</CardTitle>
        <CardDescription>
          Type any order_id and hit Postgres directly. This skips the warehouse entirely so you can see the real, measured
          Lakebase round trip for that one row.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!lakebaseAvailable && (
          <Alert>
            <AlertDescription>Lakebase is not connected on this deployment. This console needs the lakebase plugin to be active.</AlertDescription>
          </Alert>
        )}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void runLookup();
          }}
        >
          <Input
            placeholder="ord-00098728"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            disabled={!lakebaseAvailable}
          />
          <Button type="submit" disabled={!lakebaseAvailable || loading || !orderId.trim()}>
            {loading ? 'Looking up…' : 'Look up'}
          </Button>
        </form>

        {result && result.backend === 'lakebase' && result.row && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">{result.row.order_id}</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{result.ms} ms</Badge>
                <Badge variant={Number(result.row.fraud_score) >= 0.8 ? 'destructive' : 'outline'}>
                  score {formatScore(result.row.fraud_score)}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {result.row.brand_name} · {formatCurrency(result.row.face_value)} · {result.row.customer_id}
            </p>
            <p className="text-sm text-muted-foreground">decision: {result.row.model_decision}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenCase(result.row!.order_id)}>
                Open this case
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSql((v) => !v)}>
                {showSql ? 'Hide SQL' : 'Show SQL'}
              </Button>
            </div>
            {showSql && <pre className="overflow-auto rounded-md bg-muted/40 p-2 text-xs">{result.sql}</pre>}
          </div>
        )}

        {result && result.backend === 'lakebase' && !result.row && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No row for that order_id</EmptyTitle>
              <EmptyDescription>Lookup took {result.ms} ms against {result.table}, but found nothing. Check the id.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {result && result.backend === 'unavailable' && (
          <Alert variant="destructive">
            <AlertDescription>{result.error ?? 'Lakebase is not reachable from this deployment.'}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
