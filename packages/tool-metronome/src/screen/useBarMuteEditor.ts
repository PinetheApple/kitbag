import type { StepDelta } from '@kitbag/core-design';
import { KB_MUTE_BARS_BOUNDS } from '@kitbag/core-native';
import { useMetronome, type BarMuteConfig } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';

import { mutePreview, stepWithin } from '../logic/trainer.ts';

type Stepper = (delta: StepDelta) => void;

export interface BarMuteEditor {
  readonly barMute: BarMuteConfig;
  readonly preview: readonly boolean[];
  readonly stepPlay: Stepper;
  readonly stepMute: Stepper;
  readonly toggle: (enabled: boolean) => void;
}

function useMuteStepper(key: 'playBars' | 'muteBars'): Stepper {
  const barMute = useMetronome((s) => s.barMute);
  const setBarMute = useMetronome((s) => s.setBarMute);
  return useCallback(
    (delta: StepDelta) => {
      setBarMute({
        ...barMute,
        [key]: stepWithin(barMute[key], delta, KB_MUTE_BARS_BOUNDS),
      });
    },
    [barMute, setBarMute, key],
  );
}

export function useBarMuteEditor(): BarMuteEditor {
  const barMute = useMetronome((s) => s.barMute);
  const setBarMute = useMetronome((s) => s.setBarMute);
  const preview = useMemo(
    () => mutePreview(barMute.playBars, barMute.muteBars),
    [barMute.playBars, barMute.muteBars],
  );
  const toggle = useCallback(
    (enabled: boolean) => {
      setBarMute({ ...barMute, enabled });
    },
    [barMute, setBarMute],
  );
  const stepPlay = useMuteStepper('playBars');
  const stepMute = useMuteStepper('muteBars');
  return { barMute, preview, stepPlay, stepMute, toggle };
}
