import { ARRIVAL, arrivalStore, type QueuedSong } from '@kitbag/core-state';
import { useEffect } from 'react';

export interface QueueFollow {
  readonly songId: number;
  readonly onOpenStemSet: (stemSetId: number) => void;
  readonly onOpenSong: (songId: number) => void;
}

function follows(song: QueuedSong, songId: number): boolean {
  return song.kind === 'stems' || song.id !== songId;
}

export function useFollowQueueArrivals(
  focused: boolean,
  follow: QueueFollow,
  markLeft: () => void,
) {
  useEffect(() => {
    if (!focused) return undefined;
    return arrivalStore.subscribe(({ arrival }) => {
      if (arrival?.kind !== ARRIVAL.arriving) return;
      const { song } = arrival;
      if (!follows(song, follow.songId)) return;
      markLeft();
      if (song.kind === 'stems') follow.onOpenStemSet(song.id);
      else follow.onOpenSong(song.id);
    });
  }, [focused, follow, markLeft]);
}
