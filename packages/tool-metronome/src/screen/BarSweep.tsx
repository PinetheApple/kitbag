import { createThemedStyles } from '@kitbag/core-design';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

const TRACK_HEIGHT = 3;
const TRACK_RADIUS = 2;
const TRACK_INSET = 18;
const TRACK_MARGIN_TOP = 12;

interface BarSweepProps {
  readonly barPhase: SharedValue<number>;
}

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

const useStyles = createThemedStyles((theme) => ({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    backgroundColor: theme.color.surface3,
    marginTop: TRACK_MARGIN_TOP,
    marginHorizontal: TRACK_INSET,
    overflow: 'hidden',
  },
  fill: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    backgroundColor: theme.color.accent,
    width: '100%',
    transformOrigin: 'left',
  },
}));
