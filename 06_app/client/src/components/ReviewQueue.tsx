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
  Skeleton,
} from '@databricks/appkit-ui/react';
import { useState } from 'react';
import { formatCurrency, formatScore, formatWhen, toNumber } from '../lib/formatters';
import type { FlaggedOrder, ReviewDecision } from '../lib/types';

export function ReviewQueue({
  orders,
  loading,
  error,
  selectedId,
  onSelect,
  decisions,
  source,
}: {
  orders: FlaggedOrder[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (orderId: string) => void;
  decisions: Record<string, ReviewDecision>;
  source: string;
}) {
  const [filter, setFilter] = useState('');

  const visible = orders.filter((row) => {
    if (!filter) return true;
    const haystack = `${row.order_id} ${row.customer_id} ${row.brand_name} ${row.case_summary}`.toLowerCase();
    return haystack.includes(filter.toLowerCase());
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Flagged review queue</CardTitle>
        <CardDescription>
          {source === 'lakebase'
            ? 'Low-latency Lakebase lookup of scored orders'
            : 'SQL warehouse fallback over gold.fe-bar-card-risk-scores'}
        </CardDescription>
        <Input
          placeholder="Filter by order, customer, brand, or summary"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!loading && !error && visible.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No flagged orders</EmptyTitle>
              <EmptyDescription>When gold scores land, high-risk gift-card orders appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <div className="max-h-[640px] space-y-2 overflow-auto">
          {visible.map((row) => {
            const decision = decisions[row.order_id];
            const selected = selectedId === row.order_id;
            return (
              <button
                key={row.order_id}
                type="button"
                onClick={() => onSelect(row.order_id)}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  selected ? 'bg-accent' : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{row.order_id}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.brand_name} · {formatCurrency(row.face_value)} · {row.customer_id}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={toNumber(row.fraud_score) >= 0.8 ? 'destructive' : 'secondary'}>
                      score {formatScore(row.fraud_score)}
                    </Badge>
                    {decision ? (
                      <Badge variant={decision.action === 'block' ? 'destructive' : 'outline'}>{decision.action}</Badge>
                    ) : (
                      <Badge variant="outline">{row.model_decision || 'review'}</Badge>
                    )}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{row.case_summary || 'No GenAI summary yet'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatWhen(row.scored_at)}</p>
              </button>
            );
          })}
        </div>
        {orders.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onSelect(orders[0].order_id)}>
            Open top case
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
