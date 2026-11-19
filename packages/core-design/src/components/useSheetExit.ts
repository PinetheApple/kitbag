import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { Keyboard, useWindowDimensions } from 'react-native';
import {
  withTiming,
  type ReduceMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useSheetPortal } from './SheetHost.tsx';

export interface SheetExitOptions {
  readonly visible: boolean;
  readonly content: ReactNode;
  readonly motion: ReduceMotion;
  readonly dragY: SharedValue<number>;
  readonly scrimOpacity: SharedValue<number>;
  readonly onReturn: () => void;
}

// A layout `exiting` animation leaves a zombie view that a same-commit insert
// overflows (reanimated#7493, RN#57017), so the slot leaves after this exit.
export function useSheetExit({
  visible,
  content,
  motion,
  dragY,
  scrimOpacity,
  onReturn,
}: SheetExitOptions): void {
  const { show, hide } = useSheetPortal();
  const { height: windowHeight } = useWindowDimensions();
  const id = useId();
  const present = useRef(false);
  const visibleNow = useRef(visible);
  const lastShown = useRef<ReactNode>(null);
  const finishExit = useCallback(() => {
    if (visibleNow.current) return;
    present.current = false;
    hide(id);
  }, [hide, id]);

  useEffect(() => {
    visibleNow.current = visible;
    const timing = { reduceMotion: motion };
    if (visible) {
      if (present.current) onReturn();
      present.current = true;
      dragY.value = 0;
      scrimOpacity.value = withTiming(1, timing);
      return;
    }
    if (!present.current) return;
    Keyboard.dismiss();
    scrimOpacity.value = withTiming(0, timing);
    dragY.value = withTiming(windowHeight, timing, (finished) => {
      'worklet';
      if (finished) scheduleOnRN(finishExit);
    });
    // The exit runs per visibility change, not per new callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (visible) lastShown.current = content;
    if (present.current)
      show(id, lastShown.current, visible ? 'open' : 'leaving');
  });
  useEffect(
    () => () => {
      hide(id);
    },
    [hide, id],
  );
}
