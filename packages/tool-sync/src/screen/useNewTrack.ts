import type { MediaSessionSnapshot } from '@kitbag/core-native';
import type { PlayAlongLock } from '@kitbag/core-state';
import { useCallback, useEffect, useRef, useState } from 'react';

import { endedByTrackChange } from '../logic/trackChange.ts';

type Track = Pick<MediaSessionSnapshot, 'sessionId' | 'title' | 'artist'>;

const sameTrack = (a: Track, b: Track) =>
  a.sessionId === b.sessionId && a.title === b.title && a.artist === b.artist;

export interface NewTrack {
  readonly newTrack: boolean;
  readonly noticeShown: boolean;
  readonly hideNotice: () => void;
}

export function useNewTrack(
  session: MediaSessionSnapshot | undefined,
  lock: PlayAlongLock | undefined,
): NewTrack {
  const [changedTo, setChangedTo] = useState<Track | undefined>(undefined);
  const [noticeShown, setNoticeShown] = useState(false);
  const previous = useRef(lock);

  useEffect(() => {
    if (lock === undefined && endedByTrackChange(previous.current, session)) {
      setChangedTo(session);
      setNoticeShown(true);
    }
    previous.current = lock;
  }, [lock, session]);

  const hideNotice = useCallback(() => {
    setNoticeShown(false);
  }, []);

  const newTrack =
    lock === undefined &&
    changedTo !== undefined &&
    session !== undefined &&
    sameTrack(changedTo, session);
  return { newTrack, noticeShown: noticeShown && newTrack, hideNotice };
}
