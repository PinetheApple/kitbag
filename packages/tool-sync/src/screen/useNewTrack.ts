import { UNLOCK_REASON, type PlayAlongLock } from '@kitbag/core-state';
import { useCallback, useEffect, useState } from 'react';

import { usePlayAlong } from './playAlongHooks.ts';

export interface NewTrack {
  readonly newTrack: boolean;
  readonly noticeShown: boolean;
  readonly hideNotice: () => void;
}

export function useNewTrack(lock: PlayAlongLock | undefined): NewTrack {
  const trackChanged = usePlayAlong(
    (s) => s.unlockReason === UNLOCK_REASON.trackChanged,
  );
  const newTrack = lock === undefined && trackChanged;
  const [noticeShown, setNoticeShown] = useState(false);

  useEffect(() => {
    setNoticeShown(newTrack);
  }, [newTrack]);

  const hideNotice = useCallback(() => {
    setNoticeShown(false);
  }, []);

  return { newTrack, noticeShown: noticeShown && newTrack, hideNotice };
}
