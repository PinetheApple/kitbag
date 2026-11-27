import type { MediaSessionSnapshot } from '@kitbag/core-native';
import { UNLOCK_REASON, type PlayAlongLock } from '@kitbag/core-state';
import { useCallback, useEffect, useState } from 'react';

import { usePlayAlong } from './playAlongHooks.ts';
import { useLastSeen } from './useLastSeen.ts';

export interface NewTrack {
  readonly newTrack: boolean;
  readonly noticeShown: boolean;
  readonly hideNotice: () => void;
}

export function useNewTrack(
  session: MediaSessionSnapshot | undefined,
  lock: PlayAlongLock | undefined,
): NewTrack {
  const trackChanged = usePlayAlong(
    (s) => s.unlockReason === UNLOCK_REASON.trackChanged,
  );
  const endedOn = useLastSeen(lock?.sessionId);
  const newTrack =
    lock === undefined &&
    trackChanged &&
    session !== undefined &&
    session.sessionId === endedOn;
  const [noticeShown, setNoticeShown] = useState(false);

  useEffect(() => {
    setNoticeShown(newTrack);
  }, [newTrack]);

  const hideNotice = useCallback(() => {
    setNoticeShown(false);
  }, []);

  return { newTrack, noticeShown: noticeShown && newTrack, hideNotice };
}
