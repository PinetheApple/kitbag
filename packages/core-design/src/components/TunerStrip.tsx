import { useCallback, useMemo } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { opacity, radius, size } from '../roles.ts';
import { HALF, TRANSPARENT } from '../styleConstants.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import type { ColorToken } from '../tokens.ts';
import {
  stripGradient,
  stripPosition,
  TUNER_STRIP_STOPS,
  type GradientStop,
} from '../tunerVisuals.ts';

const NEEDLE_REACH_ABOVE = size.tunerNeedleOverhang + size.tunerNeedleCap;

const useStyles = createThemedStyles((theme) => ({
  frame: {
    paddingTop: NEEDLE_REACH_ABOVE,
    paddingBottom: size.tunerNeedleOverhang,
  },
  strip: {
    height: size.tunerStrip,
    borderRadius: radius.tunerStrip,
    opacity: opacity.tunerStrip,
  },
  centre: {
    position: 'absolute',
    left: '50%',
    top: -size.tunerCentreOverhang,
    bottom: -size.tunerCentreOverhang,
    width: size.tunerCentreLine,
    marginLeft: -size.tunerCentreLine * HALF,
    backgroundColor: theme.color.text,
  },
  needle: {
    position: 'absolute',
    left: 0,
    top: -size.tunerNeedleOverhang,
    bottom: -size.tunerNeedleOverhang,
    width: size.tunerNeedle,
    borderRadius: radius.tunerNeedle,
  },
  cap: {
    position: 'absolute',
    top: -size.tunerNeedleCap,
    left: size.tunerNeedle * HALF - size.tunerNeedleCap,
    borderLeftWidth: size.tunerNeedleCap,
    borderRightWidth: size.tunerNeedleCap,
    borderTopWidth: size.tunerNeedleCap,
    borderLeftColor: TRANSPARENT,
    borderRightColor: TRANSPARENT,
  },
}));

export interface TunerStripProps {
  readonly needle: SharedValue<number>;
  readonly active: SharedValue<number>;
  readonly stops?: readonly GradientStop[];
  readonly needleColor?: ColorToken;
}

// Decorative to screen readers: the screen's status text carries the reading.
export function TunerStrip({
  needle,
  active,
  stops = TUNER_STRIP_STOPS,
  needleColor = 'text',
}: TunerStripProps) {
  const styles = useStyles();
  const theme = useTheme();
  const stripWidth = useSharedValue(0);
  const fill = useMemo(
    () => ({ experimental_backgroundImage: stripGradient(theme.color, stops) }),
    [theme.color, stops],
  );
  const ink = theme.color[needleColor];
  const needleInk = useMemo(() => ({ backgroundColor: ink }), [ink]);
  const capInk = useMemo(() => ({ borderTopColor: ink }), [ink]);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      stripWidth.value = event.nativeEvent.layout.width;
    },
    [stripWidth],
  );

  const needleStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, active.value)),
    transform: [
      {
        translateX:
          stripPosition(needle.value) * stripWidth.value -
          size.tunerNeedle * HALF,
      },
    ],
  }));

  return (
    <View
      style={styles.frame}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={[styles.strip, fill]} onLayout={onLayout}>
        <View style={styles.centre} />
        <Animated.View style={[styles.needle, needleInk, needleStyle]}>
          <View style={[styles.cap, capInk]} />
        </Animated.View>
      </View>
    </View>
  );
}
