import {
  ARRIVAL,
  arrivalStore,
  useSongPlayer,
  type QueuedSong,
} from '@kitbag/core-state';
import { useCallback, useEffect, useRef } from 'react';

export interface QueueFollow {
  readonly songId: number;
  readonly onOpenStemSet: (stemSetId: number) => void;
  readonly onOpenSong: (songId: number) => void;
}

function followTo(song: QueuedSong, follow: QueueFollow): boolean {
  if (song.kind === 'stems') {
    follow.onOpenStemSet(song.id);
    return true;
  }
  if (song.id !== follow.songId) follow.onOpenSong(song.id);
  return false;
}

export function useLeaveOnStop(
  focused: boolean,
  onBack: () => void,
  follow: QueueFollow,
) {
  const idle = useSongPlayer((s) => s.status === 'idle');
  const seenOpen = useRef(false);
  const left = useRef(false);
  const leave = useCallback(() => {
    left.current = true;
    onBack();
  }, [onBack]);
  useEffect(() => {
    if (!focused) {
      seenOpen.current = false;
      left.current = false;
      return;
    }
    if (!idle) seenOpen.current = true;
    else if (seenOpen.current && !left.current) leave();
  }, [focused, idle, leave]);
  useEffect(() => {
    if (!focused) return undefined;
    return arrivalStore.subscribe(({ arrival }) => {
      if (arrival?.kind !== ARRIVAL.arriving) return;
      if (followTo(arrival.song, follow)) left.current = true;
    });
  }, [focused, follow]);
  return leave;
}
