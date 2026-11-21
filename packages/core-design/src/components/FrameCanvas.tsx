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
  CANVAS_HIDING,
  useMeasuredSize,
  type FillBarProps,
  type ThumbDotProps,
  type WaveLayersProps,
} from './frameCanvasShared.ts';

export type { FillBarProps } from './frameCanvasShared.ts';

export function FillBar({
  shown,
  color,
  style,
  radius = 0,
  testID,
}: FillBarProps) {
  const { size, onLayout } = useMeasuredSize();
  const transform = useDerivedValue(() => [{ scaleX: clampUnit(shown.value) }]);
  const width = useDerivedValue(() => size.value.width);
  const height = useDerivedValue(() => size.value.height);
  return (
    <View
      testID={testID}
      style={style}
      pointerEvents="none"
      onLayout={onLayout}
      {...CANVAS_HIDING}
    >
      <Canvas style={StyleSheet.absoluteFill} {...CANVAS_HIDING}>
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

export function ThumbDot({ shown, color, diameter, style }: ThumbDotProps) {
  const { size, onLayout } = useMeasuredSize();
  const radius = diameter / 2;
  const cx = useDerivedValue(
    () => radius + clampUnit(shown.value) * (size.value.width - diameter),
  );
  return (
    <View
      style={style}
      pointerEvents="none"
      onLayout={onLayout}
      {...CANVAS_HIDING}
    >
      <Canvas style={StyleSheet.absoluteFill} {...CANVAS_HIDING}>
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
      {...CANVAS_HIDING}
    >
      {bars(color)}
      {progress === undefined ? null : (
        <Group clip={clip}>{bars(playedColor)}</Group>
      )}
    </Canvas>
  );
}
