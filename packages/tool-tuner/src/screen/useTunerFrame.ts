// The §13.3 mechanism, applied to the tuner: a Reanimated frame callback on
// the UI thread reads the JSI HostObject and writes SharedValues for the
// needle, the note, the caption and the detected peg. Nothing on this path
// goes through React state. Two things do cross to JS, each only when it
// changes: the lock event (once per lock) and the discrete slice of a hop
// (status, string, wrong-string hint, silence), which change at human speed.
//
// Same shape as tool-metronome's useMetronomeFrame; see its header for why the
// HostObject read is repeated here rather than shared.

import { opacity, TUNE_DIRECTION } from '@kitbag/core-design';
import {
  KB_TUNER_NO_STRING,
  KITBAG_HOST_OBJECT_KEY,
  type KitbagHostObject,
} from '@kitbag/core-native';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  discreteOf,
  isHeard,
  isLocked,
  QUIET_DISCRETE,
  readHop,
  sameDiscrete,
  type TunerDiscrete,
} from '../logic/hop.ts';
import { followNeedle, lockFired, nextLatch } from '../logic/lock.ts';
import { noteName } from '../logic/notes.ts';
import {
  IDLE_CAPTION,
  needleFraction,
  tuneDirection,
  tunerCaption,
} from '../logic/readout.ts';

type HostGlobal = Record<
  typeof KITBAG_HOST_OBJECT_KEY,
  KitbagHostObject | undefined
>;

/** Shown in place of a note until the first one is heard. */
export const NO_NOTE_TEXT = '—';

export interface TunerFrameOptions {
  /** The mic is capturing; the poll runs only then. */
  readonly listening: boolean;
  /** Any change clears the readout: screen entry, a new tuning, a new mode. */
  readonly resetKey: string;
  readonly chromatic: boolean;
  /** A string reached the engine's tuned ratio. Once per lock. */
  readonly onLocked: (stringIndex: number) => void;
  readonly onDiscrete: (discrete: TunerDiscrete) => void;
}

export interface TunerFrameValues {
  /** Needle position in [-1, 1]. */
  readonly needle: SharedValue<number>;
  /** Needle opacity: 1 hearing, muted while holding the last note, 0 before any. */
  readonly active: SharedValue<number>;
  readonly detectedIndex: SharedValue<number>;
  readonly noteText: SharedValue<string>;
  readonly captionText: SharedValue<string>;
  /** A TUNE_DIRECTION value. */
  readonly direction: SharedValue<number>;
}

export function useTunerFrame({
  listening,
  resetKey,
  chromatic,
  onLocked,
  onDiscrete,
}: TunerFrameOptions): TunerFrameValues {
  const reduceMotion = useReducedMotion();

  const needle = useSharedValue(0);
  const needleTarget = useSharedValue(0);
  const active = useSharedValue(0);
  const detectedIndex = useSharedValue(KB_TUNER_NO_STRING);
  const noteText = useSharedValue(NO_NOTE_TEXT);
  const captionText = useSharedValue<string>(IDLE_CAPTION.strings);
  const direction = useSharedValue<number>(TUNE_DIRECTION.none);

  // UI-thread bookkeeping between frames.
  const lastId = useSharedValue(Number.NaN);
  const latched = useSharedValue(KB_TUNER_NO_STRING);
  const locked = useSharedValue(false);
  const holding = useSharedValue(false);
  const lastDiscrete = useSharedValue<TunerDiscrete>(QUIET_DISCRETE);
  const still = useSharedValue(reduceMotion);

  // scheduleOnRN needs a JS function; these stay stable so the frame callback
  // is registered once, and forward to the latest props.
  const handlers = useRef({ onLocked, onDiscrete });
  useLayoutEffect(() => {
    handlers.current = { onLocked, onDiscrete };
  }, [onLocked, onDiscrete]);
  const reportLock = useCallback((stringIndex: number) => {
    handlers.current.onLocked(stringIndex);
  }, []);
  const reportDiscrete = useCallback((discrete: TunerDiscrete) => {
    handlers.current.onDiscrete(discrete);
  }, []);

  const onFrame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      const host = (globalThis as unknown as HostGlobal)[
        KITBAG_HOST_OBJECT_KEY
      ];
      if (host === undefined) return;

      if (host.tuner_measurement_id !== lastId.value) {
        const hop = readHop(host);
        lastId.value = hop.id;

        if (isHeard(hop)) {
          noteText.value = noteName(hop.targetMidi);
          captionText.value = tunerCaption(hop.status, hop.errorCents);
          direction.value = TUNE_DIRECTION[tuneDirection(hop.status)];
          needleTarget.value = needleFraction(hop.errorCents);
          detectedIndex.value = hop.currentString;
          active.value = 1;
          holding.value = true;
        } else {
          // Hold after decay: the last note, caption and needle stay, dimmed,
          // until a new note or a reset.
          detectedIndex.value = KB_TUNER_NO_STRING;
          active.value = holding.value ? opacity.muted : 0;
        }

        locked.value = isLocked(hop);
        const next = nextLatch(hop);
        if (lockFired(latched.value, next)) scheduleOnRN(reportLock, next);
        latched.value = next;

        const discrete = discreteOf(hop);
        if (!sameDiscrete(discrete, lastDiscrete.value)) {
          lastDiscrete.value = discrete;
          scheduleOnRN(reportDiscrete, discrete);
        }
      }

      if (locked.value) {
        needleTarget.value = 0;
        needle.value = 0;
      } else {
        needle.value = followNeedle(
          needle.value,
          needleTarget.value,
          info.timeSincePreviousFrame ?? 0,
          still.value,
        );
      }
    },
    [
      active,
      captionText,
      detectedIndex,
      direction,
      holding,
      lastDiscrete,
      lastId,
      latched,
      locked,
      needle,
      needleTarget,
      noteText,
      reportDiscrete,
      reportLock,
      still,
    ],
  );

  const frame = useFrameCallback(onFrame, false);

  useEffect(() => {
    still.value = reduceMotion;
  }, [reduceMotion, still]);

  // Runs before `listening` turns the poll on, because entry starts the mic
  // asynchronously; a new tuning or mode while listening resets in place.
  useEffect(() => {
    needle.value = 0;
    needleTarget.value = 0;
    active.value = 0;
    detectedIndex.value = KB_TUNER_NO_STRING;
    noteText.value = NO_NOTE_TEXT;
    captionText.value = chromatic
      ? IDLE_CAPTION.chromatic
      : IDLE_CAPTION.strings;
    direction.value = TUNE_DIRECTION.none;
    lastId.value = Number.NaN;
    latched.value = KB_TUNER_NO_STRING;
    locked.value = false;
    holding.value = false;
    lastDiscrete.value = QUIET_DISCRETE;
    handlers.current.onDiscrete(QUIET_DISCRETE);
  }, [
    resetKey,
    chromatic,
    active,
    captionText,
    detectedIndex,
    direction,
    holding,
    lastDiscrete,
    lastId,
    latched,
    locked,
    needle,
    needleTarget,
    noteText,
  ]);

  useEffect(() => {
    frame.setActive(listening);
  }, [frame, listening]);

  return { needle, active, detectedIndex, noteText, captionText, direction };
}
