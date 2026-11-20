import { useCallback, useMemo } from 'react';

import { leftSetlistNotice, QUEUE_TEXT } from '../queueText.ts';
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

export function useLeftSetlistNotice<
  Left extends { readonly setlistName: string },
>(notice: Notice, rejoin: (left: Left) => Promise<unknown>) {
  return useCallback(
    (left: Left) => {
      notice.show(
        leftSetlistNotice(left.setlistName, () => {
          void rejoin(left);
        }),
      );
    },
    [notice, rejoin],
  );
}
