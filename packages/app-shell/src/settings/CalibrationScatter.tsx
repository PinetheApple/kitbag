import {
  asPercent,
  calibration,
  calibrationText,
  createThemedStyles,
  radius,
  size,
  textStyle,
} from '@kitbag/core-design';
import { formatOffsetMs } from '@kitbag/core-state';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import type { ScatterDot } from './calibrationView.ts';

const CENTRE = 0.5;
const ZERO_LABEL = '0';

const useStyles = createThemedStyles((theme) => ({
  scatter: {
    height: calibration.scatterHeight,
    borderRadius: radius.pick,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    overflow: 'hidden',
  },
  zero: {
    position: 'absolute',
    left: asPercent(CENTRE),
    top: 0,
    bottom: 0,
    width: size.stroke,
    backgroundColor: theme.color.text3,
  },
  mean: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: calibration.meanLine,
    backgroundColor: theme.color.accent,
  },
  dot: {
    position: 'absolute',
    width: calibration.dot,
    height: calibration.dot,
    marginLeft: -calibration.dot / 2,
    marginTop: -calibration.dot / 2,
    borderRadius: radius.circle,
    backgroundColor: theme.color.text2,
  },
  axis: {
    ...textStyle(calibrationText.scatterAxis),
    position: 'absolute',
    bottom: calibration.axisBottom,
    color: theme.color.text3,
  },
  axisStart: { left: calibration.axisSide },
  axisEnd: { right: calibration.axisSide },
  axisCentre: { left: 0, right: 0, textAlign: 'center' },
}));

function Dot({ dot }: { readonly dot: ScatterDot }) {
  const styles = useStyles();
  const place = useMemo(
    () => ({ left: asPercent(dot.x), top: asPercent(dot.y) }),
    [dot.x, dot.y],
  );
  return <View style={[styles.dot, place]} />;
}

export interface CalibrationScatterProps {
  readonly dots: readonly ScatterDot[];
  readonly meanX: number | null;
  readonly axisMs: number;
}

export function CalibrationScatter({
  dots,
  meanX,
  axisMs,
}: CalibrationScatterProps) {
  const styles = useStyles();
  const axis = Math.round(axisMs);
  const meanPlace = useMemo(
    () => (meanX === null ? null : { left: asPercent(meanX) }),
    [meanX],
  );
  return (
    <View
      style={styles.scatter}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.zero} />
      {meanPlace === null ? null : <View style={[styles.mean, meanPlace]} />}
      {dots.map((dot, index) => (
        <Dot key={index} dot={dot} />
      ))}
      <Text style={[styles.axis, styles.axisStart]}>
        {formatOffsetMs(-axis)}
      </Text>
      <Text style={[styles.axis, styles.axisCentre]}>{ZERO_LABEL}</Text>
      <Text style={[styles.axis, styles.axisEnd]}>{formatOffsetMs(axis)}</Text>
    </View>
  );
}
