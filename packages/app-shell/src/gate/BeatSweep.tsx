import { resolveTheme } from '@kitbag/core-design';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { sweepTranslateX } from './sweepGeometry';

// Reads barPhase in useAnimatedStyle on the UI thread — §13.3 mechanism, see
// useBeatSweep.

const theme = resolveTheme('dark');

const TRACK_WIDTH = 320;
const TRACK_HEIGHT = 10;
const SWEEP_WIDTH = 8;

interface BeatSweepProps {
  readonly barPhase: SharedValue<number>;
}

export function BeatSweep({ barPhase }: BeatSweepProps) {
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: sweepTranslateX(barPhase.value, TRACK_WIDTH, SWEEP_WIDTH) },
    ],
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.sweep, sweepStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    backgroundColor: theme.surface2,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
  },
  sweep: {
    width: SWEEP_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: SWEEP_WIDTH / 2,
    backgroundColor: theme.accent,
  },
});
