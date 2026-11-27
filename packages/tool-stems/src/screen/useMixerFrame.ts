import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import type { KitbagHostObject } from '@kitbag/core-native';
import {
  formatClock,
  framesToSeconds,
  onSongStarting,
} from '@kitbag/core-state';
import { useCallback, useEffect } from 'react';
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

export type HostGlobal = Record<
  typeof KITBAG_HOST_OBJECT_KEY,
  KitbagHostObject | undefined
>;

const NO_SECOND = -1;
const NOT_HELD = -1;
const NO_LOOP = -1;
const NO_COUNT = -1;
const MS_PER_SECOND = 1000;
// The mixer publishes its head once per device block; the playhead runs on
// between publishes, never further than this.
const MAX_LEAD_SECONDS = 0.1;
// A released scrub shows where it was let go until the seek lands near there.
const HOLD_NEAR_SECONDS = 0.5;
const HOLD_TIMEOUT_MS = 1000;
const NOT_QUIET = -1;
const QUIET_AFTER_MS = 250;
// A paused song can still start or seek from the notification without telling the app.
const QUIET_POLL_MS = 100;

export interface MixerFrameValues {
  readonly progress: SharedValue<number>;
  readonly playing: SharedValue<number>;
  readonly elapsed: SharedValue<string>;
  readonly second: SharedValue<number>;
  readonly songSec: SharedValue<number>;
  readonly hold: (fraction: number) => void;
}

export interface MixerFrameOptions {
  readonly countEndFrame?: number | null;
  readonly heldFrame?: number | null;
}

function isQuiet(
  host: KitbagHostObject,
  started: number,
  moved: boolean,
  holding: boolean,
): boolean {
  'worklet';
  return started === 0 && !moved && !holding && host.counting_in === 0;
}

export function useMixerFrame(
  engineRate: number,
  durationFrames: number,
  loopEndFrames: number | null,
  { countEndFrame = null, heldFrame = null }: MixerFrameOptions = {},
): MixerFrameValues {
  const progress = useSharedValue(0);
  const playing = useSharedValue(0);
  const elapsed = useSharedValue(formatClock(0, engineRate));
  const second = useSharedValue(NO_SECOND);
  const songSec = useSharedValue(0);
  const rate = useSharedValue(engineRate);
  const duration = useSharedValue(durationFrames);
  const loopEnd = useSharedValue(loopEndFrames ?? NO_LOOP);
  const countEnd = useSharedValue(countEndFrame ?? NO_COUNT);
  const published = useSharedValue(NO_SECOND);
  const publishedAt = useSharedValue(0);
  const lastShown = useSharedValue(0);
  const held = useSharedValue(NOT_HELD);
  const heldSince = useSharedValue(NOT_HELD);
  const viewed = useSharedValue(heldFrame ?? NOT_HELD);
  const quietSince = useSharedValue(NOT_QUIET);
  const polledAt = useSharedValue(0);

  const wake = useCallback(() => {
    quietSince.value = NOT_QUIET;
  }, [quietSince]);

  useEffect(() => onSongStarting(wake), [wake]);

  useEffect(() => {
    wake();
    rate.value = engineRate;
    duration.value = durationFrames;
    loopEnd.value = loopEndFrames ?? NO_LOOP;
    second.value = NO_SECOND;
  }, [
    wake,
    engineRate,
    durationFrames,
    loopEndFrames,
    rate,
    duration,
    loopEnd,
    second,
  ]);

  useEffect(() => {
    wake();
    countEnd.value = countEndFrame ?? NO_COUNT;
  }, [wake, countEndFrame, countEnd]);

  const showFrame = useCallback(
    (shown: number, frameRate: number) => {
      'worklet';
      const fraction = duration.value > 0 ? shown / duration.value : 0;
      if (progress.value !== fraction) progress.value = fraction;
      const seconds = framesToSeconds(shown, frameRate);
      if (songSec.value !== seconds) songSec.value = seconds;
      const now = Math.floor(seconds);
      if (now === second.value) return;
      second.value = now;
      elapsed.value = formatClock(shown, frameRate);
    },
    [duration, progress, songSec, second, elapsed],
  );

  useEffect(() => {
    wake();
    viewed.value = heldFrame ?? NOT_HELD;
    if (heldFrame === null) return;
    held.value = NOT_HELD;
    playing.value = 0;
    second.value = NO_SECOND;
    showFrame(heldFrame, engineRate);
  }, [wake, heldFrame, engineRate, viewed, held, playing, second, showFrame]);

  const hold = useCallback(
    (fraction: number) => {
      wake();
      held.value = fraction * duration.value;
      heldSince.value = NOT_HELD;
    },
    [wake, held, heldSince, duration],
  );

  useFrameCallback((frame) => {
    'worklet';
    if (viewed.value !== NOT_HELD) return;
    const now = frame.timestamp;
    const asleep =
      quietSince.value !== NOT_QUIET && now - quietSince.value > QUIET_AFTER_MS;
    if (asleep && now - polledAt.value < QUIET_POLL_MS) return;
    polledAt.value = now;
    const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
    if (host === undefined) return;
    const position = host.mixer_position;
    const isPlaying = host.mixer_playing;
    const counting =
      countEnd.value !== NO_COUNT && host.frames_rendered < countEnd.value;
    const started = isPlaying !== 0 || counting ? 1 : 0;
    if (playing.value !== started) playing.value = started;
    const moved = position !== published.value;
    if (isQuiet(host, started, moved, held.value !== NOT_HELD)) {
      if (quietSince.value === NOT_QUIET) quietSince.value = now;
    } else quietSince.value = NOT_QUIET;
    if (moved) {
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
    showFrame(shown, rate.value);
  });

  return { progress, playing, elapsed, second, songSec, hold };
}
