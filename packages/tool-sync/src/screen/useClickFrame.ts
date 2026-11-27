import type { BeatDotGridFrame } from '@kitbag/core-design';
import {
  KB_STOPPED_BEAT,
  KITBAG_HOST_OBJECT_KEY,
  type KitbagHostObject,
} from '@kitbag/core-native';
import { useEffect, useMemo } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

type HostGlobal = Record<
  typeof KITBAG_HOST_OBJECT_KEY,
  KitbagHostObject | undefined
>;

const IDLE_BAR_PHASE = 0;
const IDLE_BAR_MUTED = 0;

export function useClickFrame(running: boolean): BeatDotGridFrame {
  const barPhase = useSharedValue(IDLE_BAR_PHASE);
  const currentBeat = useSharedValue<number>(KB_STOPPED_BEAT);
  const barMuted = useSharedValue(IDLE_BAR_MUTED);

  const frame = useFrameCallback(() => {
    'worklet';
    const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
    if (host === undefined) return;
    barPhase.value = host.bar_phase;
    if (currentBeat.value !== host.current_beat)
      currentBeat.value = host.current_beat;
    if (barMuted.value !== host.bar_muted) barMuted.value = host.bar_muted;
  }, false);

  useEffect(() => {
    frame.setActive(running);
    if (running) return;
    barPhase.value = IDLE_BAR_PHASE;
    currentBeat.value = KB_STOPPED_BEAT;
    barMuted.value = IDLE_BAR_MUTED;
  }, [frame, running, barPhase, currentBeat, barMuted]);

  return useMemo(
    () => ({ barPhase, currentBeat, barMuted }),
    [barPhase, currentBeat, barMuted],
  );
}
