import { z } from 'zod';

export const REVIEW_ACTIONS = ['approve', 'block', 'escalate'] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export const ReviewDecisionBody = z.object({
  order_id: z.string().min(1),
  action: z.enum(REVIEW_ACTIONS),
  note: z.string().max(2000).optional(),
});

export type ReviewDecisionInput = z.infer<typeof ReviewDecisionBody>;

export interface ReviewDecision {
  order_id: string;
  action: ReviewAction;
  note: string | null;
  analyst: string;
  decided_at: string;
}

export function asAnalyst(email: string | undefined | null): string {
  return email && email.trim().length > 0 ? email : 'unknown-analyst';
}
