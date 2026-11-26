import { MS_PER_SECOND } from '@kitbag/core-db';

import { clamp } from '../metronome/config.ts';
import type { BeatDirection } from '../stemPlayer/beatStep.ts';
import type { DetectedGrid } from '../stemPlayer/meterOverride.ts';
import type { PlayAlongPattern } from './pattern.ts';
import { barSeconds } from './position.ts';

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

type Meter = Pick<PlayAlongPattern, 'beatsPerBar' | 'denominator'>;

export const UNSHIFTED_PHASE: LockPhase = {
  phaseOffsetMs: 0,
  downbeatShift: 0,
};

export function phaseLimitMs(bpm: number, denominator: number): number {
  return (barSeconds(bpm, 1, denominator) * MS_PER_SECOND) / BEAT_HALVES;
}

export function clampPhase(ms: number, bpm: number, denominator: number) {
  const limit = phaseLimitMs(bpm, denominator);
  return clamp(ms, -limit, limit);
}

export function shiftedDownbeat(
  shift: number,
  direction: BeatDirection | 0,
  beatsPerBar: number,
): number {
  return (((shift + direction) % beatsPerBar) + beatsPerBar) % beatsPerBar;
}

export const fittedPhase = (
  phase: LockPhase,
  bpm: number,
  meter: Meter,
): LockPhase => ({
  phaseOffsetMs: clampPhase(phase.phaseOffsetMs, bpm, meter.denominator),
  downbeatShift: shiftedDownbeat(phase.downbeatShift, 0, meter.beatsPerBar),
});

export function shiftedGrid(
  grid: DetectedGrid,
  shift: number,
  beatsPerBar: number,
): DetectedGrid {
  const moved = grid.downbeatIndices
    .map((index) => index + shift)
    .filter((index) => index < grid.beats.length);
  const before = (moved[0] ?? beatsPerBar) - beatsPerBar;
  return {
    beats: grid.beats,
    downbeatIndices: before >= 0 ? [before, ...moved] : moved,
  };
}

export function downbeatSecOf(
  downbeatSec: number,
  shift: number,
  bpm: number,
  meter: Meter,
): number {
  const bar = barSeconds(bpm, meter.beatsPerBar, meter.denominator);
  return downbeatSec + (shift * bar) / meter.beatsPerBar;
}
