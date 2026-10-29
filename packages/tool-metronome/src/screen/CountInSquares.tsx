import {
  size,
  textRoles,
  TRANSPARENT,
  UNSCALED_TEXT,
  useTheme,
} from '@kitbag/core-design';
import { useCallback, useMemo } from 'react';
import { Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import type { LedRowLayout } from '../logic/ledLayout.ts';
import { countSquare } from '../logic/statusLine.ts';
import { useBeatDotStyles } from './beatDotStyles.ts';
import { BeatGrid } from './BeatGrid.tsx';

interface SquareProps {
  readonly beat: number;
  readonly side: number;
  readonly currentBeat: SharedValue<number>;
}

function CountSquare({ beat, side, currentBeat }: SquareProps) {
  const styles = useBeatDotStyles();
  const { color } = useTheme();
  const box = useMemo(
    () => ({
      width: side,
      height: side,
    }),
    [side],
  );
  const number = useMemo(
    () => ({
      fontSize: (textRoles.countSquare.size * side) / size.countSquare,
    }),
    [side],
  );
  const face = useAnimatedStyle(() => {
    const state = countSquare(beat, currentBeat.value);
    if (state === 'now') {
      return { backgroundColor: color.text, borderColor: color.text };
    }
    if (state === 'done') {
      return { backgroundColor: color.surface3, borderColor: color.surface3 };
    }
    return { backgroundColor: TRANSPARENT, borderColor: color.text3 };
  });
  const ink = useAnimatedStyle(() => {
    const state = countSquare(beat, currentBeat.value);
    if (state === 'now') return { color: color.bg };
    return { color: state === 'done' ? color.text3 : color.text2 };
  });
  return (
    <Animated.View style={[styles.square, box, face]}>
      <Animated.Text
        maxFontSizeMultiplier={UNSCALED_TEXT}
        style={[styles.squareNumber, number, ink]}
      >
        {String(beat + 1)}
      </Animated.Text>
    </Animated.View>
  );
}

interface CountInSquaresProps {
  readonly lines: readonly LedRowLayout[];
  readonly dotSize: number;
  readonly currentBeat: SharedValue<number>;
  readonly countingIn: SharedValue<number>;
}

export function CountInSquares({
  lines,
  dotSize,
  currentBeat,
  countingIn,
}: CountInSquaresProps) {
  const styles = useBeatDotStyles();
  const shown = useAnimatedStyle(() => ({
    opacity: countingIn.value === 0 ? 0 : 1,
  }));
  const renderSquare = useCallback(
    (beat: number) => (
      <>
        <CountSquare beat={beat} side={dotSize} currentBeat={currentBeat} />
        <Text style={styles.marker} />
      </>
    ),
    [dotSize, currentBeat, styles],
  );
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, styles.lines, shown]}
    >
      <BeatGrid lines={lines} renderBeat={renderSquare} />
    </Animated.View>
  );
}
