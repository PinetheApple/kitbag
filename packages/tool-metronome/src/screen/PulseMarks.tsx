import { useTheme } from '@kitbag/core-design';
import { useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { pulseInBeat, pulseMarkFit } from '../logic/pulseMarks.ts';
import { PULSE_MARKS, useBeatDotStyles } from './beatDotStyles.ts';

interface PulseMarksProps {
  readonly beat: number;
  readonly pulsesPerBeat: number;
  readonly dotSize: number;
  readonly silentBeat: boolean;
  readonly barPulse: SharedValue<number>;
  readonly barMuted: SharedValue<number>;
}

interface PulseMarkProps extends Omit<PulseMarksProps, 'dotSize'> {
  readonly index: number;
  readonly shape: ViewStyle;
}

function PulseMark({
  index,
  beat,
  pulsesPerBeat,
  silentBeat,
  barPulse,
  barMuted,
  shape,
}: PulseMarkProps) {
  const styles = useBeatDotStyles();
  const { color } = useTheme();
  const lit = useAnimatedStyle(() => {
    const sounding =
      !silentBeat &&
      barMuted.value === 0 &&
      pulseInBeat(barPulse.value, beat, pulsesPerBeat) === index;
    return { backgroundColor: sounding ? color.accent : color.surface3 };
  });
  return <Animated.View style={[styles.pulseMark, shape, lit]} />;
}

export function PulseMarks({
  beat,
  pulsesPerBeat,
  dotSize,
  silentBeat,
  barPulse,
  barMuted,
}: PulseMarksProps) {
  const styles = useBeatDotStyles();
  const fit = useMemo(
    () => pulseMarkFit(pulsesPerBeat, dotSize, PULSE_MARKS),
    [pulsesPerBeat, dotSize],
  );
  const shape = useMemo(
    () => ({ width: fit.mark, height: fit.mark, borderRadius: fit.radius }),
    [fit],
  );
  const spacing = useMemo(() => ({ gap: fit.gap }), [fit.gap]);
  const marks = Array.from({ length: pulsesPerBeat }, (_u, i) => i);
  return (
    <View style={styles.pulseRow}>
      <View style={[styles.pulseMarks, spacing]}>
        {marks.map((index) => (
          <PulseMark
            key={index}
            index={index}
            beat={beat}
            pulsesPerBeat={pulsesPerBeat}
            silentBeat={silentBeat}
            barPulse={barPulse}
            barMuted={barMuted}
            shape={shape}
          />
        ))}
      </View>
    </View>
  );
}
