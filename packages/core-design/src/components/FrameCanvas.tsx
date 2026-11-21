import {
  Canvas,
  Circle,
  Group,
  Path,
  RoundedRect,
} from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

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

export function FillBar({
  progress,
  color,
  style,
  radius = 0,
  testID,
}: FillBarProps) {
  const { size, onLayout } = useMeasuredSize();
  const transform = useDerivedValue(() => [
    { scaleX: clampUnit(progress.value) },
  ]);
  const width = useDerivedValue(() => size.value.width);
  const height = useDerivedValue(() => size.value.height);
  return (
    <View
      testID={testID}
      style={style}
      pointerEvents="none"
      onLayout={onLayout}
      {...READER_HIDDEN}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={transform}>
          <RoundedRect
            x={0}
            y={0}
            width={width}
            height={height}
            r={radius}
            color={color}
          />
        </Group>
      </Canvas>
    </View>
  );
}

export function ThumbDot({ progress, color, diameter, style }: ThumbDotProps) {
  const { size, onLayout } = useMeasuredSize();
  const radius = diameter / 2;
  const cx = useDerivedValue(
    () =>
      radius +
      clampUnit(progress.value) * thumbTravel(size.value.width, diameter),
  );
  return (
    <View
      style={style}
      pointerEvents="none"
      onLayout={onLayout}
      {...READER_HIDDEN}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={radius} r={radius} color={color} />
      </Canvas>
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
  const clip = useDerivedValue(() => ({
    x: 0,
    y: 0,
    width: clampUnit(progress?.value ?? 0) * width,
    height,
  }));
  const bars = (fill: string) =>
    path === '' ? null : <Path path={path} color={fill} />;
  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      {...READER_HIDDEN}
    >
      {bars(color)}
      {progress === undefined ? null : (
        <Group clip={clip}>{bars(playedColor)}</Group>
      )}
    </Canvas>
  );
}
