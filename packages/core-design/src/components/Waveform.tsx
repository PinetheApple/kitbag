import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { clampUnit } from '../clampUnit.ts';
import { asPercent } from '../percent.ts';
import { radius, space, waveMinBarFraction } from '../roles.ts';
import { useTheme } from '../ThemeProvider.tsx';
import { waveBarHeights, waveBarsPath } from '../waveform.ts';

export interface WaveformProps {
  readonly envelope: readonly number[] | null;
  readonly bars: number;
  readonly height: number;
  readonly progress?: SharedValue<number>;
  readonly extent?: number;
}

const styles = StyleSheet.create({
  lane: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  layer: { position: 'absolute', left: 0, top: 0 },
  played: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
  },
});

interface BarsProps {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly color: string;
}

function Bars({ path, width, height, color }: BarsProps) {
  return (
    <Svg style={styles.layer} width={width} height={height}>
      <Path d={path} fill={color} />
    </Svg>
  );
}

// Clip and content counter-slide as transforms; an animated width would relayout
// every frame. Percent shifts keep the unmeasured first mount from drawing all played.
export function Waveform({
  envelope,
  bars,
  height,
  progress,
  extent = 1,
}: WaveformProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const barsWidth = width * clampUnit(extent);
  const path = useMemo(
    () =>
      waveBarsPath(waveBarHeights(envelope, bars, waveMinBarFraction), {
        width: barsWidth,
        height,
        gap: space.waveBarGap,
        radius: radius.waveBar,
      }),
    [envelope, bars, barsWidth, height],
  );
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);
  const clipStyle = useAnimatedStyle(() => {
    const hidden = 1 - clampUnit(progress?.value ?? 0);
    return { transform: [{ translateX: asPercent(-hidden) }] };
  });
  const contentStyle = useAnimatedStyle(() => {
    const hidden = 1 - clampUnit(progress?.value ?? 0);
    return { transform: [{ translateX: asPercent(hidden) }] };
  });
  return (
    <View
      style={[styles.lane, { height }]}
      onLayout={onLayout}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Bars
        path={path}
        width={barsWidth}
        height={height}
        color={theme.color.wave}
      />
      {progress === undefined ? null : (
        <Animated.View style={[styles.played, clipStyle]}>
          <Animated.View style={[styles.fill, contentStyle]}>
            <Bars
              path={path}
              width={barsWidth}
              height={height}
              color={theme.color.waveHot}
            />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}
