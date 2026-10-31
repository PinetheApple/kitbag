import { metronome, size, Snackbar, space } from '@kitbag/core-design';
import { useLibrary } from '@kitbag/core-state';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { unsavedSnackbarView } from '../logic/unsavedSnackbar.ts';

const ABOVE_TRANSPORT =
  metronome.belowTransport + size.playButtonLarge + space.sectionGap;

function useVisibleSince(): number {
  const [visibleSince, setVisibleSince] = useState(Date.now);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setVisibleSince(Date.now());
    });
    return () => {
      subscription.remove();
    };
  }, []);
  return visibleSince;
}

export function UnsavedSnackbar({
  bottomInset,
}: {
  readonly bottomInset: number;
}) {
  const discarded = useLibrary((s) => s.discarded);
  const presets = useLibrary((s) => s.presets);
  const undo = useLibrary((s) => s.undoDiscard);
  const dismiss = useLibrary((s) => s.dismissDiscarded);
  const visibleSince = useVisibleSince();
  const view = useMemo(
    () => unsavedSnackbarView(discarded, presets, visibleSince),
    [discarded, presets, visibleSince],
  );
  const handleUndo = useCallback(() => {
    void undo();
  }, [undo]);
  if (view === undefined) return null;
  return (
    <Snackbar
      key={`${String(discarded?.at)}-${String(visibleSince)}`}
      message={view.message}
      actionLabel="Undo"
      bottom={bottomInset + ABOVE_TRANSPORT}
      durationMs={view.timeLeftMs}
      onAction={handleUndo}
      onTimeout={dismiss}
    />
  );
}
