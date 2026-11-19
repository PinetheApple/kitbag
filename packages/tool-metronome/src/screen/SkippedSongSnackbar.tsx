import { Snackbar } from '@kitbag/core-design';
import { SKIPPED_STEM_SONG } from '@kitbag/core-state';

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
