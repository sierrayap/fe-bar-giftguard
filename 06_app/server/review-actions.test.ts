import { describe, expect, test } from 'vitest';
import { asAnalyst, ReviewDecisionBody } from '../shared/review-actions';

describe('review decision payload', () => {
  test('accepts approve, block, and escalate', () => {
    for (const action of ['approve', 'block', 'escalate'] as const) {
      const parsed = ReviewDecisionBody.safeParse({ order_id: 'ord-1', action });
      expect(parsed.success).toBe(true);
    }
  });

  test('rejects unknown actions and empty order ids', () => {
    expect(ReviewDecisionBody.safeParse({ order_id: 'ord-1', action: 'ignore' }).success).toBe(false);
    expect(ReviewDecisionBody.safeParse({ order_id: '', action: 'approve' }).success).toBe(false);
  });

  test('falls back to unknown-analyst when identity headers are missing', () => {
    expect(asAnalyst(null)).toBe('unknown-analyst');
    expect(asAnalyst('analyst@databricks.com')).toBe('analyst@databricks.com');
  });
});
