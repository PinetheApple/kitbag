// The bar sweep under the BPM (SPEC §5.2, design §02 `.beatring`): a thin
// progress bar per bar — anticipation. The LED flash on the click is the
// confirmation half (§12.3); both are drawn, neither replaces the other.
//
// barPhase is read inside useAnimatedStyle on the UI thread — §13.3, see
// useMetronomeFrame.

import { resolveTheme } from '@kitbag/core-design';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

const theme = resolveTheme('dark');

// design §02 `.beatring`: 3px track, 2px radius, inset from the swipe zone.
const TRACK_HEIGHT = 3;
const TRACK_RADIUS = 2;
const TRACK_INSET = 18;
const TRACK_MARGIN_TOP = 12;

interface BarSweepProps {
  readonly barPhase: SharedValue<number>;
}

export function BarSweep({ barPhase }: BarSweepProps) {
  // scaleX from a left-anchored full-width fill: no layout per frame, and the
  // transform stays on the UI thread.
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

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    backgroundColor: theme.surface3,
    marginTop: TRACK_MARGIN_TOP,
    marginHorizontal: TRACK_INSET,
    overflow: 'hidden',
  },
  fill: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    backgroundColor: theme.accent,
    width: '100%',
    // Grow from the left edge rather than the centre.
    transformOrigin: 'left',
  },
});
