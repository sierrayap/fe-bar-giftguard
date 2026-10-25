import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  LineChart,
  Skeleton,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { formatCurrency, formatRate } from '../lib/formatters';

export function KpiHeader() {
  const kpis = useAnalyticsQuery('fraud_kpis', {});
  const trend = useAnalyticsQuery('kpi_trend', {});
  const row = kpis.data?.[0];

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Fraud posture</h2>
          <p className="text-sm text-muted-foreground">
            Source: Unity Catalog gold KPIs · last 30 days with volume, ending
            {row?.kpi_date ? ` ${String(row.kpi_date).slice(0, 10)}` : ' the latest active day'}
          </p>
        </div>
      </div>

      {kpis.error && (
        <Alert variant="destructive">
          <AlertDescription>
            Could not load gold KPIs. Confirm `fe-bar-gold`.`fe-bar-fraud-kpis` exists and the warehouse resource is bound.
            {kpis.error}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Fraud rate"
          loading={kpis.loading}
          value={row ? formatRate(row.fraud_rate) : null}
          comparison="labeled fraud / orders in window"
          period="30-day active window"
        />
        <KpiCard
          title="$ blocked (30d)"
          loading={kpis.loading}
          value={row ? formatCurrency(row.dollars_blocked) : null}
          comparison="true-positive blocked face value"
          period="gold.fraud_kpis"
        />
        <KpiCard
          title="False-positive rate"
          loading={kpis.loading}
          value={row ? formatRate(row.false_positive_rate) : null}
          comparison="legit orders sent to review or block"
          period="30-day active window"
          tone={row && Number(row.false_positive_rate) > 0.02 && Number(row.false_positive_rate) <= 1 ? 'bad' : 'good'}
        />
        <KpiCard
          title="Cases open"
          loading={kpis.loading}
          value={row ? String(Math.round(Number(row.cases_open))) : null}
          comparison="gold scores currently in review"
          period="live gold table"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fraud rate and dollars blocked</CardTitle>
          <CardDescription>Daily gold KPIs on days with at least 20 orders, last 90 active days</CardDescription>
        </CardHeader>
        <CardContent>
          {trend.loading && <Skeleton className="h-[280px] w-full" />}
          {trend.error && (
            <Alert variant="destructive">
              <AlertDescription>{trend.error}</AlertDescription>
            </Alert>
          )}
          {trend.data && trend.data.length > 0 && (
            <LineChart
              data={trend.data}
              xKey="kpi_date"
              yKey={['fraud_rate', 'dollars_blocked']}
              colorPalette="categorical"
              height={280}
              showLegend
              smooth
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function KpiCard({
  title,
  value,
  comparison,
  period,
  loading,
  tone,
}: {
  title: string;
  value: string | null;
  comparison: string;
  period: string;
  loading: boolean;
  tone?: 'good' | 'bad';
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={tone === 'bad' ? 'text-destructive' : tone === 'good' ? 'text-success' : 'text-foreground'}>
          {loading ? <Skeleton className="h-8 w-24" /> : (value ?? '—')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p>{comparison}</p>
        <p>Freshness: {period}</p>
      </CardContent>
    </Card>
  );
}
