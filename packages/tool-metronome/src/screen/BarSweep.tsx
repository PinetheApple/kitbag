import {
  createThemedStyles,
  FillBar,
  inset,
  radius,
  size,
  useReduceMotionValue,
  useTheme,
} from '@kitbag/core-design';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { sweepFill } from '../logic/barSweep.ts';
import { trackOpacity } from '../logic/trackOpacity.ts';

interface BarSweepProps {
  readonly barPhase: SharedValue<number>;
  readonly gap: number;
}

const useStyles = createThemedStyles((theme) => ({
  track: {
    height: size.sweepTrack,
    borderRadius: radius.sweepTrack,
    backgroundColor: theme.color.surface3,
    marginHorizontal: inset.sweepH,
    overflow: 'hidden',
  },
}));

export function BarSweep({ barPhase, gap }: BarSweepProps) {
  const styles = useStyles();
  const { color } = useTheme();
  const spacing = useMemo(() => ({ marginTop: gap }), [gap]);
  const still = useReduceMotionValue();
  const trackStyle = useAnimatedStyle(() => ({
    opacity: trackOpacity(!still.value),
  }));
  const fill = useDerivedValue(() => sweepFill(barPhase.value, still.value));

  return (
    <Animated.View style={[styles.track, spacing, trackStyle]}>
      <FillBar
        progress={fill}
        color={color.accent}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}
