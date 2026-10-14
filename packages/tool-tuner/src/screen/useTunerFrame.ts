// §13.3: the needle, note, caption and detected peg are SharedValues written on
// the UI thread; only the lock event and the dwelled discrete slice reach JS.

import { opacity, type TuneGlyph } from '@kitbag/core-design';
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

import { dwellAt, settleDiscrete } from '../logic/dwell.ts';
import {
  discreteOf,
  isHeard,
  isLocked,
  QUIET_DISCRETE,
  readHop,
  type TunerDiscrete,
} from '../logic/hop.ts';
import {
  followNeedle,
  lockArmed,
  lockFired,
  nextArmed,
  nextLatch,
} from '../logic/lock.ts';
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
  /** The readout was cleared; the discrete slice is back to QUIET_DISCRETE. */
  readonly onReset: () => void;
}

export interface TunerFrameValues {
  /** Needle position in [-1, 1]. */
  readonly needle: SharedValue<number>;
  /** Needle opacity: 1 hearing, muted while holding the last note, 0 before any. */
  readonly active: SharedValue<number>;
  readonly detectedIndex: SharedValue<number>;
  readonly noteText: SharedValue<string>;
  readonly captionText: SharedValue<string>;
  readonly direction: SharedValue<TuneGlyph>;
}

export function useTunerFrame({
  listening,
  resetKey,
  chromatic,
  onLocked,
  onDiscrete,
  onReset,
}: TunerFrameOptions): TunerFrameValues {
  const reduceMotion = useReducedMotion();

  const needle = useSharedValue(0);
  const needleTarget = useSharedValue(0);
  const active = useSharedValue(0);
  const detectedIndex = useSharedValue(KB_TUNER_NO_STRING);
  const noteText = useSharedValue(NO_NOTE_TEXT);
  const captionText = useSharedValue<string>(IDLE_CAPTION.strings);
  const direction = useSharedValue<TuneGlyph>('none');

  // UI-thread bookkeeping between frames.
  const lastId = useSharedValue(Number.NaN);
  const latched = useSharedValue(KB_TUNER_NO_STRING);
  const locked = useSharedValue(false);
  const holding = useSharedValue(false);
  const latestDiscrete = useSharedValue<TunerDiscrete>(QUIET_DISCRETE);
  const dwell = useSharedValue(dwellAt(QUIET_DISCRETE));
  const resetId = useSharedValue(Number.NEGATIVE_INFINITY);
  const armed = useSharedValue(false);
  // The JS copy rejects lock events already in flight when a reset lands.
  const resetIdOnJs = useRef(Number.NEGATIVE_INFINITY);
  const still = useSharedValue(reduceMotion);

  // scheduleOnRN needs a JS function; these stay stable so the frame callback
  // is registered once, and forward to the latest props.
  const handlers = useRef({ onLocked, onDiscrete, onReset });
  useLayoutEffect(() => {
    handlers.current = { onLocked, onDiscrete, onReset };
  }, [onLocked, onDiscrete, onReset]);
  const reportLock = useCallback((stringIndex: number, hopId: number) => {
    if (lockArmed(resetIdOnJs.current, hopId)) {
      handlers.current.onLocked(stringIndex);
    }
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
          direction.value = tuneDirection(hop.status);
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
        armed.value = nextArmed(armed.value, hop, resetId.value);
        const next = nextLatch(hop, armed.value);
        if (lockFired(latched.value, next)) {
          scheduleOnRN(reportLock, next, hop.id);
        }
        latched.value = next;
        latestDiscrete.value = discreteOf(hop);
      }

      const current = dwell.value;
      const settled = settleDiscrete(
        current,
        latestDiscrete.value,
        info.timestamp,
      );
      if (settled !== current) {
        if (settled.shown !== current.shown) {
          scheduleOnRN(reportDiscrete, settled.shown);
        }
        dwell.value = settled;
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
      armed,
      captionText,
      detectedIndex,
      direction,
      dwell,
      holding,
      lastId,
      latched,
      latestDiscrete,
      locked,
      needle,
      needleTarget,
      noteText,
      reportDiscrete,
      reportLock,
      resetId,
      still,
    ],
  );

  const frame = useFrameCallback(onFrame, false);

  useEffect(() => {
    still.value = reduceMotion;
  }, [reduceMotion, still]);

  // Runs before `listening` turns the poll on, because entry starts the mic
  // asynchronously; a new tuning or mode while listening resets in place.
  useLayoutEffect(() => {
    const host = (globalThis as unknown as HostGlobal)[KITBAG_HOST_OBJECT_KEY];
    const id = host?.tuner_measurement_id ?? Number.NEGATIVE_INFINITY;
    resetIdOnJs.current = id;
    resetId.value = id;
    armed.value = false;
    needle.value = 0;
    needleTarget.value = 0;
    active.value = 0;
    detectedIndex.value = KB_TUNER_NO_STRING;
    noteText.value = NO_NOTE_TEXT;
    captionText.value = chromatic
      ? IDLE_CAPTION.chromatic
      : IDLE_CAPTION.strings;
    direction.value = 'none';
    lastId.value = Number.NaN;
    latched.value = KB_TUNER_NO_STRING;
    locked.value = false;
    holding.value = false;
    latestDiscrete.value = QUIET_DISCRETE;
    dwell.value = dwellAt(QUIET_DISCRETE);
    handlers.current.onReset();
  }, [
    resetKey,
    chromatic,
    active,
    armed,
    captionText,
    detectedIndex,
    direction,
    dwell,
    holding,
    lastId,
    latched,
    latestDiscrete,
    locked,
    needle,
    needleTarget,
    noteText,
    resetId,
  ]);

  useEffect(() => {
    frame.setActive(listening);
  }, [frame, listening]);

  return { needle, active, detectedIndex, noteText, captionText, direction };
}
