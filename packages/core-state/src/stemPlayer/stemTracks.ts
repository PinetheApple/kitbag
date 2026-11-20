import { KB_MAX_TRACKS, KB_RESULT } from '@kitbag/core-native';
import type { StemSetRecord } from '@kitbag/core-db';

import { UNSHIFTED_KEY } from './mix.ts';
import type { StemPlayerRuntime } from './runtime.ts';
import { transposable, wholeKey } from './speedKey.ts';
import type { StemRow } from './store.ts';
import { longestSeconds } from './tempoGrid.ts';

export function rowsOf(record: StemSetRecord): StemRow[] {
  const longest = longestSeconds(record);
  return record.stems.slice(0, KB_MAX_TRACKS).map((stem) => ({
    id: stem.id,
    name: stem.name,
    role: stem.role,
    transposable: transposable(stem.role),
    key: wholeKey(stem.pitch),
    volume: stem.volume,
    muted: stem.muted,
    soloed: stem.soloed,
    loaded: false,
    envelope: null,
    extent: longest > 0 ? stem.durationSec / longest : 1,
  }));
}

// Unload resets a track's key, so only a shifted stem needs one sent.
async function sendKey(
  commands: StemPlayerRuntime['commands'],
  row: StemRow,
  track: number,
): Promise<StemRow> {
  if (!row.transposable || row.key === UNSHIFTED_KEY) return row;
  const result = await commands
    .mixerSetTrackPitch(track, row.key)
    .catch(() => KB_RESULT.KB_ERROR_INTERNAL);
  if (result === KB_RESULT.KB_OK) return row;
  console.warn('[kitbag] stem key not applied', result);
  return { ...row, key: UNSHIFTED_KEY };
}

export async function loadTracks(
  runtime: StemPlayerRuntime,
  record: StemSetRecord,
  rows: readonly StemRow[],
  isLive: () => boolean,
): Promise<StemRow[]> {
  const { commands } = runtime;
  const results = await Promise.all(
    rows.map((_, track) =>
      commands
        .loadTrack(track, record.stems[track]?.filePath ?? '')
        .catch(() => KB_RESULT.KB_ERROR_INVALID_ARGUMENT),
    ),
  );
  // The mixer ignores mix commands for a track it has not loaded yet.
  return Promise.all(
    rows.map((row, track) => {
      const loaded = results[track] === KB_RESULT.KB_OK;
      if (!loaded || !isLive()) return Promise.resolve({ ...row, loaded });
      commands.mixerSetGain(track, row.volume);
      commands.mixerSetMute(track, row.muted);
      commands.mixerSetSolo(track, row.soloed);
      return sendKey(commands, { ...row, loaded }, track);
    }),
  );
}
