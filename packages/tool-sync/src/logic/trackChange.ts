import type { MediaSessionSnapshot } from '@kitbag/core-native';
import type { PlayAlongLock } from '@kitbag/core-state';

export type PlayingTrack = Pick<
  MediaSessionSnapshot,
  'sessionId' | 'title' | 'artist'
>;

export function sameTrack(a: PlayingTrack, b: PlayingTrack): boolean {
  return (
    a.sessionId === b.sessionId && a.title === b.title && a.artist === b.artist
  );
}

export function endedByTrackChange(
  lock: PlayAlongLock | undefined,
  playing: PlayingTrack | undefined,
): boolean {
  if (lock === undefined || playing === undefined) return false;
  if (playing.sessionId !== lock.sessionId) return false;
  return !sameTrack({ sessionId: lock.sessionId, ...lock.track }, playing);
}
