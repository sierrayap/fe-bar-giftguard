import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@databricks/appkit-ui/react';
import { formatWhen } from '../lib/formatters';
import type { QueryTraceEntry, TraceBackend } from '../lib/types';

const BACKEND_LABEL: Record<TraceBackend, string> = {
  lakebase: 'Lakebase',
  warehouse: 'SQL warehouse',
  memory: 'In-memory',
  unavailable: 'Unavailable',
};

function backendVariant(backend: TraceBackend): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (backend === 'lakebase') return 'default';
  if (backend === 'warehouse') return 'secondary';
  if (backend === 'unavailable') return 'destructive';
  return 'outline';
}

export function QueryTraceLog({ entries }: { entries: QueryTraceEntry[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Live query trace</CardTitle>
        <CardDescription>Every click below makes a real round trip. This is what actually ran, where, and how long it took.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No calls logged yet</EmptyTitle>
              <EmptyDescription>Open a case or run a Lakebase lookup to populate this trace.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <div className="max-h-[320px] space-y-2 overflow-auto">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between gap-3 rounded-md border p-2">
              <div>
                <p className="text-sm text-foreground">{entry.label}</p>
                {entry.detail && <p className="text-xs text-muted-foreground">{entry.detail}</p>}
                <p className="text-xs text-muted-foreground">{formatWhen(entry.at)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={backendVariant(entry.backend)}>{BACKEND_LABEL[entry.backend]}</Badge>
                <span className="text-xs font-mono text-muted-foreground">{entry.ms} ms</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
