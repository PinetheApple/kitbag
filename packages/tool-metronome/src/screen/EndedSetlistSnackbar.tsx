import {
  NoticeSnackbar,
  useLeftSetlistNotice,
  useNotice,
} from '@kitbag/core-design';
import { useEndedSetlistNotice, useLibrary } from '@kitbag/core-state';

import { ABOVE_TRANSPORT } from './snackbarPlacement.ts';

export function EndedSetlistSnackbar({
  bottomInset,
}: {
  readonly bottomInset: number;
}) {
  const notice = useNotice();
  const rejoinSetlist = useLibrary((s) => s.rejoinSetlist);
  useEndedSetlistNotice(useLeftSetlistNotice(notice, rejoinSetlist));
  return (
    <NoticeSnackbar notice={notice} bottom={bottomInset + ABOVE_TRANSPORT} />
  );
}
