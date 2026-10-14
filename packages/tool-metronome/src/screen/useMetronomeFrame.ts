import { KB_STOPPED_BEAT, KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import type { KitbagHostObject } from '@kitbag/core-native';
import { useEffect } from 'react';
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

type HostGlobal = Record<
  typeof KITBAG_HOST_OBJECT_KEY,
  KitbagHostObject | undefined
>;

export interface MetronomeFrameValues {
  readonly barPhase: SharedValue<number>;
  readonly currentBeat: SharedValue<number>;
  readonly currentPolyBeat: SharedValue<number>;
  readonly currentBpm: SharedValue<number>;
}

export function useMetronomeFrame(
  running: boolean,
  bpm: number,
): MetronomeFrameValues {
  const barPhase = useSharedValue(0);
  const currentBeat = useSharedValue(KB_STOPPED_BEAT);
  const currentPolyBeat = useSharedValue(KB_STOPPED_BEAT);
  const currentBpm = useSharedValue(bpm);

  const frame = useFrameCallback(() => {
    'worklet';
    // Read globalThis on the UI runtime each frame; bootstrapRuntime.ts explains why.
    const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
    if (host === undefined) {
      return;
    }
    barPhase.value = host.bar_phase;
    currentBeat.value = host.current_beat;
    currentPolyBeat.value = host.current_poly_beat;
    currentBpm.value = host.current_bpm;
  }, false);

  useEffect(() => {
    frame.setActive(running);
  }, [frame, running]);

  useEffect(() => {
    currentBpm.value = bpm;
  }, [bpm, currentBpm]);

  return { barPhase, currentBeat, currentPolyBeat, currentBpm };
}
