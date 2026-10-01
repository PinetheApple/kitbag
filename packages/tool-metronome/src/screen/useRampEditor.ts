import type { StepDelta } from '@kitbag/core-design';
import { type KB_RAMP_UNIT as RampUnit } from '@kitbag/core-native';
import { BPM_BOUNDS, useMetronome, type RampConfig } from '@kitbag/core-state';
import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { stepRampDuration, withRampUnit } from '../logic/rampUnit.ts';
import { stepWithin } from '../logic/trainer.ts';

type Stepper = (delta: StepDelta) => void;
type SetDraft = Dispatch<SetStateAction<RampConfig>>;

export interface RampEditor {
  readonly draft: RampConfig;
  readonly running: boolean;
  readonly reset: () => void;
  readonly stepFrom: Stepper;
  readonly stepTo: Stepper;
  readonly stepDuration: Stepper;
  readonly setUnit: (unit: RampUnit) => void;
  readonly toggleLoop: () => void;
  readonly start: () => void;
  readonly clear: () => void;
}

function useBpmStepper(
  setDraft: SetDraft,
  key: 'startBpm' | 'endBpm',
): Stepper {
  return useCallback(
    (delta: StepDelta) => {
      setDraft((d) => ({ ...d, [key]: stepWithin(d[key], delta, BPM_BOUNDS) }));
    },
    [setDraft, key],
  );
}

function useDurationEdits(setDraft: SetDraft) {
  const stepDuration = useCallback(
    (delta: StepDelta) => {
      setDraft((d) => stepRampDuration(d, delta));
    },
    [setDraft],
  );
  const setUnit = useCallback(
    (unit: RampUnit) => {
      setDraft((d) => withRampUnit(d, unit));
    },
    [setDraft],
  );
  const toggleLoop = useCallback(() => {
    setDraft((d) => ({ ...d, loop: !d.loop }));
  }, [setDraft]);
  return { stepDuration, setUnit, toggleLoop };
}

function useRampCommit(draft: RampConfig, onDone: () => void) {
  const ramp = useMetronome((s) => s.ramp);
  const setRamp = useMetronome((s) => s.setRamp);
  const start = useCallback(() => {
    setRamp({ ...draft, enabled: true });
    onDone();
  }, [draft, setRamp, onDone]);
  const clear = useCallback(() => {
    setRamp({ ...ramp, enabled: false });
    onDone();
  }, [ramp, setRamp, onDone]);
  return { start, clear };
}

export function useRampEditor(onDone: () => void): RampEditor {
  const ramp = useMetronome((s) => s.ramp);
  const bpm = useMetronome((s) => s.bpm);
  const [draft, setDraft] = useState(ramp);
  const reset = useCallback(() => {
    setDraft(ramp.enabled ? ramp : { ...ramp, startBpm: bpm, endBpm: bpm });
  }, [ramp, bpm]);
  return {
    draft,
    running: ramp.enabled,
    reset,
    stepFrom: useBpmStepper(setDraft, 'startBpm'),
    stepTo: useBpmStepper(setDraft, 'endBpm'),
    ...useDurationEdits(setDraft),
    ...useRampCommit(draft, onDone),
  };
}
