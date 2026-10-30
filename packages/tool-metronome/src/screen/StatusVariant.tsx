import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import {
  NO_SLOT,
  rowSlot,
  type StatusRow,
  type StatusRows,
} from '../logic/statusRows.ts';
import { ROW_PITCH, useStatusStyles } from './statusStyles.ts';

interface StatusVariantProps {
  readonly rows: SharedValue<StatusRows>;
  readonly shown: StatusRow;
  readonly style: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}

export function StatusVariant({
  rows,
  shown,
  style,
  children,
}: StatusVariantProps) {
  const styles = useStatusStyles();
  const placed = useAnimatedStyle(() => {
    const slot = rowSlot(rows.value, shown);
    return {
      opacity: slot === NO_SLOT ? 0 : 1,
      transform: [{ translateY: slot === NO_SLOT ? 0 : slot * ROW_PITCH }],
    };
  });
  return (
    <Animated.View style={[styles.variant, style, placed]}>
      {children}
    </Animated.View>
  );
}
