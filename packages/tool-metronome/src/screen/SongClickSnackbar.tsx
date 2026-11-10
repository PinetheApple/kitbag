import { Snackbar } from '@kitbag/core-design';
import { useMixerClickNotice } from '@kitbag/core-state';

import { songClickSnackbarView } from '../logic/songClickSnackbar.ts';
import { ABOVE_TRANSPORT } from './snackbarPlacement.ts';
import { useUnsavedSnackbarView } from './useUnsavedSnackbarView.ts';
import { useVisibleSince } from './useVisibleSince.ts';

export function SongClickSnackbar({
  bottomInset,
}: {
  readonly bottomInset: number;
}) {
  const released = useMixerClickNotice((s) => s.released);
  const dismiss = useMixerClickNotice((s) => s.dismiss);
  const visibleSince = useVisibleSince();
  const unsaved = useUnsavedSnackbarView(visibleSince);
  const view = songClickSnackbarView(
    released,
    visibleSince,
    unsaved !== undefined,
  );
  if (released === null || view === undefined) return null;
  return (
    <Snackbar
      key={`${String(released.id)}-${String(visibleSince)}`}
      message={view.message}
      bottom={bottomInset + ABOVE_TRANSPORT}
      durationMs={view.timeLeftMs}
      onTimeout={dismiss}
    />
  );
}
