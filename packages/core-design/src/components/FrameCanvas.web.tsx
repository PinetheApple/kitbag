import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { clampUnit } from '../clampUnit.ts';
import { asPercent } from '../percent.ts';
import { radius as radii } from '../roles.ts';
import {
  CANVAS_HIDING,
  useMeasuredSize,
  type FillBarProps,
  type ThumbDotProps,
  type WaveLayersProps,
} from './frameCanvasShared.ts';

export type { FillBarProps } from './frameCanvasShared.ts';

const styles = StyleSheet.create({
  cover: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0 },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    transformOrigin: 'left',
  },
  thumb: { position: 'absolute', left: 0, top: 0, borderRadius: radii.circle },
  layer: { position: 'absolute', left: 0, top: 0 },
  played: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    overflow: 'hidden',
  },
});

export function FillBar({
  shown,
  color,
  style,
  radius = 0,
  testID,
}: FillBarProps) {
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: clampUnit(shown.value) }],
    backgroundColor: typeof color === 'string' ? color : color.value,
  }));
  return (
    <View testID={testID} style={style} pointerEvents="none" {...CANVAS_HIDING}>
      <Animated.View
        style={[styles.fill, { borderRadius: radius }, fillStyle]}
      />
    </View>
  );
}

export function ThumbDot({ shown, color, diameter, style }: ThumbDotProps) {
  const { size, onLayout } = useMeasuredSize();
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: clampUnit(shown.value) * (size.value.width - diameter),
      },
    ],
  }));
  return (
    <View
      style={style}
      pointerEvents="none"
      onLayout={onLayout}
      {...CANVAS_HIDING}
    >
      <Animated.View
        style={[
          styles.thumb,
          { width: diameter, height: diameter, backgroundColor: color },
          thumbStyle,
        ]}
      />
    </View>
  );
}

function Bars({
  path,
  width,
  height,
  color,
}: Pick<WaveLayersProps, 'path' | 'width' | 'height' | 'color'>) {
  return (
    <Svg style={styles.layer} width={width} height={height}>
      <Path d={path} fill={color} />
    </Svg>
  );
}

// Clip and content counter-slide as transforms; an animated width would relayout
// every frame. Percent shifts keep the unmeasured first mount from drawing all played.
export function WaveLayers({
  path,
  width,
  height,
  color,
  playedColor,
  progress,
}: WaveLayersProps) {
  const clipStyle = useAnimatedStyle(() => {
    const hidden = 1 - clampUnit(progress?.value ?? 0);
    return { transform: [{ translateX: asPercent(-hidden) }] };
  });
  const contentStyle = useAnimatedStyle(() => {
    const hidden = 1 - clampUnit(progress?.value ?? 0);
    return { transform: [{ translateX: asPercent(hidden) }] };
  });
  return (
    <>
      <Bars path={path} width={width} height={height} color={color} />
      {progress === undefined ? null : (
        <Animated.View style={[styles.played, clipStyle]}>
          <Animated.View style={[styles.cover, contentStyle]}>
            <Bars
              path={path}
              width={width}
              height={height}
              color={playedColor}
            />
          </Animated.View>
        </Animated.View>
      )}
    </>
  );
}
