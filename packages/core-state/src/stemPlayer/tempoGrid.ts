import {
  TEMPO_MODE,
  type BarMark,
  type BundleTempo,
  type FittedTempo,
  type StemSetRecord,
  type TempoMode,
} from '@kitbag/core-db';

import { SECONDS_PER_MINUTE } from '../text.ts';
import { barMarkDownbeats } from './bars.ts';
import type { DetectedGrid } from './meterOverride.ts';

// StemDeck's TEMPO_EDGE_EPS: a beat landing exactly on either end survives float error.
const EDGE_EPSILON = 1e-9;
const BEAT_TIME_DECIMALS = 6;

export type TempoSong = Pick<
  StemSetRecord,
  'beats' | 'bars' | 'tempo' | 'chosenTempoMode' | 'stems'
>;

export interface ConstantBeats {
  readonly beats: readonly number[];
  readonly anchorIndex: number;
}

const roundBeat = (seconds: number) =>
  Number(seconds.toFixed(BEAT_TIME_DECIMALS));

export function constantBeats(
  bpm: number,
  anchor: number,
  duration: number,
): ConstantBeats {
  const period = SECONDS_PER_MINUTE / bpm;
  const first = -Math.floor(anchor / period + EDGE_EPSILON);
  const last = Math.floor((duration - anchor) / period + EDGE_EPSILON);
  const beats: number[] = [];
  for (let n = first; n <= last; n++) {
    const beat = roundBeat(anchor + n * period);
    if (beat >= 0 && beat <= duration) beats.push(beat);
  }
  return { beats, anchorIndex: -first };
}

export function constantBars(
  anchorIndex: number,
  beatsPerBar: number,
): BarMark[] {
  return [{ beat: anchorIndex % beatsPerBar, beatsPerBar }];
}

export function longestSeconds({ stems }: Pick<TempoSong, 'stems'>): number {
  return Math.max(0, ...stems.map((stem) => stem.durationSec));
}

export function gridBpm(
  { bpm, tempo }: Pick<StemSetRecord, 'bpm' | 'tempo'>,
  mode: TempoMode | null,
): number | null {
  return mode === TEMPO_MODE.constant ? (tempo?.bpm ?? bpm) : bpm;
}

export function tempoModeOf({
  tempo,
  chosenTempoMode,
}: Pick<TempoSong, 'tempo' | 'chosenTempoMode'>): TempoMode | null {
  return chosenTempoMode ?? tempo?.mode ?? null;
}

function rebuiltGrid(
  { bpm, anchor, beatsPerBar }: FittedTempo,
  duration: number,
): DetectedGrid {
  const { beats, anchorIndex } = constantBeats(bpm, anchor, duration);
  const bars = constantBars(anchorIndex, beatsPerBar);
  return { beats, downbeatIndices: barMarkDownbeats(bars, beats.length) };
}

export function tempoGrid(
  stored: DetectedGrid,
  tempo: BundleTempo | null,
  mode: TempoMode | null,
  durationSec: number,
): DetectedGrid {
  if (mode !== TEMPO_MODE.constant || tempo?.mode !== TEMPO_MODE.follow)
    return stored;
  const { bpm, anchor, beatsPerBar } = tempo;
  if (bpm === null || anchor === null) return stored;
  return rebuiltGrid({ bpm, anchor, beatsPerBar }, durationSec);
}

export function effectiveGrid(
  song: TempoSong,
  mode: TempoMode | null = tempoModeOf(song),
): DetectedGrid {
  const stored = {
    beats: song.beats,
    downbeatIndices: barMarkDownbeats(song.bars, song.beats.length),
  };
  return tempoGrid(stored, song.tempo, mode, longestSeconds(song));
}
