import { isTextScaled } from '@kitbag/core-design';
import type { ReactNode } from 'react';
import {
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { statusRowPitch } from '../logic/belowTempo.ts';
import {
  NO_SLOT,
  rowSlot,
  type StatusRow,
  type StatusRows,
} from '../logic/statusRows.ts';
import { useStatusStyles } from './statusStyles.ts';
import { useStatusRowFrame } from './useStatusRowFrame.ts';

interface StatusVariantProps {
  readonly rows: SharedValue<StatusRows>;
  readonly shown: StatusRow;
  readonly style: StyleProp<ViewStyle>;
  readonly wrapsWhenScaled?: boolean;
  readonly children: ReactNode;
}

export function StatusVariant({
  rows,
  shown,
  style,
  wrapsWhenScaled = true,
  children,
}: StatusVariantProps) {
  const styles = useStatusStyles();
  const { fontScale } = useWindowDimensions();
  const pitch = statusRowPitch(fontScale);
  const frame = useStatusRowFrame();
  const wraps = wrapsWhenScaled && isTextScaled(fontScale);
  const placed = useAnimatedStyle(() => {
    const slot = rowSlot(rows.value, shown);
    return {
      opacity: slot === NO_SLOT ? 0 : 1,
      transform: [{ translateY: slot === NO_SLOT ? 0 : slot * pitch }],
    };
  });
  return (
    <Animated.View
      style={[styles.variant, style, frame, wraps && styles.wrapped, placed]}
    >
      {children}
    </Animated.View>
  );
}
