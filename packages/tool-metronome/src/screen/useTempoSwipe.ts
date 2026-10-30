import { tickHaptic } from '@kitbag/core-native';
import { BPM_BOUNDS } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { Gesture, type GestureType } from 'react-native-gesture-handler';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  clampBpm,
  startSwipe,
  SWIPE_ACTIVATE_DP,
  SWIPE_CANCEL_X_DP,
  swipeTempo,
} from '../logic/swipeTempo.ts';

type BlockedGesture = Parameters<GestureType['blocksExternalGesture']>[0];

export interface TempoSwipeScope {
  readonly enabled: boolean;
  readonly blocks?: BlockedGesture;
}

export function useTempoSwipe(
  currentBpm: SharedValue<number>,
  onTempo: (bpm: number) => void,
  scope: TempoSwipeScope,
) {
  const { enabled, blocks } = scope;
  const swipe = useSharedValue(startSwipe(0));

  const handleStep = useCallback(
    (bpm: number) => {
      tickHaptic();
      onTempo(bpm);
    },
    [onTempo],
  );

  return useMemo(() => {
    const pan = Gesture.Pan()
      // Activating on the first pixel would swallow taps on the controls below.
      .activeOffsetY([-SWIPE_ACTIVATE_DP, SWIPE_ACTIVATE_DP])
      .failOffsetX([-SWIPE_CANCEL_X_DP, SWIPE_CANCEL_X_DP])
      .onBegin(() => {
        'worklet';
        swipe.value = startSwipe(
          clampBpm(Math.round(currentBpm.value), BPM_BOUNDS),
        );
      })
      .onUpdate((event) => {
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
      })
      .enabled(enabled);
    return blocks === undefined ? pan : pan.blocksExternalGesture(blocks);
  }, [handleStep, swipe, currentBpm, enabled, blocks]);
}
