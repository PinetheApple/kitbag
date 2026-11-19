import type { BarMark, MeterOverride } from '@kitbag/core-db';

import { impliedMeter, type BarMeterSong } from './barMeter.ts';
import { barLength, barMarkDownbeats, usableDownbeats } from './bars.ts';
import { nearestBeat } from './loop.ts';

export type DetectedGrid = BarMeterSong;

function barOneAt(downbeats: readonly number[], meter: number): number {
  const [first, second] = downbeats;
  const pickup =
    first !== undefined && second !== undefined && second - first < meter;
  return pickup ? 1 : 0;
}

function shiftedBars(
  downbeats: readonly number[],
  barOne: number,
  meter: number,
): BarMark[] {
  const shift = barOne - (downbeats[0] ?? barOne);
  return downbeats.map((beat, bar) => ({
    beat: beat + shift,
    beatsPerBar: barLength(downbeats, bar) ?? meter,
  }));
}

export function isMeterOverridden({
  meterBeatsPerBar,
  barOneSeconds,
}: MeterOverride): boolean {
  return meterBeatsPerBar !== null || barOneSeconds !== null;
}

export interface DetectedMeter {
  readonly meter: number;
  readonly barOneSeconds: number;
}

export function detectedMeter({
  beats,
  downbeatIndices,
}: DetectedGrid): DetectedMeter {
  const detected = usableDownbeats(downbeatIndices, beats.length);
  const meter = impliedMeter(detected);
  const barOne = detected[barOneAt(detected, meter)] ?? 0;
  return { meter, barOneSeconds: beats[barOne] ?? 0 };
}

export function overrideDownbeats(
  { beats, downbeatIndices }: DetectedGrid,
  { meterBeatsPerBar, barOneSeconds }: MeterOverride,
): readonly number[] {
  if (meterBeatsPerBar === null && barOneSeconds === null)
    return downbeatIndices;
  const detected = usableDownbeats(downbeatIndices, beats.length);
  const meter = impliedMeter(detected);
  const fromBarOne = detected.slice(barOneAt(detected, meter));
  const barOne =
    barOneSeconds === null
      ? (fromBarOne[0] ?? 0)
      : (nearestBeat(beats, barOneSeconds) ?? 0);
  const beatsPerBar = meterBeatsPerBar ?? meter;
  const pattern =
    meterBeatsPerBar === null ? shiftedBars(fromBarOne, barOne, meter) : [];
  return barMarkDownbeats(
    [{ beat: barOne % beatsPerBar, beatsPerBar }, ...pattern],
    beats.length,
  );
}
