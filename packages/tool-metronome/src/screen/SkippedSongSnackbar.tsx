import { Snackbar } from '@kitbag/core-design';
import { SKIPPED_STEM_SONG } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { ABOVE_TRANSPORT } from './snackbarPlacement.ts';

export interface SkippedSongSnackbarProps {
  readonly shownAt: number | null;
  readonly bottomInset: number;
  readonly onDone: () => void;
}

export function SkippedSongSnackbar({
  shownAt,
  bottomInset,
  onDone,
}: SkippedSongSnackbarProps) {
  if (shownAt === null) return null;
  return (
    <Snackbar
      key={shownAt}
      message={SKIPPED_STEM_SONG}
      bottom={bottomInset + ABOVE_TRANSPORT}
      onTimeout={onDone}
    />
  );
}

export function useSkippedNotice() {
  const [shownAt, setShownAt] = useState<number | null>(null);
  const show = useCallback(() => {
    setShownAt(Date.now());
  }, []);
  const hide = useCallback(() => {
    setShownAt(null);
  }, []);
  return { shownAt, show, hide };
}
