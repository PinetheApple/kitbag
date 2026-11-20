import {
  SetlistPickerSheet,
  useLeftSetlistNotice,
  useQueueNotices,
  useQueuePresses,
  type Notice,
  type QueueTarget,
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
import { useEffect, useMemo } from 'react';

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

function useThisSong(): QueueTarget<QueuedSong> | null {
  const setId = useStemPlayer((s) => s.setId);
  const title = useStemPlayer((s) => s.title);
  return useMemo(
    () =>
      setId === null ? null : { song: { kind: 'stems', id: setId }, title },
    [setId, title],
  );
}

export function useQueueActions(
  notice: Notice,
  closeSheet: () => void,
  onOpenSetlist: (setlistId: number) => void,
  onOpenQueue: () => void,
) {
  useQueueRefresh();
  const queueSong = useQueueSong();
  const queue = useQueueNotices(notice, queueSong, onOpenSetlist, onOpenQueue);
  const presses = useQueuePresses(queue, useThisSong(), closeSheet);
  const rejoinSetlist = useLibrary((s) => s.rejoinSetlist);
  const leftSetlist = useLeftSetlistNotice(notice, rejoinSetlist);
  useEndedSetlistNotice(leftSetlist);
  return useMemo(
    () => ({ presses, added: queue.added, leftSetlist }),
    [presses, queue.added, leftSetlist],
  );
}
