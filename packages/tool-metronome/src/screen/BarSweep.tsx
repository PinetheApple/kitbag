import { createThemedStyles, inset, radius, size } from '@kitbag/core-design';
import { useMemo } from 'react';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { sweepFill } from '../logic/barSweep.ts';
import { useStillMotion } from './useStillMotion.ts';

const HIDDEN = 0;
const SHOWN = 1;

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
  const still = useStillMotion();
  const trackStyle = useAnimatedStyle(() => ({
    opacity: still.value ? HIDDEN : SHOWN,
  }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: sweepFill(barPhase.value, still.value) }],
  }));

  return (
    <Animated.View style={[styles.track, spacing, trackStyle]}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </Animated.View>
  );
}
