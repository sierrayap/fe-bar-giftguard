import type {
  LakebaseCustomerResult,
  LakebaseOrderResult,
  QueueResponse,
  ReviewAction,
  ReviewDecision,
  RuntimeStatus,
  WhoAmI,
} from './types';

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function loadWhoAmI(): Promise<WhoAmI> {
  return fetchJson<WhoAmI>('/api/whoami');
}

export function loadStatus(): Promise<RuntimeStatus> {
  return fetchJson<RuntimeStatus>('/api/status');
}

export function loadLakebaseQueue(): Promise<QueueResponse> {
  return fetchJson<QueueResponse>('/api/queue');
}

export function loadReviews(): Promise<{ source: string; rows: ReviewDecision[]; ms?: number }> {
  return fetchJson('/api/reviews');
}

export function submitReview(
  orderId: string,
  action: ReviewAction,
  note?: string,
): Promise<{ source: string; row: ReviewDecision; ms?: number }> {
  return fetchJson('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, action, note }),
  });
}

// Live point lookup directly against the Lakebase scores table, bypassing
// the warehouse entirely. Used by the "Lakebase inspector" console so an
// analyst can type any order_id and see a measured round trip on demand.
export async function fetchLakebaseOrder(orderId: string): Promise<LakebaseOrderResult> {
  const res = await fetch(`/api/lakebase/order/${encodeURIComponent(orderId)}`);
  const body = (await res.json()) as LakebaseOrderResult;
  return body;
}

// Live Lakebase lookup of every order tied to one customer_id.
export async function fetchLakebaseCustomer(customerId: string): Promise<LakebaseCustomerResult> {
  const res = await fetch(`/api/lakebase/customer/${encodeURIComponent(customerId)}`);
  const body = (await res.json()) as LakebaseCustomerResult;
  return body;
}
