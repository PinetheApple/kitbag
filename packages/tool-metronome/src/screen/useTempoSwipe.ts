import { BPM_BOUNDS } from '@kitbag/core-state';
import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  clampBpm,
  dragTempo,
  DP_PER_BPM,
  flingBpmDelta,
} from '../logic/swipeTempo.ts';

export function useTempoSwipe(
  currentBpm: SharedValue<number>,
  onTempo: (bpm: number) => void,
) {
  const gestureStartBpm = useSharedValue(0);
  const sentBpm = useSharedValue(0);

  return useMemo(
    () =>
      Gesture.Pan()
        // Activating on the first pixel would swallow taps on the controls below.
        .activeOffsetY([-DP_PER_BPM, DP_PER_BPM])
        .failOffsetX([-DP_PER_BPM, DP_PER_BPM])
        .onBegin(() => {
          'worklet';
          const engineBpm = clampBpm(Math.round(currentBpm.value), BPM_BOUNDS);
          gestureStartBpm.value = engineBpm;
          sentBpm.value = engineBpm;
        })
        .onUpdate((event) => {
          'worklet';
          const dragged = dragTempo(
            gestureStartBpm.value,
            event.translationY,
            BPM_BOUNDS,
          );
          gestureStartBpm.value = dragged.anchorBpm;
          if (dragged.bpm === sentBpm.value) return;
          sentBpm.value = dragged.bpm;
          scheduleOnRN(onTempo, dragged.bpm);
        })
        .onEnd((event, success) => {
          'worklet';
          // onEnd also fires for failed and cancelled pans.
          if (!success) return;
          const delta = flingBpmDelta(event.velocityY);
          if (delta === 0) return;
          const thrown = clampBpm(sentBpm.value + delta, BPM_BOUNDS);
          if (thrown === sentBpm.value) return;
          sentBpm.value = thrown;
          scheduleOnRN(onTempo, thrown);
        }),
    [onTempo, gestureStartBpm, currentBpm, sentBpm],
  );
}
