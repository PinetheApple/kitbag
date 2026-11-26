import type { StoreAccess } from '../configuredStore.ts';
import {
  clampPhase,
  lockBeatsPerBar,
  nextShift,
  PHASE_STEPS_MS,
  shiftedPhase,
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
  heardSpeed: () => number,
): PhaseActions {
  const edit = (change: (lock: PlayAlongLock) => Partial<LockPhase>) => {
    const { lock } = getState();
    if (lock === undefined) return;
    setState({ lock: { ...lock, ...change(lock) } });
    anchor();
  };
  const setOffset = (ms: number) => {
    edit((lock) => ({
      phaseOffsetMs: clampPhase(
        ms,
        lock.bpm,
        getState().pattern.denominator,
        heardSpeed(),
      ),
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
      const { lock, pattern } = getState();
      if (lock?.downbeatShiftAvailable !== true) return;
      const beatsPerBar = lockBeatsPerBar(lock.grid, pattern);
      edit((current) =>
        shiftedPhase(
          current,
          nextShift(current.downbeatShift, direction, beatsPerBar),
          beatsPerBar,
        ),
      );
    },
    resetPhase: () => {
      edit(() => UNSHIFTED_PHASE);
    },
  };
}
