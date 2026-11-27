import {
  MS_PER_SECOND,
  SAME_SONG_DURATION_TOLERANCE_SEC,
  songMatchKey,
  type SongIdentity,
  type SongPreset,
  type SongPresetRepository,
} from '@kitbag/core-db';
import type { MediaSessionSnapshot } from '@kitbag/core-native';

import { sameSong } from '../tempoLadder/store.ts';
import { songOf } from './track.ts';

export interface TrackIdentity {
  readonly song: SongIdentity;
  readonly source: string;
  readonly lengthSeconds: number | null;
}

export type PresetLookup = Pick<
  SongPresetRepository,
  'list' | 'forLibrarySong'
>;

export function identityOf(
  seen: MediaSessionSnapshot,
): TrackIdentity | undefined {
  const song = songOf(seen);
  if (songMatchKey(song).title === '') return undefined;
  return {
    song,
    source: seen.packageName,
    lengthSeconds:
      seen.durationMs === null ? null : seen.durationMs / MS_PER_SECOND,
  };
}

function sameLength(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= SAME_SONG_DURATION_TOLERANCE_SEC;
}

export const sameIdentity = (
  a: TrackIdentity | undefined,
  b: TrackIdentity | undefined,
): boolean =>
  a === undefined || b === undefined
    ? a === b
    : sameSong(a.song, b.song) &&
      a.source === b.source &&
      sameLength(a.lengthSeconds, b.lengthSeconds);

const presetIdentity = (preset: SongPreset): TrackIdentity | undefined =>
  preset.title === null || preset.source === null
    ? undefined
    : {
        song: { title: preset.title, artist: preset.artist ?? '' },
        source: preset.source,
        lengthSeconds: preset.lengthSeconds,
      };

export async function presetForTrack(
  presets: PresetLookup,
  identity: TrackIdentity,
  songId: number | undefined,
): Promise<SongPreset | undefined> {
  const linked =
    songId === undefined ? undefined : await presets.forLibrarySong(songId);
  if (linked !== undefined) return linked;
  return (await presets.list()).find(
    (preset) =>
      (songId === undefined || preset.librarySongId === null) &&
      sameIdentity(presetIdentity(preset), identity),
  );
}
