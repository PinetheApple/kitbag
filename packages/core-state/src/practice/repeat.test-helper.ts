import {
  loggedSettingsOf,
  PRACTICE_LOG_VERSION,
  type LoggedSetlist,
  type LoggedSong,
  type LoggedStretch,
  type PracticeLog,
} from '@kitbag/core-db';

import { presetFromMetronome } from '../library/presetMapping.ts';
import { isPresetEntry } from '../library/snapshot.ts';
import { setup } from '../library/store.test-helper.ts';
import type { MetronomeConfig } from '../metronome/store.ts';

const MINUTE = 60_000;

export const COUNT_IN = { bars: 2, distinct: true, sound: 3 } as const;

export function stretchOf(
  config: MetronomeConfig,
  index: number,
  song: LoggedSong | null,
  setlist: LoggedSetlist | null,
  bpm: number,
): LoggedStretch {
  return {
    from: index * MINUTE,
    to: (index + 1) * MINUTE,
    end: 'song',
    song,
    setlist,
    settings: loggedSettingsOf({
      ...presetFromMetronome(config),
      bpm,
      countInBars: COUNT_IN.bars,
    }),
    countIn: COUNT_IN,
    tempo: [],
    endBpm: bpm,
    avgBpm: bpm,
  };
}

export async function gig() {
  const h = setup();
  const s = h.library.getState();
  const setlistId = await s.createSetlist('Gig');
  const firstId = await s.newSongFromCurrent('First', setlistId);
  const secondId = await s.newSongFromCurrent('Second', setlistId);
  const state = h.library.getState();
  const entries = (state.entries[setlistId] ?? []).filter(isPresetEntry);
  const byId = (id: number) => {
    const preset = state.presets.find((p) => p.id === id);
    if (preset === undefined) throw new Error('missing preset');
    return preset;
  };
  const summary = state.setlists.find((x) => x.setlist.id === setlistId);
  if (summary === undefined) throw new Error('missing setlist');
  const first = byId(firstId);
  const second = byId(secondId);
  const place = (position: number): LoggedSetlist => ({
    uuid: summary.setlist.uuid,
    name: 'Gig',
    position,
  });
  const song = (preset: typeof first): LoggedSong => ({
    uuid: preset.uuid,
    title: preset.name,
  });
  const config = h.metronome.getState();
  const log = (bpms: readonly [number, number, number]): PracticeLog => ({
    v: PRACTICE_LOG_VERSION,
    stretches: [
      stretchOf(config, 0, song(second), place(2), bpms[0]),
      stretchOf(config, 1, song(first), place(1), bpms[1]),
      stretchOf(config, 2, song(second), place(2), bpms[2]),
    ],
  });
  return { ...h, setlistId, entries, first, second, log };
}
