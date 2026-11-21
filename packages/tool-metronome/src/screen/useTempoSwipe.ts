import { tickHaptic } from '@kitbag/core-native';
import { BPM_BOUNDS } from '@kitbag/core-state';
import { useCallback } from 'react';
import { usePanGesture } from 'react-native-gesture-handler';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  clampBpm,
  startSwipe,
  SWIPE_ACTIVATE_DP,
  SWIPE_CANCEL_X_DP,
  swipeTempo,
} from '../logic/swipeTempo.ts';

export interface TempoSwipeScope {
  readonly enabled: boolean;
}

export function useTempoSwipe(
  currentBpm: SharedValue<number>,
  onTempo: (bpm: number) => void,
  scope: TempoSwipeScope,
) {
  const { enabled } = scope;
  const swipe = useSharedValue(startSwipe(0));

  const handleStep = useCallback(
    (bpm: number) => {
      tickHaptic();
      onTempo(bpm);
    },
    [onTempo],
  );

  return usePanGesture({
    // Activating on the first pixel would swallow taps on the controls below.
    activeOffsetY: [-SWIPE_ACTIVATE_DP, SWIPE_ACTIVATE_DP],
    failOffsetX: [-SWIPE_CANCEL_X_DP, SWIPE_CANCEL_X_DP],
    enabled,
    onBegin: () => {
      'worklet';
      swipe.value = startSwipe(
        clampBpm(Math.round(currentBpm.value), BPM_BOUNDS),
      );
    },
    onUpdate: (event) => {
      'worklet';
      const sent = swipe.value.bpm;
      const next = swipeTempo(
        swipe.value,
        event.translationY,
        event.velocityY,
        BPM_BOUNDS,
      );
      swipe.value = next;
      if (next.bpm !== sent) scheduleOnRN(handleStep, next.bpm);
    },
  });
}
