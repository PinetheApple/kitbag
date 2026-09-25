import { BPM_BOUNDS } from '@kitbag/core-state';
import { useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  clampBpm,
  dragTempo,
  DP_PER_BPM,
  flingBpmDelta,
} from '../logic/swipeTempo.ts';

export function useTempoSwipe(bpm: number, onTempo: (bpm: number) => void) {
  const liveBpm = useSharedValue(bpm);
  const gestureStartBpm = useSharedValue(bpm);
  const sentBpm = useSharedValue(bpm);

  useEffect(() => {
    liveBpm.value = bpm;
  }, [bpm, liveBpm]);

  return useMemo(
    () =>
      Gesture.Pan()
        // Activating on the first pixel would swallow taps on the controls below.
        .activeOffsetY([-DP_PER_BPM, DP_PER_BPM])
        .failOffsetX([-DP_PER_BPM, DP_PER_BPM])
        .onBegin(() => {
          'worklet';
          gestureStartBpm.value = liveBpm.value;
          sentBpm.value = liveBpm.value;
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
    [onTempo, gestureStartBpm, liveBpm, sentBpm],
  );
}
