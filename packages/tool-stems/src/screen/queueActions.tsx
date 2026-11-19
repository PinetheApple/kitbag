import {
  SKIPPED_STEM_SONG,
  useLibrary,
  usePlayOrder,
  useStemPlayer,
} from '@kitbag/core-state';
import { useCallback, useEffect } from 'react';

import type { usePlayerNotice } from './PlayerNotice.tsx';
import {
  SetlistPickerSheet,
  type AddedToSetlist,
  type SetlistPickerSheetProps,
} from './SetlistPickerSheet.tsx';

export const ADDED_TO_UP_NEXT = 'Added to Up next';

export function SetlistSheet(
  props: Omit<SetlistPickerSheetProps, 'songTitle' | 'stemSetId'>,
) {
  const title = useStemPlayer((s) => s.title);
  const setId = useStemPlayer((s) => s.setId);
  if (setId === null) return null;
  return <SetlistPickerSheet {...props} songTitle={title} stemSetId={setId} />;
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
  notice: ReturnType<typeof usePlayerNotice>,
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
      notice.show({ message: ADDED_TO_UP_NEXT });
    });
  }, [closeSheet, setId, enqueue, notice]);
  const added = useCallback(
    ({ setlistId, name }: AddedToSetlist) => {
      notice.show({
        message: `Added to ${name}`,
        action: {
          label: 'Open',
          onPress: () => {
            onOpenSetlist(setlistId);
          },
        },
      });
    },
    [notice, onOpenSetlist],
  );
  return { playNext, added };
}
