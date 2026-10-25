import type { ReviewAction, ReviewDecision } from '../../../shared/review-actions';

export type { ReviewAction, ReviewDecision };

export interface WhoAmI {
  email: string | null;
  user: string | null;
}

export interface RuntimeStatus {
  warehouseConfigured: boolean;
  lakebaseConnected: boolean;
  lakebaseScoresTable: string | null;
  genieConfigured: boolean;
  writeStore: 'lakebase' | 'memory';
}

export interface FlaggedOrder {
  order_id: string;
  customer_id: string;
  brand_name: string;
  face_value: number | string;
  fraud_score: number | string;
  model_decision: string;
  case_summary: string;
  scored_at: string;
}

export interface QueueResponse {
  source: 'lakebase' | 'sql-warehouse';
  rows: FlaggedOrder[] | null;
  ms?: number;
}

export interface DeviceOrder {
  order_id: string;
  customer_id: string;
  brand_name: string;
  face_value: number | string;
  model_decision: string;
  order_ts: string | null;
}

export interface LakebaseOrderRow {
  order_id: string;
  customer_id: string;
  brand_name: string;
  face_value: number | string;
  fraud_score: number | string;
  model_decision: string;
  case_summary: string | null;
  scored_at: string;
  review_status: string | null;
  reviewed_at: string | null;
}

export interface LakebaseOrderResult {
  backend: 'lakebase' | 'unavailable';
  table?: string;
  sql?: string;
  ms: number;
  row: LakebaseOrderRow | null;
  error?: string;
}

export interface LakebaseCustomerRow {
  order_id: string;
  brand_name: string;
  face_value: number | string;
  fraud_score: number | string;
  model_decision: string;
  scored_at: string;
}

export interface LakebaseCustomerResult {
  backend: 'lakebase' | 'unavailable';
  table?: string;
  sql?: string;
  ms: number;
  rows: LakebaseCustomerRow[];
  error?: string;
}

export type TraceBackend = 'lakebase' | 'warehouse' | 'memory' | 'unavailable';

export interface QueryTraceEntry {
  id: string;
  at: string;
  label: string;
  backend: TraceBackend;
  ms: number;
  detail?: string;
}
