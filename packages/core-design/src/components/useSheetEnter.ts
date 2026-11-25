import { useCallback, useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type ReduceMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export interface SheetEnterOptions {
  readonly motion: ReduceMotion;
  readonly open: SharedValue<boolean>;
  readonly onShown: () => void;
}

export function useSheetEnter({ motion, open, onShown }: SheetEnterOptions) {
  const { height: windowHeight } = useWindowDimensions();
  const enterY = useSharedValue(windowHeight);
  const slides = useRef(0);
  const sliding = useRef<number | null>(null);
  const shown = useRef(onShown);
  shown.current = onShown;
  const settled = useCallback((slide: number, stillOpen: boolean) => {
    if (sliding.current !== slide) return;
    sliding.current = null;
    if (stillOpen) shown.current();
  }, []);
  const enter = useCallback(() => {
    slides.current += 1;
    const slide = slides.current;
    sliding.current = slide;
    enterY.value = windowHeight;
    enterY.value = withTiming(0, { reduceMotion: motion }, (finished) => {
      'worklet';
      if (!finished) enterY.value = 0;
      scheduleOnRN(settled, slide, open.value);
    });
  }, [enterY, windowHeight, motion, open, settled]);
  const returned = useCallback(() => {
    if (sliding.current === null) shown.current();
  }, []);
  useEffect(
    () => () => {
      sliding.current = null;
      cancelAnimation(enterY);
    },
    [enterY],
  );
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: enterY.value }],
  }));
  return { enter, returned, style };
}
