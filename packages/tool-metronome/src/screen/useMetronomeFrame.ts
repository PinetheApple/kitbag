import {
  KB_RAMP_STATE,
  KB_STOPPED_BEAT,
  KITBAG_HOST_OBJECT_KEY,
} from '@kitbag/core-native';
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

const NOT_IN_CYCLE = -1;

export interface MetronomeFrameValues {
  readonly barPhase: SharedValue<number>;
  readonly currentBeat: SharedValue<number>;
  readonly currentPolyBeat: SharedValue<number>;
  readonly currentBpm: SharedValue<number>;
  readonly countingIn: SharedValue<number>;
  readonly countInBar: SharedValue<number>;
  readonly barMuted: SharedValue<number>;
  readonly barMutePosition: SharedValue<number>;
  readonly rampState: SharedValue<number>;
  readonly rampNextBpm: SharedValue<number>;
  readonly rampRemaining: SharedValue<number>;
  readonly rampStepProgress: SharedValue<number>;
}

// Unchanged values skip the write, so mappers rerun on a beat, not a frame.
function assign(target: SharedValue<number>, next: number) {
  'worklet';
  if (target.value !== next) target.value = next;
}

export function useMetronomeFrame(
  running: boolean,
  bpm: number,
): MetronomeFrameValues {
  const barPhase = useSharedValue(0);
  const currentBeat = useSharedValue(KB_STOPPED_BEAT);
  const currentPolyBeat = useSharedValue(KB_STOPPED_BEAT);
  const currentBpm = useSharedValue(bpm);
  const countingIn = useSharedValue(0);
  const countInBar = useSharedValue(NOT_IN_CYCLE);
  const barMuted = useSharedValue(0);
  const barMutePosition = useSharedValue(NOT_IN_CYCLE);
  const rampState = useSharedValue<number>(KB_RAMP_STATE.KB_RAMP_STATE_OFF);
  const rampNextBpm = useSharedValue(0);
  const rampRemaining = useSharedValue(0);
  const rampStepProgress = useSharedValue(0);

  const frame = useFrameCallback(() => {
    'worklet';
    // Read globalThis on the UI runtime each frame; bootstrapRuntime.ts explains why.
    const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
    if (host === undefined) {
      return;
    }
    barPhase.value = host.bar_phase;
    assign(currentBeat, host.current_beat);
    assign(currentPolyBeat, host.current_poly_beat);
    assign(currentBpm, host.current_bpm);
    assign(countingIn, host.counting_in);
    assign(countInBar, host.count_in_bar);
    assign(barMuted, host.bar_muted);
    assign(barMutePosition, host.bar_mute_position);
    assign(rampState, host.ramp_state);
    assign(rampNextBpm, host.ramp_next_bpm);
    assign(rampRemaining, host.ramp_remaining);
    assign(rampStepProgress, host.ramp_step_progress);
  }, false);

  useEffect(() => {
    frame.setActive(running);
    if (!running) {
      barPhase.value = 0;
      currentBeat.value = KB_STOPPED_BEAT;
      currentPolyBeat.value = KB_STOPPED_BEAT;
      countingIn.value = 0;
      countInBar.value = NOT_IN_CYCLE;
      barMuted.value = 0;
      barMutePosition.value = NOT_IN_CYCLE;
      rampState.value = KB_RAMP_STATE.KB_RAMP_STATE_OFF;
      rampNextBpm.value = 0;
      rampRemaining.value = 0;
      rampStepProgress.value = 0;
    }
  }, [
    frame,
    running,
    barPhase,
    currentBeat,
    currentPolyBeat,
    countingIn,
    countInBar,
    barMuted,
    barMutePosition,
    rampState,
    rampNextBpm,
    rampRemaining,
    rampStepProgress,
  ]);

  useEffect(() => {
    currentBpm.value = bpm;
  }, [bpm, currentBpm]);

  return {
    barPhase,
    currentBeat,
    currentPolyBeat,
    currentBpm,
    countingIn,
    countInBar,
    barMuted,
    barMutePosition,
    rampState,
    rampNextBpm,
    rampRemaining,
    rampStepProgress,
  };
}
