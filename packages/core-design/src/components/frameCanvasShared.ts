import { useCallback } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { useSharedValue, type DerivedValue } from 'react-native-reanimated';

import { readerHiding } from '../readerHiding.ts';

export const CANVAS_HIDING = { ...readerHiding(true), accessible: false };

const UNMEASURED = { width: 0, height: 0 };

export interface FillBarProps {
  readonly shown: DerivedValue<number>;
  readonly color: string | DerivedValue<string>;
  readonly style: StyleProp<ViewStyle>;
  readonly radius?: number;
  readonly testID?: string;
}

export interface ThumbDotProps {
  readonly shown: DerivedValue<number>;
  readonly color: string;
  readonly diameter: number;
  readonly style: StyleProp<ViewStyle>;
}

export interface WaveLayersProps {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly playedColor: string;
  readonly progress: DerivedValue<number> | undefined;
}

export function useMeasuredSize() {
  const size = useSharedValue(UNMEASURED);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      size.value = { width, height };
    },
    [size],
  );
  return { size, onLayout };
}
