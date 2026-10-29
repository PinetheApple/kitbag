import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import type { StatusMode } from '../logic/statusLine.ts';
import { useStatusStyles } from './statusStyles.ts';

interface StatusVariantProps {
  readonly mode: SharedValue<StatusMode>;
  readonly shown: StatusMode;
  readonly style: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}

export function StatusVariant({
  mode,
  shown,
  style,
  children,
}: StatusVariantProps) {
  const styles = useStatusStyles();
  const visible = useAnimatedStyle(() => ({
    opacity: mode.value === shown ? 1 : 0,
  }));
  return (
    <Animated.View style={[styles.variant, style, visible]}>
      {children}
    </Animated.View>
  );
}
