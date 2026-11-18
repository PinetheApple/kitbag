import { useCallback, useMemo } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import { asPercent } from '../percent.ts';
import { radius } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { useReduceMotion } from '../useReduceMotion.ts';

const PERCENT = 100;

export const linearProgress = {
  height: 4,
  radius: radius.sweepTrack,
  band: 0.32,
  restingStart: 0.28,
  cycleMs: 1400,
} as const;

const useStyles = createThemedStyles((theme) => ({
  track: {
    height: linearProgress.height,
    borderRadius: linearProgress.radius,
    backgroundColor: theme.color.surface3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: linearProgress.radius,
    backgroundColor: theme.color.accent,
  },
  band: { width: asPercent(linearProgress.band) },
  resting: { marginLeft: asPercent(linearProgress.restingStart) },
}));

function SweepingBand() {
  const styles = useStyles();
  const phase = useSharedValue(0);
  const trackWidth = useSharedValue(0);
  useFrameCallback(({ timestamp }) => {
    phase.value = (timestamp % linearProgress.cycleMs) / linearProgress.cycleMs;
  });
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      trackWidth.value = event.nativeEvent.layout.width;
    },
    [trackWidth],
  );
  const sweep = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          (phase.value * (1 + linearProgress.band) - linearProgress.band) *
          trackWidth.value,
      },
    ],
  }));
  return (
    <View style={styles.track} onLayout={handleLayout}>
      <Animated.View style={[styles.fill, styles.band, sweep]} />
    </View>
  );
}

export interface LinearProgressProps {
  readonly percent: number | null;
  readonly accessibilityLabel: string;
}

export function LinearProgress({
  percent,
  accessibilityLabel,
}: LinearProgressProps) {
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const filled = useMemo(
    () =>
      percent === null
        ? null
        : {
            width: asPercent(Math.min(PERCENT, Math.max(0, percent)) / PERCENT),
          },
    [percent],
  );
  const a11y =
    percent === null
      ? { accessibilityState: { busy: true } }
      : { accessibilityValue: { min: 0, max: PERCENT, now: percent } };
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      {...a11y}
    >
      {filled !== null ? (
        <View style={styles.track}>
          <View style={[styles.fill, filled]} />
        </View>
      ) : reduceMotion ? (
        <View style={styles.track}>
          <View style={[styles.fill, styles.band, styles.resting]} />
        </View>
      ) : (
        <SweepingBand />
      )}
    </View>
  );
}
