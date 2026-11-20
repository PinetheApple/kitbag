import {
  addedToSetlistNotice,
  QUEUE_TEXT,
  type AddedToSetlist,
  type Notice,
} from '@kitbag/core-design';
import { usePlayOrder } from '@kitbag/core-state';
import { useCallback, useEffect, useMemo } from 'react';

export function useStemRowQueue(
  notice: Notice,
  onOpenSetlist: (setlistId: number) => void,
) {
  const enqueue = usePlayOrder((s) => s.enqueue);
  const refresh = usePlayOrder((s) => s.refresh);
  useEffect(() => {
    refresh().catch((error: unknown) => {
      console.warn('[kitbag] play queue read failed', error);
    });
  }, [refresh]);
  const playNext = useCallback(
    (stemSetId: number) => {
      void enqueue(stemSetId).then(() => {
        notice.show({ message: QUEUE_TEXT.addedToUpNext });
      });
    },
    [enqueue, notice],
  );
  const added = useCallback(
    (to: AddedToSetlist) => {
      notice.show(addedToSetlistNotice(to, onOpenSetlist));
    },
    [notice, onOpenSetlist],
  );
  return useMemo(() => ({ playNext, added }), [playNext, added]);
}
