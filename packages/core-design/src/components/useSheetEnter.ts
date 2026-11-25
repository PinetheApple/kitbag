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
  const waiting = useRef(false);
  const laidOut = useRef(false);
  const shown = useRef(onShown);
  shown.current = onShown;
  const settled = useCallback((slide: number, stillOpen: boolean) => {
    if (sliding.current !== slide) return;
    sliding.current = null;
    if (stillOpen) shown.current();
  }, []);
  // A long frame could end a slide started before the content mounted, so
  // onShown would focus a field that did not exist yet.
  const startSlide = useCallback(() => {
    const slide = sliding.current;
    if (!waiting.current || slide === null) return;
    waiting.current = false;
    enterY.value = withTiming(0, { reduceMotion: motion }, (finished) => {
      'worklet';
      if (!finished) enterY.value = 0;
      scheduleOnRN(settled, slide, open.value);
    });
  }, [enterY, motion, open, settled]);
  const enter = useCallback(() => {
    slides.current += 1;
    sliding.current = slides.current;
    waiting.current = true;
    enterY.value = windowHeight;
    if (laidOut.current) startSlide();
  }, [enterY, windowHeight, startSlide]);
  const slotLaidOut = useCallback(() => {
    laidOut.current = true;
    startSlide();
  }, [startSlide]);
  const slotAttached = useCallback((slot: unknown) => {
    if (slot === null) laidOut.current = false;
  }, []);
  const returned = useCallback(() => {
    if (sliding.current === null) shown.current();
  }, []);
  useEffect(
    () => () => {
      sliding.current = null;
      waiting.current = false;
      cancelAnimation(enterY);
    },
    [enterY],
  );
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: enterY.value }],
  }));
  return { enter, returned, slotAttached, slotLaidOut, style };
}
