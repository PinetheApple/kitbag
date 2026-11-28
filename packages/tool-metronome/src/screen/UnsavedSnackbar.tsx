import {
  QUEUE_TEXT,
  TimedSnackbar,
  useVisibleSince,
} from '@kitbag/core-design';
import { useLibrary } from '@kitbag/core-state';
import { useCallback } from 'react';

import { ABOVE_TRANSPORT } from './snackbarPlacement.ts';
import { useUnsavedSnackbarView } from './useUnsavedSnackbarView.ts';

export function UnsavedSnackbar({
  bottomInset,
}: {
  readonly bottomInset: number;
}) {
  const discardedAt = useLibrary((s) => s.discarded?.at);
  const undo = useLibrary((s) => s.undoDiscard);
  const dismiss = useLibrary((s) => s.dismissDiscarded);
  const view = useUnsavedSnackbarView(useVisibleSince());
  const handleUndo = useCallback(() => {
    void undo();
  }, [undo]);
  if (view === undefined || discardedAt === undefined) return null;
  return (
    <TimedSnackbar
      at={discardedAt}
      message={view.message}
      actionLabel={QUEUE_TEXT.undo}
      bottom={bottomInset + ABOVE_TRANSPORT}
      onAction={handleUndo}
      onTimeout={dismiss}
    />
  );
}
