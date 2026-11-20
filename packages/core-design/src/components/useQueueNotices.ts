import { useCallback, useMemo } from 'react';

import { QUEUE_TEXT } from '../queueText.ts';
import {
  addedToSetlistNotice,
  type AddedToSetlist,
} from '../setlistPickText.ts';
import type { Notice } from './useNotice.ts';

export function useQueueNotices(
  notice: Notice,
  queueSong: (stemSetId: number) => Promise<boolean>,
  onOpenSetlist: (setlistId: number) => void,
) {
  const playNext = useCallback(
    (stemSetId: number) => {
      void queueSong(stemSetId).then((queued) => {
        if (queued) notice.show({ message: QUEUE_TEXT.addedToUpNext });
      });
    },
    [queueSong, notice],
  );
  const added = useCallback(
    (to: AddedToSetlist) => {
      notice.show(addedToSetlistNotice(to, onOpenSetlist));
    },
    [notice, onOpenSetlist],
  );
  return useMemo(() => ({ playNext, added }), [playNext, added]);
}
