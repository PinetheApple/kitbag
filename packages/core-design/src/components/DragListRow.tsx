import { useCallback, useLayoutEffect, useMemo } from 'react';
import {
  Text,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  inset,
  radius,
  size,
  space,
  textRoles,
  type IconSize,
} from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp, type ColorToken } from '../tokens.ts';
import { dropTarget, NO_DRAG, reorderTarget } from '../dragReorder.ts';
import { Icon } from './Icon.tsx';
import {
  RowPress,
  usePlainRowStyles,
  type PlainListRowProps,
} from './PlainListRow.tsx';
import { useSheetContentLive } from './sheetContentLive.ts';
import { SwipeDeleteRow } from './SwipeDeleteRow.tsx';

const HANDLE_HIT_SLOP = { top: inset.rowV, bottom: inset.rowV };
const DRAGGING_Z = 1;

export interface DragHandleLook {
  readonly size: IconSize;
  readonly color: ColorToken;
}

const LIST_HANDLE: DragHandleLook = { size: 'control', color: 'decor' };

const useStyles = createThemedStyles((theme) => ({
  handle: {
    width: minTouchTargetDp,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  index: {
    ...textStyle(textRoles.dragIndex),
    color: theme.color.text3,
    width: size.dragIndex,
  },
}));

export interface DragGroup {
  readonly from: SharedValue<number>;
  readonly target: SharedValue<number>;
  readonly pitch: SharedValue<number>;
}

// Rows sharing a group make room for the dragged row as it moves. A drop holds
// the shifted layout until `order` changes, so rows never flash back first.
export function useDragGroup(order: unknown): DragGroup {
  const from = useSharedValue(NO_DRAG);
  const target = useSharedValue(NO_DRAG);
  const pitch = useSharedValue(0);
  useLayoutEffect(() => {
    from.value = NO_DRAG;
    target.value = NO_DRAG;
  }, [order, from, target]);
  return useMemo(() => ({ from, target, pitch }), [from, target, pitch]);
}

export interface DragReorder {
  readonly index: number;
  readonly count: number;
  readonly onMove: (from: number, to: number) => void;
  readonly onDragActive?: (active: boolean) => void;
  readonly group?: DragGroup;
}

export function useHandleDrag(reorder: DragReorder) {
  const offset = useSharedValue(0);
  const pitch = useSharedValue(0);
  const moved = useSharedValue(false);
  const live = useSheetContentLive();
  const { index, count, onMove, onDragActive, group } = reorder;
  useLayoutEffect(() => {
    offset.value = 0;
  }, [index, offset]);
  const settleRow = () => {
    'worklet';
    if (group !== undefined && moved.value) return;
    offset.value = 0;
    if (group !== undefined) group.from.value = NO_DRAG;
  };
  useAnimatedReaction(
    () => live.value,
    (now, previous) => {
      if (!now || previous !== false) return;
      settleRow();
    },
  );
  const pan = usePanGesture({
    hitSlop: HANDLE_HIT_SLOP,
    onBegin: () => {
      moved.value = false;
      if (onDragActive !== undefined) scheduleOnRN(onDragActive, true);
    },
    onActivate: () => {
      if (group === undefined || !live.value) return;
      group.from.value = index;
      group.target.value = index;
      group.pitch.value = pitch.value;
    },
    onUpdate: (event) => {
      if (!live.value) return;
      offset.value = event.translationY;
      if (group === undefined) return;
      group.target.value = reorderTarget(
        index,
        event.translationY,
        pitch.value,
        count,
      );
    },
    onDeactivate: (event) => {
      const to = dropTarget(
        index,
        event.translationY,
        pitch.value,
        count,
        !event.canceled,
      );
      if (to === null) return;
      moved.value = true;
      scheduleOnRN(onMove, index, to);
    },
    onFinalize: () => {
      if (onDragActive !== undefined) scheduleOnRN(onDragActive, false);
      if (!live.value) return;
      settleRow();
    },
  });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    zIndex: offset.value === 0 ? 0 : DRAGGING_Z,
  }));
  const onLayout = (event: LayoutChangeEvent) => {
    pitch.value = event.nativeEvent.layout.height + space.controlGap;
  };
  return { pan, style, onLayout, offset };
}

function useHandleActions(reorder: DragReorder) {
  const { index, count, onMove } = reorder;
  return useCallback(
    (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName;
      if (name === 'decrement' && index > 0) onMove(index, index - 1);
      if (name === 'increment' && index + 1 < count) onMove(index, index + 1);
    },
    [index, count, onMove],
  );
}

interface HandleProps {
  readonly reorder: DragReorder;
  readonly look: DragHandleLook;
}

function Handle({ reorder, look }: HandleProps) {
  const styles = useStyles();
  const onAction = useHandleActions(reorder);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Reorder, position ${String(reorder.index + 1)} of ${String(reorder.count)}`}
      accessibilityActions={[
        { name: 'increment', label: 'Move later' },
        { name: 'decrement', label: 'Move earlier' },
      ]}
      onAccessibilityAction={onAction}
      style={styles.handle}
    >
      <Icon name="dragHandle" size={look.size} color={look.color} />
    </View>
  );
}

export interface DragRowSwipe {
  readonly label: string;
  readonly onRemove: () => Promise<boolean>;
}

export interface DragListRowProps extends PlainListRowProps {
  readonly reorder: DragReorder;
  readonly swipe?: DragRowSwipe;
  readonly handle?: DragHandleLook;
}

export function DragListRow(props: DragListRowProps) {
  const styles = useStyles();
  const row = usePlainRowStyles();
  const drag = useHandleDrag(props.reorder);
  const rowStyle = [row.row, props.active === true && row.active];
  const content = (
    <>
      <GestureDetector gesture={drag.pan}>
        <Handle reorder={props.reorder} look={props.handle ?? LIST_HANDLE} />
      </GestureDetector>
      <Text style={styles.index}>{props.reorder.index + 1}</Text>
      <RowPress {...props} />
    </>
  );
  if (props.swipe === undefined)
    return (
      <Animated.View onLayout={drag.onLayout} style={[rowStyle, drag.style]}>
        {content}
      </Animated.View>
    );
  // The swipe clips its row, so the drag moves the wrapper rather than the row.
  return (
    <Animated.View onLayout={drag.onLayout} style={drag.style}>
      <SwipeDeleteRow
        side="left"
        tone="tint"
        radius={radius.row}
        deleteLabel={props.swipe.label}
        onDelete={props.swipe.onRemove}
      >
        <View style={rowStyle}>{content}</View>
      </SwipeDeleteRow>
    </Animated.View>
  );
}
