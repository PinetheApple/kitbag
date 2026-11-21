import { useCallback, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import {
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { clampUnit } from '../clampUnit.ts';
import {
  dragTarget,
  pastWarning,
  releaseTarget,
  snapToDetent,
  type SliderDetent,
  type SliderLook,
  type SliderMode,
} from '../sliderMath.ts';
import { asPercent } from '../percent.ts';
import { sliderGeometry } from '../stemPlayerRoles.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { FillBar, ThumbDot } from './ProgressSvg.tsx';

const NOT_DRAGGING = -1;
const A11Y_ACTIONS = [
  { name: 'increment', label: 'More' },
  { name: 'decrement', label: 'Less' },
];

export interface SliderProps {
  /** Shown unless the thumb is held; set to the release point on release. */
  readonly value: SharedValue<number>;
  readonly onSlide?: (fraction: number) => void;
  readonly onRelease: (fraction: number) => void;
  readonly onCancel?: () => void;
  readonly accessibilityLabel: string;
  readonly accessibilityValue: string;
  readonly step: number;
  readonly mode: SliderMode;
  readonly tick?: number;
  readonly detent?: SliderDetent;
  readonly warnAbove?: number;
  readonly look?: SliderLook;
  readonly behindFill?: ReactNode;
  readonly overFill?: ReactNode;
}

const useStyles = createThemedStyles((theme) => ({
  hitArea: {
    width: '100%',
    minWidth: sliderGeometry.minWidth,
    height: minTouchTargetDp,
    justifyContent: 'center',
  },
  track: { backgroundColor: theme.color.surface3 },
  fill: { ...StyleSheet.absoluteFill },
  tick: {
    position: 'absolute',
    top: -sliderGeometry.tickOverhang,
    bottom: -sliderGeometry.tickOverhang,
    width: sliderGeometry.tick,
    marginLeft: -sliderGeometry.tick / 2,
    backgroundColor: theme.color.decor,
    opacity: sliderGeometry.tickOpacity,
  },
  levelTick: {
    width: sliderGeometry.levelTick,
    marginLeft: -sliderGeometry.levelTick / 2,
    opacity: 1,
  },
}));

function geometryStyles(look: SliderMode | SliderLook) {
  const { track, thumb } = sliderGeometry[look];
  return {
    track: { height: track, borderRadius: track / 2 },
    thumb: {
      position: 'absolute',
      left: -thumb / 2,
      right: -thumb / 2,
      top: (track - thumb) / 2,
      height: thumb,
    },
    diameter: thumb,
  } as const;
}

const GEOMETRY = {
  seek: geometryStyles('seek'),
  fader: geometryStyles('fader'),
  level: geometryStyles('level'),
} as const;

function useSliderGesture(props: SliderProps, width: SharedValue<number>) {
  const drag = useSharedValue(NOT_DRAGGING);
  const origin = useSharedValue(0);
  const { value, onSlide, onRelease, onCancel, mode, detent } = props;
  const commit = (target: number | null) => {
    'worklet';
    if (target === null) return;
    value.value = target;
    scheduleOnRN(onRelease, target);
  };
  const pan = usePanGesture({
    activeOffsetX: [-sliderGeometry.dragSlop, sliderGeometry.dragSlop],
    failOffsetY: [-sliderGeometry.dragSlop, sliderGeometry.dragSlop],
    onActivate: () => {
      origin.value = value.value;
    },
    onUpdate: (event) => {
      drag.value = snapToDetent(
        dragTarget(mode, origin.value, {
          x: event.x,
          translationX: event.translationX,
          width: width.value,
        }),
        detent,
      );
      if (onSlide !== undefined) scheduleOnRN(onSlide, drag.value);
    },
    onDeactivate: (event) => {
      const success = !event.canceled;
      if (!success && onCancel !== undefined) scheduleOnRN(onCancel);
      commit(releaseTarget(mode, 'pan', success, drag.value, origin.value));
    },
    onFinalize: () => {
      drag.value = NOT_DRAGGING;
    },
  });
  const tap = useTapGesture({
    onDeactivate: (event) => {
      const target = snapToDetent(
        dragTarget(mode, value.value, {
          x: event.x,
          translationX: 0,
          width: width.value,
        }),
        detent,
      );
      commit(releaseTarget(mode, 'tap', !event.canceled, target, value.value));
    },
  });
  return { gesture: useCompetingGestures(pan, tap), drag };
}

export function Slider(props: SliderProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { value, onRelease, step, warnAbove } = props;
  const geometry = GEOMETRY[props.look ?? props.mode];
  const width = useSharedValue(0);
  const { gesture, drag } = useSliderGesture(props, width);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      width.value = event.nativeEvent.layout.width;
    },
    [width],
  );
  const onAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
      onRelease(clampUnit(value.value + delta));
    },
    [onRelease, step, value],
  );
  const shown = useDerivedValue(() =>
    drag.value === NOT_DRAGGING ? value.value : drag.value,
  );
  const warned = useDerivedValue(() => pastWarning(shown.value, warnAbove));
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={props.accessibilityLabel}
        accessibilityValue={{ text: props.accessibilityValue }}
        accessibilityActions={A11Y_ACTIONS}
        onAccessibilityAction={onAction}
        style={styles.hitArea}
      >
        <View style={[styles.track, geometry.track]} onLayout={onLayout}>
          {props.behindFill}
          <FillBar
            progress={shown}
            color={theme.color.accent}
            warning={
              warnAbove === undefined
                ? undefined
                : { color: theme.color.red, active: warned }
            }
            radius={geometry.track.borderRadius}
            style={[styles.fill, geometry.track]}
          />
          {props.overFill}
          {props.tick === undefined ? null : (
            <View
              style={[
                styles.tick,
                props.look === 'level' && styles.levelTick,
                { left: asPercent(props.tick) },
              ]}
            />
          )}
          <ThumbDot
            progress={shown}
            color={theme.color.text}
            diameter={geometry.diameter}
            style={geometry.thumb}
          />
        </View>
      </View>
    </GestureDetector>
  );
}
