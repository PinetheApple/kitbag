import {
  useCallback,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  BEAT_LABEL_HEIGHT,
  beatDotGeometry,
  DOT_METRICS,
  type BeatLine,
} from '../beatDotLayout.ts';
import {
  beatLabel,
  beatMarker,
  dotLook,
  type DotPalette,
} from '../beatDotLook.ts';
import { NO_PULSE, soundingPulse } from '../pulseMarks.ts';
import type { ScreenDensity } from '../screenDensity.ts';
import { useTheme } from '../ThemeProvider.tsx';
import {
  hitBoxStyle,
  hitExtension,
  type NeighbourGaps,
} from '../touchTarget.ts';
import { dotPalette, useBeatDotStyles } from './beatDotStyles.ts';
import type { LedState } from './BeatLed.tsx';
import { BeatGrid, type BeatPosition } from './BeatGrid.tsx';
import { PulseMarks } from './PulseMarks.tsx';

interface BeatDotProps {
  readonly beat: number;
  readonly state: LedState;
  readonly dotSize: number;
  readonly palette: DotPalette;
  readonly currentBeat: SharedValue<number>;
  readonly barMuted: SharedValue<number>;
  readonly gaps: NeighbourGaps;
  readonly onPress: (beat: number) => void;
}

function BeatDot({
  beat,
  state,
  dotSize,
  palette,
  currentBeat,
  barMuted,
  gaps,
  onPress,
}: BeatDotProps) {
  const styles = useBeatDotStyles();
  const box = useMemo(() => ({ width: dotSize, height: dotSize }), [dotSize]);
  const hitBox = useMemo(
    () => hitBoxStyle(hitExtension(dotSize, dotSize, gaps)),
    [dotSize, gaps],
  );
  const now = useDerivedValue(() =>
    dotLook(state, currentBeat.value === beat, barMuted.value !== 0, palette),
  );
  const look = useAnimatedStyle(() => ({
    backgroundColor: now.value.fill,
    borderColor: now.value.edge,
  }));
  const accentEdge = useAnimatedStyle(() => ({
    borderColor: now.value.accentEdge,
  }));
  const silentNowEdge = useAnimatedStyle(() => ({
    borderColor: now.value.silentNowEdge,
  }));
  const dashed = state === 'muted' && styles.dashed;
  const ring = useAnimatedStyle(() => ({
    borderColor: currentBeat.value === beat ? palette.accent : palette.clear,
  }));
  const handlePress = useCallback(() => {
    onPress(beat);
  }, [onPress, beat]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={beatLabel(beat, state)}
      accessibilityHint="Cycles accent, normal and muted"
      style={hitBox}
      onPress={handlePress}
    >
      <View style={box}>
        <Animated.View style={[styles.dot, box, dashed, look]} />
        {state === 'accented' ? (
          <>
            <Animated.View style={[styles.accentEdge, accentEdge]} />
            <Animated.View style={[styles.ring, ring]} />
          </>
        ) : null}
        <Animated.View style={[styles.silentNowEdge, dashed, silentNowEdge]} />
      </View>
    </Pressable>
  );
}

function dotGaps(
  { line, group, dot }: BeatPosition,
  linePitchGap: number,
): NeighbourGaps {
  const across = (dotEdge: boolean, groupEdge: boolean) => {
    if (!dotEdge) return DOT_METRICS.dotGap;
    return groupEdge ? undefined : DOT_METRICS.groupGap;
  };
  return {
    top: line.first ? undefined : linePitchGap,
    bottom: line.last ? undefined : linePitchGap,
    left: across(dot.first, group.first),
    right: across(dot.last, group.last),
  };
}

export interface BeatDotGridFrame {
  readonly barPhase: SharedValue<number>;
  readonly currentBeat: SharedValue<number>;
  readonly barMuted: SharedValue<number>;
}

export interface BeatDotGridProps {
  readonly lines: readonly BeatLine[];
  readonly states: readonly LedState[];
  readonly subdivision: number;
  readonly width: number;
  readonly density: ScreenDensity;
  readonly frame: BeatDotGridFrame;
  readonly onCycle: (beat: number) => void;
  readonly style?: ComponentProps<typeof Animated.View>['style'];
  readonly children?: ReactNode;
}

interface BeatCellContext {
  readonly dotSize: number;
  readonly palette: DotPalette;
  readonly currentBeat: SharedValue<number>;
  readonly barMuted: SharedValue<number>;
  readonly barPulse: SharedValue<number>;
  readonly subdivision: number;
  readonly linePitchGap: number;
  readonly onCycle: (beat: number) => void;
}

interface BeatCellProps {
  readonly beat: number;
  readonly position: BeatPosition;
  readonly state: LedState;
  readonly cell: BeatCellContext;
}

function BeatCell({ beat, position, state, cell }: BeatCellProps) {
  const styles = useBeatDotStyles();
  return (
    <>
      <BeatDot
        beat={beat}
        state={state}
        dotSize={cell.dotSize}
        palette={cell.palette}
        currentBeat={cell.currentBeat}
        barMuted={cell.barMuted}
        gaps={dotGaps(position, cell.linePitchGap)}
        onPress={cell.onCycle}
      />
      <PulseMarks
        beat={beat}
        pulsesPerBeat={cell.subdivision}
        dotSize={cell.dotSize}
        silentBeat={state === 'muted'}
        barPulse={cell.barPulse}
        barMuted={cell.barMuted}
        palette={cell.palette}
      />
      <Text
        style={styles.marker}
        accessible={false}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {beatMarker(beat)}
      </Text>
    </>
  );
}

function useBarPulse(
  frame: BeatDotGridFrame,
  beatCount: number,
  subdivision: number,
): SharedValue<number> {
  const { barPhase, currentBeat } = frame;
  const barPulse = useSharedValue(NO_PULSE);
  useAnimatedReaction(
    () =>
      soundingPulse(barPhase.value, beatCount, subdivision, currentBeat.value),
    (next) => {
      if (barPulse.value !== next) barPulse.value = next;
    },
    [beatCount, subdivision],
  );
  return barPulse;
}

export function BeatDotGrid(props: BeatDotGridProps) {
  const { lines, states, subdivision, frame, onCycle, style, children } = props;
  const styles = useBeatDotStyles();
  const theme = useTheme();
  const palette = useMemo(() => dotPalette(theme.color), [theme.color]);
  const geometry = beatDotGeometry(lines, props.width, props.density);
  const { dotSize, lineGap } = geometry;
  const lineSpacing = useMemo(() => ({ gap: lineGap }), [lineGap]);
  const barPulse = useBarPulse(frame, states.length, subdivision);
  const { currentBeat, barMuted } = frame;
  const cell = useMemo<BeatCellContext>(
    () => ({
      dotSize,
      palette,
      currentBeat,
      barMuted,
      barPulse,
      subdivision,
      linePitchGap: BEAT_LABEL_HEIGHT + lineGap,
      onCycle,
    }),
    [
      dotSize,
      palette,
      currentBeat,
      barMuted,
      barPulse,
      subdivision,
      lineGap,
      onCycle,
    ],
  );
  const renderDot = useCallback(
    (beat: number, position: BeatPosition) => (
      <BeatCell
        beat={beat}
        position={position}
        state={states[beat] ?? 'normal'}
        cell={cell}
      />
    ),
    [states, cell],
  );
  return (
    <Animated.View style={[styles.lines, lineSpacing, style]}>
      <BeatGrid lines={lines} renderBeat={renderDot} />
      {children}
    </Animated.View>
  );
}
