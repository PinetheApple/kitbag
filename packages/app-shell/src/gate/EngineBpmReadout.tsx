import { resolveTheme } from '@kitbag/core-design';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';

// Animated readout of the engine's current_bpm (ramp progress), written on the
// UI thread via animatedProps — same §13.3 rule as the sweep (see useBeatSweep).

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const theme = resolveTheme('dark');

interface EngineBpmReadoutProps {
  readonly currentBpm: SharedValue<number>;
}

export function EngineBpmReadout({ currentBpm }: EngineBpmReadoutProps) {
  const animatedProps = useAnimatedProps(() => {
    const text = currentBpm.value.toFixed(0);
    // `text` is the animated-value channel a TextInput reads; it is not in
    // TextInputProps, so cast to write it from the UI thread without a render.
    return { text, defaultValue: text } as unknown as Partial<TextInputProps>;
  });

  return (
    <AnimatedTextInput
      style={styles.readout}
      editable={false}
      underlineColorAndroid="transparent"
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  readout: {
    color: theme.text2,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
});
