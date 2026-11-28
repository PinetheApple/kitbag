import { deletedText, snackbar, TimedSnackbar } from '@kitbag/core-design';
import { useSongLibrary } from '@kitbag/core-state';
import { useCallback, useEffect } from 'react';

import { UNDO_LABEL } from '../logic/songMeterText.ts';

function useDismissOnUnmount(dismiss: () => void): void {
  useEffect(() => dismiss, [dismiss]);
}

export function DeletedSongSnackbar({
  bottomInset,
}: {
  readonly bottomInset: number;
}) {
  const deletedSong = useSongLibrary((s) => s.deletedSong);
  const undoDeleteSong = useSongLibrary((s) => s.undoDeleteSong);
  const dismissDeletedSong = useSongLibrary((s) => s.dismissDeletedSong);
  const undo = useCallback(() => {
    void undoDeleteSong();
  }, [undoDeleteSong]);
  const dismiss = useCallback(() => {
    void dismissDeletedSong();
  }, [dismissDeletedSong]);
  useDismissOnUnmount(dismiss);
  if (deletedSong === null) return null;
  return (
    <TimedSnackbar
      at={deletedSong.at}
      message={deletedText(deletedSong.title)}
      actionLabel={UNDO_LABEL}
      bottom={bottomInset + snackbar.aboveSheet}
      onAction={undo}
      onTimeout={dismiss}
    />
  );
}
