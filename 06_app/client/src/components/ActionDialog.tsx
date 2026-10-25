import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@databricks/appkit-ui/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ReviewAction } from '../lib/types';

const BLOCK_REASONS = [
  'Confirmed fraud / chargeback history',
  'Stolen card details',
  'Card testing pattern',
  'Velocity abuse (too many orders too fast)',
  'Device shared across many accounts',
  'Geo / IP mismatch',
  'Other',
];

const ESCALATE_TO = ['Senior fraud analyst', 'Compliance', 'Payments team', 'Risk lead'];
const PRIORITIES = ['Low', 'Medium', 'High'];

const COPY: Record<ReviewAction, { title: string; description: string; confirmLabel: string; variant: 'default' | 'destructive' | 'outline' }> = {
  approve: {
    title: 'Approve this order',
    description: 'This clears the order and releases a legitimate buyer. The model flagged it; your review overrides that.',
    confirmLabel: 'Confirm approve',
    variant: 'default',
  },
  block: {
    title: 'Block this order',
    description: 'This stops card issuance immediately. Give a reason so the audit trail holds up.',
    confirmLabel: 'Confirm block',
    variant: 'destructive',
  },
  escalate: {
    title: 'Escalate this case',
    description: 'Hand this off with enough context that the next reviewer does not start from zero.',
    confirmLabel: 'Confirm escalate',
    variant: 'outline',
  },
};

export function ActionDialog({
  action,
  orderId,
  busy,
  onClose,
  onConfirm,
}: {
  action: ReviewAction | null;
  orderId: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (action: ReviewAction, note: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [escalateTo, setEscalateTo] = useState('');
  const [priority, setPriority] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset the form every time a fresh action/case opens, so stale text from
  // the last case never leaks into this one.
  useEffect(() => {
    setNote('');
    setBlockReason('');
    setEscalateTo('');
    setPriority('');
  }, [action, orderId]);

  if (!action) return null;

  const copy = COPY[action];
  const valid =
    action === 'approve' ||
    (action === 'block' && blockReason.length > 0) ||
    (action === 'escalate' && escalateTo.length > 0 && priority.length > 0 && note.trim().length > 0);

  function composeNote(): string {
    if (action === 'block') {
      return note.trim() ? `Reason: ${blockReason}\nNotes: ${note.trim()}` : `Reason: ${blockReason}`;
    }
    if (action === 'escalate') {
      return `Escalated to: ${escalateTo}\nPriority: ${priority}\nContext: ${note.trim()}`;
    }
    return note.trim();
  }

  async function handleConfirm() {
    if (!action || submitting) return;
    setSubmitting(true);
    const composed = composeNote();
    const ok = await onConfirm(action, composed);
    setSubmitting(false);
    if (ok) {
      if (action === 'approve') toast.success(`${orderId} approved — buyer released.`);
      if (action === 'block') toast.success(`${orderId} blocked — card issuance stopped.`, { description: `Reason: ${blockReason}` });
      if (action === 'escalate') toast(`${orderId} escalated to ${escalateTo}.`, { description: `Priority: ${priority}` });
      onClose();
    } else {
      toast.error('That decision did not save. Check the error banner above and try again.');
    }
  }

  return (
    <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {orderId} · {copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {action === 'block' && (
            <div className="space-y-2">
              <Label htmlFor="block-reason">Reason</Label>
              <Select value={blockReason} onValueChange={setBlockReason}>
                <SelectTrigger id="block-reason" className="w-full">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {BLOCK_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {action === 'escalate' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="escalate-to">Escalate to</Label>
                <Select value={escalateTo} onValueChange={setEscalateTo}>
                  <SelectTrigger id="escalate-to" className="w-full">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESCALATE_TO.map((team) => (
                      <SelectItem key={team} value={team}>
                        {team}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority" className="w-full">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="action-note">
              {action === 'escalate' ? 'Context for the next reviewer' : action === 'block' ? 'Additional notes (optional)' : 'Note (optional)'}
            </Label>
            <Textarea
              id="action-note"
              placeholder={
                action === 'escalate'
                  ? 'What did you see? What should the next reviewer check first?'
                  : 'Anything worth recording on this decision'
              }
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button variant={copy.variant} disabled={!valid || submitting || busy} onClick={() => void handleConfirm()}>
            {submitting ? 'Saving…' : copy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
