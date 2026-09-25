import {
  createThemedStyles,
  inset,
  radius,
  size,
  space,
} from '@kitbag/core-design';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

interface BarSweepProps {
  readonly barPhase: SharedValue<number>;
}

const useStyles = createThemedStyles((theme) => ({
  track: {
    height: size.sweepTrack,
    borderRadius: radius.sweepTrack,
    backgroundColor: theme.color.surface3,
    marginTop: space.sectionGap,
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

export function BarSweep({ barPhase }: BarSweepProps) {
  const styles = useStyles();
  const fillStyle = useAnimatedStyle(() => {
    const phase = barPhase.value;
    const clamped = phase < 0 ? 0 : phase > 1 ? 1 : phase;
    return { transform: [{ scaleX: clamped }] };
  });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}
