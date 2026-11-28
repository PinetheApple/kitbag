import {
  QUEUE_TEXT,
  snackbar,
  TimedSnackbar,
  useSnackbarShown,
} from '@kitbag/core-design';
import { useLibrary, useStemSongs } from '@kitbag/core-state';
import { useCallback } from 'react';

import { deletionText } from '../logic/deletionText.ts';

export function useLibraryUndoShown(): boolean {
  return useSnackbarShown(useLibrary((s) => s.deletion?.at));
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
  const handleUndo = useCallback(() => {
    undo().catch((error: unknown) => {
      console.warn('[kitbag] could not undo the delete', error);
    });
  }, [undo]);
  if (deletion === null) return null;
  return (
    <TimedSnackbar
      at={deletion.at}
      message={deletionText(deletion, { presets, setlists, stems })}
      actionLabel={QUEUE_TEXT.undo}
      bottom={bottomInset + snackbar.aboveSheet}
      onAction={handleUndo}
      onTimeout={dismiss}
    />
  );
}
