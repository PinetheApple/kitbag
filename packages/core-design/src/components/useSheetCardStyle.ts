import { useCallback, useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type ReduceMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { space } from '../roles.ts';

export interface SheetEnterOptions {
  readonly motion: ReduceMotion;
  readonly open: SharedValue<boolean>;
  readonly onArrived: () => void;
}

// The layout `entering` slide sometimes left the card below the screen when a
// field focused mid-slide, so the slide runs on the sheet's own value.
export function useSheetEnter({ motion, open, onArrived }: SheetEnterOptions) {
  const { height: windowHeight } = useWindowDimensions();
  const enterY = useSharedValue(windowHeight);
  const enter = useCallback(() => {
    enterY.value = windowHeight;
    enterY.value = withTiming(0, { reduceMotion: motion }, (finished) => {
      'worklet';
      if (!finished) {
        enterY.value = 0;
        return;
      }
      if (open.value) scheduleOnRN(onArrived);
    });
  }, [enterY, windowHeight, motion, open, onArrived]);
  useEffect(
    () => () => {
      cancelAnimation(enterY);
    },
    [enterY],
  );
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: enterY.value }],
  }));
  return { enter, style };
}

export interface SheetCardStyleOptions {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly dragY: SharedValue<number>;
}

function sheetPaddingBottom(bottomInset: number, keyboardHeight: number) {
  'worklet';
  return space.cardPadding + Math.max(bottomInset, -keyboardHeight);
}

export function useSheetCardStyle({
  visible,
  bottomInset,
  dragY,
}: SheetCardStyleOptions) {
  // Edge to edge, nothing resizes for the keyboard and RN's keyboard events
  // only fire on a layout pass (#142). Height is negative while it is open.
  const keyboard = useReanimatedKeyboardAnimation();
  const leavingPadding = useSharedValue(0);
  const openStyle = () => {
    'worklet';
    return {
      paddingBottom: sheetPaddingBottom(bottomInset, keyboard.height.value),
      transform: [{ translateY: dragY.value }],
    };
  };
  const leavingStyle = () => {
    'worklet';
    return {
      paddingBottom: leavingPadding.value,
      transform: [{ translateY: dragY.value }],
    };
  };
  useEffect(() => {
    if (visible) return;
    scheduleOnUI(() => {
      'worklet';
      leavingPadding.value = sheetPaddingBottom(
        bottomInset,
        keyboard.height.value,
      );
    });
    // The padding freezes once per exit, not per new inset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  return useAnimatedStyle(visible ? openStyle : leavingStyle);
}
