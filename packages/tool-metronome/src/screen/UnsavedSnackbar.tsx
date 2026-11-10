import { Snackbar } from '@kitbag/core-design';
import { useLibrary } from '@kitbag/core-state';
import { useCallback } from 'react';

import { ABOVE_TRANSPORT } from './snackbarPlacement.ts';
import { useUnsavedSnackbarView } from './useUnsavedSnackbarView.ts';
import { useVisibleSince } from './useVisibleSince.ts';

export function UnsavedSnackbar({
  bottomInset,
}: {
  readonly bottomInset: number;
}) {
  const discardedAt = useLibrary((s) => s.discarded?.at);
  const undo = useLibrary((s) => s.undoDiscard);
  const dismiss = useLibrary((s) => s.dismissDiscarded);
  const visibleSince = useVisibleSince();
  const view = useUnsavedSnackbarView(visibleSince);
  const handleUndo = useCallback(() => {
    void undo();
  }, [undo]);
  if (view === undefined) return null;
  return (
    <Snackbar
      key={`${String(discardedAt)}-${String(visibleSince)}`}
      message={view.message}
      actionLabel="Undo"
      bottom={bottomInset + ABOVE_TRANSPORT}
      durationMs={view.timeLeftMs}
      onAction={handleUndo}
      onTimeout={dismiss}
    />
  );
}
