import {
  createThemedStyles,
  metronome,
  radius,
  space,
  textRoles,
  textStyle,
  useTheme,
} from '@kitbag/core-design';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import {
  polyDotCentres,
  polyLabelReach,
  polyRatioLabel,
} from '../logic/polyRow.ts';
import { DOT_METRICS, dotPalette } from './beatDotStyles.ts';

const LABEL_REACH = metronome.polyLabelWidth + metronome.polyLabelGap;
const HALF_POLY_DOT = metronome.polyDot / 2;

const usePolyStyles = createThemedStyles((theme) => ({
  row: {
    alignSelf: 'center',
    height: metronome.polyDot,
  },
  label: {
    position: 'absolute',
    top: 0,
    width: metronome.polyLabelWidth,
    height: metronome.polyDot,
    justifyContent: 'center',
  },
  labelText: {
    ...textStyle(textRoles.polyRatio),
    color: theme.color.text2,
    textAlign: 'right',
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
  const ratio = polyRatioLabel(polyBeats, beatsPerBar);
  const centres = polyDotCentres(
    polyBeats,
    lineWidth,
    dotSize,
    DOT_METRICS.dotGap,
  );
  const width = useMemo(() => ({ width: lineWidth }), [lineWidth]);
  const labelPlace = useMemo(() => {
    const sideRoom = (areaWidth - lineWidth) / 2;
    return { left: -polyLabelReach(LABEL_REACH, sideRoom, space.screenInset) };
  }, [areaWidth, lineWidth]);
  return (
    <View
      style={[styles.row, width]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Polyrhythm ${ratio}`}
      pointerEvents="none"
    >
      <View style={[styles.label, labelPlace]}>
        <Text style={styles.labelText} numberOfLines={1}>
          {ratio}
        </Text>
      </View>
      {centres.map((centre, index) => (
        <PolyDot
          key={index}
          index={index}
          left={centre - HALF_POLY_DOT}
          currentPolyBeat={currentPolyBeat}
        />
      ))}
    </View>
  );
}
