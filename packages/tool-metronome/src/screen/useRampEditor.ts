import type { StepDelta } from '@kitbag/core-design';
import { KB_MAX_RAMP_BARS } from '@kitbag/core-native';
import { BPM_BOUNDS, useMetronome, type RampConfig } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { barBounds, stepWithin } from '../logic/trainer.ts';

const RAMP_BARS = barBounds(KB_MAX_RAMP_BARS);

type Stepper = (delta: StepDelta) => void;

export interface RampEditor {
  readonly draft: RampConfig;
  readonly running: boolean;
  readonly reset: () => void;
  readonly stepFrom: Stepper;
  readonly stepTo: Stepper;
  readonly stepBars: Stepper;
  readonly start: () => void;
  readonly clear: () => void;
}

function useDraftStepper(
  setDraft: (update: (d: RampConfig) => RampConfig) => void,
  key: 'startBpm' | 'endBpm' | 'bars',
): Stepper {
  return useCallback(
    (delta: StepDelta) => {
      const bounds = key === 'bars' ? RAMP_BARS : BPM_BOUNDS;
      setDraft((d) => ({ ...d, [key]: stepWithin(d[key], delta, bounds) }));
    },
    [setDraft, key],
  );
}

export function useRampEditor(onDone: () => void): RampEditor {
  const ramp = useMetronome((s) => s.ramp);
  const bpm = useMetronome((s) => s.bpm);
  const setRamp = useMetronome((s) => s.setRamp);
  const [draft, setDraft] = useState(ramp);

  const reset = useCallback(() => {
    setDraft(ramp.enabled ? ramp : { ...ramp, startBpm: bpm, endBpm: bpm });
  }, [ramp, bpm]);
  const start = useCallback(() => {
    setRamp({ ...draft, enabled: true });
    onDone();
  }, [draft, setRamp, onDone]);
  const clear = useCallback(() => {
    setRamp({ ...ramp, enabled: false });
    onDone();
  }, [ramp, setRamp, onDone]);

  const stepFrom = useDraftStepper(setDraft, 'startBpm');
  const stepTo = useDraftStepper(setDraft, 'endBpm');
  const stepBars = useDraftStepper(setDraft, 'bars');
  const running = ramp.enabled;
  return { draft, running, reset, stepFrom, stepTo, stepBars, start, clear };
}
