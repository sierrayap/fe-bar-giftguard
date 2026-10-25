import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@databricks/appkit-ui/react';
import { CaseDetailContent } from './CaseDetail';
import type { QueryTraceEntry, ReviewAction, ReviewDecision } from '../lib/types';

/**
 * Pop-up version of the case panel. Opened from the Lakebase inspector (and
 * anywhere else that wants to show a case without disturbing the main
 * queue/case layout). Navigating to a linked order inside the dialog keeps
 * the dialog open and just swaps which case it is showing.
 */
export function CaseDetailModal({
  orderId,
  decision,
  busy,
  lakebaseAvailable,
  onAction,
  onSelect,
  onTrace,
  onClose,
}: {
  orderId: string | null;
  decision?: ReviewDecision;
  busy: boolean;
  lakebaseAvailable: boolean;
  onAction: (orderId: string, action: ReviewAction, note?: string) => Promise<boolean>;
  onSelect: (orderId: string) => void;
  onTrace: (entry: QueryTraceEntry) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(orderId)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Case popup</DialogTitle>
          <DialogDescription>Opened from the Lakebase inspector — jump to linked orders without losing your place.</DialogDescription>
        </DialogHeader>
        {orderId && (
          <CaseDetailContent
            orderId={orderId}
            decision={decision}
            busy={busy}
            lakebaseAvailable={lakebaseAvailable}
            onAction={onAction}
            onSelect={onSelect}
            onTrace={onTrace}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
