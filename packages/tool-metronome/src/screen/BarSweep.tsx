import { createThemedStyles, inset, radius, size } from '@kitbag/core-design';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { sweepFill } from '../logic/barSweep.ts';

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
  fill: {
    height: size.sweepTrack,
    borderRadius: radius.sweepTrack,
    backgroundColor: theme.color.accent,
    width: '100%',
    transformOrigin: 'left',
  },
}));

export function BarSweep({ barPhase, gap }: BarSweepProps) {
  const styles = useStyles();
  const spacing = useMemo(() => ({ marginTop: gap }), [gap]);
  const reduceMotion = useReducedMotion();
  const still = useSharedValue(reduceMotion);
  useEffect(() => {
    still.value = reduceMotion;
  }, [reduceMotion, still]);
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: sweepFill(barPhase.value, still.value) }],
  }));

  return (
    <View style={[styles.track, spacing]}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}
