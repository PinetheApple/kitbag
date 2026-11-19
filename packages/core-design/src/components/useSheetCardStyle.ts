import { useEffect } from 'react';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import { space } from '../roles.ts';

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
