import { EditRow, EditValue, rowLabel } from '@kitbag/core-design';
import { hasGetSongBpmKey, useGetSongBpmKey } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { GetSongBpmKeySheet } from './GetSongBpmKeySheet.tsx';
import { GET_SONG_BPM_KEY_LABEL, keyStatus } from './getSongBpmKeyText.ts';

export function GetSongBpmKeyRow() {
  const key = useGetSongBpmKey((s) => s.key);
  const [open, setOpen] = useState(false);
  const show = useCallback(() => {
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
  }, []);
  const status = keyStatus(key);
  return (
    <>
      <EditRow
        label={GET_SONG_BPM_KEY_LABEL}
        accessibilityLabel={rowLabel(GET_SONG_BPM_KEY_LABEL, status)}
        onPress={show}
      >
        <EditValue muted={!hasGetSongBpmKey(key)}>{status}</EditValue>
      </EditRow>
      <GetSongBpmKeySheet visible={open} onDismiss={hide} />
    </>
  );
}
