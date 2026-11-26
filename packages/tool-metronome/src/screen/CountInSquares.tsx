import {
  CountSquare,
  DrawnLineLabel,
  metronome,
  TRANSPARENT,
} from '@kitbag/core-design';
import { KB_STOPPED_BEAT } from '@kitbag/core-native';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import type { LedRowLayout } from '@kitbag/core-state';

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
  const countBeat = useDerivedValue(() =>
    countingIn.value === 0 ? KB_STOPPED_BEAT : currentBeat.value,
  );
  const shown = useAnimatedStyle(() => ({
    opacity: countingIn.value === 0 ? 0 : 1,
  }));
  const renderSquare = useCallback(
    (beat: number) => (
      <>
        <CountSquare beat={beat} side={dotSize} currentBeat={countBeat} />
        <View style={styles.pulseRow} />
        <DrawnLineLabel
          text=""
          role="beatMarker"
          lineHeight={metronome.beatMarkerLineHeight}
          width={dotSize}
          color={TRANSPARENT}
        />
      </>
    ),
    [dotSize, countBeat, styles],
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
