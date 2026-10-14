import { useCallback } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { opacity, radius, size } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { stripPosition, tunerStripGradient } from '../tunerVisuals.ts';

const TRANSPARENT = 'transparent';
const HALF = 0.5;
const NEEDLE_REACH_ABOVE = size.tunerNeedleOverhang + size.tunerNeedleCap;

const useStyles = createThemedStyles((theme) => ({
  frame: {
    paddingTop: NEEDLE_REACH_ABOVE,
    paddingBottom: size.tunerNeedleOverhang,
  },
  strip: {
    height: size.tunerStrip,
    borderRadius: radius.tunerStrip,
    experimental_backgroundImage: tunerStripGradient(theme.color),
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
    backgroundColor: theme.color.text,
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
    borderTopColor: theme.color.text,
  },
}));

export interface TunerStripProps {
  readonly needle: SharedValue<number>;
  readonly active: SharedValue<number>;
}

// Decorative to screen readers: the screen's status text carries the reading.
export function TunerStrip({ needle, active }: TunerStripProps) {
  const styles = useStyles();
  const stripWidth = useSharedValue(0);

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
      <View style={styles.strip} onLayout={onLayout}>
        <View style={styles.centre} />
        <Animated.View style={[styles.needle, needleStyle]}>
          <View style={styles.cap} />
        </Animated.View>
      </View>
    </View>
  );
}
