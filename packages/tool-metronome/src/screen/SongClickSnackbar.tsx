import { Snackbar } from '@kitbag/core-design';
import { useMixerClickNotice } from '@kitbag/core-state';

import { songClickOffMessage } from '../logic/songClickSnackbar.ts';
import { ABOVE_TRANSPORT } from './snackbarPlacement.ts';

export function SongClickSnackbar({
  bottomInset,
}: {
  readonly bottomInset: number;
}) {
  const released = useMixerClickNotice((s) => s.released);
  const dismiss = useMixerClickNotice((s) => s.dismiss);
  if (released === null) return null;
  return (
    <Snackbar
      key={released.release}
      message={songClickOffMessage(released.title)}
      bottom={bottomInset + ABOVE_TRANSPORT}
      onTimeout={dismiss}
    />
  );
}
