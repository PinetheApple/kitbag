import { ledRadius, resolveTheme } from '@kitbag/core-design';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

// One LED per beat, read in useAnimatedStyle on the UI thread — §13.3, see
// useBeatSweep. The LED count is human-speed React state (beats per bar); the
// flash is not.

const theme = resolveTheme('dark');
const LED_ON = theme.accent;
const LED_OFF = theme.accentDim;
const LED_IDLE_OPACITY = 0.35;
const LED_SIZE = 18;

interface LedProps {
  readonly index: number;
  readonly currentBeat: SharedValue<number>;
}

function Led({ index, currentBeat }: LedProps) {
  const style = useAnimatedStyle(() => {
    const active = Math.round(currentBeat.value) === index;
    return {
      backgroundColor: active ? LED_ON : LED_OFF,
      opacity: active ? 1 : LED_IDLE_OPACITY,
    };
  });

  return <Animated.View style={[styles.led, style]} />;
}

interface LedRowProps {
  readonly currentBeat: SharedValue<number>;
  readonly beatsPerBar: number;
}

export function LedRow({ currentBeat, beatsPerBar }: LedRowProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: beatsPerBar }, (_unused, index) => (
        <Led key={index} index={index} currentBeat={currentBeat} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  led: {
    width: LED_SIZE,
    height: LED_SIZE,
    borderRadius: ledRadius,
  },
});
