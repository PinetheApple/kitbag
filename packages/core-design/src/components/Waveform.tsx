import { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { clampUnit } from '../clampUnit.ts';
import { radius, space, waveMinBarFraction } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { waveBarHeights, type BarHeight } from '../waveform.ts';

export interface WaveformProps {
  readonly envelope: readonly number[] | null;
  readonly bars: number;
  readonly height: number;
  readonly progress?: SharedValue<number>;
  readonly extent?: number;
}

const useStyles = createThemedStyles((theme) => ({
  lane: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  row: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.waveBarGap,
  },
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
  bar: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.waveBar,
    backgroundColor: theme.color.wave,
  },
  hot: {
    backgroundColor: theme.color.waveHot,
  },
}));

interface BarsProps {
  readonly heights: readonly BarHeight[];
  readonly width: number;
  readonly hot: boolean;
}

function Bars({ heights, width, hot }: BarsProps) {
  const styles = useStyles();
  return (
    <View style={[styles.row, { width }]}>
      {heights.map((height, i) => (
        <View key={i} style={[styles.bar, hot && styles.hot, { height }]} />
      ))}
    </View>
  );
}

// Clip and content counter-slide as transforms; an animated width would
// relayout the tree on every frame.
export function Waveform({
  envelope,
  bars,
  height,
  progress,
  extent = 1,
}: WaveformProps) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const heights = waveBarHeights(envelope, bars, waveMinBarFraction);
  const barsWidth = width * clampUnit(extent);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);
  const clipStyle = useAnimatedStyle(() => {
    const hidden = (1 - clampUnit(progress?.value ?? 0)) * width;
    return { transform: [{ translateX: -hidden }] };
  });
  const contentStyle = useAnimatedStyle(() => {
    const hidden = (1 - clampUnit(progress?.value ?? 0)) * width;
    return { transform: [{ translateX: hidden }] };
  });
  return (
    <View
      style={[styles.lane, { height }]}
      onLayout={onLayout}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Bars heights={heights} width={barsWidth} hot={false} />
      {progress === undefined ? null : (
        <Animated.View style={[styles.played, clipStyle]}>
          <Animated.View style={[styles.fill, contentStyle]}>
            <Bars heights={heights} width={barsWidth} hot />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}
