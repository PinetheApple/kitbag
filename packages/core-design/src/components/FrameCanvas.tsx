import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { clampUnit } from '../clampUnit.ts';
import {
  READER_HIDDEN,
  thumbTravel,
  useMeasuredSize,
  type FillBarProps,
  type ThumbDotProps,
  type WaveLayersProps,
} from './frameCanvasShared.ts';

export type { FillBarProps } from './frameCanvasShared.ts';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const FULL = '100%';

export function FillBar({
  progress,
  color,
  style,
  radius = 0,
  testID,
}: FillBarProps) {
  const { size, onLayout } = useMeasuredSize();
  const fillProps = useAnimatedProps(() => {
    const share = clampUnit(progress.value);
    return {
      width: share * size.value.width,
      rx: share * radius,
      fill: typeof color === 'string' ? color : color.value,
    };
  });
  return (
    <View
      testID={testID}
      style={style}
      pointerEvents="none"
      onLayout={onLayout}
      {...READER_HIDDEN}
    >
      <Svg style={StyleSheet.absoluteFill}>
        <AnimatedRect height={FULL} ry={radius} animatedProps={fillProps} />
      </Svg>
    </View>
  );
}

export function ThumbDot({ progress, color, diameter, style }: ThumbDotProps) {
  const { size, onLayout } = useMeasuredSize();
  const radius = diameter / 2;
  const thumbProps = useAnimatedProps(() => ({
    cx:
      radius +
      clampUnit(progress.value) * thumbTravel(size.value.width, diameter),
  }));
  return (
    <View
      style={style}
      pointerEvents="none"
      onLayout={onLayout}
      {...READER_HIDDEN}
    >
      <Svg style={StyleSheet.absoluteFill}>
        <AnimatedCircle
          cy={radius}
          r={radius}
          fill={color}
          animatedProps={thumbProps}
        />
      </Svg>
    </View>
  );
}

export function WaveLayers({
  path,
  width,
  height,
  color,
  playedColor,
  progress,
}: WaveLayersProps) {
  const clipId = `played${useId().replace(/\W/g, '')}`;
  const clipProps = useAnimatedProps(() => ({
    width: clampUnit(progress?.value ?? 0) * width,
  }));
  const bars = (fill: string) =>
    path === '' ? null : <Path d={path} fill={fill} />;
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      {...READER_HIDDEN}
    >
      {bars(color)}
      {progress === undefined ? null : (
        <>
          <Defs>
            <ClipPath id={clipId}>
              <AnimatedRect height={height} animatedProps={clipProps} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>{bars(playedColor)}</G>
        </>
      )}
    </Svg>
  );
}
