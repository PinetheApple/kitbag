import { TEMPO_RATIO, type TempoCorrection } from '@kitbag/core-db';

import { barMarkDownbeats } from './bars.ts';
import { nearestBeat } from './loop.ts';
import { detectedMeter, type DetectedGrid } from './meterOverride.ts';

function beatAt(
  beats: readonly number[],
  step: number,
  beatsOut: number,
): number {
  const whole = Math.floor(step / beatsOut);
  const from = beats[whole] ?? 0;
  const part = step - whole * beatsOut;
  if (part === 0) return from;
  const to = beats[whole + 1] ?? from;
  return from + ((to - from) * part) / beatsOut;
}

// Steps count in 1/beatsOut of an original interval, so every scaled beat is an
// exact fraction and the anchor beat is always one of them.
export function scaleBeats(
  beats: readonly number[],
  correction: TempoCorrection,
  anchorIndex = 0,
): readonly number[] {
  const { beatsOut, beatsIn } = TEMPO_RATIO[correction];
  if (beatsOut === beatsIn || beats.length === 0) return beats;
  const lastStep = (beats.length - 1) * beatsOut;
  const scaled: number[] = [];
  for (
    let step = (anchorIndex * beatsOut) % beatsIn;
    step <= lastStep;
    step += beatsIn
  )
    scaled.push(beatAt(beats, step, beatsOut));
  return scaled;
}

export function correctedGrid(
  grid: DetectedGrid,
  correction: TempoCorrection,
  barOneSeconds: number,
): DetectedGrid {
  const anchor = nearestBeat(grid.beats, barOneSeconds) ?? 0;
  const beats = scaleBeats(grid.beats, correction, anchor);
  if (beats === grid.beats) return grid;
  const { meter } = detectedMeter(grid);
  const barOne = nearestBeat(beats, barOneSeconds) ?? 0;
  return {
    beats,
    downbeatIndices: barMarkDownbeats(
      [{ beat: barOne % meter, beatsPerBar: meter }],
      beats.length,
    ),
  };
}
