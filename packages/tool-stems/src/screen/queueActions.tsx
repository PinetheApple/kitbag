import {
  SetlistPickerSheet,
  useQueueNotices,
  type Notice,
  type SetlistPickerSheetProps,
} from '@kitbag/core-design';
import {
  SKIPPED_STEM_SONG,
  useLibrary,
  useQueueRefresh,
  useQueueSong,
  useSetlistPicker,
  useStemPlayer,
} from '@kitbag/core-state';
import { useCallback, useEffect } from 'react';

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

export function useQueueActions(
  notice: Notice,
  closeSheet: () => void,
  onOpenSetlist: (setlistId: number) => void,
) {
  const setId = useStemPlayer((s) => s.setId);
  useQueueRefresh(true);
  const queueSong = useQueueSong();
  const { playNext: queueNext, added } = useQueueNotices(
    notice,
    queueSong,
    onOpenSetlist,
  );
  const playNext = useCallback(() => {
    closeSheet();
    if (setId !== null) queueNext(setId);
  }, [closeSheet, setId, queueNext]);
  return { playNext, added };
}
