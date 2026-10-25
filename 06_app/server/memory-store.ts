import type { ReviewDecision } from '../shared/review-actions';

const decisions = new Map<string, ReviewDecision>();

export function memoryListDecisions(): ReviewDecision[] {
  return [...decisions.values()].sort((a, b) => b.decided_at.localeCompare(a.decided_at));
}

export function memoryUpsertDecision(decision: ReviewDecision): ReviewDecision {
  decisions.set(decision.order_id, decision);
  return decision;
}
