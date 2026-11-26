import type { BeatDirection } from '../stemPlayer/beatStep.ts';

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
