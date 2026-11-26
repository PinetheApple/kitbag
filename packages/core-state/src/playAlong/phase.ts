import { MS_PER_SECOND } from '@kitbag/core-db';

import { clamp } from '../metronome/config.ts';
import type { BeatDirection } from '../stemPlayer/beatStep.ts';
import { usableDownbeats } from '../stemPlayer/bars.ts';
import {
  detectedMeter,
  type DetectedGrid,
} from '../stemPlayer/meterOverride.ts';
import type { PlayAlongPattern } from './pattern.ts';
import { beatSeconds } from './position.ts';

const BEAT_HALVES = 2;

const FINE_STEP_MS = 1;
const MEDIUM_STEP_MS = 10;
const COARSE_STEP_MS = 50;

export const PHASE_STEPS_MS = [
  FINE_STEP_MS,
  MEDIUM_STEP_MS,
  COARSE_STEP_MS,
] as const;

export type PhaseStepMs = (typeof PHASE_STEPS_MS)[number];

export const DEFAULT_PHASE_STEP_MS: PhaseStepMs = MEDIUM_STEP_MS;

export interface LockPhase {
  readonly phaseOffsetMs: number;
  readonly downbeatShift: number;
  readonly downbeatShiftAvailable: boolean;
  readonly gridDownbeats: readonly number[] | undefined;
}

export interface PhaseState {
  readonly phaseStepMs: PhaseStepMs;
  readonly latencyOffsetMs: number;
}

export interface PhaseActions {
  readonly nudgePhase: (direction: BeatDirection) => void;
  readonly setPhaseOffset: (ms: number) => void;
  readonly setPhaseStep: (step: PhaseStepMs) => void;
  readonly shiftDownbeat: (direction: BeatDirection) => void;
  readonly resetPhase: () => void;
}

export const UNSHIFTED_PHASE = {
  phaseOffsetMs: 0,
  downbeatShift: 0,
  gridDownbeats: undefined,
} as const satisfies Partial<LockPhase>;

export const tapPhase = (): LockPhase => ({
  ...UNSHIFTED_PHASE,
  downbeatShiftAvailable: true,
});

export const gridPhase = (grid: DetectedGrid): LockPhase => ({
  ...UNSHIFTED_PHASE,
  downbeatShiftAvailable:
    usableDownbeats(grid.downbeatIndices, grid.beats.length).length > 0,
});

export function phaseLimitMs(
  bpm: number,
  denominator: number,
  speed: number,
): number {
  return Math.trunc(
    (beatSeconds(bpm * speed, denominator) * MS_PER_SECOND) / BEAT_HALVES,
  );
}

function wholeMs(ms: number): number {
  const whole = Math.sign(ms) * Math.round(Math.abs(ms));
  return whole === 0 ? 0 : whole;
}

export function clampPhase(
  ms: number,
  bpm: number,
  denominator: number,
  speed: number,
): number {
  const limit = phaseLimitMs(bpm, denominator, speed);
  return clamp(wholeMs(ms), -limit, limit);
}

export const wrappedShift = (shift: number, beatsPerBar: number): number =>
  ((shift % beatsPerBar) + beatsPerBar) % beatsPerBar;

export const nextShift = (
  shift: number,
  direction: BeatDirection,
  beatsPerBar: number,
): number => wrappedShift(shift + direction, beatsPerBar);

export const lockBeatsPerBar = (
  grid: DetectedGrid | undefined,
  pattern: Pick<PlayAlongPattern, 'beatsPerBar'>,
): number =>
  grid === undefined ? pattern.beatsPerBar : detectedMeter(grid).meter;

export function shiftedDownbeats(
  grid: DetectedGrid,
  shift: number,
  beatsPerBar: number,
): readonly number[] {
  if (shift === 0) return grid.downbeatIndices;
  const moved = grid.downbeatIndices
    .map((index) => index + shift)
    .filter((index) => index < grid.beats.length);
  const [first] = moved;
  const [original] = grid.downbeatIndices;
  if (first === undefined || original === undefined) return moved;
  if (original >= beatsPerBar) return moved;
  const leadingDownbeat = first - beatsPerBar;
  return leadingDownbeat >= 0 ? [leadingDownbeat, ...moved] : moved;
}

export const shiftedPhase = (
  lock: { readonly grid: DetectedGrid | undefined },
  downbeatShift: number,
  beatsPerBar: number,
): Pick<LockPhase, 'downbeatShift' | 'gridDownbeats'> => ({
  downbeatShift,
  gridDownbeats:
    lock.grid && shiftedDownbeats(lock.grid, downbeatShift, beatsPerBar),
});

export const fittedPhase = (
  lock: LockPhase & {
    readonly bpm: number;
    readonly grid: DetectedGrid | undefined;
  },
  pattern: Pick<PlayAlongPattern, 'beatsPerBar' | 'denominator'>,
  speed: number,
): Pick<LockPhase, 'phaseOffsetMs' | 'downbeatShift'> => ({
  phaseOffsetMs: clampPhase(
    lock.phaseOffsetMs,
    lock.bpm,
    pattern.denominator,
    speed,
  ),
  downbeatShift: wrappedShift(
    lock.downbeatShift,
    lockBeatsPerBar(lock.grid, pattern),
  ),
});

export function shiftedDownbeatSec(
  downbeatSec: number,
  shift: number,
  bpm: number,
  denominator: number,
): number {
  return downbeatSec + shift * beatSeconds(bpm, denominator);
}
