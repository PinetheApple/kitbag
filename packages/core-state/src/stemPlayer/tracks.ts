import type { StemSetRecord } from '@kitbag/core-db';
import { KB_MAX_TRACKS, KB_RESULT } from '@kitbag/core-native';

import type { StemPlayerRuntime } from './runtime.ts';
import type { StemRow } from './store.ts';
import { longestSeconds } from './tempoGrid.ts';

export function rowsOf(record: StemSetRecord): StemRow[] {
  const longest = longestSeconds(record);
  return record.stems.slice(0, KB_MAX_TRACKS).map((stem) => ({
    id: stem.id,
    name: stem.name,
    volume: stem.volume,
    muted: stem.muted,
    soloed: stem.soloed,
    loaded: false,
    envelope: null,
    extent: longest > 0 ? stem.durationSec / longest : 1,
  }));
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
  return rows.map((row, track) => {
    const loaded = results[track] === KB_RESULT.KB_OK;
    if (loaded && isLive()) {
      commands.mixerSetGain(track, row.volume);
      commands.mixerSetMute(track, row.muted);
      commands.mixerSetSolo(track, row.soloed);
    }
    return { ...row, loaded };
  });
}
