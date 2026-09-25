import type { StepDelta } from '@kitbag/core-design';
import { KB_MAX_MUTE_BARS } from '@kitbag/core-native';
import { useMetronome, type BarMuteConfig } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';

import { barBounds, mutePreview, stepWithin } from '../logic/trainer.ts';

const MUTE_BARS = barBounds(KB_MAX_MUTE_BARS);

type Stepper = (delta: StepDelta) => void;

export interface BarMuteEditor {
  readonly barMute: BarMuteConfig;
  readonly preview: readonly boolean[];
  readonly stepPlay: Stepper;
  readonly stepMute: Stepper;
  readonly apply: () => void;
  readonly turnOff: () => void;
}

function useMuteStepper(key: 'playBars' | 'muteBars'): Stepper {
  const barMute = useMetronome((s) => s.barMute);
  const setBarMute = useMetronome((s) => s.setBarMute);
  return useCallback(
    (delta: StepDelta) => {
      setBarMute({
        ...barMute,
        [key]: stepWithin(barMute[key], delta, MUTE_BARS),
      });
    },
    [barMute, setBarMute, key],
  );
}

export function useBarMuteEditor(onDone: () => void): BarMuteEditor {
  const barMute = useMetronome((s) => s.barMute);
  const setBarMute = useMetronome((s) => s.setBarMute);
  const preview = useMemo(
    () => mutePreview(barMute.playBars, barMute.muteBars),
    [barMute.playBars, barMute.muteBars],
  );
  const apply = useCallback(() => {
    setBarMute({ ...barMute, enabled: true });
    onDone();
  }, [barMute, setBarMute, onDone]);
  const turnOff = useCallback(() => {
    setBarMute({ ...barMute, enabled: false });
    onDone();
  }, [barMute, setBarMute, onDone]);
  const stepPlay = useMuteStepper('playBars');
  const stepMute = useMuteStepper('muteBars');
  return { barMute, preview, stepPlay, stepMute, apply, turnOff };
}
