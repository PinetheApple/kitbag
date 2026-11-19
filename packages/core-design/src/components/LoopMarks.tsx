import { useCallback, useLayoutEffect, useMemo } from 'react';
import { Text, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  loopHandleFrame,
  type BarBox,
  type LaneSize,
  type ScrubEdge,
} from '../loopHandleFrame.ts';
import { asPercent } from '../percent.ts';
import { textRoles } from '../roles.ts';
import {
  sliderGeometry,
  stemPlayer,
  stemPlayerMix,
} from '../stemPlayerRoles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { withAlpha } from '../theme.ts';
import { minTouchTargetDp } from '../tokens.ts';

const NOT_DRAGGING = -1;

export type { ScrubEdge } from '../loopHandleFrame.ts';
export type EdgeStep = 1 | -1;

export interface ScrubMarks {
  readonly start: number;
  readonly end: number | null;
}

export interface LoopHandles {
  readonly onMoveLoopEdge: (
    edge: ScrubEdge,
    fraction: number,
  ) => Promise<void> | void;
  readonly onStepLoopEdge: (edge: ScrubEdge, step: EdgeStep) => void;
  readonly spokenEdge: (edge: ScrubEdge) => string;
}

export interface LoopGeometry {
  readonly start: SharedValue<number>;
  readonly end: SharedValue<number>;
  readonly lane: SharedValue<LaneSize>;
  readonly bar: SharedValue<BarBox>;
}

const EDGE_LETTERS: Readonly<Record<ScrubEdge, string>> = {
  start: 'A',
  end: 'B',
};
const EDGE_LABELS: Readonly<Record<ScrubEdge, string>> = {
  start: 'Loop start',
  end: 'Loop end',
};
const EDGE_ACTIONS = [
  { name: 'increment', label: 'One beat later' },
  { name: 'decrement', label: 'One beat earlier' },
];

const useStyles = createThemedStyles((theme) => ({
  cover: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  region: {
    position: 'absolute',
    top: stemPlayer.loopTintInset,
    bottom: stemPlayer.loopTintInset,
    backgroundColor: withAlpha(theme.color.accent, stemPlayerMix.loopTint),
  },
  line: {
    position: 'absolute',
    top: stemPlayer.loopTintInset,
    bottom: stemPlayer.loopTintInset,
    width: stemPlayer.loopLine,
    marginLeft: -stemPlayer.loopLine / 2,
    backgroundColor: theme.color.accent,
  },
  flag: {
    width: stemPlayer.loopFlagWidth,
    minHeight: stemPlayer.loopFlagHeight,
    borderRadius: stemPlayer.loopFlagRadius,
    backgroundColor: theme.accentTextFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinned: {
    position: 'absolute',
    top: stemPlayer.loopTintInset + stemPlayer.loopFlagTop,
  },
  flagStart: { marginLeft: -stemPlayer.loopFlagWidth },
  flagEnd: { marginLeft: 0 },
  flagText: { ...textStyle(textRoles.loopFlag), color: theme.color.onAccent },
  handle: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: minTouchTargetDp,
    height: minTouchTargetDp,
  },
  handleFlag: { position: 'absolute', left: 0, top: 0 },
}));

function shownAt(drag: SharedValue<number>, at: number): number {
  'worklet';
  return drag.value === NOT_DRAGGING ? at : drag.value;
}

export function useLoopGeometry(): LoopGeometry {
  const start = useSharedValue(NOT_DRAGGING);
  const end = useSharedValue(NOT_DRAGGING);
  const lane = useSharedValue<LaneSize>({ width: 0, height: 0 });
  const bar = useSharedValue<BarBox>({ x: 0, y: 0, width: 0, height: 0 });
  return useMemo(() => ({ start, end, lane, bar }), [start, end, lane, bar]);
}

// A's flag hangs left of its line and B's right of its own, so a short loop
// never hides one flag under the other.
function LoopEdge({
  at,
  edge,
}: {
  readonly at: number;
  readonly edge: ScrubEdge;
}) {
  const styles = useStyles();
  const left = asPercent(at);
  return (
    <>
      <View style={[styles.line, { left }]} />
      <View
        style={[
          styles.flag,
          styles.pinned,
          edge === 'start' ? styles.flagStart : styles.flagEnd,
          { left },
        ]}
      >
        <Text style={styles.flagText}>{EDGE_LETTERS[edge]}</Text>
      </View>
    </>
  );
}

interface FollowingLineProps {
  readonly at: number;
  readonly drag: SharedValue<number>;
  readonly bar: SharedValue<BarBox>;
}

function FollowingLine({ at, drag, bar }: FollowingLineProps) {
  const styles = useStyles();
  const follow = useAnimatedStyle(() => ({
    transform: [{ translateX: (shownAt(drag, at) - at) * bar.value.width }],
  }));
  return (
    <Animated.View style={[styles.line, { left: asPercent(at) }, follow]} />
  );
}

interface LiveTintProps {
  readonly start: number;
  readonly end: number;
  readonly geometry: LoopGeometry;
}

