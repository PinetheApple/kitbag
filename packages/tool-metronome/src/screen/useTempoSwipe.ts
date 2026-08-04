// Swipe ANYWHERE (SPEC §5.2): the gesture belongs to the whole screen, not to
// the readout — the screen mounts it at its root, so a drag that starts over the
// chips, the card or the empty space moves the tempo too.
//
// It runs on the UI thread and hands the JS thread ONE call per whole BPM step:
// the tempo is human-speed state (§13.4) and goes through the store, never
// through a SharedValue. The LEDs and steppers are Pressables, and a tap is not
// a pan, so they keep their taps.

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

/** The pan that drives the tempo. `bpm` is the tempo it starts each drag from. */
export function useTempoSwipe(bpm: number, onTempo: (bpm: number) => void) {
  // The gesture must survive the re-render its own tempo changes cause, so it
  // reads the tempo from a mirror instead of a captured prop.
  const liveBpm = useSharedValue(bpm);
  const gestureStartBpm = useSharedValue(bpm);
  const sentBpm = useSharedValue(bpm);

  useEffect(() => {
    liveBpm.value = bpm;
  }, [bpm, liveBpm]);

  return useMemo(
    () =>
      Gesture.Pan()
        // A pan that activates on the first pixel would swallow taps on the
        // LEDs, steppers and transport it now sits over. One BPM of travel is
        // the smallest movement that means "tempo" rather than "tap".
        .activeOffsetY([-DP_PER_BPM, DP_PER_BPM])
        // Horizontal stays free: the setlist chip pages songs sideways (M5).
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
          // onEnd also runs for a FAILED or CANCELLED pan — a sideways swipe
          // that tripped failOffsetX must not throw a fling into the tempo.
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
