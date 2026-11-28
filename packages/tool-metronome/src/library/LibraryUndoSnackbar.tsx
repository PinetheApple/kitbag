import { Snackbar, snackbar } from '@kitbag/core-design';
import { useLibrary, useStemSongs } from '@kitbag/core-state';
import { useCallback } from 'react';

import { deletionText } from '../logic/deletionText.ts';
import { snackbarTimeLeftMs } from '../logic/unsavedSnackbar.ts';
import { useVisibleSince } from '../screen/useVisibleSince.ts';

export function useLibraryUndoShown(): boolean {
  return useLibrary((s) => s.deletion !== null);
}

export function LibraryUndoSnackbar({
  bottomInset,
}: {
  readonly bottomInset: number;
}) {
  const deletion = useLibrary((s) => s.deletion);
  const presets = useLibrary((s) => s.presets);
  const setlists = useLibrary((s) => s.setlists);
  const undo = useLibrary((s) => s.undoDeletion);
  const dismiss = useLibrary((s) => s.dismissDeletion);
  const stems = useStemSongs();
  const visibleSince = useVisibleSince();
  const handleUndo = useCallback(() => {
    undo().catch((error: unknown) => {
      console.warn('[kitbag] could not undo the delete', error);
    });
  }, [undo]);
  if (deletion === null) return null;
  const timeLeftMs = snackbarTimeLeftMs(deletion.at, visibleSince);
  if (timeLeftMs <= 0) return null;
  return (
    <Snackbar
      key={`${String(deletion.at)}-${String(visibleSince)}`}
      message={deletionText(deletion, { presets, setlists, stems })}
      actionLabel="Undo"
      bottom={bottomInset + snackbar.aboveSheet}
      durationMs={timeLeftMs}
      onAction={handleUndo}
      onTimeout={dismiss}
    />
  );
}
