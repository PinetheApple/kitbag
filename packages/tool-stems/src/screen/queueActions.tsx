import {
  SetlistPickerSheet,
  useLeftSetlistNotice,
  useQueueNotices,
  type Notice,
  type QueueAction,
  type SetlistPickerSheetProps,
} from '@kitbag/core-design';
import {
  SKIPPED_STEM_SONG,
  useLibrary,
  useQueueRefresh,
  useQueueSong,
  useSetlistPicker,
  useEndedSetlistNotice,
  useStemPlayer,
  type QueuedSong,
} from '@kitbag/core-state';
import { useCallback, useEffect, useMemo } from 'react';

type SetlistSheetProps = Pick<
  SetlistPickerSheetProps,
  'visible' | 'bottomInset' | 'onDismiss' | 'onAdded'
>;

export function SetlistSheet(props: SetlistSheetProps) {
  const title = useStemPlayer((s) => s.title);
  const setId = useStemPlayer((s) => s.setId);
  const picker = useSetlistPicker(setId);
  if (setId === null) return null;
  return <SetlistPickerSheet {...props} {...picker} songTitle={title} />;
}

export function useCarriedSkipNotice(showMessage: (message: string) => void) {
  const carried = useLibrary((s) => s.carriedSkip);
  const carrySkip = useLibrary((s) => s.carrySkip);
  useEffect(() => {
    if (!carried) return;
    showMessage(SKIPPED_STEM_SONG);
    carrySkip(false);
  }, [carried, carrySkip, showMessage]);
}

function useQueueThisSong(closeSheet: () => void) {
  const setId = useStemPlayer((s) => s.setId);
  const title = useStemPlayer((s) => s.title);
  return useCallback(
    (verb: QueueAction<QueuedSong>) => (queued: boolean) => {
      closeSheet();
      if (setId !== null)
        verb({ song: { kind: 'stems', id: setId }, title, queued });
    },
    [closeSheet, setId, title],
  );
}

export function useQueueActions(
  notice: Notice,
  closeSheet: () => void,
  onOpenSetlist: (setlistId: number) => void,
  onOpenQueue: () => void,
) {
  useQueueRefresh(true);
  const queueSong = useQueueSong();
  const queue = useQueueNotices(notice, queueSong, onOpenSetlist, onOpenQueue);
  const thisSong = useQueueThisSong(closeSheet);
  const rejoinSetlist = useLibrary((s) => s.rejoinSetlist);
  const leftSetlist = useLeftSetlistNotice(notice, rejoinSetlist);
  useEndedSetlistNotice(leftSetlist);
  return useMemo(
    () => ({
      playNext: thisSong(queue.playNext),
      addToQueue: thisSong(queue.addToQueue),
      added: queue.added,
      leftSetlist,
    }),
    [thisSong, queue, leftSetlist],
  );
}
