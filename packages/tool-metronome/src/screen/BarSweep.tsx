import { createThemedStyles, inset, radius, size } from '@kitbag/core-design';
import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

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
  const fillStyle = useAnimatedStyle(() => {
    const phase = barPhase.value;
    const clamped = phase < 0 ? 0 : phase > 1 ? 1 : phase;
    return { transform: [{ scaleX: clamped }] };
  });

  return (
    <View style={[styles.track, spacing]}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}
