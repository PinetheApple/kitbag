import {
  createThemedStyles,
  metronome,
  radius,
  space,
  textRoles,
  textStyle,
  useTheme,
} from '@kitbag/core-design';
import { useCallback, useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { DOT_METRICS } from '../logic/belowTempo.ts';
import {
  polyDotCentres,
  polyLabelPlace,
  polyRatioLabel,
} from '../logic/polyRow.ts';
import { dotPalette } from './beatDotStyles.ts';

const HALF_POLY_DOT = metronome.polyDot / 2;

const usePolyStyles = createThemedStyles((theme) => ({
  block: {
    alignSelf: 'center',
    gap: metronome.beatMarkerGap,
  },
  row: {
    height: metronome.polyDot,
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
    top: 0,
    width: metronome.polyDot,
    height: metronome.polyDot,
    borderRadius: radius.circle,
    borderWidth: metronome.dotBorder,
  },
}));

interface PolyDotProps {
  readonly index: number;
  readonly left: number;
  readonly currentPolyBeat: SharedValue<number>;
}

function PolyDot({ index, left, currentPolyBeat }: PolyDotProps) {
  const styles = usePolyStyles();
  const { color } = useTheme();
  const palette = useMemo(() => dotPalette(color), [color]);
  const place = useMemo(() => ({ left }), [left]);
  const look = useAnimatedStyle(() => {
    const sounding = currentPolyBeat.value === index;
    return {
      backgroundColor: sounding ? color.text2 : palette.fill,
      borderColor: sounding ? color.text2 : palette.border,
    };
  });
  return <Animated.View style={[styles.dot, place, look]} />;
}

interface PolyDotsProps {
  readonly polyBeats: number;
  readonly beatsPerBar: number;
  readonly lineWidth: number;
  readonly areaWidth: number;
  readonly dotSize: number;
  readonly currentPolyBeat: SharedValue<number>;
}

export function PolyDots({
  polyBeats,
  beatsPerBar,
  lineWidth,
  areaWidth,
  dotSize,
  currentPolyBeat,
}: PolyDotsProps) {
  const styles = usePolyStyles();
  const [label, setLabel] = useState({ width: 0, height: 0 });
  const labelWidth = label.width;
  const ratio = polyRatioLabel(polyBeats, beatsPerBar);
  const centres = polyDotCentres(
    polyBeats,
    lineWidth,
    dotSize,
    DOT_METRICS.dotGap,
  );
  const lastDotRight = (centres.at(-1) ?? 0) + HALF_POLY_DOT;
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
  const labelText = <Text style={styles.labelText}>{ratio}</Text>;
  return (
    <View
      style={[styles.block, width]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Polyrhythm ${ratio}`}
      pointerEvents="none"
    >
      <Text
        style={[styles.labelText, styles.ghost]}
        importantForAccessibility="no"
        onLayout={handleLabelLayout}
      >
        {ratio}
      </Text>
      {place === 'above' ? (
        <View style={styles.aboveLabel}>{labelText}</View>
      ) : null}
      <View style={styles.row}>
        {place === 'above' ? null : (
          <View style={[styles.besideLabel, besidePlace]}>{labelText}</View>
        )}
        {centres.map((centre, index) => (
          <PolyDot
            key={index}
            index={index}
            left={centre - HALF_POLY_DOT}
            currentPolyBeat={currentPolyBeat}
          />
        ))}
      </View>
    </View>
  );
}
