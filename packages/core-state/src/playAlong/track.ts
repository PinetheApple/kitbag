import type { SongIdentity } from '@kitbag/core-db';
import type { MediaSessionSnapshot } from '@kitbag/core-native';

export type PlayAlongTrack = Pick<
  MediaSessionSnapshot,
  'title' | 'artist' | 'durationMs'
>;

export const findSession = (
  sessions: readonly MediaSessionSnapshot[],
  sessionId: string | undefined,
) => sessions.find((session) => session.sessionId === sessionId);

export const trackOf = ({
  title,
  artist,
  durationMs,
}: MediaSessionSnapshot): PlayAlongTrack => ({ title, artist, durationMs });

export const sameTrack = (track: PlayAlongTrack, seen: MediaSessionSnapshot) =>
  track.title === seen.title &&
  track.artist === seen.artist &&
  (track.durationMs === null || track.durationMs === seen.durationMs);

export const songOf = ({ title, artist }: PlayAlongTrack): SongIdentity => ({
  title: title ?? '',
  artist: artist ?? '',
});
