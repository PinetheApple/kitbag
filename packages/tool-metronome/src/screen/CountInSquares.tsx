import { CountSquare } from '@kitbag/core-design';
import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import type { LedRowLayout } from '@kitbag/core-state';

import { TEXT_PLACEHOLDER } from '../logic/textPlaceholder.ts';
import { useBeatDotStyles } from './beatDotStyles.ts';
import { BeatGrid } from './BeatGrid.tsx';

interface CountInSquaresProps {
  readonly lines: readonly LedRowLayout[];
  readonly dotSize: number;
  readonly lineGap: number;
  readonly currentBeat: SharedValue<number>;
  readonly countingIn: SharedValue<number>;
}

export function CountInSquares({
  lines,
  dotSize,
  lineGap,
  currentBeat,
  countingIn,
}: CountInSquaresProps) {
  const styles = useBeatDotStyles();
  const lineSpacing = useMemo(() => ({ gap: lineGap }), [lineGap]);
  const shown = useAnimatedStyle(() => ({
    opacity: countingIn.value === 0 ? 0 : 1,
  }));
  const renderSquare = useCallback(
    (beat: number) => (
      <>
        <CountSquare beat={beat} side={dotSize} currentBeat={currentBeat} />
        <View style={styles.pulseRow} />
        <Text style={styles.marker}>{TEXT_PLACEHOLDER}</Text>
      </>
    ),
    [dotSize, currentBeat, styles],
  );
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, styles.lines, lineSpacing, shown]}
    >
      <BeatGrid lines={lines} renderBeat={renderSquare} />
    </Animated.View>
  );
}
