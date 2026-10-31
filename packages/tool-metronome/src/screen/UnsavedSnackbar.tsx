import { Snackbar } from '@kitbag/core-design';
import { useLibrary } from '@kitbag/core-state';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { unsavedSnackbarView } from '../logic/unsavedSnackbar.ts';

// A notification step can land while the app is hidden, so the window is
// re-measured from the discard each time the app comes back.
function useAppActiveAt(): number {
  const [activeAt, setActiveAt] = useState(Date.now);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setActiveAt(Date.now());
    });
    return () => {
      subscription.remove();
    };
  }, []);
  return activeAt;
}

export function UnsavedSnackbar({ bottom }: { readonly bottom: number }) {
  const discarded = useLibrary((s) => s.discarded);
  const presets = useLibrary((s) => s.presets);
  const undo = useLibrary((s) => s.undoDiscard);
  const dismiss = useLibrary((s) => s.dismissDiscarded);
  const activeAt = useAppActiveAt();
  const at = discarded?.at ?? activeAt;
  const view = useMemo(
    () => unsavedSnackbarView(discarded, presets, Math.max(activeAt, at)),
    [discarded, presets, activeAt, at],
  );
  const handleUndo = useCallback(() => {
    void undo();
  }, [undo]);
  if (view === undefined) return null;
  return (
    <Snackbar
      key={`${String(at)}-${String(activeAt)}`}
      message={view.message}
      actionLabel="Undo"
      bottom={bottom}
      durationMs={view.timeLeftMs}
      onAction={handleUndo}
      onTimeout={dismiss}
    />
  );
}
