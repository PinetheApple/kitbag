import { useCallback } from 'react';
import {
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
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
import { radius } from '../roles.ts';
import { sliderGeometry } from '../stemPlayerRoles.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';

const NOT_DRAGGING = -1;
const DRAG_SLOP = 6;
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
  /** Draws the thinner settings thumb and tick; the gesture is still `mode`'s. */
  readonly look?: SliderLook;
}

const useStyles = createThemedStyles((theme) => ({
  hitArea: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: sliderGeometry.minWidth,
    height: minTouchTargetDp,
    justifyContent: 'center',
  },
  track: { backgroundColor: theme.color.surface3 },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    transformOrigin: 'left',
    backgroundColor: theme.color.accent,
  },
  thumb: {
    position: 'absolute',
    borderRadius: radius.circle,
    backgroundColor: theme.color.text,
  },
  tick: {
    position: 'absolute',
    top: -sliderGeometry.tickOverhang,
    bottom: -sliderGeometry.tickOverhang,
    width: sliderGeometry.tick,
    marginLeft: -sliderGeometry.tick / 2,
    backgroundColor: theme.color.text3,
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
      width: thumb,
      height: thumb,
      left: -thumb / 2,
      top: (track - thumb) / 2,
    },
  };
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
  const pan = Gesture.Pan()
    .activeOffsetX([-DRAG_SLOP, DRAG_SLOP])
    .failOffsetY([-DRAG_SLOP, DRAG_SLOP])
    .onStart(() => {
      origin.value = value.value;
    })
    .onUpdate((event) => {
      drag.value = snapToDetent(
        dragTarget(mode, origin.value, {
          x: event.x,
          translationX: event.translationX,
          width: width.value,
        }),
        detent,
      );
      if (onSlide !== undefined) scheduleOnRN(onSlide, drag.value);
    })
    .onEnd((_, success) => {
      if (!success && onCancel !== undefined) scheduleOnRN(onCancel);
      commit(releaseTarget(mode, 'pan', success, drag.value, origin.value));
    })
    .onFinalize(() => {
      drag.value = NOT_DRAGGING;
    });
  const tap = Gesture.Tap().onEnd((event, success) => {
    const target = snapToDetent(
      dragTarget(mode, value.value, {
        x: event.x,
        translationX: 0,
        width: width.value,
      }),
      detent,
    );
    commit(releaseTarget(mode, 'tap', success, target, value.value));
  });
  return { gesture: Gesture.Race(pan, tap), drag };
}

export function Slider(props: SliderProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { value, onRelease, step, warnAbove } = props;
  const fillColor = theme.color.accent;
  const warnColor = theme.color.red;
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
  const fillStyle = useAnimatedStyle(() => {
    const shown = drag.value === NOT_DRAGGING ? value.value : drag.value;
    return {
      transform: [{ scaleX: clampUnit(shown) }],
      backgroundColor: pastWarning(shown, warnAbove) ? warnColor : fillColor,
    };
  });
  const thumbStyle = useAnimatedStyle(() => {
    const shown = drag.value === NOT_DRAGGING ? value.value : drag.value;
    return { transform: [{ translateX: clampUnit(shown) * width.value }] };
  });
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
          <Animated.View style={[styles.fill, geometry.track, fillStyle]} />
          {props.tick === undefined ? null : (
            <View
              style={[
                styles.tick,
                props.look === 'level' && styles.levelTick,
                { left: asPercent(props.tick) },
              ]}
            />
          )}
          <Animated.View style={[styles.thumb, geometry.thumb, thumbStyle]} />
        </View>
      </View>
    </GestureDetector>
  );
}
