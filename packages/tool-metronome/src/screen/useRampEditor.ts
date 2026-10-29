import type { StepDelta } from '@kitbag/core-design';
import {
  KB_MIN_RAMP_STEP_BPM,
  type KB_RAMP_UNIT as RampUnit,
} from '@kitbag/core-native';
import { BPM_BOUNDS, useMetronome, type RampConfig } from '@kitbag/core-state';
import { useCallback } from 'react';

import { withRampBpm, type RampBpmField } from '../logic/rampEntry.ts';
import { stepRampInterval, withRampUnit } from '../logic/rampUnit.ts';
import { stepWithin } from '../logic/trainer.ts';

type Stepper = (delta: StepDelta) => void;
type Edit = (change: (ramp: RampConfig) => RampConfig) => void;

const STEP_BOUNDS = {
  min: KB_MIN_RAMP_STEP_BPM,
  max: BPM_BOUNDS.max - BPM_BOUNDS.min,
};

export interface RampEditor {
  readonly ramp: RampConfig;
  readonly toggle: (enabled: boolean) => void;
  readonly stepFrom: Stepper;
  readonly stepTo: Stepper;
  readonly typeBpm: (field: RampBpmField, bpm: number) => void;
  readonly stepStep: Stepper;
  readonly stepInterval: Stepper;
  readonly setUnit: (unit: RampUnit) => void;
  readonly toggleLoop: () => void;
}

function useBpmStepper(edit: Edit, field: RampBpmField): Stepper {
  return useCallback(
    (delta: StepDelta) => {
      edit((r) =>
        withRampBpm(r, field, stepWithin(r[field], delta, BPM_BOUNDS)),
      );
    },
    [edit, field],
  );
}

function useCadenceEdits(edit: Edit) {
  const stepStep = useCallback(
    (delta: StepDelta) => {
      edit((r) => ({
        ...r,
        stepBpm: stepWithin(r.stepBpm, delta, STEP_BOUNDS),
      }));
    },
    [edit],
  );
  const stepInterval = useCallback(
    (delta: StepDelta) => {
      edit((r) => stepRampInterval(r, delta));
    },
    [edit],
  );
  const setUnit = useCallback(
    (unit: RampUnit) => {
      edit((r) => withRampUnit(r, unit));
    },
    [edit],
  );
  const toggleLoop = useCallback(() => {
    edit((r) => ({ ...r, loop: !r.loop }));
  }, [edit]);
  return { stepStep, stepInterval, setUnit, toggleLoop };
}

export function useRampEditor(): RampEditor {
  const ramp = useMetronome((s) => s.ramp);
  const setRamp = useMetronome((s) => s.setRamp);
  const edit = useCallback<Edit>(
    (change) => {
      setRamp(change(ramp));
    },
    [ramp, setRamp],
  );
  const toggle = useCallback(
    (enabled: boolean) => {
      setRamp({ ...ramp, enabled });
    },
    [ramp, setRamp],
  );
  const typeBpm = useCallback(
    (field: RampBpmField, bpm: number) => {
      setRamp(withRampBpm(ramp, field, bpm));
    },
    [ramp, setRamp],
  );
  return {
    ramp,
    toggle,
    stepFrom: useBpmStepper(edit, 'startBpm'),
    stepTo: useBpmStepper(edit, 'targetBpm'),
    typeBpm,
    ...useCadenceEdits(edit),
  };
}
