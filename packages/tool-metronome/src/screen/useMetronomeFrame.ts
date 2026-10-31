import {
  KB_POLY_PHASE_NONE,
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

const NOT_ACTIVE = -1;

const IDLE_FRAME = {
  barPhase: 0,
  currentBeat: KB_STOPPED_BEAT,
  currentPolyBeat: KB_STOPPED_BEAT,
  polyDownbeatPhase: KB_POLY_PHASE_NONE,
  countingIn: 0,
  countInBar: NOT_ACTIVE,
  countInBarsTotal: 0,
  barMuted: 0,
  barMutePosition: NOT_ACTIVE,
  rampState: KB_RAMP_STATE.KB_RAMP_STATE_OFF,
  rampNextBpm: 0,
  rampRemaining: 0,
  rampStepProgress: 0,
} as const;

export interface MetronomeFrameValues {
  readonly barPhase: SharedValue<number>;
  readonly currentBeat: SharedValue<number>;
  readonly currentPolyBeat: SharedValue<number>;
  readonly polyDownbeatPhase: SharedValue<number>;
  readonly currentBpm: SharedValue<number>;
  readonly countingIn: SharedValue<number>;
  readonly countInBar: SharedValue<number>;
  readonly countInBarsTotal: SharedValue<number>;
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
  const barPhase = useSharedValue<number>(IDLE_FRAME.barPhase);
  const currentBeat = useSharedValue<number>(IDLE_FRAME.currentBeat);
  const currentPolyBeat = useSharedValue<number>(IDLE_FRAME.currentPolyBeat);
  const polyDownbeatPhase = useSharedValue<number>(
    IDLE_FRAME.polyDownbeatPhase,
  );
  const currentBpm = useSharedValue(bpm);
  const countingIn = useSharedValue<number>(IDLE_FRAME.countingIn);
  const countInBar = useSharedValue<number>(IDLE_FRAME.countInBar);
  const countInBarsTotal = useSharedValue<number>(IDLE_FRAME.countInBarsTotal);
  const barMuted = useSharedValue<number>(IDLE_FRAME.barMuted);
  const barMutePosition = useSharedValue<number>(IDLE_FRAME.barMutePosition);
  const rampState = useSharedValue<number>(IDLE_FRAME.rampState);
  const rampNextBpm = useSharedValue<number>(IDLE_FRAME.rampNextBpm);
  const rampRemaining = useSharedValue<number>(IDLE_FRAME.rampRemaining);
  const rampStepProgress = useSharedValue<number>(IDLE_FRAME.rampStepProgress);

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
    assign(polyDownbeatPhase, host.poly_downbeat_phase);
    assign(currentBpm, host.current_bpm);
    assign(countingIn, host.counting_in);
    assign(countInBar, host.count_in_bar);
    assign(countInBarsTotal, host.count_in_bars_total);
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
      barPhase.value = IDLE_FRAME.barPhase;
      currentBeat.value = IDLE_FRAME.currentBeat;
      currentPolyBeat.value = IDLE_FRAME.currentPolyBeat;
      polyDownbeatPhase.value = IDLE_FRAME.polyDownbeatPhase;
      countingIn.value = IDLE_FRAME.countingIn;
      countInBar.value = IDLE_FRAME.countInBar;
      countInBarsTotal.value = IDLE_FRAME.countInBarsTotal;
      barMuted.value = IDLE_FRAME.barMuted;
      barMutePosition.value = IDLE_FRAME.barMutePosition;
      rampState.value = IDLE_FRAME.rampState;
      rampNextBpm.value = IDLE_FRAME.rampNextBpm;
      rampRemaining.value = IDLE_FRAME.rampRemaining;
      rampStepProgress.value = IDLE_FRAME.rampStepProgress;
    }
  }, [
    frame,
    running,
    barPhase,
    currentBeat,
    currentPolyBeat,
    polyDownbeatPhase,
    countingIn,
    countInBar,
    countInBarsTotal,
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
    polyDownbeatPhase,
    currentBpm,
    countingIn,
    countInBar,
    countInBarsTotal,
    barMuted,
    barMutePosition,
    rampState,
    rampNextBpm,
    rampRemaining,
    rampStepProgress,
  };
}
