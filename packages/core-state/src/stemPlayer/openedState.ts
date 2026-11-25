import { meterOverrideOf, type StemSetRecord } from '@kitbag/core-db';

import { songLyrics } from './lyrics.ts';
import { sortedSections } from './sections.ts';
import { wholeKey } from './speedKey.ts';
import type { StemPlayerState, StemRow } from './store.ts';
import { songGrid } from './tempoActions.ts';
import { longestSeconds, tempoModeOf } from './tempoGrid.ts';
import { secondsToFrames } from './time.ts';

export interface StemOpening {
  readonly engineRate: number;
  readonly speed: number;
  readonly stems: readonly StemRow[];
  readonly masterGain: number;
}

export function openedStemState(
  record: StemSetRecord,
  { engineRate, speed, stems, masterGain }: StemOpening,
): {
  readonly marked: readonly number[];
  readonly state: Partial<StemPlayerState>;
} {
  const songKey = wholeKey(record.pitch);
  const meterOverride = meterOverrideOf(record);
  const grid = songGrid(record, tempoModeOf(record), meterOverride, {
    speed,
    key: songKey,
  });
  return {
    marked: grid.marked,
    state: {
      status: 'ready',
      title: record.songTitle ?? record.title,
      artist: record.artist,
      ...grid.state,
      meterOverride,
      speed,
      songKey,
      tempo: record.tempo,
      stems,
      overLimit: record.stems.length - stems.length,
      masterGain,
      engineRate,
      durationFrames: secondsToFrames(longestSeconds(record), engineRate),
      clickGrouping: record.clickGrouping,
      clickRate: record.clickRate,
      sections: sortedSections(record.sections),
      lyrics: songLyrics(record.lyrics, record.lyricsRetimed),
    },
  };
}
