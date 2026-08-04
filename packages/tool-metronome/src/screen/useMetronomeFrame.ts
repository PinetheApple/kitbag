// The §13.3 mechanism, applied to the metronome: a Reanimated worklet on the UI
// thread reads the JSI HostObject each frame and writes SharedValues. No JS
// thread, no useState, no runOnJS on this path — the bar sweep and the LED flash
// read the SharedValues through useAnimatedStyle.
//
// This mirrors app-shell/src/gate/useBeatSweep.ts rather than importing it: a
// tool may not import app-shell (§9.4), and the gate is the #33 proving surface.
// The mechanism is the one that passed on device there. Two copies of a read
// path is a §13.7 smell; the fix is core-native owning a worklet-safe frame
// accessor, which is a core-native change, not this screen's.

import { KB_STOPPED_BEAT, KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import type { KitbagHostObject } from '@kitbag/core-native';
import { useEffect } from 'react';
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

// Keyed over the single owned host key (§13.7) — never a retyped literal.
type HostGlobal = Record<
  typeof KITBAG_HOST_OBJECT_KEY,
  KitbagHostObject | undefined
>;

export interface MetronomeFrameValues {
  /** bar_phase [0,1) — drives the bar sweep. */
  readonly barPhase: SharedValue<number>;
  /** current_beat (int; -1 stopped) — drives the LED flash. */
  readonly currentBeat: SharedValue<number>;
}

/** `running` gates the poll: a stopped metronome publishes nothing to read, and
 * a screen left mounted should not wake every frame for it. */
export function useMetronomeFrame(running: boolean): MetronomeFrameValues {
  const barPhase = useSharedValue(0);
  const currentBeat = useSharedValue(KB_STOPPED_BEAT);

  const frame = useFrameCallback(() => {
    'worklet';
    const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
    // Held, not zeroed, when the host is absent: a JS-only run shows a still
    // sweep instead of a stutter (the gate's caveat — absent looks like frozen).
    if (host === undefined) {
      return;
    }
    // Each read is an allocation-free JSI double (§13.3).
    barPhase.value = host.bar_phase;
    currentBeat.value = host.current_beat;
  }, false);

  useEffect(() => {
    frame.setActive(running);
  }, [frame, running]);

  return { barPhase, currentBeat };
}
