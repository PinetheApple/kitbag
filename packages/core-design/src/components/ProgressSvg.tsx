import { useCallback, useId } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  type DerivedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { clampUnit } from '../clampUnit.ts';
import { readerHiding } from '../readerHiding.ts';

export interface FillWarning {
  readonly color: string;
  readonly active: DerivedValue<boolean>;
}

export interface FillBarProps {
  readonly progress: DerivedValue<number>;
  readonly color: string;
  readonly warning?: FillWarning | undefined;
  readonly style: StyleProp<ViewStyle>;
  readonly radius?: number;
  readonly testID?: string;
}

export interface ThumbDotProps {
  readonly progress: DerivedValue<number>;
  readonly color: string;
  readonly diameter: number;
  readonly style: StyleProp<ViewStyle>;
}

export interface WaveLayersProps {
  readonly path: string;
  readonly width: number;
  readonly color: string;
  readonly playedColor: string;
  readonly progress: DerivedValue<number> | undefined;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

const READER_HIDDEN = { ...readerHiding(true), accessible: false };
const UNMEASURED = { width: 0, height: 0 };
const FULL = '100%';
const PLAYHEAD_EDGE = 0.01;

function thumbTravel(width: number, diameter: number): number {
  'worklet';
  return Math.max(0, width - diameter);
}

function fillShape(progress: number, width: number, radius: number) {
  'worklet';
  const share = clampUnit(progress);
  return { width: share * width, rx: share * radius };
}

function svgSafeId(prefix: string, reactId: string): string {
  return `${prefix}${reactId.replace(/\W/g, '')}`;
}

function useMeasuredSize() {
  const size = useSharedValue(UNMEASURED);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      size.value = { width, height };
    },
    [size],
  );
  return { size, onLayout };
}

export function FillBar({
  progress,
  color,
  warning,
  style,
  radius = 0,
  testID,
}: FillBarProps) {
  const { size, onLayout } = useMeasuredSize();
  const fillProps = useAnimatedProps(() =>
    fillShape(progress.value, size.value.width, radius),
  );
  const warnProps = useAnimatedProps(() => ({
    ...fillShape(progress.value, size.value.width, radius),
    opacity: warning?.active.value === true ? 1 : 0,
  }));
  return (
    <View
      testID={testID}
      style={style}
      pointerEvents="none"
      onLayout={onLayout}
      {...READER_HIDDEN}
    >
      <Svg style={StyleSheet.absoluteFill}>
        <AnimatedRect
          height={FULL}
          ry={radius}
          fill={color}
          animatedProps={fillProps}
        />
        {warning === undefined ? null : (
          <AnimatedRect
            height={FULL}
            ry={radius}
            fill={warning.color}
            animatedProps={warnProps}
          />
        )}
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
  color,
  playedColor,
  progress,
}: WaveLayersProps) {
  const playedId = svgSafeId('played', useId());
  const edgeProps = useAnimatedProps(() => {
    const playhead = clampUnit(progress?.value ?? 0) * width;
    return { x1: playhead, x2: playhead + PLAYHEAD_EDGE };
  });
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      {...READER_HIDDEN}
    >
      {progress === undefined ? null : (
        <Defs>
          <AnimatedGradient
            id={playedId}
            gradientUnits="userSpaceOnUse"
            y1={0}
            y2={0}
            animatedProps={edgeProps}
          >
            <Stop offset={0} stopColor={playedColor} />
            <Stop offset={1} stopColor={color} />
          </AnimatedGradient>
        </Defs>
      )}
      {path === '' ? null : (
        <Path
          d={path}
          fill={progress === undefined ? color : `url(#${playedId})`}
        />
      )}
    </Svg>
  );
}
