import {
  createThemedStyles,
  metronome,
  radius,
  space,
  textRoles,
  textStyle,
  TRANSPARENT,
  useTheme,
} from '@kitbag/core-design';
import { effectivePolyAgainst } from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { DOT_METRICS } from '../logic/belowTempo.ts';
import {
  polyBarTable,
  polyCycleOffset,
  polyDotSize,
  polyLabelLeft,
  polyLabelPlace,
  polyLastDotRight,
  polyRatioLabel,
  polySpanInArea,
  polyX,
  soundingCycle,
  type PolyRatio,
  type PolyRowGeometry,
} from '../logic/polyRow.ts';
import { dotPalette } from './beatDotStyles.ts';

const usePolyStyles = createThemedStyles((theme) => ({
  block: {
    alignSelf: 'center',
    gap: metronome.beatMarkerGap,
  },
  row: {
    height: metronome.polyRow,
  },
  besideLabel: {
    position: 'absolute',
    top: 0,
    height: metronome.polyDot,
    justifyContent: 'center',
  },
  aboveLabel: {
    alignSelf: 'flex-start',
  },
  ghost: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
  },
  labelText: {
    ...textStyle(textRoles.polyRatio),
    lineHeight: metronome.beatMarkerLineHeight,
    color: theme.color.text2,
  },
  dot: {
    position: 'absolute',
    borderRadius: radius.circle,
  },
  bracket: {
    position: 'absolute',
    top: metronome.polyDot + metronome.polyBracketGap,
    height: metronome.polyBracket,
    borderTopWidth: 0,
    borderBottomLeftRadius: metronome.polyBracketRadius,
    borderBottomRightRadius: metronome.polyBracketRadius,
  },
}));

const BRACKET_FOR_CURRENT = [false, true] as const;

interface PlacedPulse {
  readonly bar: number;
  readonly left: number;
  readonly slot: number;
  readonly cycle: number;
}

interface PlacedSpan {
  readonly bar: number;
  readonly left: number;
  readonly width: number;
  readonly cycle: number;
}

function placedPulses(
  ratio: PolyRatio,
  row: PolyRowGeometry,
  size: number,
): readonly PlacedPulse[] {
  return polyBarTable(ratio).flatMap((table, bar) =>
    table.pulses.map((pulse) => ({
      bar,
      left: polyX(pulse.beat, ratio.beatsPerBar, row) - size / 2,
      slot: pulse.slot,
      cycle: pulse.cycle,
    })),
  );
}

function placedSpans(
  ratio: PolyRatio,
  row: PolyRowGeometry,
  areaWidth: number,
): readonly PlacedSpan[] {
  return polyBarTable(ratio).flatMap((table, bar) =>
    table.spans.map((span) => ({
      bar,
      ...polySpanInArea(span, ratio.beatsPerBar, row, areaWidth),
      cycle: span.cycle,
    })),
  );
}

interface PolyDotProps {
  readonly pulse: PlacedPulse;
  readonly size: number;
  readonly offset: SharedValue<number>;
  readonly cycle: SharedValue<number>;
  readonly currentPolyBeat: SharedValue<number>;
}

function PolyDot({
  pulse,
  size,
  offset,
  cycle,
  currentPolyBeat,
}: PolyDotProps) {
  const styles = usePolyStyles();
  const { color } = useTheme();
  const palette = useMemo(() => dotPalette(color), [color]);
  const ring = pulse.slot === 0;
  const place = useMemo(
    () => ({
      top: (metronome.polyDot - size) / 2,
      left: pulse.left,
      width: size,
      height: size,
      borderWidth: ring ? metronome.dotRing : metronome.dotBorder,
    }),
    [size, pulse.left, ring],
  );
  const look = useAnimatedStyle(() => {
    if (offset.value !== pulse.bar) {
      return { backgroundColor: TRANSPARENT, borderColor: TRANSPARENT };
    }
    const sounding =
      pulse.slot === currentPolyBeat.value && pulse.cycle === cycle.value;
    const rest = ring ? TRANSPARENT : palette.fill;
    return {
      backgroundColor: sounding ? color.text2 : rest,
      borderColor: sounding || ring ? color.text2 : palette.border,
    };
  });
  return <Animated.View style={[styles.dot, place, look]} />;
}

interface CycleBracketProps {
  readonly span: PlacedSpan;
  readonly current: boolean;
  readonly offset: SharedValue<number>;
  readonly cycle: SharedValue<number>;
}

