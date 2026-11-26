import { FACT_SEPARATOR, type SegmentOption } from '@kitbag/core-design';
import type { MediaSessionSnapshot } from '@kitbag/core-native';
import {
  formatOffsetMs,
  MINUS,
  PHASE_STEPS_MS,
  type PhaseStepMs,
} from '@kitbag/core-state';

import { shownBpm } from './tempoLine.ts';

const HALF_BEAT = '½ beat';
const PERCENT = 100;
const HALVES_PER_BEAT = 2;
const SHARE_TENTHS = 10;
const FLOAT_NOISE_DIGITS = 12;
const FIRST_BEAT = 1;
const NORMAL_SPEED = 1;
const CENTRE = 0.5;

export function beatShareHint(
  offsetMs: number,
  limitMs: number,
  heardBpm: number,
): string {
  const share = ((Math.abs(offsetMs) / limitMs) * PERCENT) / HALVES_PER_BEAT;
  // 10 ms at 171 BPM computes as 2.8499…; trimming the noise lets it round to 2.9.
  const exact = Number(share.toPrecision(FLOAT_NOISE_DIGITS));
  const shown = Math.round(exact * SHARE_TENTHS) / SHARE_TENTHS;
  return `${String(shown)}% of a beat at ${shownBpm(heardBpm)} BPM`;
}

export function phaseRangeEnds(limitMs: number): {
  readonly start: string;
  readonly end: string;
} {
  const ms = String(Math.round(limitMs));
  return {
    start: `${MINUS}${HALF_BEAT}${FACT_SEPARATOR}${MINUS}${ms} ms`,
    end: `+${ms} ms${FACT_SEPARATOR}+${HALF_BEAT}`,
  };
}

export function phaseThumbFraction(offsetMs: number, limitMs: number): number {
  if (limitMs <= 0) return CENTRE;
  const fraction = CENTRE + (offsetMs / limitMs) * CENTRE;
  return Math.min(1, Math.max(0, fraction));
}

const signedPlain = (ms: number): string =>
  ms < 0 ? `${MINUS}${String(-ms)}` : String(ms);

export function phaseTotal(
  routeMs: number,
  songMs: number,
): { readonly total: string; readonly parts: string } {
  const join = songMs < 0 ? MINUS : '+';
  return {
    total: `${formatOffsetMs(routeMs + songMs)} total`,
    parts: `· ${signedPlain(routeMs)} route ${join} ${String(Math.abs(songMs))} song`,
  };
}

export const downbeatLabel = (shift: number): string =>
  `Beat ${String(shift + FIRST_BEAT)}`;

export const PHASE_STEP_OPTIONS: readonly SegmentOption<string>[] =
  PHASE_STEPS_MS.map((ms) => ({
    value: String(ms),
    label: `${String(ms)} ms`,
    accessibilityLabel: `Step ${String(ms)} milliseconds`,
  }));

export const phaseStepFromOption = (value: string): PhaseStepMs | undefined =>
  PHASE_STEPS_MS.find((ms) => String(ms) === value);

export function heardSpeed(
  session: Pick<MediaSessionSnapshot, 'speed'> | undefined,
): number {
  const speed = session?.speed;
  return speed !== undefined && speed > 0 ? speed : NORMAL_SPEED;
}
