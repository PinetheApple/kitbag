import type { MediaSessionSnapshot } from '@kitbag/core-native';
import type { PlayAlongLock } from '@kitbag/core-state';

type PlayingTrack = Pick<
  MediaSessionSnapshot,
  'sessionId' | 'title' | 'artist'
>;

export function endedByTrackChange(
  lock: PlayAlongLock | undefined,
  playing: PlayingTrack | undefined,
): boolean {
  if (lock === undefined || playing === undefined) return false;
  if (playing.sessionId !== lock.sessionId) return false;
  return (
    playing.title !== lock.track.title || playing.artist !== lock.track.artist
  );
}
