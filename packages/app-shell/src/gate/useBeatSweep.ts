// The one mechanism SPEC §13.3 permits for 60fps values: a Reanimated worklet
// on the UI thread reads the JSI HostObject each frame and writes SharedValues.
// No JS thread, no useState, no runOnJS on this path — animated components read
// the SharedValues via useAnimatedStyle / useAnimatedProps (BeatSweep, LedRow,
// EngineBpmReadout).
//
// The HostObject is not installed on any runtime until the device build (#33),
// so the worklet reads global[KITBAG_HOST_OBJECT_KEY] DEFENSIVELY and holds the
// last value when it is absent. The JS-thread getKitbagHostObject() accessor is
// for setup only (it throws), never for this frame path.
//
// CAVEAT for #33: this worklet runs on the Reanimated UI runtime, whose global
// is SEPARATE from the JS runtime where KitbagHostObject.ts documents the install
// — #33's installer must publish the HostObject on the UI-runtime global. And
// because the defensive hold makes a wrong-runtime install look identical to
// "not wired yet" (frozen, no crash), #33 must assert the values CHANGE on
// device, not merely that nothing throws.

import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import type { KitbagHostObject } from '@kitbag/core-native';
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

// Keyed over the single owned host key (§13.7) — never a retyped literal. On
// the UI runtime the host, once #33 installs it, lives under this key.
type HostGlobal = Record<
  typeof KITBAG_HOST_OBJECT_KEY,
  KitbagHostObject | undefined
>;

const STOPPED_BEAT = -1;

export interface BeatSweepValues {
  /** bar_phase [0,1) — drives the sweep. */
  readonly barPhase: SharedValue<number>;
  /** current_beat (int; -1 stopped) — drives the LED row. */
  readonly currentBeat: SharedValue<number>;
  /** current_bpm — effective BPM incl. ramp; drives EngineBpmReadout. */
  readonly currentBpm: SharedValue<number>;
}

export function useBeatSweep(): BeatSweepValues {
  const barPhase = useSharedValue(0);
  const currentBeat = useSharedValue(STOPPED_BEAT);
  const currentBpm = useSharedValue(0);

  useFrameCallback(() => {
    'worklet';
    const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
    if (host === undefined) {
      return;
    }
    // Each read is an allocation-free JSI double (§13.3).
    barPhase.value = host.bar_phase;
    currentBeat.value = host.current_beat;
    currentBpm.value = host.current_bpm;
  });

  return { barPhase, currentBeat, currentBpm };
}
