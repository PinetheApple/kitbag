import { manualTempo } from './manualTempoRoles.ts';

const SLOTS = manualTempo.stripBeats;
const BEFORE_BAR_ONE = manualTempo.stripBeatsBeforeBarOne;
const BEAT_CENTRE = 0.5;

export const FIRST_STRIP_BEAT = -BEFORE_BAR_ONE;

export function stripPlayheadFraction(start: number, beat: number): number {
  'worklet';
  return (beat - start + BEAT_CENTRE) / SLOTS;
}

export function stripWindowStart(start: number, beat: number): number {
  'worklet';
  const fraction = stripPlayheadFraction(start, beat);
  if (fraction >= 0 && fraction < 1) return start;
  return Math.round(beat) - BEFORE_BAR_ONE;
}

export function isStripDownbeat(beat: number, beatsPerBar: number): boolean {
  'worklet';
  return ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar === 0;
}
