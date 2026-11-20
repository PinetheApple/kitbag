import {
  addedToSetlistNotice,
  QUEUE_TEXT,
  SetlistPickerSheet,
  type AddedToSetlist,
  type Notice,
  type SetlistPickerSheetProps,
} from '@kitbag/core-design';
import {
  SKIPPED_STEM_SONG,
  useLibrary,
  usePlayOrder,
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
  const enqueue = usePlayOrder((s) => s.enqueue);
  const refresh = usePlayOrder((s) => s.refresh);
  const setId = useStemPlayer((s) => s.setId);
  useEffect(() => {
    refresh().catch((error: unknown) => {
      console.warn('[kitbag] play queue read failed', error);
    });
  }, [refresh]);
  const playNext = useCallback(() => {
    closeSheet();
    if (setId === null) return;
    void enqueue(setId).then(() => {
      notice.show({ message: QUEUE_TEXT.addedToUpNext });
    });
  }, [closeSheet, setId, enqueue, notice]);
  const added = useCallback(
    (to: AddedToSetlist) => {
      notice.show(addedToSetlistNotice(to, onOpenSetlist));
    },
    [notice, onOpenSetlist],
  );
  return { playNext, added };
}
