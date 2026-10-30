import { BPM_BOUNDS } from '@kitbag/core-state';
import { useMemo } from 'react';
import { Gesture, type GestureType } from 'react-native-gesture-handler';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  clampBpm,
  dragTempo,
  DP_PER_BPM,
  flingBpmDelta,
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
  const gestureStartBpm = useSharedValue(0);
  const sentBpm = useSharedValue(0);

  return useMemo(() => {
    const pan = Gesture.Pan()
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
      })
      .enabled(enabled);
    return blocks === undefined ? pan : pan.blocksExternalGesture(blocks);
  }, [onTempo, gestureStartBpm, currentBpm, sentBpm, enabled, blocks]);
}