function CycleBracket({ span, current, offset, cycle }: CycleBracketProps) {
  const styles = usePolyStyles();
  const { color } = useTheme();
  const place = useMemo(() => {
    const border = current
      ? metronome.polyBracketNowBorder
      : metronome.polyBracketBorder;
    return {
      left: span.left,
      width: span.width,
      borderLeftWidth: border,
      borderRightWidth: border,
      borderBottomWidth: border,
    };
  }, [span.left, span.width, current]);
  const look = useAnimatedStyle(() => {
    const shown =
      offset.value === span.bar && (span.cycle === cycle.value) === current;
    return {
      borderColor: shown ? (current ? color.text2 : color.decor) : TRANSPARENT,
    };
  });
  return <Animated.View style={[styles.bracket, place, look]} />;
}

export interface PolyDotsFrame {
  readonly currentBeat: SharedValue<number>;
  readonly currentPolyBeat: SharedValue<number>;
  readonly polyDownbeatPhase: SharedValue<number>;
}

interface PolyDotsProps {
  readonly polyBeats: number;
  readonly polyAgainst: number;
  readonly beatsPerBar: number;
  readonly lineWidth: number;
  readonly areaWidth: number;
  readonly dotSize: number;
  readonly frame: PolyDotsFrame;
}

function usePolyFrame(frame: PolyDotsFrame, against: number) {
  const { currentBeat, polyDownbeatPhase } = frame;
  const offset = useDerivedValue(() =>
    polyCycleOffset(polyDownbeatPhase.value, against),
  );
  const cycle = useDerivedValue(() =>
    soundingCycle(currentBeat.value, offset.value, against),
  );
  return { offset, cycle };
}

export function PolyDots({
  polyBeats,
  polyAgainst,
  beatsPerBar,
  lineWidth,
  areaWidth,
  dotSize,
  frame,
}: PolyDotsProps) {
  const styles = usePolyStyles();
  const against = effectivePolyAgainst(polyAgainst, beatsPerBar);
  const ratio = useMemo(
    () => ({ polyBeats, against, beatsPerBar }),
    [polyBeats, against, beatsPerBar],
  );
  const row = useMemo(
    () => ({ lineWidth, dotSize, dotGap: DOT_METRICS.dotGap }),
    [lineWidth, dotSize],
  );
  const size = polyDotSize(ratio, row, metronome.polyDot);
  const pulses = useMemo(
    () => placedPulses(ratio, row, size),
    [ratio, row, size],
  );
  const spans = useMemo(
    () => placedSpans(ratio, row, areaWidth),
    [ratio, row, areaWidth],
  );
  const { offset, cycle } = usePolyFrame(frame, against);
  const [label, setLabel] = useState({ width: 0, height: 0 });
  const labelWidth = label.width;
  const text = polyRatioLabel(ratio);
  const lastDotRight = polyLastDotRight(ratio, row, size);
  const place = polyLabelPlace({
    labelWidth,
    labelHeight: label.height,
    rowHeight: metronome.polyDot,
    sideRoom: (areaWidth - lineWidth) / 2,
    screenInset: space.screenInset,
    afterLastDot: lineWidth - lastDotRight,
  });
  const width = useMemo(() => ({ width: lineWidth }), [lineWidth]);
  const besidePlace = useMemo(
    () => ({
      left: polyLabelLeft(place, lastDotRight, labelWidth),
      width: labelWidth,
    }),
    [place, lastDotRight, labelWidth],
  );
  const handleLabelLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLabel({ width, height });
  }, []);
  const labelText = (
    <Text accessibilityLabel="dbg:poly-label" style={styles.labelText}>
      {text}
    </Text>
  );
  return (
    <View
      style={[styles.block, width]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Polyrhythm ${text}`}
      pointerEvents="none"
    >
      <Text
        accessibilityLabel="dbg:poly-label-ghost"
        style={[styles.labelText, styles.ghost]}
        importantForAccessibility="no"
        onLayout={handleLabelLayout}
      >
        {text}
      </Text>
      {place === 'above' ? (
        <View style={styles.aboveLabel}>{labelText}</View>
      ) : null}
      <View style={styles.row}>
        {place === 'above' ? null : (
          <View style={[styles.besideLabel, besidePlace]}>{labelText}</View>
        )}
        {spans.flatMap((span, index) =>
          BRACKET_FOR_CURRENT.map((current) => (
            <CycleBracket
              key={`${String(index)}-${String(current)}`}
              span={span}
              current={current}
              offset={offset}
              cycle={cycle}
            />
          )),
        )}
        {pulses.map((pulse, index) => (
          <PolyDot
            key={index}
            pulse={pulse}
            size={size}
            offset={offset}
            cycle={cycle}
            currentPolyBeat={frame.currentPolyBeat}
          />
        ))}
      </View>
    </View>
  );
}