function LiveTint({ start, end, geometry }: LiveTintProps) {
  const styles = useStyles();
  const tint = useAnimatedStyle(() => {
    const from = shownAt(geometry.start, start);
    return {
      left: asPercent(from),
      width: asPercent(shownAt(geometry.end, end) - from),
    };
  });
  return (
    <>
      <Animated.View style={[styles.region, tint]} />
      <FollowingLine at={start} drag={geometry.start} bar={geometry.bar} />
      <FollowingLine at={end} drag={geometry.end} bar={geometry.bar} />
    </>
  );
}

interface LoopMarksProps {
  readonly marks: ScrubMarks | null;
  readonly geometry: LoopGeometry;
  readonly draggable: boolean;
}

export function LoopMarks({ marks, geometry, draggable }: LoopMarksProps) {
  const styles = useStyles();
  if (marks === null) return null;
  const { start, end } = marks;
  if (draggable && end !== null)
    return (
      <View pointerEvents="none" style={styles.cover}>
        <LiveTint start={start} end={end} geometry={geometry} />
      </View>
    );
  return (
    <View pointerEvents="none" style={styles.cover}>
      {end === null ? null : (
        <View
          style={[
            styles.region,
            { left: asPercent(start), width: asPercent(end - start) },
          ]}
        />
      )}
      <LoopEdge at={start} edge="start" />
      {end === null ? null : <LoopEdge at={end} edge="end" />}
    </View>
  );
}

interface HandleProps {
  readonly at: number;
  readonly edge: ScrubEdge;
  readonly low: number;
  readonly high: number;
  readonly geometry: LoopGeometry;
  readonly handles: LoopHandles;
}

function useHandlePan({ at, edge, low, high, geometry, handles }: HandleProps) {
  const drag = geometry[edge];
  const { bar } = geometry;
  const { onMoveLoopEdge } = handles;
  const settle = useCallback(
    async (fraction: number) => {
      await onMoveLoopEdge(edge, fraction);
      drag.value = NOT_DRAGGING;
    },
    [onMoveLoopEdge, edge, drag],
  );
  const commit = useCallback(
    (fraction: number) => {
      void settle(fraction);
    },
    [settle],
  );
  return Gesture.Pan()
    .activeOffsetX([-sliderGeometry.dragSlop, sliderGeometry.dragSlop])
    .onUpdate((event) => {
      const { width } = bar.value;
      if (width <= 0) return;
      drag.value = Math.min(
        high,
        Math.max(low, at + event.translationX / width),
      );
    })
    .onEnd((_, success) => {
      if (success && drag.value !== NOT_DRAGGING)
        scheduleOnRN(commit, drag.value);
    })
    .onFinalize((_, success) => {
      if (!success) drag.value = NOT_DRAGGING;
    });
}

function Handle(props: HandleProps) {
  const styles = useStyles();
  const { at, edge, geometry, handles } = props;
  const drag = geometry[edge];
  const { bar, lane } = geometry;
  const { onStepLoopEdge } = handles;
  const pan = useHandlePan(props);
  useLayoutEffect(() => {
    drag.value = NOT_DRAGGING;
  }, [at, drag]);
  const onAction = useCallback(
    (event: AccessibilityActionEvent) => {
      onStepLoopEdge(
        edge,
        event.nativeEvent.actionName === 'increment' ? 1 : -1,
      );
    },
    [onStepLoopEdge, edge],
  );
  const hitStyle = useAnimatedStyle(() => {
    const frame = loopHandleFrame(
      edge,
      shownAt(drag, at),
      bar.value,
      lane.value,
    );
    return {
      transform: [{ translateX: frame.left }, { translateY: frame.top }],
    };
  });
  const flagStyle = useAnimatedStyle(() => {
    const frame = loopHandleFrame(
      edge,
      shownAt(drag, at),
      bar.value,
      lane.value,
    );
    return {
      transform: [
        { translateX: frame.flagLeft },
        { translateY: frame.flagTop },
      ],
    };
  });
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        testID={`loop-handle-${edge}`}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={EDGE_LABELS[edge]}
        accessibilityValue={{ text: handles.spokenEdge(edge) }}
        accessibilityActions={EDGE_ACTIONS}
        onAccessibilityAction={onAction}
        style={[styles.handle, hitStyle]}
      >
        <Animated.View style={[styles.flag, styles.handleFlag, flagStyle]}>
          <Text style={styles.flagText}>{EDGE_LETTERS[edge]}</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

interface LoopHandleLayerProps {
  readonly marks: ScrubMarks | null;
  readonly handles: LoopHandles | undefined;
  readonly geometry: LoopGeometry;
}

export function LoopHandleLayer({
  marks,
  handles,
  geometry,
}: LoopHandleLayerProps) {
  const styles = useStyles();
  if (handles === undefined || marks === null) return null;
  const { start, end } = marks;
  if (end === null) return null;
  const shared = { geometry, handles };
  return (
    <View testID="loop-handles" pointerEvents="box-none" style={styles.cover}>
      <Handle at={start} edge="start" low={0} high={end} {...shared} />
      <Handle at={end} edge="end" low={start} high={1} {...shared} />
    </View>
  );
}
