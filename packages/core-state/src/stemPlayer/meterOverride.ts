import type { MeterOverride, SongRecord } from '@kitbag/core-db';

import { impliedMeter } from './barMeter.ts';

export type DetectedGrid = Pick<SongRecord, 'beats' | 'downbeatIndices'>;

export function nearestBeat(
  beats: readonly number[],
  seconds: number,
): number | null {
  if (beats.length === 0) return null;
  let low = 0;
  let high = beats.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if ((beats[mid] ?? seconds) < seconds) low = mid + 1;
    else high = mid;
  }
  const before = low - 1;
  if (before < 0) return low;
  const after = Math.abs((beats[low] ?? seconds) - seconds);
  return Math.abs(seconds - (beats[before] ?? seconds)) <= after ? before : low;
}

function everyBar(
  anchor: number,
  beatsPerBar: number,
  beatCount: number,
): readonly number[] {
  const downbeats: number[] = [];
  for (let beat = anchor % beatsPerBar; beat < beatCount; beat += beatsPerBar)
    downbeats.push(beat);
  return downbeats;
}

export function overrideDownbeats(
  { beats, downbeatIndices }: DetectedGrid,
  { meterBeatsPerBar, barOneSeconds }: MeterOverride,
): readonly number[] {
  if (meterBeatsPerBar === null && barOneSeconds === null)
    return downbeatIndices;
  if (beats.length === 0) return [];
  const anchor =
    barOneSeconds === null
      ? (downbeatIndices[0] ?? 0)
      : (nearestBeat(beats, barOneSeconds) ?? 0);
  return everyBar(
    anchor,
    meterBeatsPerBar ?? impliedMeter(downbeatIndices),
    beats.length,
  );
}
