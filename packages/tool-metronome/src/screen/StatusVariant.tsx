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

import { statusRowPitch, statusStackPinned } from '../logic/belowTempo.ts';
import {
  LOWER_SLOT,
  NO_SLOT,
  rowSlot,
  UPPER_SLOT,
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
  const pinned = statusStackPinned(fontScale);
  const anchorSlot = pinned ? LOWER_SLOT : UPPER_SLOT;
  const placed = useAnimatedStyle(() => {
    const slot = rowSlot(rows.value, shown);
    return {
      opacity: slot === NO_SLOT ? 0 : 1,
      transform: [
        { translateY: slot === NO_SLOT ? 0 : (slot - anchorSlot) * pitch },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.variant,
        pinned && styles.pinnedVariant,
        style,
        frame,
        wraps && styles.wrapped,
        placed,
      ]}
    >
      {children}
    </Animated.View>
  );
}
