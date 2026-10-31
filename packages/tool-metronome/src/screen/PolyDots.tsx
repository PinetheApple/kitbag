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

interface PlacedPulse {
  readonly left: number;
  readonly slot: number;
  readonly cycle: number;
}

type PulseColumn = readonly (PlacedPulse | null)[];

interface PlacedSpan {
  readonly left: number;
  readonly width: number;
  readonly cycle: number;
}

type SpanColumn = readonly (PlacedSpan | null)[];

function columnsOf<Item, Placed>(
  rows: readonly (readonly Item[])[],
  place: (item: Item) => Placed,
): readonly (readonly (Placed | null)[])[] {
  const count = Math.max(...rows.map((row) => row.length));
  return Array.from({ length: count }, (_u, index) =>
    rows.map((row) => {
      const item = row[index];
      return item === undefined ? null : place(item);
    }),
  );
}

function pulseColumns(
  ratio: PolyRatio,
  row: PolyRowGeometry,
  size: number,
): readonly PulseColumn[] {
  return columnsOf(
    polyBarTable(ratio).map((bar) => bar.pulses),
    (pulse) => ({
      left: polyX(pulse.beat, ratio.beatsPerBar, row) - size / 2,
      slot: pulse.slot,
      cycle: pulse.cycle,
    }),
  );
}

function spanColumns(
  ratio: PolyRatio,
  row: PolyRowGeometry,
  areaWidth: number,
): readonly SpanColumn[] {
  return columnsOf(
    polyBarTable(ratio).map((bar) => bar.spans),
    (span) => ({
      ...polySpanInArea(span, ratio.beatsPerBar, row, areaWidth),
      cycle: span.cycle,
    }),
  );
}

interface PolyDotProps {
  readonly column: PulseColumn;
  readonly size: number;
  readonly offset: SharedValue<number>;
  readonly cycle: SharedValue<number>;
  readonly currentPolyBeat: SharedValue<number>;
}

function PolyDot({
  column,
  size,
  offset,
  cycle,
  currentPolyBeat,
}: PolyDotProps) {
  const styles = usePolyStyles();
  const { color } = useTheme();
  const palette = useMemo(() => dotPalette(color), [color]);
  const box = useMemo(
    () => ({ top: (metronome.polyDot - size) / 2, width: size, height: size }),
    [size],
  );
  const look = useAnimatedStyle(() => {
    const pulse = column[offset.value] ?? null;
    if (pulse === null) return { opacity: 0 };
    const sounding =
      pulse.slot === currentPolyBeat.value && pulse.cycle === cycle.value;
    const ring = pulse.slot === 0;
    const rest = ring ? TRANSPARENT : palette.fill;
    return {
      opacity: 1,
      left: pulse.left,
      backgroundColor: sounding ? color.text2 : rest,
      borderColor: sounding || ring ? color.text2 : palette.border,
      borderWidth: ring ? metronome.dotRing : metronome.dotBorder,
    };
  });
  return <Animated.View style={[styles.dot, box, look]} />;
}

interface CycleBracketProps {
  readonly column: SpanColumn;
  readonly offset: SharedValue<number>;
  readonly cycle: SharedValue<number>;
}

function CycleBracket({ column, offset, cycle }: CycleBracketProps) {
  const styles = usePolyStyles();
  const { color } = useTheme();
  const look = useAnimatedStyle(() => {
    const span = column[offset.value] ?? null;
    if (span === null) return { opacity: 0 };
    const now = span.cycle === cycle.value;
    const border = now
      ? metronome.polyBracketNowBorder
      : metronome.polyBracketBorder;
    return {
      opacity: 1,
      left: span.left,
      width: span.width,
      borderColor: now ? color.text2 : color.text3,
      borderLeftWidth: border,
      borderRightWidth: border,
      borderBottomWidth: border,
    };
  });
  return <Animated.View style={[styles.bracket, look]} />;
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
  const columns = useMemo(
    () => pulseColumns(ratio, row, size),
    [ratio, row, size],
  );
  const spans = useMemo(
    () => spanColumns(ratio, row, areaWidth),
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
    labelGap: metronome.polyLabelGap,
    sideRoom: (areaWidth - lineWidth) / 2,
    screenInset: space.screenInset,
    afterLastDot: lineWidth - lastDotRight,
  });
  const width = useMemo(() => ({ width: lineWidth }), [lineWidth]);
  const besidePlace = useMemo(
    () => ({
      left:
        place === 'right'
          ? lastDotRight + metronome.polyLabelGap
          : -(labelWidth + metronome.polyLabelGap),
      width: labelWidth,
    }),
    [place, lastDotRight, labelWidth],
  );
  const handleLabelLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLabel({ width, height });
  }, []);
  const labelText = <Text style={styles.labelText}>{text}</Text>;
  return (
    <View
      style={[styles.block, width]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Polyrhythm ${text}`}
      pointerEvents="none"
    >
      <Text
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
        {spans.map((column, index) => (
          <CycleBracket
            key={index}
            column={column}
            offset={offset}
            cycle={cycle}
          />
        ))}
        {columns.map((column, index) => (
          <PolyDot
            key={index}
            column={column}
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
