import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { NO_PULSE, pulseInBeat, pulseMarkFit } from '../logic/pulseMarks.ts';
import { PULSE_MARKS, useBeatDotStyles } from './beatDotStyles.ts';

interface PulseMarksProps {
  readonly beat: number;
  readonly pulses: number;
  readonly dotSize: number;
  readonly silentBeat: boolean;
  readonly pulse: SharedValue<number>;
  readonly barMuted: SharedValue<number>;
}

export function PulseMarks({
  beat,
  pulses,
  dotSize,
  silentBeat,
  pulse,
  barMuted,
}: PulseMarksProps) {
  const styles = useBeatDotStyles();
  const fit = useMemo(
    () => pulseMarkFit(pulses, dotSize, PULSE_MARKS),
    [pulses, dotSize],
  );
  const mark = useMemo(
    () => ({ width: fit.mark, height: fit.mark, borderRadius: fit.radius }),
    [fit],
  );
  const spacing = useMemo(() => ({ gap: fit.gap }), [fit.gap]);
  const pitch = fit.mark + fit.gap;
  const lit = useAnimatedStyle(() => {
    const local = pulseInBeat(pulse.value, beat, pulses);
    const sounding = local !== NO_PULSE && barMuted.value === 0;
    return {
      opacity: sounding ? 1 : 0,
      transform: [{ translateX: sounding ? local * pitch : 0 }],
    };
  });
  const marks = Array.from({ length: pulses }, (_u, i) => i);
  return (
    <View style={styles.pulseRow}>
      <View style={[styles.pulseMarks, spacing]}>
        {marks.map((index) => (
          <View key={index} style={[styles.pulseMark, mark]} />
        ))}
        {silentBeat ? null : (
          <Animated.View style={[styles.pulseLit, mark, lit]} />
        )}
      </View>
    </View>
  );
}
