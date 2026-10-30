import {
  hitBoxStyle,
  hitExtension,
  useTheme,
  type LedState,
  type NeighbourGaps,
} from '@kitbag/core-design';
import { KB_ACCENT } from '@kitbag/core-native';
import { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  beatLabel,
  beatMarker,
  dotLook,
  ledStateFor,
  type DotPalette,
} from '../logic/beatDot.ts';
import {
  beatDotSize,
  layoutBeatLeds,
  MAX_DOTS_PER_LINE,
  widestLineWidth,
} from '../logic/ledLayout.ts';
import {
  BEAT_LABEL_HEIGHT,
  beatDotLineGap,
  beatDotMetrics,
  DOT_METRICS,
} from '../logic/belowTempo.ts';
import { NO_PULSE, soundingPulse } from '../logic/pulseMarks.ts';
import type { ScreenDensity } from '../logic/screenDensity.ts';
import { dotPalette, DOT_WIDTHS, useBeatDotStyles } from './beatDotStyles.ts';
import { BeatGrid, type BeatPosition } from './BeatGrid.tsx';
import { CountInSquares } from './CountInSquares.tsx';
import { PolyDots } from './PolyDots.tsx';
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
  const look = useAnimatedStyle(() =>
    dotLook(
      state,
      currentBeat.value === beat,
      barMuted.value !== 0,
      palette,
      DOT_WIDTHS,
    ),
  );
  const ring = useAnimatedStyle(() => ({
    opacity: currentBeat.value === beat ? 1 : 0,
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
        <Animated.View
          style={[styles.dot, box, state === 'muted' && styles.dashed, look]}
        />
        {state === 'accented' ? (
          <Animated.View style={[styles.ring, ring]} />
        ) : null}
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

export interface BeatDotsFrame {
  readonly barPhase: SharedValue<number>;
  readonly currentBeat: SharedValue<number>;
  readonly currentPolyBeat: SharedValue<number>;
  readonly barMuted: SharedValue<number>;
  readonly countingIn: SharedValue<number>;
}

interface BeatDotsProps {
  readonly beatCount: number;
  readonly subdivision: number;
  readonly polyBeats: number | null;
  readonly accents: readonly KB_ACCENT[];
  readonly width: number;
  readonly density: ScreenDensity;
  readonly frame: BeatDotsFrame;
  readonly onCycle: (beat: number) => void;
}

export function BeatDots({
  beatCount,
  subdivision,
  polyBeats,
  accents,
  width,
  density,
  frame,
  onCycle,
}: BeatDotsProps) {
  const styles = useBeatDotStyles();
  const theme = useTheme();
  const palette = useMemo(() => dotPalette(theme.color), [theme.color]);
  const lines = useMemo(
    () => layoutBeatLeds(beatCount, MAX_DOTS_PER_LINE),
    [beatCount],
  );
  const metrics = beatDotMetrics(density, lines);
  const dotSize = beatDotSize(lines, width, metrics);
  const lineGap = beatDotLineGap(density);
  const linePitchGap = BEAT_LABEL_HEIGHT + lineGap;
  const lineSpacing = useMemo(() => ({ gap: lineGap }), [lineGap]);
  const { barPhase, countingIn, currentBeat, barMuted } = frame;
  const barPulse = useSharedValue(NO_PULSE);
  useAnimatedReaction(
    () =>
      soundingPulse(barPhase.value, beatCount, subdivision, currentBeat.value),
    (next) => {
      if (barPulse.value !== next) barPulse.value = next;
    },
    [beatCount, subdivision],
  );
  const dotsShown = useAnimatedStyle(() => {
    const shown = countingIn.value === 0;
    return { opacity: shown ? 1 : 0, pointerEvents: shown ? 'auto' : 'none' };
  });
  const renderDot = useCallback(
    (beat: number, position: BeatPosition) => {
      const state = ledStateFor(accents[beat] ?? KB_ACCENT.KB_ACCENT_NORMAL);
      return (
        <>
          <BeatDot
            beat={beat}
            state={state}
            dotSize={dotSize}
            palette={palette}
            currentBeat={currentBeat}
            barMuted={barMuted}
            gaps={dotGaps(position, linePitchGap)}
            onPress={onCycle}
          />
          <PulseMarks
            beat={beat}
            pulsesPerBeat={subdivision}
            dotSize={dotSize}
            silentBeat={state === 'muted'}
            barPulse={barPulse}
            barMuted={barMuted}
          />
          <Text style={styles.marker}>{beatMarker(beat)}</Text>
        </>
      );
    },
    [
      accents,
      dotSize,
      palette,
      currentBeat,
      barMuted,
      onCycle,
      styles,
      subdivision,
      barPulse,
      linePitchGap,
    ],
  );

  return (
    <View>
      <Animated.View style={[styles.lines, lineSpacing, dotsShown]}>
        <BeatGrid lines={lines} renderBeat={renderDot} />
        {polyBeats === null ? null : (
          <PolyDots
            polyBeats={polyBeats}
            beatsPerBar={beatCount}
            lineWidth={widestLineWidth(lines, dotSize, metrics)}
            areaWidth={width}
            dotSize={dotSize}
            currentPolyBeat={frame.currentPolyBeat}
          />
        )}
      </Animated.View>
      <CountInSquares
        lines={lines}
        dotSize={dotSize}
        currentBeat={currentBeat}
        countingIn={countingIn}
      />
    </View>
  );
}

export function BeatLegend() {
  const styles = useBeatDotStyles();
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, styles.swatchAccent]} />
        <Text style={styles.legendLabel}>accent</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, styles.swatchNormal]} />
        <Text style={styles.legendLabel}>normal</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, styles.swatchMuted]} />
        <Text style={styles.legendLabel}>muted</Text>
      </View>
    </View>
  );
}
