import {
  NoticeSnackbar,
  snackbar,
  useLeftSetlistNotice,
  type Notice,
} from '@kitbag/core-design';
import { useEndedSetlistNotice, useLibrary } from '@kitbag/core-state';

export function EndedSetlistSnackbar({ notice }: { readonly notice: Notice }) {
  const rejoinSetlist = useLibrary((s) => s.rejoinSetlist);
  useEndedSetlistNotice(useLeftSetlistNotice(notice, rejoinSetlist));
  return <NoticeSnackbar notice={notice} bottom={snackbar.aboveDock} />;
}
