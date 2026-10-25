export const toNumber = (value: number | string | null | undefined): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const formatCurrency = (value: number | string | null | undefined): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(toNumber(value));

export const formatScore = (value: number | string | null | undefined): string =>
  toNumber(value).toFixed(2);

export const formatWhen = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export function normalizePercent(value: number | string | null | undefined): number {
  const n = toNumber(value);
  return n <= 1 ? n * 100 : n;
}

export function formatRate(value: number | string | null | undefined): string {
  return `${normalizePercent(value).toFixed(2)}%`;
}
