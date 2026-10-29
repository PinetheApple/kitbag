import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import type { KitbagHostObject } from '@kitbag/core-native';
import { formatClock, framesToSeconds } from '@kitbag/core-state';
import { useCallback, useEffect } from 'react';
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

type HostGlobal = Record<
  typeof KITBAG_HOST_OBJECT_KEY,
  KitbagHostObject | undefined
>;

const NO_SECOND = -1;
const NOT_HELD = -1;
const NO_LOOP = -1;
const MS_PER_SECOND = 1000;
// The mixer publishes its head once per device block; the playhead runs on
// between publishes, never further than this.
const MAX_LEAD_SECONDS = 0.1;
// A released scrub shows where it was let go until the seek lands near there.
const HOLD_NEAR_SECONDS = 0.5;
const HOLD_TIMEOUT_MS = 1000;

export interface MixerFrameValues {
  readonly progress: SharedValue<number>;
  readonly playing: SharedValue<number>;
  readonly elapsed: SharedValue<string>;
  readonly second: SharedValue<number>;
  readonly hold: (fraction: number) => void;
}

export function useMixerFrame(
  engineRate: number,
  durationFrames: number,
  loopEndFrames: number | null,
): MixerFrameValues {
  const progress = useSharedValue(0);
  const playing = useSharedValue(0);
  const elapsed = useSharedValue(formatClock(0, engineRate));
  const second = useSharedValue(NO_SECOND);
  const rate = useSharedValue(engineRate);
  const duration = useSharedValue(durationFrames);
  const loopEnd = useSharedValue(loopEndFrames ?? NO_LOOP);
  const published = useSharedValue(NO_SECOND);
  const publishedAt = useSharedValue(0);
  const lastShown = useSharedValue(0);
  const held = useSharedValue(NOT_HELD);
  const heldSince = useSharedValue(NOT_HELD);

  useEffect(() => {
    rate.value = engineRate;
    duration.value = durationFrames;
    loopEnd.value = loopEndFrames ?? NO_LOOP;
    second.value = NO_SECOND;
  }, [
    engineRate,
    durationFrames,
    loopEndFrames,
    rate,
    duration,
    loopEnd,
    second,
  ]);

  const hold = useCallback(
    (fraction: number) => {
      held.value = fraction * duration.value;
      heldSince.value = NOT_HELD;
    },
    [held, heldSince, duration],
  );

  useFrameCallback((frame) => {
    'worklet';
    const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
    if (host === undefined) return;
    const position = host.mixer_position;
    const isPlaying = host.mixer_playing;
    if (playing.value !== isPlaying) playing.value = isPlaying;
    if (position !== published.value) {
      if (position < published.value) lastShown.value = position;
      published.value = position;
      publishedAt.value = frame.timestamp;
    }
    let shown = position;
    if (held.value !== NOT_HELD) {
      if (heldSince.value === NOT_HELD) heldSince.value = frame.timestamp;
      const landed =
        Math.abs(position - held.value) < HOLD_NEAR_SECONDS * rate.value ||
        frame.timestamp - heldSince.value > HOLD_TIMEOUT_MS;
      if (landed) held.value = NOT_HELD;
      else shown = held.value;
    } else if (isPlaying !== 0) {
      const lead =
        Math.min(
          (frame.timestamp - publishedAt.value) / MS_PER_SECOND,
          MAX_LEAD_SECONDS,
        ) * rate.value;
      const limit = loopEnd.value > position ? loopEnd.value : duration.value;
      shown = Math.max(
        lastShown.value,
        position + Math.max(0, Math.min(lead, limit - position)),
      );
    }
    lastShown.value = shown;
    const fraction = duration.value > 0 ? shown / duration.value : 0;
    if (progress.value !== fraction) progress.value = fraction;
    const now = Math.floor(framesToSeconds(shown, rate.value));
    if (now === second.value) return;
    second.value = now;
    elapsed.value = formatClock(shown, rate.value);
  });

  return { progress, playing, elapsed, second, hold };
}
