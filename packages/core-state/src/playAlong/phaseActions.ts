import type { StoreAccess } from '../configuredStore.ts';
import {
  clampPhase,
  PHASE_STEPS_MS,
  shiftedDownbeat,
  UNSHIFTED_PHASE,
  type LockPhase,
  type PhaseActions,
  type PhaseStepMs,
} from './phase.ts';
import type { PlayAlongLock, PlayAlongStore } from './store.ts';

const isPhaseStep = (step: number): step is PhaseStepMs =>
  (PHASE_STEPS_MS as readonly number[]).includes(step);

export function phaseActions(
  { getState, setState }: StoreAccess<PlayAlongStore>,
  anchor: () => void,
): PhaseActions {
  const edit = (change: (lock: PlayAlongLock) => Partial<LockPhase>) => {
    const { lock } = getState();
    if (lock === undefined) return;
    setState({ lock: { ...lock, ...change(lock) } });
    anchor();
  };
  const setOffset = (ms: number) => {
    edit((lock) => ({
      phaseOffsetMs: clampPhase(ms, lock.bpm, getState().pattern.denominator),
    }));
  };
  return {
    nudgePhase: (direction) => {
      const { lock, phaseStepMs } = getState();
      if (lock !== undefined)
        setOffset(lock.phaseOffsetMs + direction * phaseStepMs);
    },
    setPhaseOffset: (ms) => {
      if (Number.isFinite(ms)) setOffset(ms);
    },
    setPhaseStep: (step) => {
      if (isPhaseStep(step)) setState({ phaseStepMs: step });
    },
    shiftDownbeat: (direction) => {
      edit((lock) => ({
        downbeatShift: shiftedDownbeat(
          lock.downbeatShift,
          direction,
          getState().pattern.beatsPerBar,
        ),
      }));
    },
    resetPhase: () => {
      edit(() => UNSHIFTED_PHASE);
    },
  };
}
