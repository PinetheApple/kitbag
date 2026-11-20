import {
  NoticeSnackbar,
  snackbar,
  useLeftSetlistNotice,
  useNotice,
} from '@kitbag/core-design';
import { useEndedSetlistNotice, useLibrary } from '@kitbag/core-state';

export function EndedSetlistSnackbar() {
  const notice = useNotice();
  const rejoinSetlist = useLibrary((s) => s.rejoinSetlist);
  useEndedSetlistNotice(useLeftSetlistNotice(notice, rejoinSetlist));
  return <NoticeSnackbar notice={notice} bottom={snackbar.aboveDock} />;
}
